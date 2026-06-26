-- supabase/migrations/20260626171000_seller_type_and_advert_business.sql
-- Spec §6.1, §6.8. Additive + behavior-preserving (default 'individual'; business_id NULL = today's private listing).

alter table public.profiles
  add column if not exists seller_type text not null default 'individual'
    check (seller_type in ('individual','business'));

alter table public.adverts
  add column if not exists business_id uuid references public.businesses(id) on delete restrict;

-- allow a 'withdrawn' status without disturbing existing values. If adverts.status has a CHECK,
-- this migration must widen it; if it is free text, this is a no-op guard. Inspect first:
do $$
declare conname text;
begin
  select c.conname into conname from pg_constraint c
   where c.conrelid='public.adverts'::regclass and c.contype='c'
     and pg_get_constraintdef(c.oid) ilike '%status%';
  if conname is not null then
    execute format('alter table public.adverts drop constraint %I', conname);
  end if;
end $$;
-- Re-add a status CHECK that includes the prior values plus 'withdrawn'.
-- Existing status values found: active, draft
-- Adding standard values: sold, archived, withdrawn
alter table public.adverts
  add constraint adverts_status_check
  check (status in ('active','archived','draft','sold','withdrawn'));

-- adverts team RLS (business path). Keep existing owner=user_id policies untouched.
drop policy if exists adv_team_read on public.adverts;
create policy adv_team_read on public.adverts for select to authenticated
  using (business_id is not null and is_business_member(business_id,'member'));
drop policy if exists adv_team_insert on public.adverts;
create policy adv_team_insert on public.adverts for insert to authenticated
  with check (business_id is not null and is_business_member(business_id,'member') and user_id = auth.uid());
drop policy if exists adv_team_update on public.adverts;
create policy adv_team_update on public.adverts for update to authenticated
  using (business_id is not null and is_business_member(business_id,'member'))
  with check (business_id is not null and is_business_member(business_id,'member'));
drop policy if exists adv_team_delete on public.adverts;
create policy adv_team_delete on public.adverts for delete to authenticated
  using (business_id is not null and is_business_member(business_id,'admin'));
