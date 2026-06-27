-- GDPR Art.17 erasure: FK/nullability changes + the atomic erasure function.
--
-- Why FK changes: the orchestrator anonymizes/tombstones BEFORE auth.admin.deleteUser, so the SET NULL
-- clauses are defense-in-depth against a race-window insert; the load-bearing change is making
-- messages.author_id + purchases.user_id + conversations.created_by NULLABLE (they are NOT NULL today,
-- so the anonymize/tombstone UPDATEs would otherwise fail). badges_awarded.awarded_by is NO ACTION today
-- (blocks deleting an admin who awarded badges) -> SET NULL.
--
-- Why a SECURITY DEFINER function: PostgREST/supabase-js cannot run a multi-statement transaction, so the
-- DB-side erasure must be atomic inside one function. The orchestrator calls it via rpc, then removes
-- storage objects, then calls deleteUser LAST.
--
-- PRECONDITION: deploy the orchestrator code (lib/account/erasure.ts + /api/account/delete) BEFORE applying.

begin;

-- 1. messages.author_id -> nullable + SET NULL (tombstone preserves the counterparty's thread)
alter table public.messages alter column author_id drop not null;
alter table public.messages drop constraint messages_author_id_fkey;
alter table public.messages add constraint messages_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

-- 2. purchases.user_id -> nullable + SET NULL (retain financial fields for the 7y accounting duty, anonymized)
alter table public.purchases alter column user_id drop not null;
alter table public.purchases drop constraint purchases_user_id_fkey;
alter table public.purchases add constraint purchases_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- 3. badges_awarded.awarded_by -> SET NULL (was NO ACTION, blocked admin deletion)
alter table public.badges_awarded drop constraint badges_awarded_awarded_by_fkey;
alter table public.badges_awarded add constraint badges_awarded_awarded_by_fkey
  foreign key (awarded_by) references auth.users(id) on delete set null;

-- 3b. conversations.created_by -> nullable + SET NULL (preserve a 2-party thread the erased user started;
--     chat access is participant-based, not created_by, so null created_by is safe)
alter table public.conversations alter column created_by drop not null;
alter table public.conversations drop constraint conversations_created_by_fkey;
alter table public.conversations add constraint conversations_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- 4. atomic DB-side erasure (everything except storage + auth.users delete, which are non-transactional)
create or replace function public.erase_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Guard: a user who owns an ACTIVE business must transfer/close it first (§5.4.1). Aborts the whole txn.
  if exists (select 1 from public.businesses where created_by = p_user_id and status = 'active') then
    raise exception 'ACTIVE_BUSINESS' using errcode = 'P0001';
  end if;

  -- Tombstone the user's messages (author_id nulled; body replaced) so the counterparty keeps the thread.
  update public.messages set body = '[deleted]', author_id = null where author_id = p_user_id;

  -- Anonymize purchases: keep amount/currency/created_at/provider ids for the 7y Belgian accounting duty.
  update public.purchases set user_id = null where user_id = p_user_id;

  -- Delete the user's own advert_views rows (they carry ip_address / user_agent PII).
  delete from public.advert_views where user_id = p_user_id;

  -- Null the self-certification IP on any business the user created (the entity itself is retained, owner-less).
  update public.businesses set self_certified_ip = null where created_by = p_user_id;

  -- Orphan cleanup for the polymorphic, FK-less tables (auth.users delete cannot reach these).
  delete from public.verifications  where subject_type = 'user' and subject_id = p_user_id;
  delete from public.badges_awarded where subject_type = 'user' and subject_id = p_user_id;
  -- KYC: purge unless under a future retention hold (legal basis Art.6(1)(c)).
  delete from public.kyc_records
    where subject_type = 'user' and subject_id = p_user_id
      and (retention_until is null or retention_until < now());

  -- Anonymize the user's audit logs (retain action/details under Art.6(1)(f); a retention-window is a follow-up).
  update public.logs set user_id = null where user_id = p_user_id;

  -- Accountability record of the erasure act itself (the one intentional retained user reference).
  insert into public.logs (user_id, action, details)
    values (p_user_id, 'account_erasure', jsonb_build_object('at', now()));
end;
$$;

-- IMPORTANT: Supabase default privileges grant EXECUTE on new public functions to authenticated AND anon,
-- so `revoke ... from public` is NOT enough — a SECURITY DEFINER function taking an arbitrary uuid would
-- otherwise let any authenticated user erase any account. Revoke from the named roles explicitly.
revoke execute on function public.erase_user_data(uuid) from public, authenticated, anon;
grant execute on function public.erase_user_data(uuid) to service_role;

commit;
