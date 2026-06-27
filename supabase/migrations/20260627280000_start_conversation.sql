-- Fix broken chat: conversation_participants RLS only allows a user to add THEMSELVES
-- (auth.uid()=user_id), so api/chat/start (cookie client) cannot add the SELLER's participant row ->
-- its 2-row participant insert fails under RLS -> "contact seller" never creates a conversation
-- (0 conversations on prod). Move conversation+participant creation into a verified SECURITY DEFINER rpc
-- that adds BOTH participants (definer bypasses RLS) after checking the peer relationship. This also makes
-- the seller a genuine participant, which the reviews chat-gate requires.

begin;

create or replace function public.start_conversation(p_advert_id uuid, p_peer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_conv uuid;
begin
  if v_user is null then raise exception 'auth required' using errcode = 'P0001'; end if;
  if v_user = p_peer_id then raise exception 'CANNOT_CHAT_SELF' using errcode = 'P0001'; end if;

  select user_id into v_owner from public.adverts where id = p_advert_id;
  if v_owner is null then raise exception 'ADVERT_NOT_FOUND' using errcode = 'P0001'; end if;

  -- One of the two parties must be the advert owner (buyer↔seller about this listing).
  if p_peer_id <> v_owner and v_user <> v_owner then
    raise exception 'INVALID_PEER' using errcode = 'P0001';
  end if;

  -- Idempotent: reuse an existing conversation about this advert that already has both parties.
  select c.id into v_conv
  from public.conversations c
  where c.advert_id = p_advert_id
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = c.id and cp.user_id = v_user)
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = c.id and cp.user_id = p_peer_id)
  limit 1;
  if v_conv is not null then return v_conv; end if;

  insert into public.conversations (advert_id, created_by) values (p_advert_id, v_user) returning id into v_conv;
  insert into public.conversation_participants (conversation_id, user_id, role) values
    (v_conv, v_user, 'owner'),
    (v_conv, p_peer_id, 'peer');
  return v_conv;
end;
$$;

revoke execute on function public.start_conversation(uuid, uuid) from public, anon;
grant execute on function public.start_conversation(uuid, uuid) to authenticated;

commit;
