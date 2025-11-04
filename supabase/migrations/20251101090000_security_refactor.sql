-- Harden security-sensitive helpers and OTP storage
set check_function_bodies = off;

-- Ensure hashing helpers are available
create extension if not exists pgcrypto;

-- Recreate handle_new_user with explicit search_path and conflict safety
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.profiles (id, display_name, verified_email, verified_phone)
  values (new.id, null, false, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Standardise updated_at handling to UTC
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Remove legacy triggers before removing old helper
drop trigger if exists set_updated_at_reports on public.reports;
drop trigger if exists trg_reports_touch_updated on public.reports;
drop trigger if exists set_updated_at_trust_score on public.trust_score;
drop trigger if exists trg_trust_score_touch_updated on public.trust_score;
drop function if exists public.touch_updated_at();

-- Recreate triggers with the single helper
create trigger set_updated_at_reports
  before update on public.reports
  for each row
  execute function public.set_updated_at();

create trigger set_updated_at_trust_score
  before update on public.trust_score
  for each row
  execute function public.set_updated_at();

-- Remove permissive duplicate policy on logs
drop policy if exists "insert logs" on public.logs;

-- Harden OTP storage (salted hash, no plaintext)
alter table public.phone_otps
  add column if not exists code_salt text,
  add column if not exists code_hash text,
  add column if not exists code_last_four text;

update public.phone_otps
set code_salt = encode(extensions.gen_random_bytes(16), 'hex')
where code_salt is null;

update public.phone_otps
set code_hash = encode(extensions.digest(code || ':' || code_salt, 'sha256'), 'hex')
where code_hash is null and code is not null;

update public.phone_otps
set code_last_four = right(code, 4)
where code_last_four is null and code is not null;

alter table public.phone_otps
  drop column if exists code;

alter table public.phone_otps
  alter column code_salt set not null,
  alter column code_hash set not null,
  alter column code_last_four set not null;

alter table public.phone_otps
  add constraint phone_otps_code_last_four_check
  check (char_length(code_last_four) = 4);

-- Collapse duplicate active OTP rows before enforcing unique constraint
with ranked_otps as (
  select id,
         row_number() over (partition by user_id, e164 order by created_at desc, id desc) as rn
  from public.phone_otps
  where used = false
)
update public.phone_otps
set used = true
where id in (select id from ranked_otps where rn > 1);

create index if not exists phone_otps_user_active_idx
  on public.phone_otps (user_id, expires_at)
  where used = false;

-- Prevent multiple active OTP rows per user/phone
create unique index if not exists phone_otps_one_active_per_phone_idx
  on public.phone_otps (user_id, e164)
  where used = false;

comment on column public.phone_otps.code_hash is 'SHA-256 hash using per-row salt of the OTP code.';
comment on column public.phone_otps.code_salt is 'Hex encoded salt used for hashing OTP code.';
comment on column public.phone_otps.code_last_four is 'Last four digits of issued OTP for masked display/logs.';
