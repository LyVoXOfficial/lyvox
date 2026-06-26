-- supabase/migrations/20260626173000_kyc_records.sql  (Spec §6.5, §6.8)
create table if not exists public.kyc_records (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,
  data_class text not null check (data_class in ('dsa_trader_copy','id_document','eid_attributes','aml_screen')),
  document_ref text,
  meta jsonb,
  legal_basis text check (legal_basis in ('consumer_law','dsa_art30','dac7','consent')),
  retention_until timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.kyc_records enable row level security;
create index if not exists kyc_subject_idx on public.kyc_records(subject_type, subject_id);

-- Orphan cleanup (polymorphic table has no FK cascade): drop dependent rows on business delete.
create or replace function public.cleanup_kyc_on_business_delete()
  returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  delete from public.kyc_records where subject_type='business' and subject_id = old.id;
  delete from public.verifications where subject_type='business' and subject_id = old.id;
  delete from public.badges_awarded where subject_type='business' and subject_id = old.id;
  return old;
end; $$;
drop trigger if exists trg_cleanup_business_subjects on public.businesses;
create trigger trg_cleanup_business_subjects before delete on public.businesses
  for each row execute function public.cleanup_kyc_on_business_delete();

drop policy if exists kyc_owner_read on public.kyc_records;
create policy kyc_owner_read on public.kyc_records for select to authenticated using (
  (subject_type='user' and subject_id = auth.uid())
  or (subject_type='business' and is_business_member(subject_id,'owner')));
drop policy if exists kyc_admin_all on public.kyc_records;
create policy kyc_admin_all on public.kyc_records for all using (is_admin()) with check (is_admin());
