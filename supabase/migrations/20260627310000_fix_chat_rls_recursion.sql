-- Audit fix (chat fundamentally broken): the participant-access RLS policies on conversation_participants,
-- conversations, and messages each contained `EXISTS (SELECT 1 FROM conversation_participants ...)` inline.
-- Reading conversation_participants re-triggers its own SELECT policy → "infinite recursion detected in policy
-- for relation conversation_participants" (42P17). This broke message INSERT (messages_author_insert checks
-- participation), message reads, and conversation reads — the whole chat feature under RLS.
--
-- Fix: a SECURITY DEFINER helper that checks membership WITHOUT triggering RLS (the function owner bypasses RLS),
-- the same pattern is_business_member()/is_admin() already use. Replace every inline self-referential subquery.

begin;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  );
$$;
revoke execute on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

-- conversation_participants: a participant can read all participant rows of conversations they're in.
drop policy if exists conversation_participants_read on public.conversation_participants;
create policy conversation_participants_read on public.conversation_participants
  for select to authenticated
  using (user_id = auth.uid() or public.is_conversation_participant(conversation_id));

-- conversations: participant read + update (last_message_at etc.)
drop policy if exists conversations_participants_read on public.conversations;
create policy conversations_participants_read on public.conversations
  for select to authenticated
  using (public.is_conversation_participant(id));

drop policy if exists conversations_participants_update on public.conversations;
create policy conversations_participants_update on public.conversations
  for update to authenticated
  using (public.is_conversation_participant(id));

-- messages: a participant can post + read messages in their conversations.
drop policy if exists messages_author_insert on public.messages;
create policy messages_author_insert on public.messages
  for insert to authenticated
  with check (auth.uid() = author_id and public.is_conversation_participant(conversation_id));

drop policy if exists messages_participants_read on public.messages;
create policy messages_participants_read on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id));

commit;
