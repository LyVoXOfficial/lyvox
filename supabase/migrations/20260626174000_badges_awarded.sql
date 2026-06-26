-- supabase/migrations/20260626174000_badges_awarded.sql  (Spec §6.6, §6.8)
create table if not exists public.badges_awarded (
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,
  badge text not null,
  awarded_by uuid references auth.users(id),
  awarded_at timestamptz not null default now(),
  primary key (subject_type, subject_id, badge)
);
alter table public.badges_awarded enable row level security;
drop policy if exists badge_public_read on public.badges_awarded;
create policy badge_public_read on public.badges_awarded for select using (true);
drop policy if exists badge_admin_write on public.badges_awarded;
create policy badge_admin_write on public.badges_awarded for all using (is_admin()) with check (is_admin());
