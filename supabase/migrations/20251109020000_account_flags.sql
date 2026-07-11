-- FRAUD-003: Account flags and blocking
-- Adds flags and blocked_until fields to profiles table

-- 1. Add flags column to profiles (JSONB for flexible flag structure)
alter table if exists public.profiles
  add column if not exists flags jsonb default '{}'::jsonb,
  add column if not exists blocked_until timestamptz;

-- 2. Add index for blocked users query.
-- Fresh-replay exception: now() cannot appear in an index predicate. The
-- static non-null predicate still supports blocked_until > now() range scans.
create index if not exists idx_profiles_blocked
  on public.profiles(blocked_until)
  where blocked_until is not null;

-- 3. Add index for flags query (for users with specific flags)
create index if not exists idx_profiles_flags on public.profiles using gin(flags);

-- 4. Add comment for documentation
comment on column public.profiles.flags is 'JSON object containing account flags. Common flags: fraud_suspected, spam_detected, manual_review, high_risk, etc.';
comment on column public.profiles.blocked_until is 'Timestamp until which the account is blocked. NULL means not blocked.';

-- 5. Create a read-only helper for trusted server-side fraud checks.
create or replace function public.is_user_blocked(user_id_param uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select profile.blocked_until > pg_catalog.now()
      from public.profiles as profile
      where profile.id = user_id_param
    ),
    false
  );
$function$;

revoke execute on function public.is_user_blocked(uuid)
  from public, anon, authenticated;
grant execute on function public.is_user_blocked(uuid) to service_role;

-- 6. Create a read-only helper for trusted server-side flag checks.
create or replace function public.user_has_flag(user_id_param uuid, flag_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select profile.flags -> flag_name = 'true'::pg_catalog.jsonb
      from public.profiles as profile
      where profile.id = user_id_param
    ),
    false
  );
$function$;

revoke execute on function public.user_has_flag(uuid, text)
  from public, anon, authenticated;
grant execute on function public.user_has_flag(uuid, text) to service_role;
