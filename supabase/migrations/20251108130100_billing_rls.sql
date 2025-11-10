-- BILL-001: RLS policies for billing tables
-- Enables row-level security and creates policies for products, purchases, and benefits

-- Enable RLS on all billing tables
alter table if exists public.products enable row level security;
alter table if exists public.purchases enable row level security;
alter table if exists public.benefits enable row level security;

-- ============================================================================
-- PRODUCTS policies
-- ============================================================================

-- Public can read active products
drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active" on public.products
  for select
  using (active = true);

-- Admins can manage all products
drop policy if exists "products_admin_manage" on public.products;
create policy "products_admin_manage" on public.products
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- PURCHASES policies
-- ============================================================================

-- Users can read their own purchases
drop policy if exists "purchases_user_read_own" on public.purchases;
create policy "purchases_user_read_own" on public.purchases
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Admins can read all purchases
drop policy if exists "purchases_admin_read" on public.purchases;
create policy "purchases_admin_read" on public.purchases
  for select
  using (public.is_admin());

-- Note: Insert/Update for purchases should be handled via server actions
-- with proper authorization checks. We allow inserts only for authenticated users,
-- but the server action must verify the user is creating their own purchase.
drop policy if exists "purchases_authenticated_insert" on public.purchases;
create policy "purchases_authenticated_insert" on public.purchases
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Admins can manage all purchases
drop policy if exists "purchases_admin_manage" on public.purchases;
create policy "purchases_admin_manage" on public.purchases
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- BENEFITS policies
-- ============================================================================

-- Users can read their own benefits
drop policy if exists "benefits_user_read_own" on public.benefits;
create policy "benefits_user_read_own" on public.benefits
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Public can read benefits for active adverts (to show badges)
drop policy if exists "benefits_public_read_active_adverts" on public.benefits;
create policy "benefits_public_read_active_adverts" on public.benefits
  for select
  using (
    advert_id is not null
    and exists (
      select 1 from public.adverts a
      where a.id = benefits.advert_id
        and a.status = 'active'
    )
    and valid_until > now()
  );

-- Admins can read all benefits
drop policy if exists "benefits_admin_read" on public.benefits;
create policy "benefits_admin_read" on public.benefits
  for select
  using (public.is_admin());

-- Note: Insert/Update for benefits should be handled via server actions
-- (typically from webhook handlers with service role)
-- Admins can manage all benefits
drop policy if exists "benefits_admin_manage" on public.benefits;
create policy "benefits_admin_manage" on public.benefits
  for all
  using (public.is_admin())
  with check (public.is_admin());

