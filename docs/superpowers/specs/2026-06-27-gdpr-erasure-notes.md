# GDPR Erasure / Account Deletion — Build Note

**Status:** Build-ready slice. Company-free, GDPR Art.17 hard launch-blocker. **Highest blast radius so far** —
irreversible deletes + FK-semantic changes across ~25 user-linked tables. Extra review + prod-verify on a
throwaway test account only. Grounded in the erasure audit (`tasks/wtbt95kum.output`, `erasure` key) + design §5.4.1.

## 0. Current state
NO erasure flow exists (no `/api/account*`, no `auth.admin.deleteUser` call anywhere). `profile/security` only
revokes sessions. A request today needs manual Supabase-dashboard action with no audit trail. Calling
`auth.admin.deleteUser` alone is INCORRECT: it CASCADE-destroys a counterparty's chat thread, CASCADE-deletes
financial records that have a 7-year retention duty, orphans polymorphic rows (kyc/verifications/badges), and
leaves storage objects + `advert_views` IPs behind.

## 1. Decisions / invariants (read first)
- **End state of "delete my account":** `auth.users` row deleted (login disabled, email/phone freed); all PII
  purged EXCEPT data with a legal retention basis (anonymized): `purchases` (Belgian accounting 7y), `kyc_records`
  with future `retention_until`, and a tombstoned chat thread for the counterparty.
