-- Reviews & ratings (chat-gated). A reviewer may review a seller for a listing only if they had a
-- conversation about that listing (contact-only marketplace has no transaction to gate on; the gate lives
-- in create_review() so the founder can tighten it later in one place).

begin;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (advert_id, reviewer_id)
);
create index if not exists reviews_subject_idx on public.reviews(subject_id);

alter table public.reviews enable row level security;

-- Reviews are public to read.
create policy reviews_public_read on public.reviews for select using (true);
-- No INSERT policy for normal roles: inserts go ONLY through create_review() (SECURITY DEFINER), which gates.
-- Owner may edit/delete their own review.
create policy reviews_owner_update on public.reviews for update using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy reviews_owner_delete on public.reviews for delete using (reviewer_id = auth.uid());

-- Column-lock lesson: by default authenticated/anon get table-wide INSERT/UPDATE. Force INSERT through the rpc;
-- restrict UPDATE to rating/comment only (never reviewer_id/subject_id/advert_id).
revoke insert on public.reviews from authenticated, anon;
revoke update on public.reviews from authenticated, anon;
grant update (rating, comment) on public.reviews to authenticated;

-- Gated review creation. Uses auth.uid() (not a caller-supplied id) -> safe to grant to authenticated.
create or replace function public.create_review(p_advert_id uuid, p_rating int, p_comment text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reviewer uuid := auth.uid();
  v_subject uuid;
  v_id uuid;
begin
  if v_reviewer is null then raise exception 'auth required' using errcode = 'P0001'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'INVALID_RATING' using errcode = 'P0001'; end if;

  select user_id into v_subject from public.adverts where id = p_advert_id;
  if v_subject is null then raise exception 'ADVERT_NOT_FOUND' using errcode = 'P0001'; end if;
  if v_subject = v_reviewer then raise exception 'CANNOT_REVIEW_SELF' using errcode = 'P0001'; end if;

  -- CHAT GATE: the reviewer must have participated in a conversation about this advert.
  if not exists (
    select 1 from public.conversations c
    join public.conversation_participants cp on cp.conversation_id = c.id
    where c.advert_id = p_advert_id and cp.user_id = v_reviewer
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

-- Keep profiles.rating fresh (cache of the subject's average review). SECURITY DEFINER bypasses the
-- profiles column-lock; runs on any review change.
create or replace function public.refresh_seller_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_subject uuid := coalesce(NEW.subject_id, OLD.subject_id);
begin
  update public.profiles
    set rating = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where subject_id = v_subject), 5.0)
    where id = v_subject;
  return null;
end;
$$;

drop trigger if exists trg_refresh_seller_rating on public.reviews;
create trigger trg_refresh_seller_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_seller_rating();

commit;
