-- Align vehicle localisation tables with current backup and seed baseline entries
begin;

-- Extend supported locales to include German
alter table if exists public.vehicle_make_i18n
  drop constraint if exists vehicle_make_i18n_locale_check;
alter table if exists public.vehicle_make_i18n
  add constraint vehicle_make_i18n_locale_check
  check (locale in ('en','fr','nl','ru','de'));

alter table if exists public.vehicle_model_i18n
  drop constraint if exists vehicle_model_i18n_locale_check;
alter table if exists public.vehicle_model_i18n
  add constraint vehicle_model_i18n_locale_check
  check (locale in ('en','fr','nl','ru','de'));

alter table if exists public.vehicle_generation_i18n
  drop constraint if exists vehicle_generation_i18n_locale_check;
alter table if exists public.vehicle_generation_i18n
  add constraint vehicle_generation_i18n_locale_check
  check (locale in ('en','fr','nl','ru','de'));

-- Ensure english localisation matches canonical names
insert into public.vehicle_make_i18n (make_id, locale, name, synonyms)
select m.id, 'en', m.name_en, ARRAY[]::text[]
from public.vehicle_makes m
on conflict (make_id, locale) do update
  set name = excluded.name,
      synonyms = case
        when cardinality(public.vehicle_make_i18n.synonyms) = 0 then excluded.synonyms
        else public.vehicle_make_i18n.synonyms
      end;

insert into public.vehicle_model_i18n (model_id, locale, name, synonyms)
select md.id, 'en', md.name_en, ARRAY[]::text[]
from public.vehicle_models md
on conflict (model_id, locale) do update
  set name = excluded.name,
      synonyms = case
        when cardinality(public.vehicle_model_i18n.synonyms) = 0 then excluded.synonyms
        else public.vehicle_model_i18n.synonyms
      end;

-- Backfill other locales with english fallback when missing
with locales as (
  select unnest(array['fr','nl','ru','de']) as locale
)
insert into public.vehicle_make_i18n (make_id, locale, name, synonyms)
select m.id, l.locale, m.name_en, ARRAY[]::text[]
from public.vehicle_makes m
cross join locales l
where not exists (
  select 1 from public.vehicle_make_i18n mi
  where mi.make_id = m.id and mi.locale = l.locale
);

with locales as (
  select unnest(array['fr','nl','ru','de']) as locale
)
insert into public.vehicle_model_i18n (model_id, locale, name, synonyms)
select md.id, l.locale, md.name_en, ARRAY[]::text[]
from public.vehicle_models md
cross join locales l
where not exists (
  select 1 from public.vehicle_model_i18n mi
  where mi.model_id = md.id and mi.locale = l.locale
);

-- Normalise empty arrays for generation narratives
update public.vehicle_generation_i18n
set pros = coalesce(pros, ARRAY[]::text[]),
    cons = coalesce(cons, ARRAY[]::text[]),
    inspection_tips = coalesce(inspection_tips, ARRAY[]::text[]),
    common_issues = coalesce(common_issues, ARRAY[]::text[])
where pros is null
   or cons is null
   or inspection_tips is null
   or common_issues is null;

alter table if exists public.vehicle_generation_i18n
  alter column pros set not null,
  alter column cons set not null,
  alter column inspection_tips set not null,
  alter column common_issues set not null;

commit;
