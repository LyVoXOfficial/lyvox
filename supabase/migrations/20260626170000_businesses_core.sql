-- supabase/migrations/20260626170000_businesses_core.sql
-- Phase A0 foundation: business legal entity + team + bootstrap RPC. Spec §6.2, §6.3, §6.8.

create or replace function public.normalize_kbo(p text)
  returns text language sql immutable as $$
  select case when p is null then null else regexp_replace(p, '[^0-9]', '', 'g') end;
$$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  legal_form text,
  kbo_number text unique,
  vat_number text unique,
  vat_liable boolean not null default false,
  email text not null,
  phone_e164 text,
  address_line text, postcode text, city text, country text default 'BE',
  status text not null default 'draft' check (status in ('draft','active','suspended')),
  entity_verified boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_vat_format check (vat_number is null or validate_belgian_vat(vat_number)),
  constraint businesses_kbo_format check (kbo_number is null or kbo_number ~ '^[01][0-9]{9}$')
);
alter table public.businesses enable row level security;
drop trigger if exists set_updated_at_businesses on public.businesses;
create trigger set_updated_at_businesses before update on public.businesses
  for each row execute function public.set_updated_at();

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
alter table public.business_members enable row level security;

create or replace function public.is_business_member(b_id uuid, min_role text default 'member')
  returns boolean language sql security definer stable
  set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = b_id and m.user_id = auth.uid() and m.accepted_at is not null
      and case m.role when 'owner' then 3 when 'admin' then 2 else 1 end
        >= case min_role when 'owner' then 3 when 'admin' then 2 else 1 end);
$$;

create or replace function public.create_business(p_legal_name text, p_kbo text, p_vat text)
  returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  insert into public.businesses (legal_name, kbo_number, vat_number, email, created_by, status)
    values (p_legal_name, public.normalize_kbo(p_kbo), p_vat,
            (select email from auth.users where id = auth.uid()), auth.uid(), 'draft')
    returning id into v_id;
  insert into public.business_members (business_id, user_id, role, accepted_at)
    values (v_id, auth.uid(), 'owner', now());
  return v_id;
end; $$;

-- businesses RLS
drop policy if exists biz_public_read on public.businesses;
create policy biz_public_read on public.businesses for select using (status = 'active');
drop policy if exists biz_member_read on public.businesses;
create policy biz_member_read on public.businesses for select to authenticated using (is_business_member(id));
drop policy if exists biz_owner_write on public.businesses;
create policy biz_owner_write on public.businesses for update to authenticated
  using (is_business_member(id,'owner') or created_by = auth.uid())
  with check (is_business_member(id,'owner') or created_by = auth.uid());
drop policy if exists biz_admin_all on public.businesses;
create policy biz_admin_all on public.businesses for all using (is_admin()) with check (is_admin());

-- business_members RLS
drop policy if exists bm_self_read on public.business_members;
create policy bm_self_read on public.business_members for select to authenticated
  using (user_id = auth.uid() or is_business_member(business_id,'member'));
drop policy if exists bm_invitee_accept on public.business_members;
create policy bm_invitee_accept on public.business_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = (select b.role from public.business_members b
            where b.business_id = business_members.business_id and b.user_id = auth.uid()));
drop policy if exists bm_admin_manage on public.business_members;
create policy bm_admin_manage on public.business_members for insert to authenticated
  with check (is_business_member(business_id,'admin') and role <> 'owner');
drop policy if exists bm_admin_remove on public.business_members;
create policy bm_admin_remove on public.business_members for delete to authenticated
  using (is_business_member(business_id,'admin') and role <> 'owner');
drop policy if exists bm_admin_all on public.business_members;
create policy bm_admin_all on public.business_members for all using (is_admin()) with check (is_admin());