- **Individual-first.** Ship the individual (физ) deletion path first. A **business-owner** deletion is gated:
  `adverts.business_id ON DELETE RESTRICT` blocks it until the business is handled (withdraw adverts +
  transfer/suspend). The route returns a specific error for owners with an active business ("transfer or close
  your business first") rather than attempting it — the full owner-transfer flow is a follow-up.
- **messages tombstone (decided, not deferred):** change `messages.author_id` FK from CASCADE → SET NULL; the
  orchestrator replaces the deleting user's message `body` with a tombstone (`"[deleted]"`) BEFORE deleting
  `auth.users`. Counterparty thread preserved; UI already shows author by id (no real-name leak). Without the FK
  change, CASCADE would destroy the counterparty's thread — so the FK change is required for correctness.
- **purchases retain-anonymize (decided):** change `purchases.user_id` NOT NULL → nullable, FK CASCADE → SET NULL;
  orchestrator nulls `user_id` (keeps amount/currency/created_at/provider ids) for the 7y accounting duty.
- **Conservative GDPR-minimizing defaults; flag policy points.** When a retention window is a founder/counsel call
  (fraud/abuse logs, chat retention), default to minimizing (delete/anonymize the user link now) and LOG the
  follow-up. The only retained-PII is where law clearly requires it (purchases 7y, kyc retention_until).
- All erasure writes via **service-role** (system actor). Re-auth required at the route (fresh confirmation).

## 2. Disposition table (the orchestrator spec — from the audit)
| Disposition | Tables | Action in orchestrator (before `deleteUser`) |
|---|---|---|
| **Storage first** | `ad-media` bucket | enumerate `media.url` for the user's adverts (service-role), then `storage.from("ad-media").remove(paths)`. Must run BEFORE the DB cascade removes `media` rows. |
| **Tombstone (counterparty-visible)** | `messages` | `update messages set body='[deleted]', author_id=null where author_id=$uid` (after FK→SET NULL). |
| **Anonymize — legal retention** | `purchases` | `update purchases set user_id=null where user_id=$uid` (after nullable+SET NULL). |
| **Null PII on retained rows** | `advert_views`, `businesses.self_certified_ip` | `delete from advert_views where user_id=$uid` (removes ip/user_agent of own views); if the user `created_by` a business that will be retained, `update businesses set self_certified_ip=null where created_by=$uid`. |
| **Orphan cleanup (polymorphic, no FK)** | `verifications`, `badges_awarded`, `kyc_records` | `delete from verifications where subject_type='user' and subject_id=$uid`; `delete from badges_awarded where subject_type='user' and subject_id=$uid`; `kyc_records`: delete where `subject_type='user' and subject_id=$uid AND (retention_until is null OR retention_until < now())`; RETAIN rows with future `retention_until` (legal hold) — these keep `subject_id` (pseudonymous, no FK). |
| **Audit anonymize** | `logs` (no FK) | `update logs set user_id=null where user_id=$uid` (retain action/details under Art.6(1)(f); retention-window-before-anonymize = follow-up). |
| **Hard-delete via CASCADE** | `profiles`, `phones`, `phone_otps`, `favorites`, `advert_likes`, `saved_searches`, `conversations`(created_by), `conversation_participants`, `notifications`, `trust_score`, `adverts`→`media`/`ad_item_specifics`, `fraud_detection_logs`, `benefits`, `business_members` | left to `auth.admin.deleteUser` CASCADE (no explicit action — but storage + messages + purchases handled above first). |
| **Business entity** | `businesses` | NOT cascade-deleted (`created_by` SET NULL). Individual path: if the user owns an ACTIVE business (created_by + status active), BLOCK with a clear error. If only inactive/none, proceed (self_certified_ip nulled above). |
| **Final** | `auth.users` | `service.auth.admin.deleteUser($uid)` LAST. Write a `logs` audit row of the erasure (action `account_erasure`, no PII) first via service-role. |

## 3. Migration (T1) — FK + nullability + the transactional erasure function
**Grounded facts (verified on prod):** `messages.author_id` and `purchases.user_id` are **NOT NULL** today (so the
tombstone/anonymize UPDATEs would FAIL without a nullability change — this is the load-bearing fix, per advisor).
`messages.author_id`/`purchases.user_id` FKs are CASCADE; `badges_awarded.awarded_by` is NO ACTION (blocks admin
delete). Only two storage buckets exist: `ad-media`, `lyvox-public` — NO kyc bucket (kyc doc upload is Phase B; safe).

Migration `20260627240000_erasure.sql` (transactional):
1. `alter table public.messages alter column author_id drop not null;`
   drop `messages_author_id_fkey`, re-add `references auth.users(id) on delete set null`.
2. `alter table public.purchases alter column user_id drop not null;`
   drop `purchases_user_id_fkey`, re-add `references auth.users(id) on delete set null`.
3. drop `badges_awarded_awarded_by_fkey`, re-add `references auth.users(id) on delete set null`.
3b. `alter table public.conversations alter column created_by drop not null;` drop `conversations_created_by_fkey`,
   re-add `references auth.users(id) on delete set null`. (Was NOT NULL + CASCADE → would destroy a 2-party thread
   the erased user STARTED. Chat access is participant-based — `chat/[conversationId]/page.tsx` gates on
   `conversation_participants`, not `created_by` — so null `created_by` is safe; counterparty keeps the thread.)
4. **`create function public.erase_user_data(p_user_id uuid) returns void` SECURITY DEFINER, `search_path=public`** —
   does ALL DB mutations in ONE transaction (PostgREST can't multi-statement-transact, so atomicity lives here):
   - **Guard:** if a row exists in `businesses` where `created_by=p_user_id and status='active'` → `raise exception
     using errcode='P0001', message='ACTIVE_BUSINESS'` (rolls back everything; route maps to 409).
   - tombstone: `update messages set body='[deleted]', author_id=null where author_id=p_user_id;`
   - anonymize: `update purchases set user_id=null where user_id=p_user_id;`
   - `delete from advert_views where user_id=p_user_id;`
   - `update businesses set self_certified_ip=null where created_by=p_user_id;`
   - `delete from verifications where subject_type='user' and subject_id=p_user_id;`
   - `delete from badges_awarded where subject_type='user' and subject_id=p_user_id;`
   - `delete from kyc_records where subject_type='user' and subject_id=p_user_id and (retention_until is null or retention_until < now());` (RETAIN future-retention rows — legal hold)
   - anonymize: `update logs set user_id=null where user_id=p_user_id;`
   - audit: `insert into logs(user_id, action, details) values (p_user_id, 'account_erasure', jsonb_build_object('at', now()));` (the one intentional retained reference — accountability, Art.6(1)(f)).
   `grant execute on function public.erase_user_data(uuid) to service_role;` (NOT to authenticated/anon).
- Dry-run the whole migration in a rolled-back txn (verify new `confdeltype='n'` + `attnotnull=false` via pg_constraint/pg_attribute). Apply in T6 AFTER deploy. Hand-edit `database.types.ts`: `purchases.user_id` + `messages.author_id` → nullable.

## 4. Pieces / tasks (dependency order, TDD)
- **T1** the migration above (written + dry-run-proven; applied in T6 AFTER deploy) + types. The function makes the
  DB mutations atomic and testable.
- **T2** `apps/web/src/lib/account/erasure.ts` — `eraseAccount(service, userId)` thin orchestrator: (1) `await
  service.rpc('erase_user_data', { p_user_id: userId })` — on a `P0001`/`ACTIVE_BUSINESS` error throw a typed
  `ActiveBusinessError`; on any other rpc error throw + DO NOT proceed (never partial-erase). (2) enumerate the
  user's media: `service.from('media').select('url').in('advert_id', <user's advert ids>)` (or join via adverts
  user_id) → collect storage paths → `service.storage.from('ad-media').remove(paths)` — **scoped to the explicit
  media.url paths only; never a user-prefix wipe; never touch lyvox-public**. (3) `service.auth.admin.deleteUser(userId)`
  LAST (CASCADE purges profiles/phones/adverts/media-rows/favorites/etc; the rpc already detached messages/purchases
  so CASCADE won't reach them). Order: rpc → storage-remove → deleteUser.
  - **CORRECTNESS GATE (advisor — primary, NOT mock-call-order):** a rolled-back-transaction fixture proof on prod
    (controller-run, in T6 prep): `BEGIN; <seed a fixture user + advert+media + a message to a 2nd user + a purchase
    + a verification + a badge + a future-retention kyc + a past-retention kyc>; select erase_user_data(fixture);
    <assert: messages tombstoned not gone, purchases.user_id null not deleted, verifications/badges gone, past-kyc
    gone, future-kyc RETAINED, logs anonymized + 1 account_erasure row>; <also assert the active-business case raises
    P0001>; ROLLBACK;`. This proves the SQL against the real FK graph and rolls back clean.
  - Orchestrator UNIT tests (mock service): rpc called once with the user id; `ActiveBusinessError` thrown on P0001
    (and deleteUser NOT called); storage.remove called with the enumerated paths; deleteUser called LAST only on success.
- **T3** `apps/web/src/app/api/account/delete/route.ts` (POST, runtime nodejs) — `getUser()` (401 if none); **require fresh confirmation** (re-enter password via `signInWithPassword` re-check, OR a typed confirmation phrase — pick the simplest robust: require body `{ confirm: "DELETE" }` AND a recent session; document the re-auth choice); rate-limit (Upstash); call `eraseAccount(service, user.id)`; on `ActiveBusinessError` → 409 with a clear code; on success → 200 + sign the user out. Tests: 401 no user; 400/409 without confirm / with active business; 200 happy path calls eraseAccount once with the user id.
- **T4** UI — add a **Delete account** danger-zone section to `apps/web/src/app/(protected)/profile/security/SecuritySettingsClient.tsx` (two-step confirm: type DELETE; explain what is deleted vs retained — 7y billing, tombstoned chats, kyc legal hold). Link the existing consent/data export (`GET /api/profile/consents?format=download`) as the "download your data" affordance. i18n `account.delete.*` ×5 (parity guard).
- **T5** whole-slice opus review (EXTRA scrutiny — irreversible). 
- **T6** deploy code FIRST → apply FK migration → prod-verify on a **throwaway test account**: create a test user with an advert+media+a chat thread with a second test account + a purchase row; run delete; assert: auth.users gone, profile/advert/media/storage gone, counterparty's thread shows a tombstone (not destroyed), purchase row retained with null user_id, no orphaned verifications/badges. Then verify a second test account that owns an active business is BLOCKED (409).

## 5. Out of scope (follow-ups, logged)
- Full business-owner erasure with ownership-transfer flow (§5.4.1) — individual path ships; owner path blocked with guidance.
- Retention-window-before-anonymize for logs/fraud logs + an orphan/retention cron (the audit's retention enforcement).
- A full GDPR data-EXPORT (Art.20 portability) beyond the existing consent export — separate slice.
- `conversations` sole-participant cleanup nuance; `reports`-as-subject DSA-retention nuance.
