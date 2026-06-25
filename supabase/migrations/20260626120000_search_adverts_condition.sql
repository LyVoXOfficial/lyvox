-- Extend search_adverts with an optional condition_filter (13th param).
-- Additive + idempotent. Drops the prior 12-arg overload so only one remains
-- (avoids PGRST203 overload ambiguity).

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
  page_limit int default 24,
  verified_only boolean default false,
  condition_filter text default null
)
returns table (
  id uuid, user_id uuid, category_id uuid, title text, description text,
  price numeric, currency text, condition text, status text, location_id uuid,
  location text, created_at timestamptz, updated_at timestamptz,
  seller_verified boolean, total_count bigint, relevance_rank numeric
)
language plpgsql
stable
as $$
declare
  query_tsquery tsquery;
  has_postgis boolean;
begin
  select exists (select 1 from pg_extension where extname = 'postgis') into has_postgis;

  if search_query is not null and length(trim(search_query)) > 0 then
    query_tsquery := plainto_tsquery('simple', search_query);
  end if;

  return query
  with filtered as (
    select
      a.id, a.user_id, a.category_id, a.title, a.description, a.price, a.currency,
      a.condition, a.status, a.location_id, a.location, a.created_at, a.updated_at,
      coalesce(p.verified_email, false) and coalesce(p.verified_phone, false) as seller_verified,
      case
        when query_tsquery is not null then
          ts_rank_cd(
            to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, '')),
            query_tsquery
          )
        else 0.0
      end as relevance_rank
    from public.adverts a
    left join public.profiles p on p.id = a.user_id
    left join public.locations loc on a.location_id = loc.id
    where
      a.status = 'active'
      and (category_id_filter is null or a.category_id = category_id_filter)
      and (price_min_filter is null or a.price is null or a.price >= price_min_filter)
      and (price_max_filter is null or a.price is null or a.price <= price_max_filter)
      and (location_filter is null or a.location ilike '%' || location_filter || '%')
      and (condition_filter is null or a.condition = condition_filter)
      and (
        query_tsquery is null
        or to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.description, '')) @@ query_tsquery
      )
      and (
        location_lat is null or location_lng is null or not has_postgis or loc.point is null
        or (
          has_postgis and loc.point is not null
          and st_dwithin(loc.point, st_makepoint(location_lng, location_lat)::geography, radius_km * 1000)
        )
      )
      and (
        not verified_only
        or (coalesce(p.verified_email, false) and coalesce(p.verified_phone, false))
      )
  ),
  total as (select count(*) as total_count from filtered)
  select
    f.id::uuid, f.user_id::uuid, f.category_id::uuid, f.title::text, f.description::text,
    f.price::numeric, f.currency::text, f.condition::text, f.status::text, f.location_id::uuid,
    f.location::text, f.created_at::timestamptz, f.updated_at::timestamptz,
    f.seller_verified::boolean, t.total_count::bigint, f.relevance_rank::numeric
  from filtered f
  cross join total t
  order by
    case when sort_by = 'relevance' then f.relevance_rank end desc nulls last,
    case when sort_by = 'price_asc' then f.price end asc nulls last,
    case when sort_by = 'price_desc' then f.price end desc nulls last,
    case when sort_by = 'created_at_asc' then f.created_at end asc,
    case when sort_by = 'created_at_desc' or sort_by is null then f.created_at end desc,
    f.created_at desc
  offset page_offset
  limit page_limit;
end;
$$;

-- Drop the prior 12-arg overload (no condition_filter), if present.
drop function if exists public.search_adverts(
  text, uuid, numeric, numeric, text, numeric, numeric, numeric, text, int, int, boolean
);
