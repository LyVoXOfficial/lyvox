-- F11: Dedup advert_views + close open anon-insert
--
-- Problems fixed:
--   1. Repeated views by the same actor inflate view counts, rankings, trust.
--   2. RLS allowed anyone (anon/authenticated) to INSERT directly, bypassing the
--      API's rate-limit and dedup logic.
--   3. get_advert_view_count() and top_sellers.avg_views used raw (undeduplicated) rows.
--
-- Strategy: add viewer_key (actor fingerprint) + view_hour (1-hour epoch bucket),
-- unique-index on (advert_id, viewer_key, view_hour) so ON CONFLICT DO NOTHING
-- is the enforcement mechanism. Inserts now go through the API (service-role only).

-- 1. Add columns used for dedup
ALTER TABLE public.advert_views
  ADD COLUMN IF NOT EXISTS viewer_key  text,
  ADD COLUMN IF NOT EXISTS view_hour   bigint;

-- 2. Backfill existing rows
--    Authenticated  → viewer_key = 'user:<user_id>'
--    Anonymous+IP   → viewer_key = 'ip:<md5(host(ip_address))>'   (md5 for privacy)
--    Neither        → viewer_key = 'unknown' (unidentifiable; excluded from dedup counts)
UPDATE public.advert_views
SET
  viewer_key = CASE
    WHEN user_id    IS NOT NULL THEN 'user:' || user_id::text
    WHEN ip_address IS NOT NULL THEN 'ip:'   || md5(host(ip_address))
    ELSE 'unknown'
  END,
  view_hour  = FLOOR(EXTRACT(EPOCH FROM viewed_at) / 3600)::bigint
WHERE viewer_key IS NULL;

-- 3. Set sensible defaults so future rows (before the app sets them explicitly)
--    still land safely instead of violating NOT NULL (which we'll add later with gen:types).
ALTER TABLE public.advert_views
  ALTER COLUMN viewer_key SET DEFAULT 'unknown',
  ALTER COLUMN view_hour  SET DEFAULT 0;

-- 4. Dedup unique index — the source of truth for "one view per actor per advert per hour"
--    ON CONFLICT (advert_id, viewer_key, view_hour) DO NOTHING  ← used by the API route
CREATE UNIQUE INDEX IF NOT EXISTS advert_views_dedup_idx
  ON public.advert_views(advert_id, viewer_key, view_hour);

-- 5. Close the open anon INSERT policy — direct DB inserts are no longer allowed.
--    The API route now uses service-role (bypasses RLS) to insert deduped rows.
DROP POLICY IF EXISTS "anon_insert_advert_views"           ON public.advert_views;
DROP POLICY IF EXISTS "authenticated_insert_advert_views"  ON public.advert_views;

-- 6. Replace get_advert_view_count to return deduplicated count.
--    After the migration each row represents one distinct (actor, hour) view,
--    so COUNT(*) WHERE viewer_key != 'unknown' is the deduplicated count.
CREATE OR REPLACE FUNCTION public.get_advert_view_count(advert_id_param uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
  FROM public.advert_views
  WHERE advert_id  = advert_id_param
    AND viewer_key IS NOT NULL
    AND viewer_key  != 'unknown';
$$;

COMMENT ON FUNCTION public.get_advert_view_count IS
  'Returns deduplicated view count (one per actor per advert per hour). F11.';

-- 7. Recreate top_sellers materialized view to use deduplicated view counts.
--    DROP + CREATE because PostgreSQL does not allow ALTER MATERIALIZED VIEW to
--    change column definitions.  The unique index on id is also recreated.
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
  COALESCE(AVG(av.view_count), 0) AS avg_views
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
  p.created_at, p.total_deals, p.rating, ts.score
HAVING COUNT(DISTINCT a.id) > 0
ORDER BY
  (COALESCE(ts.score, 0) * 0.4 + p.total_deals * 10 * 0.3 + COALESCE(AVG(av.view_count), 0) * 0.3) DESC
LIMIT 1000;

-- Restore unique index needed for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS top_sellers_id_idx ON public.top_sellers(id);

-- Restore refresh helper function
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
  'Top 1000 sellers ranked by trust/deals/deduplicated-views. Refresh periodically. F11.';
COMMENT ON FUNCTION public.refresh_top_sellers IS
  'Refreshes the top_sellers materialized view. Call periodically (e.g. hourly).';
