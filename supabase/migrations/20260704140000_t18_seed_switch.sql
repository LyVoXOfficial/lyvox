-- T18 (LAUNCH-GATE): Seed switch.
--
-- Builds the *mechanism* to exclude seed/demo accounts from aggregates /
-- social-proof / structured-data counts — this is NOT a purge. Seed content
-- stays a visible showcase until the founder flips the app-level env flag
-- EXCLUDE_SEED_FROM_AGGREGATES=true at launch.
--
-- Idempotent. With the app flag OFF (default) behaviour is byte-for-byte the
-- current showcase: the only DB-visible changes are a new profiles.is_seed
-- column (default false) and an is_seed column on the top_sellers MV that
-- callers ignore unless they opt in.

-- 1. Durable seed marker on profiles (previously seed was identified only by the
--    @lyvox-seed.be auth email domain). NOT NULL DEFAULT false → real accounts
--    are non-seed by construction. Deliberately NOT added to the authenticated
--    UPDATE column-grant (last set in 20260629230000_discover_prefs.sql), so
--    users cannot flip their own is_seed — writes stay server/seeder-only.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_seed IS
  'True for seeded demo/showcase accounts (T18). Excluded from aggregates when the app flag EXCLUDE_SEED_FROM_AGGREGATES is on. Never user-writable.';

-- 2. Backfill the existing seed cohort from the @lyvox-seed.be auth domain.
--    Guarded by is_seed = false so re-runs are cheap no-ops.
UPDATE public.profiles p
SET is_seed = true
WHERE p.is_seed = false
  AND p.id IN (
    SELECT u.id FROM auth.users u WHERE u.email LIKE '%@lyvox-seed.be'
  );

-- 3. estimate_price: add an opt-in p_exclude_seed parameter (default false).
--    DROP + CREATE because the signature changes; the sole caller
--    (apps/web/src/app/api/price-suggestion) is updated to pass the flag.
--    Default false keeps existing 2-arg calls byte-for-byte. Seed rows are
--    dropped from the median/IQR sample only when the caller opts in; orphan
--    ads (no matching profile) are still counted in both modes.
DROP FUNCTION IF EXISTS public.estimate_price(uuid, text);
DROP FUNCTION IF EXISTS public.estimate_price(uuid, text, boolean);

