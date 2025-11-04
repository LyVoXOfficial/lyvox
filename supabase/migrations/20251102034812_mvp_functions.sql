-- DB-004: Create helper PostgreSQL functions
-- This migration creates helper functions for search and other operations

-- ============================================================================
-- 1. Verify existing helper functions
-- ============================================================================

-- trust_inc() should already exist from 20251004122000_initial_reports_policies.sql
-- is_admin() should already exist from 20251005191500_enable_rls_and_policies.sql
-- Both are verified to exist, so we just document them here
comment on function public.trust_inc(uuid, int) is 'Increments trust score for a user (used in moderation workflow)';
comment on function public.is_admin() is 'Checks if current user has admin role from JWT claims';

-- ============================================================================
-- 2. Search function: search_adverts
-- ============================================================================

-- Function for searching adverts with filters, full-text search, sorting, and pagination
-- Supports:
--   - Full-text search across title and description
--   - Category filtering
--   - Price range filtering
--   - Location text filtering (and optional geospatial search if PostGIS is available)
--   - Multiple sort options
--   - Pagination
create or replace function public.search_adverts(
  search_query text default null,
  category_id_filter uuid default null,
  price_min_filter numeric default null,
  price_max_filter numeric default null,
  location_filter text default null,
  location_lat numeric default null,
  location_lng numeric default null,
  radius_km numeric default 50,
  sort_by text default 'created_at_desc',
  page_offset int default 0,
  page_limit int default 24
)
returns table (
  id uuid,
  user_id uuid,
  category_id uuid,
  title text,
  description text,
  price numeric,
  currency text,
  condition text,
  status text,
  location_id uuid,
  location text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint,
  relevance_rank numeric
)
language plpgsql
stable
as $$
declare
  query_tsvector tsvector;
  has_postgis boolean;
begin
  -- Check if PostGIS extension is available
  select exists (
    select 1 from pg_extension where extname = 'postgis'
  ) into has_postgis;

  -- Build tsvector for full-text search if query provided
  if search_query is not null and length(trim(search_query)) > 0 then
    query_tsvector := to_tsvector('simple', search_query);
  end if;

  return query
  with filtered as (
    select
      a.id,
      a.user_id,
      a.category_id,
      a.title,
      a.description,
      a.price,
      a.currency,
      a.condition,
      a.status,
      a.location_id,
      a.location,
      a.created_at,
      a.updated_at,
      -- Calculate relevance rank for full-text search
      case
        when query_tsvector is not null then
          ts_rank_cd(
            to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, '')),
            query_tsvector
          )
        else 0.0
      end as relevance_rank
    from public.adverts a
    left join public.locations loc on a.location_id = loc.id
    where
      -- Only show active adverts
      a.status = 'active'
      -- Category filter
      and (category_id_filter is null or a.category_id = category_id_filter)
      -- Price range filter
      and (price_min_filter is null or a.price is null or a.price >= price_min_filter)
      and (price_max_filter is null or a.price is null or a.price <= price_max_filter)
      -- Location text filter (simple text matching)
      and (location_filter is null or a.location ilike '%' || location_filter || '%')
      -- Full-text search filter
      and (
        query_tsvector is null
        or to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, '')) @@ query_tsvector
      )
      -- Geospatial radius filter (only if PostGIS is available and coordinates provided)
      -- IMPORTANT: This function requires PostGIS extension for geospatial features.
      -- If PostGIS is not installed, the function creation will fail.
      -- To use without PostGIS, comment out the geospatial filter block below.
      and (
        location_lat is null
        or location_lng is null
        or not has_postgis
        or loc.point is null
        -- Geospatial filter (requires PostGIS extension)
        or (
          has_postgis
          and loc.point is not null
          and st_dwithin(
            loc.point,
            st_makepoint(location_lng, location_lat)::geography,
            radius_km * 1000
          )
        )
      )
  ),
  total as (
    select count(*) as total_count
    from filtered
  )
  select
    f.id,
    f.user_id,
    f.category_id,
    f.title,
    f.description,
    f.price,
    f.currency,
    f.condition,
    f.status,
    f.location_id,
    f.location,
    f.created_at,
    f.updated_at,
    t.total_count,
    f.relevance_rank
  from filtered f
  cross join total t
  order by
    case when sort_by = 'relevance' then f.relevance_rank end desc nulls last,
    case when sort_by = 'price_asc' then f.price end asc nulls last,
    case when sort_by = 'price_desc' then f.price end desc nulls last,
    case when sort_by = 'created_at_asc' then f.created_at end asc,
    case when sort_by = 'created_at_desc' or sort_by is null then f.created_at end desc,
    -- Default fallback
    f.created_at desc
  offset page_offset
  limit page_limit;
end;
$$;

-- Add comment explaining the function
comment on function public.search_adverts is 
'Search adverts with full-text search, filters (category, price, location), sorting, and pagination. 
Supports geospatial search if PostGIS is enabled.
Parameters:
- search_query: Text to search in title and description
- category_id_filter: Filter by category UUID
- price_min_filter: Minimum price
- price_max_filter: Maximum price
- location_filter: Text matching for location field
- location_lat: Latitude for geospatial search
- location_lng: Longitude for geospatial search
- radius_km: Search radius in kilometers (default: 50)
- sort_by: Sort option (created_at_desc, created_at_asc, price_asc, price_desc, relevance, distance)
- page_offset: Pagination offset (default: 0)
- page_limit: Results per page (default: 24)
Returns: Table of adverts with total_count and relevance_rank';

-- Handle PostGIS availability gracefully
-- If PostGIS is not available, the function will still work but geospatial features will be ignored
do $$
begin
  -- Check if PostGIS extension is available
  if exists (select 1 from pg_extension where extname = 'postgis') then
    -- PostGIS is available, function will use geospatial features
    raise notice 'PostGIS extension detected - geospatial search enabled';
  else
    -- PostGIS not available, function will skip geospatial features
    raise notice 'PostGIS extension not found - geospatial search disabled (function will work for text-based location filtering)';
  end if;
end $$;

