-- supabase/migrations/20260626172000_verifications.sql  (Spec §6.4, §6.8)
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,
  method text not null check (method in ('email','phone','itsme','eid','kbo','vies','manual')),
  status text not null default 'pending' check (status in ('pending','verified','failed','expired','revoked')),
  evidence jsonb,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.verifications enable row level security;
create unique index if not exists uq_ver_active on public.verifications(subject_type, subject_id, method)
  where status in ('pending','verified');

-- Cache-sync: recompute the relevant boolean from the latest verified row for (subject, method).
create or replace function public.sync_verification_caches()
  returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare s_type text; s_id uuid; m text; is_ver boolean;
begin
  s_type := coalesce(new.subject_type, old.subject_type);
  s_id   := coalesce(new.subject_id, old.subject_id);
  m      := coalesce(new.method, old.method);
  is_ver := exists (select 1 from public.verifications v
                    where v.subject_type=s_type and v.subject_id=s_id and v.method=m and v.status='verified');
  if s_type='user' then
    if m='email' then update public.profiles set verified_email=is_ver where id=s_id;
    elsif m='phone' then update public.profiles set verified_phone=is_ver where id=s_id;
    elsif m in ('itsme','eid') then update public.profiles set itsme_verified=is_ver where id=s_id;
    end if;
  elsif s_type='business' then
    if m in ('kbo','vies') then
      update public.businesses set entity_verified=
        exists (select 1 from public.verifications v where v.subject_type='business' and v.subject_id=s_id
                and v.method in ('kbo','vies') and v.status='verified')
        where id=s_id;
    end if;
  end if;
  return null;
end; $$;
drop trigger if exists trg_sync_verification_caches on public.verifications;
create trigger trg_sync_verification_caches
  after insert or update or delete on public.verifications
  for each row execute function public.sync_verification_caches();

-- Backfill: seed verified rows from the existing booleans so the ledger is the source of truth going forward.
insert into public.verifications (subject_type, subject_id, method, status, verified_at)
  select 'user', id, 'email', 'verified', now() from public.profiles where coalesce(verified_email,false)
  on conflict do nothing;
insert into public.verifications (subject_type, subject_id, method, status, verified_at)
  select 'user', id, 'phone', 'verified', now() from public.profiles where coalesce(verified_phone,false)
  on conflict do nothing;
insert into public.verifications (subject_type, subject_id, method, status, verified_at)
  select 'user', id, 'itsme', 'verified', now() from public.profiles where coalesce(itsme_verified,false)
  on conflict do nothing;

-- RLS: owner-of-subject + admin; never public.
drop policy if exists ver_owner_read on public.verifications;
create policy ver_owner_read on public.verifications for select to authenticated using (
  (subject_type='user' and subject_id = auth.uid())
  or (subject_type='business' and is_business_member(subject_id,'admin')));
drop policy if exists ver_admin_all on public.verifications;
create policy ver_admin_all on public.verifications for all using (is_admin()) with check (is_admin());
