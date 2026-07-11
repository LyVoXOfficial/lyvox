-- P0-03: fail-closed launch mode and billing write boundary.
-- contact_only is the immutable safe default: keys and deploy-time flags alone
-- must never make Stripe, entitlement, escrow, or payout paths reachable.

begin;

insert into public.platform_settings (key, value, updated_by)
values
  ('platform.launch_mode', '{"mode":"contact_only"}'::jsonb, null),
  ('platform.money_emergency_stop', '{"stopped":true}'::jsonb, null),
  ('platform.stripe_reconciliation', '{"enabled":false}'::jsonb, null),
  ('capability:pro_subscriptions', '{"enabled":false,"emergencyDisabled":false}'::jsonb, null),
  ('capability:paid_boosts', '{"enabled":false,"emergencyDisabled":false}'::jsonb, null),
  ('capability:boost_ranking', '{"enabled":false,"emergencyDisabled":false}'::jsonb, null),
  ('capability:sms_otp', '{"enabled":false,"emergencyDisabled":false}'::jsonb, null),
  ('capability:payments_escrow', '{"enabled":false,"emergencyDisabled":false}'::jsonb, null)
on conflict (key) do update
set value = excluded.value,
    updated_by = null,
    updated_at = now();

alter table public.platform_settings
  drop constraint if exists platform_settings_launch_mode_check;

alter table public.platform_settings
  add constraint platform_settings_launch_mode_check
  check (
    key <> 'platform.launch_mode'
    or (
      jsonb_typeof(value -> 'mode') = 'string'
      and value ->> 'mode' in ('contact_only', 'paid_platform_services', 'marketplace_payments')
    )
  );

alter table public.products
  add column if not exists capability text;

alter table public.products
  add column if not exists benefit_type text,
  add column if not exists duration_days integer,
  add column if not exists requires_advert boolean not null default true,
  add column if not exists offer_version integer not null default 1,
  add column if not exists tax_behavior text not null default 'exclusive';

-- Never infer an entitlement contract from a mutable product code. Environments
-- with legacy catalogue rows must add an explicit reviewed mapping to this
-- migration before it is allowed to continue.
do $$
begin
  if exists (
    select 1
    from public.products
    where capability is null or benefit_type is null or duration_days is null
  ) then
    raise exception 'legacy products require an explicit capability, benefit_type and duration_days mapping';
  end if;
end;
$$;

alter table public.products
  alter column capability set not null,
  alter column benefit_type set not null,
  alter column duration_days set not null,
  alter column active set default false;

alter table public.products
  drop constraint if exists products_capability_check;

alter table public.products
  add constraint products_capability_check
  check (capability in ('paid_boosts'));

alter table public.products drop constraint if exists products_benefit_type_check;
alter table public.products
  add constraint products_benefit_type_check
  check (benefit_type in ('boost', 'premium', 'hide_phone', 'reserve', 'highlight'));

alter table public.products drop constraint if exists products_duration_days_check;
alter table public.products
  add constraint products_duration_days_check check (duration_days between 1 and 365);

alter table public.products drop constraint if exists products_offer_version_check;
alter table public.products
  add constraint products_offer_version_check check (offer_version > 0);

alter table public.products drop constraint if exists products_tax_behavior_check;
alter table public.products
  add constraint products_tax_behavior_check check (tax_behavior in ('inclusive', 'exclusive'));

alter table public.purchases
  add column if not exists advert_id uuid references public.adverts(id) on delete set null,
  add column if not exists product_offer_version integer not null default 1;

do $$
begin
  if exists (
    select 1 from public.purchases
    where provider_session_id is not null
    group by provider, provider_session_id having count(*) > 1
  ) then
    raise exception 'duplicate provider_session_id rows must be resolved before P0-03';
  end if;
  if exists (
    select 1 from public.benefits
    where purchase_id is not null
    group by purchase_id, benefit_type having count(*) > 1
  ) then
    raise exception 'duplicate purchase benefits must be resolved before P0-03';
  end if;
end;
$$;

create unique index if not exists purchases_provider_session_unique
  on public.purchases(provider, provider_session_id)
  where provider_session_id is not null;

create unique index if not exists benefits_purchase_type_unique
  on public.benefits(purchase_id, benefit_type)
  where purchase_id is not null;

-- Existing catalogue rows predate the legal/company launch gate. They are made
-- dormant explicitly and can only be re-enabled after the audited R2 controls.
update public.products set active = false where active is distinct from false;

-- Financial journal and entitlement rows are server-owned. Browser clients may
-- read their own history through RLS but can never create or mutate it directly.
drop policy if exists "purchases_authenticated_insert" on public.purchases;
drop policy if exists "purchases_admin_manage" on public.purchases;
revoke insert, update, delete, truncate on public.purchases from anon, authenticated;
revoke insert, update, delete, truncate on public.benefits from anon, authenticated;
revoke insert, update, delete, truncate on public.products from anon, authenticated;

-- Profiles are created by handle_new_user(). Allowing a full-row self INSERT
-- lets a deleted row be recreated with forged pro_until / Stripe / trust fields.
drop policy if exists "Owner upsert profile" on public.profiles;
drop policy if exists "Owner delete profile" on public.profiles;
revoke insert, delete, truncate on public.profiles from anon, authenticated;

comment on column public.products.capability is
  'Explicit capability owner for this sellable product. Never infer a money gate from code prefixes.';

comment on constraint platform_settings_launch_mode_check on public.platform_settings is
  'P0-03: only contact-only, LyVoX-owned paid services, or marketplace-payment modes are valid.';

commit;
