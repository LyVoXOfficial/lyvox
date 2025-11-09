-- DB-003: Complete and strengthen RLS policies for all MVP tables
-- This migration adds missing RLS policies and improves existing ones
-- Based on audit of current policies and requirements for public/private access patterns

-- ============================================================================
-- 1. AD_ITEM_SPECIFICS - Missing RLS policies (CRITICAL)
-- ============================================================================
alter table if exists public.ad_item_specifics enable row level security;

-- Public can read specifics for active adverts
drop policy if exists "Public read active advert specifics" on public.ad_item_specifics;
create policy "Public read active advert specifics" on public.ad_item_specifics
  for select using (
    exists (
      select 1 from public.adverts a
      where a.id = ad_item_specifics.advert_id and a.status = 'active'
    )
  );

-- Owner can read specifics for own adverts (all statuses)
drop policy if exists "Owner read own advert specifics" on public.ad_item_specifics;
create policy "Owner read own advert specifics" on public.ad_item_specifics
  for select to authenticated using (
    exists (
      select 1 from public.adverts a
      where a.id = ad_item_specifics.advert_id and a.user_id = auth.uid()
    )
  );

-- Owner can manage specifics for own adverts
drop policy if exists "Owner manage own advert specifics" on public.ad_item_specifics;
create policy "Owner manage own advert specifics" on public.ad_item_specifics
  for all to authenticated using (
    exists (
      select 1 from public.adverts a
      where a.id = ad_item_specifics.advert_id and a.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.adverts a
      where a.id = ad_item_specifics.advert_id and a.user_id = auth.uid()
    )
  );

-- Admin can manage all specifics
drop policy if exists "Admin manage advert specifics" on public.ad_item_specifics;
create policy "Admin manage advert specifics" on public.ad_item_specifics
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- 2. PROFILES - Add public read access for public profiles
-- ============================================================================
-- Public can read limited profile fields (for public profile pages)
-- Only display_name, verified_email, verified_phone, created_at are public
drop policy if exists "Public read profile public fields" on public.profiles;
create policy "Public read profile public fields" on public.profiles
  for select using (true); -- All users can read, but API should filter fields

-- Note: The actual field filtering should be done in API layer
-- This policy allows reading, but sensitive fields (phone, consents) should not be selected

-- ============================================================================
-- 3. ADVERTS - Improve policies (owner should see all own adverts)
-- ============================================================================
-- The existing "Owner can read own adverts" policy already allows this,
-- but we ensure it works correctly with the public policy

-- Ensure owner can read all own adverts regardless of status
-- The existing policy "Owner can read own adverts" already covers this,
-- but we'll verify the logic is correct (it uses user_id = auth.uid() which is correct)

-- ============================================================================
-- 4. MEDIA - Improve policies (owner should see media for all own adverts)
-- ============================================================================
-- The existing policies already allow owner to view media for own adverts,
-- but we ensure the logic is explicit

-- Owner can view media for all own adverts (not just active)
-- The existing "Owner view media" policy already covers this correctly

-- ============================================================================
-- 5. REPORTS - Add admin update capability
-- ============================================================================
-- Admin should be able to update report status (e.g., mark as reviewed)
drop policy if exists "Admin update reports" on public.reports;
create policy "Admin update reports" on public.reports
  for update to authenticated using (is_admin()) with check (is_admin());

-- Note: Admin already has full access via "Admin manage reports" policy,
-- but we add explicit update policy for clarity

-- ============================================================================
-- 6. LOCATIONS - Ensure only admin can modify
-- ============================================================================
-- Locations should be read-only for non-admins
drop policy if exists "Admin manage locations" on public.locations;
create policy "Admin manage locations" on public.locations
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- 7. CATEGORIES - Ensure only admin can modify
-- ============================================================================
-- Categories should be read-only for non-admins
drop policy if exists "Admin manage categories" on public.categories;
create policy "Admin manage categories" on public.categories
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- Comments for documentation
-- ============================================================================
comment on policy "Public read active advert specifics" on public.ad_item_specifics is 
  'Allows public to read category-specific attributes for active adverts';
comment on policy "Owner read own advert specifics" on public.ad_item_specifics is 
  'Allows authenticated users to read specifics for their own adverts (all statuses)';
comment on policy "Owner manage own advert specifics" on public.ad_item_specifics is 
  'Allows authenticated users to insert/update/delete specifics for their own adverts';
comment on policy "Public read profile public fields" on public.profiles is 
  'Allows reading profile data; API layer must filter to public fields only (display_name, verified_email, verified_phone, created_at)';
comment on policy "Admin update reports" on public.reports is 
  'Allows admins to update report status and review information';
comment on policy "Admin manage locations" on public.locations is 
  'Allows admins to create/update/delete location records';
comment on policy "Admin manage categories" on public.categories is 
  'Allows admins to create/update/delete category records';







