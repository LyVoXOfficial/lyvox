-- F6: Unified analytics_events sink + view→contact→deal funnel
--
-- Single append-only table collects all canonical platform events.
-- Server writes key events (advert_viewed, contact_start) via the service-role client.
-- Client writes lower-value events (swipe, save_search) via POST /api/analytics/track.
-- Dedup: UNIQUE(dedup_key) — NULLs never conflict so high-volume events skip dedup.
-- Deal/dispute events are defined but not yet wired (F3 escrow gate not open).

begin;

create table if not exists public.analytics_events (
  id         uuid        primary key default gen_random_uuid(),
  event_name text        not null,
  user_id    uuid        references auth.users(id) on delete set null,
  session_id text,                                -- NULL for server-written events
  ts         timestamptz not null default now(),
  props      jsonb       not null default '{}'::jsonb,
  dedup_key  text        unique                   -- NULL = no dedup; unique = idempotent
);

-- Funnel query index: GROUP BY event_name, ts bucket → conversion rates
create index if not exists analytics_events_funnel_idx
  on public.analytics_events(event_name, ts desc);

-- Per-user activity index
create index if not exists analytics_events_user_idx
  on public.analytics_events(user_id, ts desc)
  where user_id is not null;

alter table public.analytics_events enable row level security;

-- Authenticated users may insert their own events (user_id = auth.uid() or anonymous).
-- Service-role bypasses RLS for server-written events.
create policy analytics_events_user_insert
  on public.analytics_events for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- Analytics data is internal — no SELECT for regular roles.
-- Admins read via service-role.

comment on table public.analytics_events is
  'Unified event sink for funnel analysis (view→contact→deal). ~20 canonical events. F6.';
comment on column public.analytics_events.dedup_key is
  'If set, INSERT is idempotent: ON CONFLICT DO NOTHING. NULL = always insert (e.g. swipe events).';
comment on column public.analytics_events.session_id is
  'Client-side session identifier (generated once per browser session). NULL for server-written events.';

commit;
