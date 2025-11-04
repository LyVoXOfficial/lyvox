-- Vehicle i18n tables for makes/models/generations + read-only policies
-- Locale set kept intentionally small; extend when product supports more

begin;

create table if not exists public.vehicle_make_i18n (
  make_id uuid not null references public.vehicle_makes(id) on delete cascade,
  locale text not null check (locale in ('en','fr','nl','ru')),
  name text not null,
  synonyms text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (make_id, locale)
);

create table if not exists public.vehicle_model_i18n (
  model_id uuid not null references public.vehicle_models(id) on delete cascade,
  locale text not null check (locale in ('en','fr','nl','ru')),
  name text not null,
  synonyms text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (model_id, locale)
);

create table if not exists public.vehicle_generation_i18n (
  generation_id uuid not null references public.vehicle_generations(id) on delete cascade,
  locale text not null check (locale in ('en','fr','nl','ru')),
  summary text,
  created_at timestamptz not null default now(),
  primary key (generation_id, locale)
);

-- RLS: read-only for public (anon, authenticated) for dropdowns etc.
alter table public.vehicle_make_i18n enable row level security;
alter table public.vehicle_model_i18n enable row level security;
alter table public.vehicle_generation_i18n enable row level security;

drop policy if exists "public can read vehicle_make_i18n" on public.vehicle_make_i18n;
create policy "public can read vehicle_make_i18n"
  on public.vehicle_make_i18n for select
  using ( true );

drop policy if exists "public can read vehicle_model_i18n" on public.vehicle_model_i18n;
create policy "public can read vehicle_model_i18n"
  on public.vehicle_model_i18n for select
  using ( true );

drop policy if exists "public can read vehicle_generation_i18n" on public.vehicle_generation_i18n;
create policy "public can read vehicle_generation_i18n"
  on public.vehicle_generation_i18n for select
  using ( true );

-- Helper functions to fetch localized rows with fallback to EN/canonical
create or replace function public.vehicle_makes_localized(p_locale text)
returns table (
  id uuid,
  slug text,
  name text,
  country text,
  segment_class text,
  is_active boolean,
  category_path text
) language sql stable as $$
  select m.id,
         m.slug,
         coalesce(mi.name, m.name_en) as name,
         m.country,
         m.segment_class,
         m.is_active,
         m.category_path
  from public.vehicle_makes m
  left join public.vehicle_make_i18n mi
    on mi.make_id = m.id and mi.locale = p_locale
$$;

create or replace function public.vehicle_models_localized(p_locale text, p_make_id uuid default null)
returns table (
  id uuid,
  make_id uuid,
  slug text,
  name text,
  first_model_year int,
  last_model_year int,
  years_available int[]
) language sql stable as $$
  select md.id,
         md.make_id,
         md.slug,
         coalesce(mi.name, md.name_en) as name,
         md.first_model_year,
         md.last_model_year,
         md.years_available
  from public.vehicle_models md
  left join public.vehicle_model_i18n mi
    on mi.model_id = md.id and mi.locale = p_locale
  where (p_make_id is null or md.make_id = p_make_id)
$$;

create or replace function public.vehicle_generations_localized(p_locale text, p_model_id uuid)
returns table (
  id uuid,
  model_id uuid,
  code text,
  start_year int,
  end_year int,
  facelift boolean,
  summary text
) language sql stable as $$
  select g.id,
         g.model_id,
         g.code,
         g.start_year,
         g.end_year,
         g.facelift,
         coalesce(gi.summary, g.summary) as summary
  from public.vehicle_generations g
  left join public.vehicle_generation_i18n gi
    on gi.generation_id = g.id and gi.locale = p_locale
  where g.model_id = p_model_id
$$;

commit;

