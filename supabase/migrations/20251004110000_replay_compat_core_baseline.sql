-- Replay compatibility baseline for the legacy migration chain.
--
-- Historical migrations before 20251102033919 assumed these MVP relations
-- already existed in the linked project. A clean database has no such state,
-- so those migrations failed before reaching the idempotent MVP table setup.
-- Every operation here is additive and guarded: on an established database it
-- is a no-op, while a clean replay receives the minimum schema those historical
-- migrations require.

-- This backdated migration is also applied by `db push --include-all` on an
-- established project. It must therefore distinguish a genuinely empty
-- database from production before executing any compatibility DDL. A partial
-- schema is unsafe: later historical RLS/security migrations are already
-- recorded remotely and would not run again for a table created here.
begin;

do $$
declare
  expected_tables constant text[] := array[
    'categories',
    'locations',
    'profiles',
    'phones',
    'adverts',
    'media',
    'ad_item_specifics',
    'phone_otps',
    'logs',
    'vehicle_makes',
    'vehicle_models',
    'vehicle_generations',
    'vehicle_insights'
  ];
  existing_tables integer;
  has_later_history boolean := false;
  invalid_tables text;
  missing_extensions text;
  missing_sequences text;
begin
  select count(*)
  into existing_tables
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = any(expected_tables)
    and relation.relkind in ('r', 'p');

  if pg_catalog.to_regclass(
    'supabase_migrations.schema_migrations'
  ) is not null then
    execute $history$
      select exists (
        select 1
        from supabase_migrations.schema_migrations
        where version > '20251004110000'
      )
    $history$
    into has_later_history;
  end if;

  if existing_tables = 0 and not has_later_history then
    perform pg_catalog.set_config(
      'lyvox.replay_compat_mode',
      'clean',
      true
    );
    return;
  end if;

  if existing_tables = 0 then
    raise exception using
      errcode = '55000',
      message = 'Replay compatibility baseline refused an empty schema with later migration history',
      detail = 'Migration history proves this is an established or partially restored database.',
      hint = 'Restore or repair the established core schema; never reconstruct it through this backdated baseline.';
  end if;

  if existing_tables <> pg_catalog.array_length(expected_tables, 1) then
    select pg_catalog.string_agg(table_name, ', ' order by table_name)
    into invalid_tables
    from pg_catalog.unnest(expected_tables) as expected(table_name)
    where not exists (
      select 1
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = expected.table_name
        and relation.relkind in ('r', 'p')
    );

    raise exception using
      errcode = '55000',
      message = 'Replay compatibility baseline refused a partial established schema',
      detail = pg_catalog.format('Missing core tables: %s', invalid_tables),
      hint = 'Repair the established schema explicitly; never let this backdated baseline create production tables.';
  end if;

  select pg_catalog.string_agg(relation.relname, ', ' order by relation.relname)
  into invalid_tables
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = any(expected_tables)
    and relation.relkind in ('r', 'p')
    and not relation.relrowsecurity;

  if invalid_tables is not null then
    raise exception using
      errcode = '55000',
      message = 'Replay compatibility baseline refused established tables without RLS',
      detail = pg_catalog.format('RLS disabled: %s', invalid_tables),
      hint = 'Enable and audit RLS before applying backdated compatibility migrations.';
  end if;

  select pg_catalog.string_agg(required.name, ', ' order by required.name)
  into missing_extensions
  from pg_catalog.unnest(
    array['uuid-ossp', 'pgcrypto', 'postgis']::text[]
  ) as required(name)
  where not exists (
    select 1
    from pg_catalog.pg_extension extension
    where extension.extname = required.name
  );

  if missing_extensions is not null then
    raise exception using
      errcode = '55000',
      message = 'Replay compatibility baseline refused an incomplete established extension set',
      detail = pg_catalog.format('Missing extensions: %s', missing_extensions);
  end if;

  select pg_catalog.string_agg(required.name, ', ' order by required.name)
  into missing_sequences
  from pg_catalog.unnest(
    array['logs_id_seq', 'phone_otps_id_seq']::text[]
  ) as required(name)
  where not exists (
    select 1
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = required.name
      and relation.relkind = 'S'
  );

  if missing_sequences is not null then
    raise exception using
      errcode = '55000',
      message = 'Replay compatibility baseline refused incomplete established sequences',
      detail = pg_catalog.format('Missing sequences: %s', missing_sequences);
  end if;

  perform pg_catalog.set_config(
    'lyvox.replay_compat_mode',
    'established',
    true
  );
