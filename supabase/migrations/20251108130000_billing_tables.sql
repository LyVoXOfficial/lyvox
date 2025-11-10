-- BILL-001: Billing tables migration
-- Creates products, purchases, and benefits tables
-- Includes indexes, triggers, and foreign key constraints

-- 1. Products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name jsonb not null, -- {en: 'Boost for 7 days', nl: 'Boost voor 7 dagen', ...}
  price_cents integer not null check (price_cents >= 0),
  currency text default 'EUR',
  active boolean default true,
  created_at timestamptz default now()
);

-- 2. Purchases table
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null references public.products(code),
  provider text not null check (provider in ('stripe', 'mollie')),
  provider_session_id text,
  provider_payment_intent_id text,
  status text not null check (status in ('pending', 'completed', 'failed', 'refunded')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text default 'EUR',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Benefits table
create table if not exists public.benefits (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references public.purchases(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  advert_id uuid references public.adverts(id) on delete cascade,
  benefit_type text not null check (benefit_type in ('boost', 'premium', 'hide_phone', 'reserve', 'highlight')),
  valid_from timestamptz default now(),
  valid_until timestamptz not null,
  created_at timestamptz default now()
);

-- 4. Indexes for performance
create index if not exists idx_products_code on public.products(code) where active = true;
create index if not exists idx_products_active on public.products(active) where active = true;

create index if not exists idx_purchases_user_status on public.purchases(user_id, status, created_at desc);
create index if not exists idx_purchases_provider_session on public.purchases(provider_session_id) where provider_session_id is not null;
create index if not exists idx_purchases_product_code on public.purchases(product_code);

create index if not exists idx_benefits_user_valid on public.benefits(user_id, valid_until desc);
create index if not exists idx_benefits_advert on public.benefits(advert_id) where advert_id is not null;
create index if not exists idx_benefits_type_valid on public.benefits(benefit_type, valid_until desc) where valid_until > now();
create index if not exists idx_benefits_purchase on public.benefits(purchase_id) where purchase_id is not null;

-- 5. Triggers for updated_at
create trigger set_updated_at_purchases
  before update on public.purchases
  for each row
  execute function public.set_updated_at();

