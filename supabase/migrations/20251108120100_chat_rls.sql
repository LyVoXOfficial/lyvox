-- CHAT-002: RLS policies for chat tables
-- Enables row-level security and creates policies for conversations, conversation_participants, and messages

-- Enable RLS on all chat tables
alter table if exists public.conversations enable row level security;
alter table if exists public.conversation_participants enable row level security;
alter table if exists public.messages enable row level security;

-- ============================================================================
-- CONVERSATIONS policies
-- ============================================================================

-- Participants can read conversations they're part of
drop policy if exists "conversations_participants_read" on public.conversations;
create policy "conversations_participants_read" on public.conversations
  for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );

-- Participants can update conversations they're part of (e.g., update last_message_at via trigger)
drop policy if exists "conversations_participants_update" on public.conversations;
create policy "conversations_participants_update" on public.conversations
  for update
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );

-- Authenticated users can create conversations
drop policy if exists "conversations_authenticated_insert" on public.conversations;
create policy "conversations_authenticated_insert" on public.conversations
  for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Admins can read all conversations
drop policy if exists "conversations_admin_read" on public.conversations;
create policy "conversations_admin_read" on public.conversations
  for select
  using (public.is_admin());

-- Admins can update all conversations
drop policy if exists "conversations_admin_update" on public.conversations;
create policy "conversations_admin_update" on public.conversations
  for update
  using (public.is_admin());

-- ============================================================================
-- CONVERSATION_PARTICIPANTS policies
-- ============================================================================

-- Participants can read participants of conversations they're part of
drop policy if exists "conversation_participants_read" on public.conversation_participants;
create policy "conversation_participants_read" on public.conversation_participants
  for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- Admins can read all participants
drop policy if exists "conversation_participants_admin_read" on public.conversation_participants;
create policy "conversation_participants_admin_read" on public.conversation_participants
  for select
  using (public.is_admin());

-- Note: Insert/Delete for conversation_participants should be handled via server actions
-- with proper authorization checks. We allow inserts only for authenticated users,
-- but the server action must verify the user is the conversation creator or has permission.
drop policy if exists "conversation_participants_authenticated_insert" on public.conversation_participants;
create policy "conversation_participants_authenticated_insert" on public.conversation_participants
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Admins can manage all participants
drop policy if exists "conversation_participants_admin_manage" on public.conversation_participants;
create policy "conversation_participants_admin_manage" on public.conversation_participants
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- MESSAGES policies
-- ============================================================================

-- Participants can read messages from conversations they're part of
drop policy if exists "messages_participants_read" on public.messages;
create policy "messages_participants_read" on public.messages
  for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- Authors can insert messages (must be participant and author)
drop policy if exists "messages_author_insert" on public.messages;
create policy "messages_author_insert" on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- Authors can update their own messages within a short time window (5 minutes)
-- This allows editing typos, but prevents abuse
drop policy if exists "messages_author_update" on public.messages;
create policy "messages_author_update" on public.messages
  for update
  to authenticated
  using (
    auth.uid() = author_id
    and created_at > now() - interval '5 minutes'
  )
  with check (
    auth.uid() = author_id
    and created_at > now() - interval '5 minutes'
  );

-- Admins can read all messages
drop policy if exists "messages_admin_read" on public.messages;
create policy "messages_admin_read" on public.messages
  for select
  using (public.is_admin());

-- Admins can update/delete all messages (for moderation)
drop policy if exists "messages_admin_manage" on public.messages;
create policy "messages_admin_manage" on public.messages
  for all
  using (public.is_admin())
  with check (public.is_admin());

