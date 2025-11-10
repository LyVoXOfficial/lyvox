-- FRAUD-001: RLS policies for fraud_rules and fraud_detection_logs tables
-- Enables row-level security and creates policies

-- Enable RLS on fraud tables
alter table if exists public.fraud_rules enable row level security;
alter table if exists public.fraud_detection_logs enable row level security;

-- ============================================================================
-- FRAUD_RULES policies
-- ============================================================================

-- Admins can read all fraud rules
drop policy if exists "fraud_rules_admin_read" on public.fraud_rules;
create policy "fraud_rules_admin_read" on public.fraud_rules
  for select
  using (public.is_admin());

-- Only service role can insert/update/delete fraud rules (managed by admin API)
drop policy if exists "fraud_rules_service_manage" on public.fraud_rules;
create policy "fraud_rules_service_manage" on public.fraud_rules
  for all
  to service_role
  using (true)
  with check (true);

-- Admins can manage fraud rules
drop policy if exists "fraud_rules_admin_manage" on public.fraud_rules;
create policy "fraud_rules_admin_manage" on public.fraud_rules
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- FRAUD_DETECTION_LOGS policies
-- ============================================================================

-- Admins can read all fraud detection logs
drop policy if exists "fraud_detection_logs_admin_read" on public.fraud_detection_logs;
create policy "fraud_detection_logs_admin_read" on public.fraud_detection_logs
  for select
  using (public.is_admin());

-- Users can read their own fraud detection logs
drop policy if exists "fraud_detection_logs_user_read" on public.fraud_detection_logs;
create policy "fraud_detection_logs_user_read" on public.fraud_detection_logs
  for select
  using (auth.uid() = user_id);

-- Only service role can insert fraud detection logs (managed by Edge Functions/cron)
drop policy if exists "fraud_detection_logs_service_insert" on public.fraud_detection_logs;
create policy "fraud_detection_logs_service_insert" on public.fraud_detection_logs
  for insert
  to service_role
  with check (true);

-- Admins can delete fraud detection logs (for cleanup)
drop policy if exists "fraud_detection_logs_admin_delete" on public.fraud_detection_logs;
create policy "fraud_detection_logs_admin_delete" on public.fraud_detection_logs
  for delete
  using (public.is_admin());

