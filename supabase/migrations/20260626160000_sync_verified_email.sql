-- Keep profiles.verified_email in sync with auth.users.email_confirmed_at.
-- Bug: verified_email was set only at registration (false until confirmed) and never updated
-- after the user confirmed their email, so gated pages (e.g. /post) wrongly showed
-- "email confirmation missing" for confirmed accounts.

create or replace function public.sync_profile_verified_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set verified_email = (new.email_confirmed_at is not null)
    where id = new.id
      and verified_email is distinct from (new.email_confirmed_at is not null);
  return new;
end;
$$;

drop trigger if exists sync_verified_email on auth.users;
create trigger sync_verified_email
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.sync_profile_verified_email();

-- Backfill rows whose email is already confirmed but whose flag is stale.
update public.profiles p
  set verified_email = true
  from auth.users u
  where p.id = u.id
    and u.email_confirmed_at is not null
    and coalesce(p.verified_email, false) = false;
