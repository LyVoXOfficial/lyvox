-- PERF-001: Additional performance indexes for critical queries
-- This migration adds indexes to optimize common query patterns identified in performance analysis

-- 1. Index for user's adverts queries (profile page, user page)
-- Common pattern: WHERE user_id = ? ORDER BY created_at DESC
create index if not exists adverts_user_id_created_at_idx 
  on public.adverts(user_id, created_at desc)
  where status = 'active';

-- 2. Index for status filtering (very common in all queries)
-- Common pattern: WHERE status = 'active'
create index if not exists adverts_status_idx 
  on public.adverts(status)
  where status = 'active';

-- 3. Index for price sorting (when filtering by category or status)
-- Common pattern: ORDER BY price ASC/DESC
create index if not exists adverts_price_idx 
  on public.adverts(price)
  where status = 'active' and price is not null;

-- 4. Composite index for category + price sorting
-- Common pattern: WHERE category_id = ? AND status = 'active' ORDER BY price
create index if not exists adverts_category_price_idx 
  on public.adverts(category_id, price)
  where status = 'active' and price is not null;

-- 5. Index for profiles verification status (used in search_adverts verified_only filter)
-- Common pattern: WHERE verified_email = true AND verified_phone = true
create index if not exists profiles_verified_idx 
  on public.profiles(verified_email, verified_phone)
  where verified_email = true and verified_phone = true;

-- 6. Index for media.advert_id (used when loading advert media)
-- Common pattern: WHERE advert_id = ? ORDER BY sort
create index if not exists media_advert_id_sort_idx 
  on public.media(advert_id, sort);

-- 7. Index for trust_score.user_id (if not exists from previous migrations)
-- Common pattern: WHERE user_id = ?
create index if not exists trust_score_user_id_idx 
  on public.trust_score(user_id);

-- 8. Index for location text search (partial, for ILIKE queries)
-- Note: ILIKE '%...%' cannot use B-tree indexes efficiently, but we can optimize with trigram
-- This helps with location text matching in search_adverts
create index if not exists adverts_location_trgm_idx 
  on public.adverts 
  using gin(location gin_trgm_ops)
  where location is not null and status = 'active';

-- 9. Index for favorites with advert join optimization
-- Common pattern: JOIN favorites ON advert_id = adverts.id WHERE user_id = ?
-- The existing favorites_advert_id_idx should help, but we ensure it exists
create index if not exists favorites_advert_id_user_id_idx 
  on public.favorites(advert_id, user_id);

-- 10. Index for adverts with location_id (for geospatial queries)
-- Common pattern: JOIN locations ON location_id = locations.id
create index if not exists adverts_location_id_idx 
  on public.adverts(location_id)
  where location_id is not null;

-- Add comments for documentation
comment on index public.adverts_user_id_created_at_idx is 'Index for user adverts queries ordered by creation date';
comment on index public.adverts_status_idx is 'Partial index for active adverts filtering';
comment on index public.adverts_price_idx is 'Partial index for price sorting on active adverts';
comment on index public.adverts_category_price_idx is 'Composite index for category filtering with price sorting';
comment on index public.profiles_verified_idx is 'Partial index for verified sellers (verified_only filter)';
comment on index public.media_advert_id_sort_idx is 'Index for loading media ordered by sort';
comment on index public.adverts_location_trgm_idx is 'Trigram index for location text search';
comment on index public.favorites_advert_id_user_id_idx is 'Composite index for favorites with advert joins';

-- Analyze tables to update statistics (helps query planner)
analyze public.adverts;
analyze public.profiles;
analyze public.media;
analyze public.favorites;
analyze public.trust_score;

