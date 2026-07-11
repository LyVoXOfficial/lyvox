-- P0-04: audited capability control plane.
-- Direct writes are removed; every runtime-setting mutation is an atomic,
-- revision-checked, AAL2 admin RPC that writes an immutable before/after audit.

begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb)
      ) as role(value)
      where lower(role.value) = 'admin'
    );
$$;

revoke execute on function public.is_admin() from public, anon, authenticated;
-- Existing public-table admin policies were historically created without
-- `TO authenticated`, so Postgres evaluates is_admin() for anon reads too.
-- The function only inspects the caller's trusted JWT metadata and exposes no
-- table data; grant both roles explicitly until those policies are retired.
grant execute on function public.is_admin() to anon, authenticated;

alter table public.platform_settings
  add column if not exists revision bigint not null default 0;

create table if not exists public.settings_audit (
  id bigint generated always as identity primary key,
  setting_key text not null,
  revision bigint not null,
  operation text not null check (operation in ('insert', 'update')),
  before_value jsonb,
  after_value jsonb not null,
  -- Deliberately not an FK: the stable operator subject remains as audit
  -- evidence after a lawful auth-user erasure.
  actor_id uuid not null,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  request_id text not null,
  source_ip text,
  created_at timestamptz not null default now(),
  unique (setting_key, revision)
);

alter table public.settings_audit enable row level security;

