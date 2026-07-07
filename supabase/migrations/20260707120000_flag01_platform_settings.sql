-- FLAG-01 · Runtime-config layer: platform_settings.
--
-- The non-secret half of the AND-gate (capabilityOn === toggle && requiredSecretsPresent).
-- Secrets stay in env (Vercel-encrypted); this table holds only the on/off toggle + config,
-- keyed by setting name (e.g. "capability:pro_subscriptions" -> { "enabled": true }).
--
-- Read path: the runtime resolver (lib/settings/platformSettings.ts) reads via the
-- service-role client (bypasses RLS) behind a short-TTL Upstash cache with explicit
-- invalidation on write, so a toggle flip propagates to every Fluid Compute instance
-- within the TTL — no redeploy.
--
-- Write path: admins only. Defense in depth via an is_admin() RLS policy so a signed-in
-- admin can manage rows directly (FLAG-03 admin UI); no grant is issued to `authenticated`,
-- so Supabase's default table-wide grant is inert behind the is_admin() gate. Column names
-- (key/value/updated_at/updated_by) carry no trust/entitlement semantics → RULE-01/01b n/a.

begin;

create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.platform_settings enable row level security;

drop policy if exists "Admin manage platform_settings" on public.platform_settings;
create policy "Admin manage platform_settings" on public.platform_settings
  for all to authenticated using (is_admin()) with check (is_admin());

comment on table public.platform_settings is
  'FLAG-01 runtime config: non-secret capability toggles + config, keyed by setting name. '
  'Secrets stay in env. Read via service-role resolver (Upstash-cached, TTL-invalidated); '
  'written by admins only (is_admin RLS).';

commit;
