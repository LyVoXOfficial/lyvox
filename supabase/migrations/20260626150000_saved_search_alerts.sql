-- Stage 5 (Section D boundary): saved-search alert delivery support.
-- Additive: a per-search alert watermark, and one new allowed notification type.
-- Idempotent; applied surgically via pg.

-- Watermark for alerting (independent of last_seen_at, which tracks user opens):
-- the cron alerts on adverts created after last_alerted_at, then advances it.
alter table public.saved_searches
  add column if not exists last_alerted_at timestamptz not null default now();

-- Allow the new 'saved_search' notification type (superset of the existing check → validates instantly).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'new_message','advert_approved','advert_rejected','advert_contact',
    'payment_completed','favorite_new_ad','saved_search'
  ));
