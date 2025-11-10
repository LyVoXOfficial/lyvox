-- NOTIF-001: RLS policies for notifications table
-- Enables row-level security and creates policies for notifications

-- Enable RLS on notifications table
alter table if exists public.notifications enable row level security;

-- ============================================================================
-- NOTIFICATIONS policies
-- ============================================================================

-- Users can read their own notifications
drop policy if exists "notifications_user_read_own" on public.notifications;
create policy "notifications_user_read_own" on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Admins can read all notifications
drop policy if exists "notifications_admin_read" on public.notifications;
create policy "notifications_admin_read" on public.notifications
  for select
  using (public.is_admin());

-- Note: Insert for notifications should be handled via server actions
-- with service role (typically from webhook handlers or background jobs)
-- Admins can manage all notifications
drop policy if exists "notifications_admin_manage" on public.notifications;
create policy "notifications_admin_manage" on public.notifications
  for all
  using (public.is_admin())
  with check (public.is_admin());