drop policy if exists "Admin read settings_audit with MFA" on public.settings_audit;
create policy "Admin read settings_audit with MFA" on public.settings_audit
  for select to authenticated
  using (public.is_admin() and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');

create or replace function public.reject_settings_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'settings_audit is append-only' using errcode = '42501';
end;
$$;

revoke execute on function public.reject_settings_audit_mutation()
  from public, anon, authenticated;

drop trigger if exists settings_audit_reject_row_mutation on public.settings_audit;
create trigger settings_audit_reject_row_mutation
  before update or delete on public.settings_audit
  for each row execute function public.reject_settings_audit_mutation();

drop trigger if exists settings_audit_reject_truncate on public.settings_audit;
create trigger settings_audit_reject_truncate
  before truncate on public.settings_audit
  for each statement execute function public.reject_settings_audit_mutation();

drop policy if exists "Admin manage platform_settings" on public.platform_settings;
drop policy if exists "Admin read platform_settings with MFA" on public.platform_settings;
create policy "Admin read platform_settings with MFA" on public.platform_settings
  for select to authenticated
  using (public.is_admin() and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');

revoke insert, update, delete, truncate on public.platform_settings from anon, authenticated, service_role;
revoke insert, update, delete, truncate on public.settings_audit from anon, authenticated, service_role;
grant select on public.platform_settings, public.settings_audit to authenticated;

create or replace function public.set_platform_setting(
  p_key text,
  p_value jsonb,
  p_reason text,
  p_expected_revision bigint,
  p_request_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current public.platform_settings%rowtype;
  v_exists boolean := false;
  v_current_revision bigint := -1;
  v_new_revision bigint;
  v_headers jsonb;
  v_source_ip text;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'aal2 required' using errcode = '42501';
  end if;
  if p_key is null or btrim(p_key) = '' then
    raise exception 'setting key is required' using errcode = '22023';
  end if;
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    raise exception 'setting value must be an object' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'reason must contain 3..500 characters' using errcode = '22023';
  end if;

  -- Serialize both existing-row updates and first writes for a new key. A plain
  -- SELECT FOR UPDATE cannot lock a row that does not exist yet.
  perform pg_advisory_xact_lock(hashtext(p_key)::bigint);

  select * into v_current
  from public.platform_settings
  where key = p_key
  for update;

  v_exists := found;
  if v_exists then
    v_current_revision := v_current.revision;
  end if;

  if p_expected_revision is null then
    raise exception 'expected revision is required' using errcode = '22023';
  end if;

  if p_expected_revision is distinct from v_current_revision then
    raise exception 'setting revision conflict' using errcode = '40001';
  end if;

  if v_exists and v_current.value = p_value then
    return v_current_revision;
  end if;

  v_new_revision := v_current_revision + 1;

  insert into public.platform_settings (key, value, updated_at, updated_by, revision)
  values (p_key, p_value, now(), auth.uid(), v_new_revision)
  on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by,
        revision = excluded.revision;

  begin
    v_headers := coalesce(current_setting('request.headers', true), '{}')::jsonb;
    v_source_ip := nullif(
      btrim(
        coalesce(
          v_headers ->> 'cf-connecting-ip',
          split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)
        )
      ),
      ''
    );
  exception when others then
    v_source_ip := null;
  end;

  insert into public.settings_audit (
    setting_key,
    revision,
    operation,
    before_value,
    after_value,
    actor_id,
    reason,
    request_id,
    source_ip
  ) values (
    p_key,
    v_new_revision,
    case when v_exists then 'update' else 'insert' end,
    case when v_exists then v_current.value else null end,
    p_value,
    auth.uid(),
    btrim(p_reason),
    coalesce(nullif(btrim(p_request_id), ''), gen_random_uuid()::text),
    v_source_ip
  );

  return v_new_revision;
end;
$$;

revoke execute on function public.set_platform_setting(text, jsonb, text, bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_platform_setting(text, jsonb, text, bigint, text)
  to authenticated;

create or replace function public.activate_platform_emergency_stop(
  p_key text,
  p_reason text,
  p_request_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_current public.platform_settings%rowtype;
  v_current_revision bigint := -1;
  v_value jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'admin authentication required' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'aal2 required' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception 'reason must contain 3..500 characters' using errcode = '22023';
  end if;
  if p_key <> 'platform.money_emergency_stop' and p_key not like 'capability:%' then
    raise exception 'unsupported emergency setting' using errcode = '22023';
  end if;

  -- Lock by key even when the row does not exist, then patch the latest value.
  -- No stale read from the application can delay a monotonic safety action.
  perform pg_advisory_xact_lock(hashtext(p_key)::bigint);
  select * into v_current
  from public.platform_settings
  where key = p_key
  for update;

  if found then
    v_current_revision := v_current.revision;
    v_value := v_current.value;
  end if;

  if p_key = 'platform.money_emergency_stop' then
    if v_value -> 'stopped' = 'true'::jsonb then
      return v_current_revision;
    end if;
    v_value := jsonb_set(v_value, '{stopped}', 'true'::jsonb, true);
  else
    if v_value -> 'emergencyDisabled' = 'true'::jsonb then
      return v_current_revision;
    end if;
    v_value := jsonb_set(v_value, '{emergencyDisabled}', 'true'::jsonb, true);
  end if;

  return public.set_platform_setting(
    p_key,
    v_value,
    p_reason,
    v_current_revision,
    p_request_id
  );
end;
$$;

revoke execute on function public.activate_platform_emergency_stop(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.activate_platform_emergency_stop(text, text, text)
  to authenticated;

create table if not exists public.integration_health (
  integration_id text primary key,
  status text not null check (status in ('healthy', 'degraded', 'unhealthy', 'unknown')),
  checked_at timestamptz not null,
  expires_at timestamptz not null,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  safe_error_code text,
  updated_at timestamptz not null default now()
);

alter table public.integration_health enable row level security;
drop policy if exists "Admin read integration health with MFA" on public.integration_health;
create policy "Admin read integration health with MFA" on public.integration_health
  for select to authenticated
  using (public.is_admin() and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');

revoke insert, update, delete on public.integration_health from anon, authenticated;
grant select on public.integration_health to authenticated;

comment on table public.settings_audit is
  'Append-only audit for every runtime setting change; immutable even to service_role through grants and triggers.';
comment on function public.set_platform_setting(text, jsonb, text, bigint, text) is
  'AAL2 admin-only atomic setting mutation with optimistic revision and immutable before/after audit.';
comment on function public.activate_platform_emergency_stop(text, text, text) is
  'AAL2 admin-only monotonic safety patch that preserves concurrent setting fields.';
comment on table public.integration_health is
  'Secret-free current provider health snapshot; raw provider responses and credentials are forbidden.';

commit;
