# SEC-AUTHZ-GUARD — live authorization audit (baseline run)

**Run:** 2026-07-05 against prod (`DATABASE_URL`), read-only, via `pnpm authz:audit`
(`scripts/audit-authz-live.mjs`). Cross-checks the three catalogs the acceptance criteria name:
`information_schema.role_table_grants × pg_policies × pg_proc`.

The **static CI guard** (`apps/web/src/lib/db/__tests__/authz-migration-guard.test.ts`) protects
migration *authoring* — it fails CI when a new migration ships an unlocked column/function. It covers
both the explicit-grant case (RULE-01) and, crucially, the **default-grant case** (RULE-01b): a new
table with a trust/entitlement column + an authenticated write policy but no explicit `revoke` is
flagged, because Supabase's automatic table-wide grant (never in migration text) is exactly how the
`profiles`-INSERT hole below stayed open. What the static guard still cannot see is the *current live*
state — RULE-01/02 fixes on this project were historically applied out-of-band via psql (see memory:
`supabase-migration-drift-repair`, `storage-rls-privacy-state`). This audit is that complement: it
inspects what prod actually looks like today. The genuine F2 findings below are also flagged by the
static guard's RULE-01b (grandfathered in its allowlist until remediation lands).

## How findings are scoped (why the count went 421 → 20)

A raw grant/RLS dump produced 421 hits, nearly all noise. A grant is only *exploitable* when a
**permissive RLS policy actually admits the write** for that role, and the RLS gate is reachable by
the role in question:

- **Grant × policy cross** — a default Supabase grant with no permissive policy is inert.
- **anon** counts only when an admitting policy's gate is *literally open* (`true`/null) — an
  `auth.uid()`/`is_admin()`-gated `to public` policy blocks anon at runtime. → dropped 59 → 0.
- **authenticated write** counts only when an *ordinary* (non-admin) user can pass the gate
  (owner-scoped `auth.uid()` or open) — `is_admin()`-only policies are admin-managed, not RULE-01. → dropped ~13 false positives.
- **DELETE** excluded from RULE-01 (no columns to scope; an RLS "delete own rows" policy already gates it).

## Findings (20)

### F1 · RLS disabled (4) — reviewed, benign
`catalog_fields`, `catalog_field_options`, `catalog_subcategory_schema`, `spatial_ref_sys`.
- The three `catalog_*` tables: RLS off, but `authenticated`/`anon` hold **no write grant** (verified),
  so they are SELECT-only reference tables (service-role managed). Grandfathered in the static guard's allowlist.
- `spatial_ref_sys`: PostGIS system table; RLS-off is standard and not app-owned.

### F2 · Table-wide write to `authenticated` on a table with trust/entitlement columns (10) — REMEDIATION FOLLOW-UP
RLS gates ROWS, not COLUMNS. Where a policy lets an ordinary user write their own row and the grant is
table-wide, the user can set the listed columns via direct PostgREST, bypassing the API zod strip.

| Table | Op | Sensitive columns | Assessment |
|---|---|---|---|
| **profiles** | INSERT | verified_email, verified_phone, itsme_verified, itsme_kyc_level, pro_until | **Genuine.** UPDATE was column-scoped by the lockdown migration; INSERT was not. A user self-inserting their profile row could set verification/entitlement flags. Column-scope the INSERT grant (or block direct insert; profiles are trigger-created). |
| **purchases** | INSERT | status | **Review.** A user inserting a purchase row could set `status`. Confirm the insert policy pins status / that direct insert is not the intended path (F2/F3 money-flow is gated anyway). |
| **reports** | INSERT | status | **Review.** A reporter could set `status` (e.g. pre-`resolved`) on insert. Pin status in the policy or column-scope. |
| **business_members** | INSERT/UPDATE | role | **Mostly mitigated.** Policy with_check blocks `role='owner'` on insert and pins own role on update; still, prefer column-scoping over relying on the policy expression. |
| **job_listings** | UPDATE | education_level | Low — attribute column matched the heuristic; not a trust/entitlement field. Likely benign. |
| **property_listings** | INSERT/UPDATE | renovation_year, elevator | Low — physical attributes matched the heuristic loosely; likely benign. |

**Not comparable to a hole (verified during this task):** `chat_offers` INSERT — the policy `with_check`
pins `status='sent'`, `currency='EUR'`, `sender_id=auth.uid()` + conversation participation; the sensitive
column is policy-pinned. Grandfathered in the static allowlist. `businesses`/`trust_score`/`verifications`
writes are `is_admin()`-only (not ordinary-user reachable) → not findings.

### F3 · SECURITY DEFINER fn(uuid) executable by authenticated/anon (6) — reviewed, intentional
`create_review`, `is_business_member`, `is_conversation_participant`, `is_user_blocked`,
`start_conversation`, `user_has_flag`. All are RLS-predicate helpers or RPCs that authorize on
`auth.uid()` internally (no caller-supplied identity → no escalation). `erase_user_data(uuid)` — the
canonical RULE-02 case — is correctly **absent** (properly revoked). All six are grandfathered in the
static allowlist.

### F4 · RLS on, zero policies (1, informational)
`webhook_events` — the F1 idempotency journal, intentionally service-role-only.

## Remediation follow-up

Column-scope (or otherwise lock) the genuine F2 writes — **`profiles` INSERT first** (verification/entitlement
flags), then `purchases`/`reports` INSERT (`status`). Tracked separately from step 10 (SEC-AUTHZ-GUARD),
whose deliverable is the guard + this audit, not the fixes. Re-run `pnpm authz:audit` after each fix.
