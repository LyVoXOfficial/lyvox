-- AI-002: RLS policies for moderation_logs table
-- Enables row-level security and creates policies for moderation_logs

-- Enable RLS on moderation_logs table
alter table if exists public.moderation_logs enable row level security;

-- ============================================================================
-- MODERATION_LOGS policies
-- ============================================================================

-- Admins and moderators can read all moderation logs
drop policy if exists "moderation_logs_admin_read" on public.moderation_logs;
create policy "moderation_logs_admin_read" on public.moderation_logs
  for select
  using (public.is_admin());

-- Advert owners can read moderation logs for their own adverts
drop policy if exists "moderation_logs_owner_read" on public.moderation_logs;
create policy "moderation_logs_owner_read" on public.moderation_logs
  for select
  using (
    exists (
      select 1 from public.adverts
      where adverts.id = moderation_logs.advert_id
        and adverts.user_id = auth.uid()
    )
  );

-- Only service role can insert moderation logs (managed by Edge Functions/API)
drop policy if exists "moderation_logs_service_insert" on public.moderation_logs;
create policy "moderation_logs_service_insert" on public.moderation_logs
  for insert
  to service_role
  with check (true);

-- Admins can update moderation logs
drop policy if exists "moderation_logs_admin_update" on public.moderation_logs;
create policy "moderation_logs_admin_update" on public.moderation_logs
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Admins can delete moderation logs (for cleanup)
drop policy if exists "moderation_logs_admin_delete" on public.moderation_logs;
create policy "moderation_logs_admin_delete" on public.moderation_logs
  for delete
  using (public.is_admin());

