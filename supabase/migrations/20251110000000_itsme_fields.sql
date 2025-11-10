-- ITSME-002: Add Itsme verification fields to profiles table
-- Adds itsme_verified and itsme_kyc_level fields for Itsme OAuth integration

-- 1. Add Itsme verification fields to profiles
alter table if exists public.profiles
  add column if not exists itsme_verified boolean default false,
  add column if not exists itsme_kyc_level text;

-- 2. Add index for Itsme verified users query
create index if not exists idx_profiles_itsme_verified on public.profiles(itsme_verified) where itsme_verified = true;

-- 3. Add comment for documentation
comment on column public.profiles.itsme_verified is 'Whether the user has verified their identity through Itsme OAuth';
comment on column public.profiles.itsme_kyc_level is 'KYC level from Itsme (e.g., basic, extended, full). NULL means not verified via Itsme.';

