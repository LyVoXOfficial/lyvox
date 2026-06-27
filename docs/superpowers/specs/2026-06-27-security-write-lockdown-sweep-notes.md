# A0 Security Hardening — `authenticated` Write-Lockdown Sweep — Build Note

**Status:** Build-ready slice. Company-free. **Highest priority** — closes a *live, prod* class of
privilege-escalation holes (same class as the businesses/profiles self-grant fixed reactively in the
cabinet + pro slices). Found by a proactive grant/RLS sweep (advisor steer): the Supabase default gives
`authenticated` **table-wide** INSERT/UPDATE on `public` tables; RLS gives ROW security, not COLUMN
security, so any user-writable table with sensitive columns is self-grantable via direct PostgREST.

## 0. Diagnosis (ground truth, from `information_schema` + `pg_policies` on prod)

Sweep query: tables where `authenticated` holds **table-wide** UPDATE (`role_table_grants`) ∩ RLS state ∩
permissive non-admin UPDATE policy. Already-locked `businesses` (10 cols) and `profiles` (6 cols) correctly
absent from the table-wide list. The exploitable set (non-admin owner-writable + sensitive columns):

| Table | Vector | Sensitive cols | Legit write path | Severity |
|---|---|---|---|---|
| **adverts** | direct INSERT **and** UPDATE (owner policy `user_id=auth.uid()`, `with_check` does NOT pin these) | `moderation_status`, `status`, `ai_moderation_score`, `ai_moderation_reason`, `business_id`, `user_id` | create: `api/adverts/route.ts` POST cookie-insert (sets `business_id` after `canSellAsBusiness`); owner edit: `api/adverts/[id]/route.ts` PATCH (controlled set incl. `status`); admin moderation: `api/moderation/review/route.ts` **already service-role** | CRITICAL |
| **phones** | UPDATE (owner `user_id=auth.uid()`) | `verified` (bool) | `api/phone/verify/route.ts` flips `verified=true` via **cookie client** after OTP check | CRITICAL (self-verify, bypass OTP) |
| **phone_otps** | INSERT/UPDATE/DELETE (owner ALL `user_id=auth.uid()`) | `used`, `attempts`, `code_hash` | `api/phone/request` + `api/phone/verify` read/write via **cookie client** | HIGH (OTP tamper/replay) |
| **profiles.verified_phone** | UPDATE — **regression in our own prior lock**: `verified_phone` was GRANTED to authenticated | `verified_phone` (trust signal; `requireVerified.ts:3` = `profiles.verified_phone OR phones.verified`) | **client-side** write at `(protected)/verify/VerifyPhoneClient.tsx:85` (Supabase-native flow, after `auth.verifyOtp`). Server path = `verifications` insert → `sync_verification_caches` SECURITY DEFINER trigger (grant-independent). | CRITICAL (self-verify; the client literally sets its own trust flag — replayable without the OTP) |
| **catalog_fields / catalog_field_options / catalog_subcategory_schema / spatial_ref_sys** | INSERT/UPDATE/DELETE — **RLS DISABLED** + table-wide grant to **anon AND authenticated** → **any unauthenticated visitor** rewrites catalog config / spatial refs for ALL rows | whole tables (field schemas, labels, steps) | reference data; user app never writes them | HIGH (anon platform-integrity defacement) |

**`anon` sweep (advisor #3):** `anon` holds table-wide INSERT/UPDATE/DELETE on **every** `public` table (a blanket
Supabase bootstrap grant). RLS (`auth.uid()` predicates) neutralizes it for all RLS-enabled tables (anon has no
uid). The ONLY live anon-write exposure is the **RLS-disabled** set above. Broader anon-write revoke on all tables
= follow-up (must first confirm no legit anon write, e.g. anonymous `advert_views` insert).

**`adverts.status` DEFAULT is `'active'`** (NOT draft) → a column-locked INSERT omitting `status` would create
adverts born publicly-visible + unmoderated. Therefore creation MUST be fully service-role (explicit `status:'draft'`),
and authenticated gets **no** INSERT grant. Confirmed `api/adverts/route.ts` POST is the only creation path.

**Adequately protected — do NOT over-fix (logged, no change this slice):**
- `business_members` — `bm_invitee_accept` `with_check` pins `role` to the current role → escalation blocked.
- All `is_admin()`-gated policies (`verifications`, `kyc_records`, `badges_awarded`, `trust_score`,
  `purchases`, `benefits`, `reports`, `notifications`, `conversation_participants`) — RLS blocks non-admins;
  the table-wide grant is redundant-but-harmless. Defense-in-depth revoke = follow-up, not live-exploitable.
- `spatial_ref_sys` (PostGIS system table). Lower-sensitivity owner-writable tables (`media`,
  `ad_item_specifics`, `job_listings`, `property_listings`, `conversations`, `messages`, `advert_likes`,
  `favorites`, `saved_searches`) — review FK-pinning in a follow-up.

## 1. Remediation (column-grant pattern; code-to-service-role FIRST, then migration)

**Invariant sequencing (learned twice):** deploy the code that moves now-locked writes to service-role
BEFORE applying the grant migration. Each lock gets a rolled-back dry-run grant proof (sensitive col DENIED,
editable col ALLOWED for `authenticated`) before apply. Never echo `SUPABASE_DB_URL`.

### T1 — `adverts` (CRITICAL) — code only, no migration yet
- Move advert **creation insert** (`api/adverts/route.ts` POST) to **service-role** (`supabaseService()`),
  keeping all gates (`isViewerVerified`, `checkUserBlocked`, `canSellAsBusiness`) on the cookie client FIRST;
  the service-role insert sets `user_id` (=`user.id`), `category_id`, `title`, `status:'draft'`, `currency`,
  optional `business_id`. (status default is `'active'` → must be set explicitly to draft via service-role.)
