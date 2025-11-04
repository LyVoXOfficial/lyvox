-- API-005: Create PostgreSQL function search_adverts
-- This migration creates the search_adverts function for full-text search with filters, sorting, and pagination
-- 
-- Function features:
--   - Full-text search across title and description
--   - Category filtering
--   - Price range filtering (min/max)
--   - Location text filtering
--   - Geospatial radius filtering (if PostGIS is available)
--   - Multiple sort options (relevance, price, date)
--   - Pagination support

-- ============================================================================
-- Search function: search_adverts
-- ============================================================================

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
security definer
as $$
declare
  query_tsvector tsvector;
  has_postgis boolean;
begin
  -- Check if PostGIS extension is available for geospatial features
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
      -- Uses ts_rank_cd for better ranking quality
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
      -- Category filter: exact match on category_id
      and (category_id_filter is null or a.category_id = category_id_filter)
      -- Price range filter: supports null prices (free items)
      and (price_min_filter is null or a.price is null or a.price >= price_min_filter)
      and (price_max_filter is null or a.price is null or a.price <= price_max_filter)
      -- Location text filter: case-insensitive partial match
      and (location_filter is null or a.location ilike '%' || location_filter || '%')
      -- Full-text search filter: searches in both title and description
      and (
        query_tsvector is null
        or to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, '')) @@ query_tsvector
      )
      -- Geospatial radius filter (only if PostGIS is available and coordinates provided)
      and (
        location_lat is null
        or location_lng is null
        or not has_postgis
        or loc.point is null
        -- Geospatial filter using PostGIS (requires PostGIS extension)
        or (
          has_postgis
          and loc.point is not null
          and st_dwithin(
            loc.point,
            st_makepoint(location_lng, location_lat)::geography,
            radius_km * 1000  -- Convert km to meters
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

-- Add comprehensive comment explaining the function
comment on function public.search_adverts is $$Search adverts with full-text search, filters (category, price, location), sorting, and pagination. 
Supports geospatial search if PostGIS is enabled.

Parameters:
- search_query: Text to search in title and description (full-text search)
- category_id_filter: Filter by category UUID (exact match)
- price_min_filter: Minimum price (null values are included)
- price_max_filter: Maximum price (null values are included)
- location_filter: Text matching for location field (case-insensitive partial match)
- location_lat: Latitude for geospatial search (requires PostGIS)
- location_lng: Longitude for geospatial search (requires PostGIS)
- radius_km: Search radius in kilometers for geospatial search (default: 50)
- sort_by: Sort option - one of: created_at_desc, created_at_asc, price_asc, price_desc, relevance
- page_offset: Pagination offset for skip/limit (default: 0)
- page_limit: Number of results per page (default: 24)

Returns: 
Table of adverts with all fields plus total_count (total matching records) and relevance_rank (for full-text search relevance).

Usage examples:
1. Simple text search: SELECT * FROM search_adverts('laptop');
2. With filters: SELECT * FROM search_adverts('car', category_id_filter := '...'::uuid, price_max_filter := 10000);
3. With pagination: SELECT * FROM search_adverts('bike', page_offset := 24, page_limit := 24);
4. Geospatial search: SELECT * FROM search_adverts(location_lat := 50.8503, location_lng := 4.3517, radius_km := 10);$$;

-- Handle PostGIS availability gracefully
-- The function will work without PostGIS, but geospatial features will be disabled
do $$
begin
  if exists (select 1 from pg_extension where extname = 'postgis') then
    raise notice 'PostGIS extension detected - geospatial search enabled in search_adverts';
  else
    raise notice 'PostGIS extension not found - search_adverts will work but geospatial features disabled';
  end if;
end $$;
