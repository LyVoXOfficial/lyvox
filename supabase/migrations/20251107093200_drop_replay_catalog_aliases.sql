-- Remove only aliases created by the replay compatibility baseline. This file
-- is backdated and may run on an established project via `db push
-- --include-all`; an unqualified DROP VIEW IF EXISTS could otherwise delete an
-- unrelated production object that happens to use one of these names.
do $$
declare
  relation_name text;
  relation_oid regclass;
begin
  foreach relation_name in array array[
    'auto_parts_cat',
    'services_cat',
    'pets_cat',
    'baby_cat',
    'giveaway_cat'
  ] loop
    relation_oid := pg_catalog.to_regclass(
      pg_catalog.format('public.%I', relation_name)
    );

    if relation_oid is not null
      and pg_catalog.obj_description(
        relation_oid,
        'pg_class'
      ) = 'lyvox:replay-compat-catalog-alias:v1' then
      execute pg_catalog.format(
        'drop view public.%I',
        relation_name
      );
    end if;
  end loop;
end
$$;
