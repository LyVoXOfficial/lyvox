-- Defense-in-depth: now that conversation creation goes through the verified start_conversation() rpc
-- (api/chat/start), revoke direct INSERT on conversations + conversation_participants from authenticated/anon.
-- This makes conversation creation rpc-only and un-forgeable (closes the residual "self-insert a conversation
-- about a victim's advert" vector and hardens the reviews chat-gate at the source). UPDATE (read-marking via
-- api/chat/read) and SELECT are unaffected; message inserts still work (they require an rpc-created participant).

begin;
revoke insert on public.conversations from authenticated, anon;
revoke insert on public.conversation_participants from authenticated, anon;
commit;
