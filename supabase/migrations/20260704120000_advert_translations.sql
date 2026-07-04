create table if not exists public.advert_translations (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  source_locale text not null,
  target_locale text not null,
  title text not null,
  description text,
  generated_by text not null,
  model_or_provider text not null,
  source_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'reviewed', 'stale', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (advert_id, target_locale, source_hash)
);

alter table public.advert_translations
  drop constraint if exists advert_translations_status_check;

alter table public.advert_translations
  add constraint advert_translations_status_check
  check (status in ('draft', 'published', 'reviewed', 'stale', 'rejected'));

alter table public.advert_translations enable row level security;

create index if not exists advert_translations_advert_target_idx
  on public.advert_translations (advert_id, target_locale);

drop trigger if exists set_updated_at_advert_translations on public.advert_translations;
create trigger set_updated_at_advert_translations
  before update on public.advert_translations
  for each row execute function public.set_updated_at();

drop policy if exists advert_translations_public_read_published on public.advert_translations;
create policy advert_translations_public_read_published on public.advert_translations
  for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.adverts
      where adverts.id = advert_translations.advert_id
        and adverts.status = 'active'
    )
  );

drop policy if exists advert_translations_service_insert on public.advert_translations;
create policy advert_translations_service_insert on public.advert_translations
  for insert
  to service_role
  with check (true);

drop policy if exists advert_translations_service_update on public.advert_translations;
create policy advert_translations_service_update on public.advert_translations
  for update
  to service_role
  using (true)
  with check (true);

revoke all on table public.advert_translations from public, anon, authenticated;

grant select (
  id,
  advert_id,
  source_locale,
  target_locale,
  title,
  description,
  generated_by,
  model_or_provider,
  source_hash,
  status,
  created_at,
  updated_at
) on table public.advert_translations to anon, authenticated, service_role;

grant insert (
  advert_id,
  source_locale,
  target_locale,
  title,
  description,
  generated_by,
  model_or_provider,
  source_hash,
  status
) on table public.advert_translations to service_role;

grant update (
  source_locale,
  target_locale,
  title,
  description,
  generated_by,
  model_or_provider,
  source_hash,
  status,
  updated_at
) on table public.advert_translations to service_role;
