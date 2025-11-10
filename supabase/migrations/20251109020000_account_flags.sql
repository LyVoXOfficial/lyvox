-- FRAUD-003: Account flags and blocking
-- Adds flags and blocked_until fields to profiles table

-- 1. Add flags column to profiles (JSONB for flexible flag structure)
alter table if exists public.profiles
  add column if not exists flags jsonb default '{}'::jsonb,
  add column if not exists blocked_until timestamptz;

-- 2. Add index for blocked users query
create index if not exists idx_profiles_blocked on public.profiles(blocked_until) where blocked_until is not null and blocked_until > now();

-- 3. Add index for flags query (for users with specific flags)
create index if not exists idx_profiles_flags on public.profiles using gin(flags);

-- 4. Add comment for documentation
comment on column public.profiles.flags is 'JSON object containing account flags. Common flags: fraud_suspected, spam_detected, manual_review, high_risk, etc.';
comment on column public.profiles.blocked_until is 'Timestamp until which the account is blocked. NULL means not blocked.';

-- 5. Create helper function to check if user is blocked
create or replace function public.is_user_blocked(user_id_param uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  blocked_until_val timestamptz;
begin
  select blocked_until into blocked_until_val
  from public.profiles
  where id = user_id_param;
  
  if blocked_until_val is null then
    return false;
  end if;
  
  if blocked_until_val > now() then
    return true;
  else
    -- Block has expired, clear it
    update public.profiles
    set blocked_until = null
    where id = user_id_param;
    return false;
  end if;
end;
$$;

-- 6. Create helper function to check if user has a specific flag
create or replace function public.user_has_flag(user_id_param uuid, flag_name text)
returns boolean
language plpgsql
security definer
as $$
declare
  flags_val jsonb;
begin
  select flags into flags_val
  from public.profiles
  where id = user_id_param;
  
  if flags_val is null then
    return false;
  end if;
  
  return (flags_val ? flag_name) and (flags_val->>flag_name)::boolean = true;
end;
$$;

