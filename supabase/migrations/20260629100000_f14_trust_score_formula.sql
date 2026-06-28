-- F14: Trust-score formula — Bayesian rating + anti-stacking review gate
--
-- What this migration does:
--   1. Extend trust_score with components (jsonb breakdown), bayesian_rating, last_computed_at.
--   2. Replace refresh_seller_rating() to also write bayesian_rating into trust_score.
--      Bayesian rating is the one formula piece that is naturally DB-resident
--      (it is review-event-driven). The full trust-score formula lives in TypeScript
--      (lib/trust/trustScore.ts) — single source of truth, covered by vitest.
--   3. Anti-stacking check in create_review(): one review per buyer–seller pair.
--      We do NOT add UNIQUE(reviewer_id, subject_id) here because:
--        a. Existing rows may conflict and we must not DELETE data (project policy).
--        b. The application-level EXISTS guard is sufficient for a new platform.
--      The DB-level constraint is tracked in §13 as a future hardening step.
--   4. Backfill bayesian_rating for sellers who already have reviews.

begin;

-- 1. Extend trust_score
alter table public.trust_score
  add column if not exists components       jsonb,
  add column if not exists bayesian_rating  numeric(4, 2) not null default 3.5,
  add column if not exists last_computed_at timestamptz;

comment on column public.trust_score.components is
  'JSON breakdown {identity, activity, deals, riskPenalty, total} from computeTrustScore() — written by server-side job. F14.';
comment on column public.trust_score.bayesian_rating is
  'Bayesian-smoothed seller rating: (5×3.5 + sum_ratings)/(5+n). Updated by trg_refresh_seller_rating. F14.';
comment on column public.trust_score.last_computed_at is
  'Timestamp when the full trust score was last computed by the server-side job. NULL = not yet run. F14.';

-- 2. Replace refresh_seller_rating() to also maintain trust_score.bayesian_rating.
--    profiles.rating (raw avg) is kept for backward compat with existing consumers.
create or replace function public.refresh_seller_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subject  uuid    := coalesce(NEW.subject_id, OLD.subject_id);
  v_count    int;
  v_sum      numeric;
  v_raw_avg  numeric;
  v_bayes    numeric;
  -- Bayesian prior constants — must match trustScore.ts defaults.
  m constant numeric := 5;   -- priorWeight
  c constant numeric := 3.5; -- globalAvg
begin
  select count(*), coalesce(sum(rating), 0)
    into v_count, v_sum
    from public.reviews
   where subject_id = v_subject;

  v_raw_avg := case when v_count > 0 then round(v_sum / v_count, 2) else 5.0 end;
  v_bayes   := round((m * c + v_sum) / (m + v_count), 2);

  -- Keep profiles.rating (raw average — backward-compat)
  update public.profiles
    set rating = v_raw_avg
   where id = v_subject;

  -- Upsert Bayesian rating into trust_score; set_updated_at trigger handles updated_at.
  insert into public.trust_score (user_id, bayesian_rating)
    values (v_subject, v_bayes)
    on conflict (user_id)
    do update set bayesian_rating = excluded.bayesian_rating;

  return null;
end;
$$;

-- Rewire trigger (safe: drop+create is idempotent)
drop trigger if exists trg_refresh_seller_rating on public.reviews;
create trigger trg_refresh_seller_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_seller_rating();

-- 3. Anti-stacking: one review per buyer–seller pair across ALL adverts.
--    Replaces create_review() with added EXISTS check before the INSERT.
create or replace function public.create_review(p_advert_id uuid, p_rating int, p_comment text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reviewer uuid := auth.uid();
  v_subject  uuid;
  v_id       uuid;
begin
  if v_reviewer is null then raise exception 'auth required' using errcode = 'P0001'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'INVALID_RATING' using errcode = 'P0001'; end if;

  select user_id into v_subject from public.adverts where id = p_advert_id;
  if v_subject is null then raise exception 'ADVERT_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_subject = v_reviewer then raise exception 'CANNOT_REVIEW_SELF' using errcode = 'P0001'; end if;

  -- F14 anti-stacking: one review per buyer–seller pair regardless of which advert.
  -- A UNIQUE(reviewer_id, subject_id) constraint is a future hardening step (§13).
  if exists (
    select 1 from public.reviews
    where reviewer_id = v_reviewer and subject_id = v_subject
  ) then
    raise exception 'ALREADY_REVIEWED' using errcode = 'P0001';
  end if;

  -- CHAT GATE (anti-forge): both reviewer and seller must be participants in a
  -- conversation about this specific advert. RLS prevents forging the seller's presence.
  if not exists (
    select 1 from public.conversations c
    join public.conversation_participants cp_r on cp_r.conversation_id = c.id and cp_r.user_id = v_reviewer
    join public.conversation_participants cp_s on cp_s.conversation_id = c.id and cp_s.user_id = v_subject
    where c.advert_id = p_advert_id
  ) then
    raise exception 'NO_CONVERSATION' using errcode = 'P0001';
  end if;

  insert into public.reviews (advert_id, reviewer_id, subject_id, rating, comment)
    values (p_advert_id, v_reviewer, v_subject, p_rating, nullif(trim(p_comment), ''))
    returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'ALREADY_REVIEWED' using errcode = 'P0001';
end;
$$;

revoke execute on function public.create_review(uuid, int, text) from public, anon;
grant execute on function public.create_review(uuid, int, text) to authenticated;

-- 4. Backfill bayesian_rating for sellers who already have reviews.
insert into public.trust_score (user_id, bayesian_rating)
  select
    subject_id,
    round((5.0 * 3.5 + sum(rating)) / (5.0 + count(*)), 2)
  from public.reviews
  group by subject_id
  on conflict (user_id)
  do update set bayesian_rating = excluded.bayesian_rating;

commit;
