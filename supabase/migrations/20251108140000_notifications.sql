-- NOTIF-001: Notifications table migration
-- Creates notifications table and adds notification_preferences to profiles

-- 1. Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('new_message', 'advert_approved', 'advert_rejected', 'advert_contact', 'payment_completed', 'favorite_new_ad')),
  channel text not null check (channel in ('email', 'push', 'sms', 'in_app')),
  title text not null,
  body text not null,
  payload jsonb,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- 2. Indexes for performance
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read_at) where read_at is null;
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_type on public.notifications(type, created_at desc);
create index if not exists idx_notifications_sent on public.notifications(sent_at) where sent_at is null;

-- 3. Add notification_preferences column to profiles if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'notification_preferences'
  ) then
    alter table public.profiles
      add column notification_preferences jsonb default '{"email": {}, "push": {}, "sms": {}}'::jsonb;
  end if;
end $$;

