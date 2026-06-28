-- Add discover_prefs JSONB to profiles for the Discover swipe settings (PRD 01 phase 3).
-- Stores: { mode: 'standard'|'simple'|'buttons', haptics: bool, ask_reason_down: bool,
--           confirm_actions: bool }
-- Guest fallback: same shape in localStorage `lyvox:discover:prefs`.

begin;

alter table public.profiles
  add column if not exists discover_prefs jsonb not null default '{}'::jsonb;

-- The column-level write grant on profiles was last set by 20260627230000.
-- That migration granted: display_name, phone, consents, seller_type, notification_preferences.
-- We must revoke + re-grant to include discover_prefs; omitting this silently blocks writes.
revoke update on public.profiles from authenticated;
grant update (display_name, phone, consents, seller_type, notification_preferences, discover_prefs)
  on public.profiles to authenticated;

comment on column public.profiles.discover_prefs is
  'Discover swipe settings: { mode: standard|simple|buttons, haptics: bool, ask_reason_down: bool, confirm_actions: bool }. PRD 01.';

commit;