end
$$;

create schema if not exists extensions;

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

-- The first historical migration introduced an 11-argument overload. The MVP
-- migration later creates the 12-argument replacement and immediately issues
-- an unqualified COMMENT, which fails while both overloads exist. A later
-- deployed migration already removes this obsolete signature, so this is a
-- no-op on the established schema and only repairs the clean replay order.
do $$
begin
  if pg_catalog.current_setting(
    'lyvox.replay_compat_mode',
    true
  ) = 'clean' then
    execute 'drop function if exists public.search_adverts(text, uuid, numeric, numeric, text, numeric, numeric, numeric, text, integer, integer)';
  end if;
end
$$;

create sequence if not exists public.logs_id_seq;
create sequence if not exists public.phone_otps_id_seq;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid,
  slug text not null unique,
  level integer not null check (level >= 1 and level <= 3),
  name_ru text not null,
  name_nl text,
  name_fr text,
  name_en text,
  path text not null,
  sort integer default 0,
  icon text,
  is_active boolean default true,
  constraint categories_parent_id_fkey
    foreign key (parent_id) references public.categories(id) on delete set null
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  country text,
  region text,
  city text,
  postcode text,
  point extensions.geography(point, 4326)
);

create table if not exists public.profiles (
  id uuid primary key,
  display_name text,
  phone text,
  verified_email boolean default false,
  verified_phone boolean default false,
  created_at timestamptz default now(),
  consents jsonb,
  constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade
);

create table if not exists public.phones (
  user_id uuid primary key,
  e164 text not null unique,
  verified boolean not null default false,
  lookup jsonb,
  updated_at timestamptz not null default now(),
  constraint phones_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.adverts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  category_id uuid not null,
  title text not null,
  description text,
  price numeric,
  currency text default 'EUR',
  condition text,
  status text not null default 'active',
  location_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  location text,
  constraint adverts_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint adverts_category_id_fkey
    foreign key (category_id) references public.categories(id) on delete restrict,
  constraint adverts_location_id_fkey
    foreign key (location_id) references public.locations(id) on delete set null
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null,
  url text not null,
  w integer,
  h integer,
  sort integer default 0,
  created_at timestamptz default now(),
  constraint media_advert_id_fkey
    foreign key (advert_id) references public.adverts(id) on delete cascade
);

create table if not exists public.ad_item_specifics (
  advert_id uuid primary key,
  specifics jsonb not null default '{}'::jsonb,
  constraint ad_item_specifics_advert_id_fkey
    foreign key (advert_id) references public.adverts(id) on delete cascade
);

