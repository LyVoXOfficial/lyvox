-- 1. BRANDS / MAKES
create table if not exists public.vehicle_makes (
    id uuid primary key default gen_random_uuid(),
    slug text unique not null,                -- "bmw"
    name_en text not null,                    -- "BMW"
    country text,                             -- "Germany"
    segment_class text,                       -- "premium" | "mass" | "budget" | "luxury" | "electric"
    is_active boolean default true,
    category_path text not null default 'transport/legkovye-avtomobili',
    created_at timestamptz not null default now()
);
-- 2. MODELS
create table if not exists public.vehicle_models (
    id uuid primary key default gen_random_uuid(),
    make_id uuid not null references public.vehicle_makes(id) on delete cascade,

    slug text not null,                       -- "3-series"
    name_en text not null,                    -- "3 Series"

    first_model_year int,
    last_model_year int,
    years_available int[] not null default '{}',

    body_types_available jsonb not null default '[]'::jsonb,
    fuel_types_available jsonb not null default '[]'::jsonb,
    transmission_available jsonb not null default '[]'::jsonb,

    reliability_score numeric,               -- we will normalize to 0..10
    popularity_score numeric,                -- same

    created_at timestamptz not null default now(),

    unique (make_id, slug)
);
-- 3. GENERATIONS (per model)
create table if not exists public.vehicle_generations (
    id uuid primary key default gen_random_uuid(),
    model_id uuid not null references public.vehicle_models(id) on delete cascade,

    code text,                                -- "E39", "W205", "Mk8", etc.
    start_year int,
    end_year int,                             -- NULL => still in production
    facelift boolean,
    production_countries text[] default '{}',

    body_types text[] default '{}',
    fuel_types text[] default '{}',
    transmission_types text[] default '{}',

    summary text,                             -- 60-100 word neutral technical summary

    created_at timestamptz not null default now()
);
-- Index to quickly look up gens by model
create index if not exists vehicle_generations_model_id_idx on public.vehicle_generations(model_id);
-- 4. INSIGHT (per model)
create table if not exists public.vehicle_insights (
    model_id uuid primary key references public.vehicle_models(id) on delete cascade,

    pros jsonb not null default '[]'::jsonb,
    cons jsonb not null default '[]'::jsonb,
    inspection_tips jsonb not null default '[]'::jsonb,

    notable_features jsonb not null default '[]'::jsonb,
    engine_examples jsonb not null default '[]'::jsonb,

    common_issues_by_engine jsonb not null default '{}'::jsonb,

    reliability_score numeric,
    popularity_score numeric,

    created_at timestamptz not null default now()
);
-- Helpful indexes
create index if not exists vehicle_models_make_id_idx on public.vehicle_models(make_id);
create index if not exists vehicle_models_slug_idx on public.vehicle_models(slug);
create index if not exists vehicle_makes_slug_idx on public.vehicle_makes(slug);
-- ============================
-- RLS / SECURITY
-- ============================

alter table public.vehicle_makes enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_generations enable row level security;
alter table public.vehicle_insights enable row level security;

-- Policy: public read-only (anyone can SELECT for dropdowns, form hints, etc)
drop policy if exists "public can read vehicle_makes" on public.vehicle_makes;
create policy "public can read vehicle_makes"
    on public.vehicle_makes
    for select
    using ( true );

drop policy if exists "public can read vehicle_models" on public.vehicle_models;
create policy "public can read vehicle_models"
    on public.vehicle_models
    for select
    using ( true );

drop policy if exists "public can read vehicle_generations" on public.vehicle_generations;
create policy "public can read vehicle_generations"
    on public.vehicle_generations
    for select
    using ( true );

drop policy if exists "public can read vehicle_insights" on public.vehicle_insights;
create policy "public can read vehicle_insights"
    on public.vehicle_insights
    for select
    using ( true );
-- We do NOT allow inserts/updates/deletes via anon. These will be done through service role only.
-- (service role bypasses RLS anyway, но мы не даём публичные ручки на запись);
