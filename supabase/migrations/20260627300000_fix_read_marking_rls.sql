-- Core-flow audit fix (chat-bug class): notifications mark-as-read and chat read-marking silently no-op.
-- Both tables had ONLY an is_admin() UPDATE policy and no user UPDATE policy, so a normal user's
-- cookie-client UPDATE was RLS-filtered to 0 rows (returning HTTP 200) → read_at / last_read_at never
-- persisted → unread badges never cleared. Add a scoped user UPDATE policy + column-lock the grant to ONLY
-- the read-tracking columns (so users can mark read but can't touch role/payload/etc.).

begin;

-- C1: notifications — a user may mark their OWN notifications read (read_at only).
drop policy if exists notifications_user_mark_read on public.notifications;
create policy notifications_user_mark_read on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

-- C2: conversation_participants — a participant may update their OWN read marker / mute (never role).
drop policy if exists cp_user_mark_read on public.conversation_participants;
create policy cp_user_mark_read on public.conversation_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
revoke update on public.conversation_participants from authenticated, anon;
grant update (last_read_at, muted) on public.conversation_participants to authenticated;

commit;
