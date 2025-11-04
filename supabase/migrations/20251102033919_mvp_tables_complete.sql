-- DB-001: Complete MVP tables migration
-- This migration ensures all core MVP tables exist with proper structure.
-- Uses IF NOT EXISTS to safely handle already-existing tables.

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Create sequences if they don't exist
create sequence if not exists public.logs_id_seq;
create sequence if not exists public.phone_otps_id_seq;

-- 1. Categories table (hierarchical taxonomy)
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
  constraint categories_parent_id_fkey foreign key (parent_id) references public.categories(id) on delete set null
);

-- 2. Locations table (geodata for adverts)
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  country text,
  region text,
  city text,
  postcode text,
  point geography(point, 4326)
);

-- Create index for PostGIS point column if PostGIS is available
do $$
begin
  if exists (select 1 from pg_extension where extname = 'postgis') then
    create index if not exists locations_point_idx on public.locations using gist (point);
  end if;
end $$;

-- 3. Profiles table (user profile metadata)
create table if not exists public.profiles (
  id uuid primary key,
  display_name text,
  phone text,
  verified_email boolean default false,
  verified_phone boolean default false,
  created_at timestamptz default now(),
  consents jsonb,
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade
);

-- 4. Phones table (verified phone numbers)
create table if not exists public.phones (
  user_id uuid primary key,
  e164 text not null unique,
  verified boolean not null default false,
  lookup jsonb,
  updated_at timestamptz not null default now(),
  constraint phones_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- 5. Adverts table (marketplace listings)
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
  constraint adverts_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint adverts_category_id_fkey foreign key (category_id) references public.categories(id) on delete restrict,
  constraint adverts_location_id_fkey foreign key (location_id) references public.locations(id) on delete set null
);

-- 6. Media table (advert media assets)
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null,
  url text not null,
  w integer,
  h integer,
  sort integer default 0,
  created_at timestamptz default now(),
  constraint media_advert_id_fkey foreign key (advert_id) references public.adverts(id) on delete cascade
);

-- 7. Ad item specifics table (JSON payload per advert)
create table if not exists public.ad_item_specifics (
  advert_id uuid primary key,
  specifics jsonb not null default '{}'::jsonb,
  constraint ad_item_specifics_advert_id_fkey foreign key (advert_id) references public.adverts(id) on delete cascade
);

-- 8. Phone OTPs table (OTP tokens for phone verification)
-- Note: This creates the base structure. Later migrations may modify it (e.g., security_refactor adds code_salt/code_hash)
create table if not exists public.phone_otps (
  id bigint primary key default nextval('public.phone_otps_id_seq'),
  user_id uuid,
  e164 text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  constraint phone_otps_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Add code-related columns if they don't exist (for backward compatibility with security_refactor migration)
-- Note: security_refactor migration adds code_salt, code_hash, code_last_four and removes code column
-- This block ensures these columns exist if the table was created fresh (before security_refactor)
do $$
begin
  -- Check if code_salt column exists - if not, add security columns
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'phone_otps' 
    and column_name = 'code_salt'
  ) then
    -- Add security columns (these will be properly set by security_refactor migration)
    alter table public.phone_otps
      add column if not exists code_salt text,
      add column if not exists code_hash text,
      add column if not exists code_last_four text;
  end if;
end $$;

-- 9. Logs table (audit trail)
create table if not exists public.logs (
  id bigint primary key default nextval('public.logs_id_seq'),
  user_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- 10. Reports table (moderation complaints)
-- Note: This table already has a migration (20251004120000), but included here for completeness
create table if not exists public.reports (
  id bigserial primary key,
  advert_id uuid not null,
  reporter uuid not null,
  reason text not null,
  details text,
  status text not null default 'pending',
  reviewed_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint reports_advert_id_fkey foreign key (advert_id) references public.adverts(id) on delete cascade,
  constraint reports_reporter_fkey foreign key (reporter) references auth.users(id) on delete cascade,
  constraint reports_reviewed_by_fkey foreign key (reviewed_by) references auth.users(id) on delete set null
);

-- 11. Trust score table (trust reputation ledger)
-- Note: This table already has a migration (20251004121000), but included here for completeness
-- Note: Actual table doesn't have created_at column, only updated_at
create table if not exists public.trust_score (
  user_id uuid primary key,
  score int not null default 0,
  updated_at timestamptz default now(),
  constraint trust_score_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Create basic indexes for performance (detailed indexes will be added in DB-002)
create index if not exists adverts_user_id_idx on public.adverts(user_id);
create index if not exists adverts_category_id_idx on public.adverts(category_id);
create index if not exists adverts_status_idx on public.adverts(status);
create index if not exists adverts_created_at_idx on public.adverts(created_at);

create index if not exists media_advert_id_idx on public.media(advert_id);
create index if not exists media_sort_idx on public.media(advert_id, sort);

create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists categories_slug_idx on public.categories(slug);
create index if not exists categories_is_active_idx on public.categories(is_active);

create index if not exists phones_e164_idx on public.phones(e164);

create index if not exists phone_otps_user_id_idx on public.phone_otps(user_id);
create index if not exists phone_otps_e164_idx on public.phone_otps(e164);

create index if not exists logs_user_id_idx on public.logs(user_id);
create index if not exists logs_action_idx on public.logs(action);
create index if not exists logs_created_at_idx on public.logs(created_at);

create index if not exists reports_advert_id_idx on public.reports(advert_id);
create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_reporter_idx on public.reports(reporter);

-- Add comments for documentation
comment on table public.categories is 'Hierarchical category taxonomy for marketplace listings';
comment on table public.locations is 'Normalized geodata for advert locations';
comment on table public.profiles is 'User profile metadata keyed by auth.users.id';
comment on table public.phones is 'Verified phone numbers per user';
comment on table public.adverts is 'Marketplace listings with pricing, location, and status';
comment on table public.media is 'Media assets (images/videos) associated with adverts';
comment on table public.ad_item_specifics is 'JSON payload for category-specific advert attributes';
comment on table public.phone_otps is 'OTP tokens for phone verification (codes are hashed for security)';
comment on table public.logs is 'Audit trail for user actions and system events';
comment on table public.reports is 'User complaints/reports for moderation';
comment on table public.trust_score is 'Trust reputation score per user for moderation heuristics';

