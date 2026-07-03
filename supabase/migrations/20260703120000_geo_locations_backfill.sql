-- T20: Belgian city reference, geography points, and advert location backfill.
-- Coordinates are fixed by docs/todo/T20-geo-backfill.md. Do not extend from memory.

create unique index if not exists locations_city_postcode_key
  on public.locations (lower(city), postcode);

insert into public.locations (country, region, city, postcode, point)
values
  ('BE', 'Brussels', 'Brussel', '1000', st_setsrid(st_makepoint(4.3517, 50.8503), 4326)::geography),
  ('BE', 'Flanders', 'Antwerpen', '2000', st_setsrid(st_makepoint(4.4025, 51.2194), 4326)::geography),
  ('BE', 'Flanders', 'Gent', '9000', st_setsrid(st_makepoint(3.7174, 51.0543), 4326)::geography),
  ('BE', 'Wallonia', 'Charleroi', '6000', st_setsrid(st_makepoint(4.4446, 50.4114), 4326)::geography),
  ('BE', 'Wallonia', 'Liège', '4000', st_setsrid(st_makepoint(5.5797, 50.6326), 4326)::geography),
  ('BE', 'Flanders', 'Brugge', '8000', st_setsrid(st_makepoint(3.2247, 51.2093), 4326)::geography),
  ('BE', 'Wallonia', 'Namur', '5000', st_setsrid(st_makepoint(4.8720, 50.4674), 4326)::geography),
  ('BE', 'Flanders', 'Leuven', '3000', st_setsrid(st_makepoint(4.7005, 50.8798), 4326)::geography),
  ('BE', 'Flanders', 'Mechelen', '2800', st_setsrid(st_makepoint(4.4776, 51.0257), 4326)::geography),
  ('BE', 'Flanders', 'Aalst', '9300', st_setsrid(st_makepoint(4.0409, 50.9378), 4326)::geography),
  ('BE', 'Flanders', 'Kortrijk', '8500', st_setsrid(st_makepoint(3.2649, 50.8285), 4326)::geography),
  ('BE', 'Flanders', 'Hasselt', '3500', st_setsrid(st_makepoint(5.3378, 50.9307), 4326)::geography),
  ('BE', 'Flanders', 'Oostende', '8400', st_setsrid(st_makepoint(2.9286, 51.2154), 4326)::geography),
  ('BE', 'Flanders', 'Genk', '3600', st_setsrid(st_makepoint(5.5000, 50.9650), 4326)::geography),
  ('BE', 'Flanders', 'Sint-Niklaas', '9100', st_setsrid(st_makepoint(4.1437, 51.1656), 4326)::geography),
  ('BE', 'Flanders', 'Turnhout', '2300', st_setsrid(st_makepoint(4.9447, 51.3227), 4326)::geography),
  ('BE', 'Flanders', 'Roeselare', '8800', st_setsrid(st_makepoint(3.1264, 50.9443), 4326)::geography),
  ('BE', 'Wallonia', 'Mons', '7000', st_setsrid(st_makepoint(3.9563, 50.4542), 4326)::geography),
  ('BE', 'Wallonia', 'Tournai', '7500', st_setsrid(st_makepoint(3.3893, 50.6071), 4326)::geography),
  ('BE', 'Flanders', 'Geel', '2440', st_setsrid(st_makepoint(4.9900, 51.1650), 4326)::geography),
  ('BE', 'Wallonia', 'Wavre', '1300', st_setsrid(st_makepoint(4.6000, 50.7167), 4326)::geography),
  ('BE', 'Wallonia', 'Nivelles', '1400', st_setsrid(st_makepoint(4.3286, 50.5983), 4326)::geography)
on conflict do nothing;

create or replace function public.resolve_location_id(p_location text)
returns uuid
language sql
stable
set search_path = public
as $$
  with parsed as (
    select
      nullif(trim(split_part(coalesce(p_location, ''), ',', 1)), '') as city_part,
      nullif(regexp_replace(trim(split_part(coalesce(p_location, ''), ',', 2)), '\D', '', 'g'), '') as postcode_part
  )
  select locations.id
  from public.locations, parsed
  where parsed.city_part is not null
    and lower(locations.city) = lower(parsed.city_part)
    and (parsed.postcode_part is null or locations.postcode = parsed.postcode_part)
  order by case
    when parsed.postcode_part is not null and locations.postcode = parsed.postcode_part then 0
    else 1
  end
  limit 1
$$;

revoke execute on function public.resolve_location_id(text) from public;
revoke execute on function public.resolve_location_id(text) from anon;
revoke execute on function public.resolve_location_id(text) from authenticated;
grant execute on function public.resolve_location_id(text) to service_role;

update public.adverts
set location_id = public.resolve_location_id(location)
where location_id is null
  and location is not null
  and public.resolve_location_id(location) is not null;
