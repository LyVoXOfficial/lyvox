-- Team management: look up a user id by email for invitations (auth.users is not PostgREST-exposed).
-- SECURITY DEFINER so the service-role route can resolve an invitee's email to their id.
--
-- IMPORTANT (function-grant lesson): Supabase default privileges grant EXECUTE on new public functions to
-- authenticated AND anon. `revoke from public` is NOT enough — without the explicit revoke below, any user
-- could enumerate which emails are registered. Granted ONLY to service_role.

begin;

create or replace function public.find_user_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke execute on function public.find_user_by_email(text) from public, authenticated, anon;
grant execute on function public.find_user_by_email(text) to service_role;

commit;
