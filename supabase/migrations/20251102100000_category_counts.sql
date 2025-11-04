-- DB-005: Create materialized view for counting adverts by category
-- This migration creates a materialized view to efficiently count active adverts per category
-- and sets up automatic refresh via pg_cron every hour

-- ============================================================================
-- 1. Enable pg_cron extension (if available)
-- ============================================================================

-- Note: pg_cron may not be available in all Supabase instances
-- If pg_cron is not available, manual refresh will be required
do $$
begin
  -- Try to enable pg_cron extension
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Check if extension exists in the database
    if exists (
      select 1 from pg_available_extensions where name = 'pg_cron'
    ) then
      create extension if not exists pg_cron;
      raise notice 'pg_cron extension enabled successfully';
    else
      raise notice 'pg_cron extension is not available in this database instance. Manual refresh will be required.';
    end if;
  else
    raise notice 'pg_cron extension already enabled';
  end if;
exception
  when insufficient_privilege then
    raise notice 'pg_cron extension requires superuser privileges. Manual refresh will be required.';
  when others then
    raise notice 'Could not enable pg_cron extension: %', sqlerrm;
end $$;

-- ============================================================================
-- 2. Create materialized view for category advert counts
-- ============================================================================

-- Materialized view that counts active adverts per category
-- Only counts adverts with status = 'active'
-- Includes all categories, even if they have 0 adverts (for completeness)
create materialized view if not exists public.category_advert_counts as
select
  c.id as category_id,
  c.parent_id,
  c.slug,
  c.level,
  c.is_active,
  coalesce(count(a.id) filter (where a.status = 'active'), 0) as advert_count,
  now() as last_refreshed_at
from public.categories c
left join public.adverts a on a.category_id = c.id
group by c.id, c.parent_id, c.slug, c.level, c.is_active;

-- Add unique index on category_id for fast lookups
create unique index if not exists category_advert_counts_category_id_idx
  on public.category_advert_counts(category_id);

-- Add index on parent_id for hierarchical queries
create index if not exists category_advert_counts_parent_id_idx
  on public.category_advert_counts(parent_id)
  where parent_id is not null;

-- Add index on is_active for filtering active categories
create index if not exists category_advert_counts_is_active_idx
  on public.category_advert_counts(is_active)
  where is_active = true;

-- Add comment for documentation
comment on materialized view public.category_advert_counts is 
'Materialized view counting active adverts per category. 
Automatically refreshed every hour via pg_cron.
Use REFRESH MATERIALIZED VIEW CONCURRENTLY for zero-downtime updates.';

comment on column public.category_advert_counts.category_id is 'Category UUID';
comment on column public.category_advert_counts.advert_count is 'Number of active adverts in this category';
comment on column public.category_advert_counts.last_refreshed_at is 'Timestamp of last refresh';

-- ============================================================================
-- 3. Create function to refresh the materialized view
-- ============================================================================

-- Function to refresh the materialized view
-- Uses CONCURRENTLY for zero-downtime refresh (requires unique index)
create or replace function public.refresh_category_advert_counts()
returns void
language plpgsql
security definer
as $$
begin
  -- Refresh materialized view concurrently (requires unique index on category_id)
  -- This allows queries to continue reading the old data while refresh is in progress
  refresh materialized view concurrently public.category_advert_counts;
  
  raise notice 'category_advert_counts materialized view refreshed at %', now();
exception
  when others then
    -- If CONCURRENTLY fails (e.g., no unique index), fall back to regular refresh
    raise warning 'CONCURRENT refresh failed, using regular refresh: %', sqlerrm;
    refresh materialized view public.category_advert_counts;
end;
$$;

comment on function public.refresh_category_advert_counts() is 
'Refreshes the category_advert_counts materialized view.
Uses CONCURRENTLY for zero-downtime updates when possible.';

-- ============================================================================
-- 4. Perform initial refresh
-- ============================================================================

-- Refresh the view immediately to populate it with initial data
select public.refresh_category_advert_counts();

-- ============================================================================
-- 5. Set up pg_cron job for automatic hourly refresh
-- ============================================================================

-- Schedule cron job to refresh the view every hour at minute 0
-- Format: minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-7, 0 and 7 = Sunday)
-- '0 * * * *' means: at minute 0 of every hour
do $body$
declare
  cron_job_id integer;
begin
  -- Check if pg_cron is available and we have permission to use it
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Check if job already exists
    select jobid into cron_job_id
    from cron.job
    where jobname = 'refresh_category_advert_counts';
    
    if cron_job_id is null then
      -- Create new cron job
      select cron.schedule(
        'refresh_category_advert_counts',  -- job name
        '0 * * * *',                        -- schedule: every hour at minute 0
        $sql$select public.refresh_category_advert_counts()$sql$  -- SQL to execute
      ) into cron_job_id;
      
      raise notice 'pg_cron job created successfully with ID: %', cron_job_id;
    else
      raise notice 'pg_cron job already exists with ID: %', cron_job_id;
    end if;
  else
    raise notice 'pg_cron not available - manual refresh required. Use: REFRESH MATERIALIZED VIEW CONCURRENTLY category_advert_counts;';
  end if;
exception
  when insufficient_privilege then
    raise notice 'pg_cron requires superuser privileges. Manual refresh required.';
  when undefined_table then
    raise notice 'pg_cron extension tables not found. Manual refresh required.';
  when others then
    raise notice 'Could not create pg_cron job: %. Manual refresh required.', sqlerrm;
end $body$;

-- ============================================================================
-- 6. Grant permissions
-- ============================================================================

-- Grant SELECT access to authenticated users
grant select on public.category_advert_counts to authenticated;
grant select on public.category_advert_counts to anon;

-- Grant EXECUTE on refresh function to service_role (if needed for manual refresh)
grant execute on function public.refresh_category_advert_counts() to service_role;

