-- Phase 4 (Section D): saved searches. Additive table only — new_count is computed in the API
-- via the existing search_adverts RPC. RLS owner-only. Idempotent; applied surgically via pg.

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  query text,
  filters jsonb not null default '{}'::jsonb,
  alert_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_user_created_idx
  on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;

drop policy if exists saved_searches_owner_all on public.saved_searches;
create policy saved_searches_owner_all on public.saved_searches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