- Move the owner-edit PATCH **`status`** write (`api/adverts/[id]/route.ts`) to **service-role**, AFTER the route's
  existing ownership + `checkUserBlocked` + `enforceStatusTransition` + publish-validation checks. (Closes the
  blocked-user / unvalidated direct `status='active'` publish bypass — advisor #2.) The benign field updates
  (title/description/price/currency/condition/location/category_id) stay on the cookie client.
- Confirm via multiline grep that POST is the ONLY `adverts` insert and no other cookie path writes
  `status`/`business_id`/`moderation_status`/`ai_*`.

### T2 — `phones` + `phone_otps` (CRITICAL/HIGH) — code only
- In `api/phone/verify/route.ts`: move the `phone_otps` select + `update({used})` + failed-attempt
  `update({attempts})` AND the `phones.update({verified:true})` to **service-role** (auth on cookie client first).
- In `api/phone/request/route.ts`: move the `phones.upsert` + the `phone_otps` deactivate + insert to **service-role**.
- After this, NO cookie-client write to `phones`/`phone_otps` remains (verify by grep).

### T3 — Supabase-native phone confirm (CRITICAL, second `verified_phone` writer) — code only
- The client write `VerifyPhoneClient.tsx:85` (`profiles.update({verified_phone:true})`) is replaced by a POST to a
  new server route `api/phone/confirm-native/route.ts`: it `getUser()`s, then **proves Supabase actually verified the
  phone** by reading `auth.users.phone_confirmed_at` (via `service.auth.admin.getUserById(user.id)` or the
  service-role `auth.users` read) — only if non-null does it set `profiles.verified_phone=true` **via service-role**
  (or insert a `verifications` row method='phone' status='verified' to fire the sync trigger — pick the simpler;
  direct service-role profile write is fine). Client calls it after `auth.verifyOtp` succeeds; no client trust write.
- **TDD:** route test — no `phone_confirmed_at` → 403 + no write; with it → 200 + service-role write asserted.

### T4 — the lockdown migration `20260627230000_lock_authenticated_writes.sql` (applied AFTER T1–T3 deploy)
One transactional migration; for each grant, the dry-run proof (`set local role authenticated;` inside a rolled-back
txn) must show sensitive DENIED + editable ALLOWED before commit. Grants:
- **adverts:** `revoke insert, update on public.adverts from authenticated, anon;`
  `grant update (title, description, price, currency, condition, location, location_id, category_id) on public.adverts to authenticated;`
  → authenticated/anon can NEVER set `business_id`, `status`, `moderation_status`, `ai_moderation_score`,
  `ai_moderation_reason`, `user_id`; NO INSERT (creation = service-role).
- **phones:** `revoke insert, update, delete on public.phones from authenticated, anon;` (writes all service-role; keep SELECT).
- **phone_otps:** `revoke insert, update, delete on public.phone_otps from authenticated, anon;` (server-managed; the
  verify-route read is service-role now → revoke SELECT from authenticated/anon too).
- **profiles:** `revoke update on public.profiles from authenticated;`
  `grant update (display_name, phone, consents, seller_type, notification_preferences) on public.profiles to authenticated;`
  → drops `verified_phone` from the prior grant.
- **catalog trio + spatial_ref_sys (RLS-disabled, anon-writable):**
  `revoke insert, update, delete on public.catalog_fields, public.catalog_field_options, public.catalog_subcategory_schema, public.spatial_ref_sys from authenticated, anon;`
- **Hand-edit `supabase/types/database.types.ts`?** No schema/column change → types unchanged.

### T5 — final whole-slice opus review + clean build + deploy code → apply migration → prod-verify
- Deploy the T1–T3 service-role code FIRST. Then apply the migration. Re-run every dry-run proof against prod
  committed (as `authenticated` AND `anon` via `set role`): adverts `business_id`/`status`/`moderation_status` DENIED,
  `title` ALLOWED; `phones.verified` DENIED; `phone_otps` insert DENIED; `profiles.verified_phone` DENIED,
  `display_name` ALLOWED; `catalog_fields` write DENIED for anon. Smoke: create a draft advert (200, personal +
  business_id path), `/post` 200, `/pro` 200, home 200, native phone-confirm route 403-without-confirmation shape.
- **Deferred follow-ups (log, don't build):** broader `anon` write-revoke across all RLS-enabled tables (verify no
  anon `advert_views` insert first); Tier-2 defense-in-depth revoke on `is_admin()`-gated tables; FK-pin review on
  low-sensitivity owner tables; RLS-enable (not just revoke) the catalog trio.

## 2. Launch "definition of done" checklist (so the loop can terminate)
This slice is item (1). "Ready for start" (company-free) = :
1. **Security:** authenticated-write sweep clean (this slice) — no user-settable trust/moderation/ownership column.
2. **Legal pages:** Privacy Policy, Terms, Cookie/consent notice, DSA notice-&-action / contact — published
   (next slice; can be manual-erasure at first but pages are a hard EU floor).
3. **GDPR erasure:** account deletion / right-to-erasure flow (soft-anonymize → purge) — buildable now.
4. **Founder-activation list documented** (no company needed to BUILD, needed to ACTIVATE): Turnstile keys,
   `CRON_SECRET`, Stripe Pro Price + `CAPABILITY_PRO_SUBSCRIPTIONS`, (Phase B: itsme/WhatsApp/payouts).
When 1–4 are done, STOP and hand back to the founder with the activation list — do not manufacture further slices.