-- The security refactor precedes the idempotent MVP migration and migrates the
-- legacy plaintext column to salted hashes. Keep this transient column only in
-- the clean-replay baseline; the refactor drops it in the same replay.
create table if not exists public.phone_otps (
  id bigint primary key default nextval('public.phone_otps_id_seq'),
  user_id uuid,
  e164 text not null,
  code text,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  constraint phone_otps_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.logs (
  id bigint primary key default nextval('public.logs_id_seq'),
  user_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- The linked schema predates the vehicle catalog migration. In that schema,
-- generation option lists are JSONB; the historical seed uses JSONB literals,
-- while the later CREATE TABLE fallback incorrectly declared those columns as
-- text arrays. Reproduce the established schema so both clean replay and the
-- existing project follow the same contract.
create table if not exists public.vehicle_makes (
  id uuid primary key,
  slug text not null unique,
  name_en text not null,
  country text,
  segment_class text,
  is_active boolean,
  category_path text
);

create table if not exists public.vehicle_models (
  id uuid primary key,
  make_id uuid references public.vehicle_makes(id) on delete cascade,
  slug text not null,
  name_en text not null,
  first_model_year integer,
  last_model_year integer,
  years_available integer[],
  body_types_available jsonb,
  fuel_types_available jsonb,
  transmission_available jsonb,
  reliability_score numeric,
  popularity_score numeric,
  unique (make_id, slug)
);

create table if not exists public.vehicle_generations (
  id uuid primary key,
  model_id uuid references public.vehicle_models(id) on delete cascade,
  code text,
  start_year integer,
  end_year integer,
  facelift boolean,
  production_countries text[],
  body_types jsonb,
  fuel_types jsonb,
  transmission_types jsonb,
  summary text,
  name_en text,
  name_ru text,
  unique (model_id, code)
);

create table if not exists public.vehicle_insights (
  model_id uuid primary key references public.vehicle_models(id) on delete cascade,
  pros jsonb,
  cons jsonb,
  inspection_tips jsonb,
  notable_features jsonb,
  engine_examples jsonb,
  common_issues_by_engine jsonb,
  reliability_score numeric,
  popularity_score numeric
);

-- Defense in depth for a clean replay that stops after this file: no baseline
-- table is exposed through PostgREST before later policy migrations finish,
-- and RLS cannot be bypassed with TRUNCATE.
alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.phones enable row level security;
alter table public.adverts enable row level security;
alter table public.media enable row level security;
alter table public.ad_item_specifics enable row level security;
alter table public.phone_otps enable row level security;
alter table public.logs enable row level security;
alter table public.vehicle_makes enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_generations enable row level security;
alter table public.vehicle_insights enable row level security;

revoke truncate on table
  public.categories,
  public.locations,
  public.profiles,
  public.phones,
  public.adverts,
  public.media,
  public.ad_item_specifics,
  public.phone_otps,
  public.logs,
  public.vehicle_makes,
  public.vehicle_models,
  public.vehicle_generations,
  public.vehicle_insights
from anon, authenticated;

-- The catalog seed defines these aliases in a CTE used by its first INSERT,
-- then reuses them in later statements where the CTE is out of scope. Create
-- temporary aliases only during a clean replay. Each view carries a provenance
-- marker so the cleanup migration cannot delete a pre-existing production
-- object with the same name.
do $$
begin
  if pg_catalog.current_setting(
    'lyvox.replay_compat_mode',
    true
  ) <> 'clean' then
    return;
  end if;

  execute 'create view public.auto_parts_cat with (security_invoker = true) as select id from public.categories where slug = ''zapchasti-i-aksessuary''';
  execute 'create view public.services_cat with (security_invoker = true) as select id from public.categories where slug = ''uslugi''';
  execute 'create view public.pets_cat with (security_invoker = true) as select id from public.categories where slug = ''domashnie-pitomcy''';
  execute 'create view public.baby_cat with (security_invoker = true) as select id from public.categories where slug = ''detskie-tovary''';
  execute 'create view public.giveaway_cat with (security_invoker = true) as select id from public.categories where slug = ''otdam-darom''';

  comment on view public.auto_parts_cat is
    'lyvox:replay-compat-catalog-alias:v1';
  comment on view public.services_cat is
    'lyvox:replay-compat-catalog-alias:v1';
  comment on view public.pets_cat is
    'lyvox:replay-compat-catalog-alias:v1';
  comment on view public.baby_cat is
    'lyvox:replay-compat-catalog-alias:v1';
  comment on view public.giveaway_cat is
    'lyvox:replay-compat-catalog-alias:v1';

  revoke all on public.auto_parts_cat from public, anon, authenticated;
  revoke all on public.services_cat from public, anon, authenticated;
  revoke all on public.pets_cat from public, anon, authenticated;
  revoke all on public.baby_cat from public, anon, authenticated;
  revoke all on public.giveaway_cat from public, anon, authenticated;
end
$$;

commit;
