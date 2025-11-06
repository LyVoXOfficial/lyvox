-- Views, Favorites and Top Sellers migration
-- Creates tables for tracking advert views, user favorites, and materialized view for top sellers

-- 1. Advert Views Table - track page views for each advert
CREATE TABLE IF NOT EXISTS public.advert_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advert_id uuid NOT NULL REFERENCES public.adverts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address inet,
  user_agent text,
  viewed_at timestamptz DEFAULT now()
);

-- Indexes for advert_views
CREATE INDEX IF NOT EXISTS advert_views_advert_id_idx ON public.advert_views(advert_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS advert_views_user_id_idx ON public.advert_views(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS advert_views_viewed_at_idx ON public.advert_views(viewed_at DESC);

-- 2. Favorites Table - user bookmarks for adverts
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advert_id uuid NOT NULL REFERENCES public.adverts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, advert_id)
);

-- Indexes for favorites
CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON public.favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_advert_id_idx ON public.favorites(advert_id);

-- 3. Add seller stats columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_deals integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 5.0;

-- 4. Materialized View for Top Sellers
-- This is calculated based on trust_score, total_deals, and recent activity
CREATE MATERIALIZED VIEW IF NOT EXISTS public.top_sellers AS
SELECT 
  p.id,
  p.display_name,
  p.verified_email,
  p.verified_phone,
  p.created_at,
  p.total_deals,
  p.rating,
  COALESCE(ts.score, 0) as trust_score,
  COUNT(DISTINCT a.id) as active_adverts,
  COALESCE(AVG(av.view_count), 0) as avg_views
FROM public.profiles p
LEFT JOIN public.trust_score ts ON ts.user_id = p.id
LEFT JOIN public.adverts a ON a.user_id = p.id AND a.status = 'active'
LEFT JOIN (
  SELECT advert_id, COUNT(*) as view_count
  FROM public.advert_views
  WHERE viewed_at > NOW() - INTERVAL '30 days'
  GROUP BY advert_id
) av ON av.advert_id = a.id
WHERE 
  p.verified_email = true 
  AND p.verified_phone = true
  AND (COALESCE(ts.score, 0) > 10 OR p.total_deals > 0)
GROUP BY p.id, p.display_name, p.verified_email, p.verified_phone, p.created_at, p.total_deals, p.rating, ts.score
HAVING COUNT(DISTINCT a.id) > 0
ORDER BY 
  (COALESCE(ts.score, 0) * 0.4 + p.total_deals * 10 * 0.3 + COALESCE(AVG(av.view_count), 0) * 0.3) DESC
LIMIT 1000;

-- Create unique index on top_sellers for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS top_sellers_id_idx ON public.top_sellers(id);

-- 5. Function to refresh top_sellers materialized view
CREATE OR REPLACE FUNCTION public.refresh_top_sellers() 
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.top_sellers;
END;
$$;

-- Comment on function
COMMENT ON FUNCTION public.refresh_top_sellers IS 'Refreshes the top_sellers materialized view. Should be called periodically (e.g., hourly via cron)';

-- 6. RLS Policies for advert_views
ALTER TABLE public.advert_views ENABLE ROW LEVEL SECURITY;

-- Everyone can read view counts (for display)
CREATE POLICY "public_read_advert_views" ON public.advert_views 
  FOR SELECT 
  USING (true);

-- Authenticated users can insert views (we'll track in API)
CREATE POLICY "authenticated_insert_advert_views" ON public.advert_views 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Anonymous users can also insert views (for tracking)
CREATE POLICY "anon_insert_advert_views" ON public.advert_views 
  FOR INSERT 
  TO anon 
  WITH CHECK (true);

-- 7. RLS Policies for favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own favorites
CREATE POLICY "user_manage_own_favorites" ON public.favorites 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Everyone can read favorites count (for display)
CREATE POLICY "public_read_favorites" ON public.favorites 
  FOR SELECT 
  USING (true);

-- 8. Helper function to get view count for an advert
CREATE OR REPLACE FUNCTION public.get_advert_view_count(advert_id_param uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*) 
  FROM public.advert_views 
  WHERE advert_id = advert_id_param;
$$;

-- 9. Helper function to get favorite count for an advert
CREATE OR REPLACE FUNCTION public.get_advert_favorite_count(advert_id_param uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*) 
  FROM public.favorites 
  WHERE advert_id = advert_id_param;
$$;

-- 10. Helper function to check if user favorited an advert
CREATE OR REPLACE FUNCTION public.is_favorited(advert_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 
    FROM public.favorites 
    WHERE advert_id = advert_id_param AND user_id = user_id_param
  );
$$;

-- Comments
COMMENT ON TABLE public.advert_views IS 'Tracks page views for adverts (for analytics and top adverts)';
COMMENT ON TABLE public.favorites IS 'User bookmarks/favorites for adverts';
COMMENT ON MATERIALIZED VIEW public.top_sellers IS 'Top 1000 sellers ranked by trust score, deals, and activity (refresh periodically)';
COMMENT ON FUNCTION public.get_advert_view_count IS 'Returns total view count for an advert';
COMMENT ON FUNCTION public.get_advert_favorite_count IS 'Returns total favorite count for an advert';
COMMENT ON FUNCTION public.is_favorited IS 'Checks if a user has favorited an advert';