create function public.estimate_price(
  p_category_id uuid,
  p_condition text default null,
  p_exclude_seed boolean default false
)
returns table (
  sample_size int,
  p25 numeric,
  median numeric,
  p75 numeric,
  backoff_level text
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_category_path text;
  v_parent_path text;
  v_condition text := nullif(btrim(p_condition), '');
  v_level text;
  v_path text;
  v_filter_condition boolean;
  v_sample_size int := 0;
  v_p25 numeric;
  v_median numeric;
  v_p75 numeric;
  v_last_level text := 'category';
begin
  select c.path, parent.path
  into v_category_path, v_parent_path
  from public.categories c
  left join public.categories parent on parent.id = c.parent_id
  where c.id = p_category_id
    and c.is_active = true;

  if v_category_path is null then
    sample_size := 0;
    p25 := null;
    median := null;
    p75 := null;
    backoff_level := 'unsupported_category';
    return next;
    return;
  end if;

  for v_level, v_path, v_filter_condition in
    select level_name, path_prefix, condition_scoped
    from (
      values
        ('category_condition'::text, v_category_path, v_condition is not null),
        ('category'::text, v_category_path, false),
        ('parent_category'::text, v_parent_path, false)
    ) as levels(level_name, path_prefix, condition_scoped)
  loop
    continue when v_path is null;
    continue when v_level = 'category_condition' and not v_filter_condition;

    select
      count(*)::int,
      (percentile_cont(0.25) within group (order by scoped.price_value))::numeric,
      (percentile_cont(0.5) within group (order by scoped.price_value))::numeric,
      (percentile_cont(0.75) within group (order by scoped.price_value))::numeric
    into v_sample_size, v_p25, v_median, v_p75
    from (
      select a.price::numeric as price_value
      from public.adverts a
      join public.categories c on c.id = a.category_id
      left join public.profiles p on p.id = a.user_id
      where (c.path = v_path or c.path like v_path || '/%')
        and a.status = 'active'
        and coalesce(a.moderation_status, 'approved') not in ('rejected', 'flagged')
        and a.price is not null
        and a.price > 0
        and (not v_filter_condition or a.condition = v_condition)
        and (p.id is null or p.blocked_until is null or p.blocked_until <= now())
        -- T18 launch-gate: drop seed/demo accounts when the caller opts in.
        -- coalesce → orphan ads (no profile) are kept in both modes.
        and (not p_exclude_seed or not coalesce(p.is_seed, false))
    ) scoped;

    v_last_level := v_level;

    if v_sample_size >= 8 then
      sample_size := v_sample_size;
      p25 := v_p25;
      median := v_median;
      p75 := v_p75;
      backoff_level := v_level;
      return next;
      return;
    end if;
  end loop;

  sample_size := coalesce(v_sample_size, 0);
  p25 := null;
  median := null;
  p75 := null;
  backoff_level := v_last_level;
  return next;
end;
$$;

comment on function public.estimate_price(uuid, text, boolean) is
  'Internal service-role-only median/IQR price estimator with category/parent backoff. Returns null quantiles below n=8. p_exclude_seed drops seeded/demo accounts (T18).';

revoke execute on function public.estimate_price(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.estimate_price(uuid, text, boolean) to service_role;

-- 4. top_sellers MV: carry p.is_seed so the API can filter seed sellers out at
--    query time (runtime-flippable via env, no rebuild). Definition is
--    otherwise identical to F11 (20260629000000). DROP + CREATE because
--    PostgreSQL cannot ALTER a materialized view's column set.
DROP MATERIALIZED VIEW IF EXISTS public.top_sellers;

CREATE MATERIALIZED VIEW public.top_sellers AS
SELECT
  p.id,
  p.display_name,
  p.verified_email,
  p.verified_phone,
  p.created_at,
  p.total_deals,
  p.rating,
  COALESCE(ts.score, 0)           AS trust_score,
  COUNT(DISTINCT a.id)            AS active_adverts,
  COALESCE(AVG(av.view_count), 0) AS avg_views,
  p.is_seed
FROM public.profiles p
LEFT JOIN public.trust_score ts ON ts.user_id = p.id
LEFT JOIN public.adverts a
       ON a.user_id = p.id AND a.status = 'active'
LEFT JOIN (
  -- Deduplicated: each row already represents one unique (actor, hour) view
  SELECT advert_id, COUNT(*) AS view_count
  FROM public.advert_views
  WHERE viewed_at   > NOW() - INTERVAL '30 days'
    AND viewer_key IS NOT NULL
    AND viewer_key  != 'unknown'
  GROUP BY advert_id
) av ON av.advert_id = a.id
WHERE
  p.verified_email = true
  AND p.verified_phone = true
  AND (COALESCE(ts.score, 0) > 10 OR p.total_deals > 0)
GROUP BY
  p.id, p.display_name, p.verified_email, p.verified_phone,
  p.created_at, p.total_deals, p.rating, ts.score, p.is_seed
HAVING COUNT(DISTINCT a.id) > 0
ORDER BY
  (COALESCE(ts.score, 0) * 0.4 + p.total_deals * 10 * 0.3 + COALESCE(AVG(av.view_count), 0) * 0.3) DESC
LIMIT 1000;

-- Restore unique index needed for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS top_sellers_id_idx ON public.top_sellers(id);

-- Restore refresh helper (unchanged; recreated for parity after DROP)
CREATE OR REPLACE FUNCTION public.refresh_top_sellers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.top_sellers;
END;
$$;

COMMENT ON MATERIALIZED VIEW public.top_sellers IS
  'Top 1000 sellers ranked by trust/deals/deduplicated-views. Carries is_seed for T18 aggregate-exclusion. Refresh periodically.';
COMMENT ON FUNCTION public.refresh_top_sellers IS
  'Refreshes the top_sellers materialized view. Call periodically (e.g. hourly).';
