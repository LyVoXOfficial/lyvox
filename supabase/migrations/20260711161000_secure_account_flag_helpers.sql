-- Converge established projects that already recorded the historical
-- account-flags migration. These helpers accept caller-supplied user IDs, so
-- they are server-only and must never retain Supabase's default PUBLIC EXECUTE.

begin;

set local lock_timeout = '5s';

-- RLS does not apply to TRUNCATE. Supabase's broad table grants can otherwise
-- let browser roles wipe an RLS-protected relation in one statement.
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate on tables from anon, authenticated;

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

comment on function public.is_user_blocked(uuid) is
  'Server-only, read-only block-status helper. Expired timestamps are ignored; cleanup is performed by trusted maintenance code.';
comment on function public.user_has_flag(uuid, text) is
  'Server-only, read-only account-flag helper.';

-- Maintenance helpers mutate materialized views and are never browser RPCs.
create or replace function public.refresh_category_advert_counts()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  refresh materialized view concurrently public.category_advert_counts;
exception
  when others then
    raise warning 'CONCURRENT refresh failed, using regular refresh: %', sqlerrm;
    refresh materialized view public.category_advert_counts;
end;
$function$;

revoke execute on function public.refresh_category_advert_counts()
  from public, anon, authenticated;
grant execute on function public.refresh_category_advert_counts()
  to service_role;

create or replace function public.refresh_top_sellers()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  refresh materialized view concurrently public.top_sellers;
end;
$function$;

revoke execute on function public.refresh_top_sellers()
  from public, anon, authenticated;
grant execute on function public.refresh_top_sellers() to service_role;

-- Trigger execution does not require callers to hold direct EXECUTE on the
-- trigger function. Remove the RPC surface while preserving insert behavior.
create or replace function public.update_conversation_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$function$;

revoke execute on function public.update_conversation_last_message_at()
  from public, anon, authenticated, service_role;

-- Trigger helpers are invoked by PostgreSQL, not as RPCs. Remove every direct
-- execution path left by Supabase's default function ACL.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated, service_role;
revoke execute on function public.cleanup_kyc_on_business_delete()
  from public, anon, authenticated, service_role;
revoke execute on function public.refresh_seller_rating()
  from public, anon, authenticated, service_role;
revoke execute on function public.sync_profile_verified_email()
  from public, anon, authenticated, service_role;
revoke execute on function public.sync_verification_caches()
  from public, anon, authenticated, service_role;

-- create_business is an authenticated self-service RPC. It authorizes through
-- auth.uid() internally; anonymous execution is never part of the contract.
revoke execute on function public.create_business(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_business(text, text, text)
  to authenticated, service_role;

commit;
