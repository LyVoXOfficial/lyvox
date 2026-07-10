> [!WARNING]
> **Историческое свидетельство аудита на 2026-06-25, а не текущий список уязвимостей.** Не повторять исправления и не считать статусы ниже актуальными без воспроизведения на текущем `HEAD`. Действующие security release-gates и открытые задачи находятся только в [`docs/MASTER_PRODUCTION_TZ.md`](./MASTER_PRODUCTION_TZ.md).

# LyVoX — Security & Quality Audit

_Audit date: 2026-06-25_

Scope: authentication/authorization, service-role (RLS-bypass) usage, HTTP
security headers, caching, build/type safety, and documentation accuracy for
`apps/web` + `supabase`. At the audit date this document consolidated findings
from ad-hoc `*_STATUS.md` / `*_REPORT.md` notes; it is no longer an authority
for current status or remediation order.

Status legend: ✅ FIXED in this pass · ⚠️ RECOMMENDED (needs a decision / larger
change / testing) · ℹ️ NOTE.

---

## Critical — runtime / data layer (found by live testing, not static review)

### ✅ R1 — Search was completely broken (`/api/search` → HTTP 400)
At runtime, every search returned PostgREST `PGRST202` ("function
`public.search_adverts(... verified_only)` not found"). The connected database
had only the **old 11-parameter** `search_adverts` live (no `verified_only`),
while the API always sends `verified_only` → no overload matched. The canonical
12-param definition (migration `20251102034812`) was recorded as applied but its
function was not actually present.

Worse, when re-created, the canonical function had **two further latent bugs**
caught by a transactional test-call before commit:
1. it built the query term with `to_tsvector` (a `tsvector`) and fed it to `@@`
   and `ts_rank_cd`, which require a `tsquery` → any text query errored; fixed to
   `plainto_tsquery`.
2. `relevance_rank` (a CASE over `real` ts_rank_cd vs `numeric` 0.0) didn't match
   the `RETURNS TABLE` type → "structure of query does not match function result
   type"; fixed by casting every returned column to its declared type.

**Fix:** `supabase/migrations/20260625120000_fix_search_adverts_function.sql`
(re-asserts the corrected 12-param function and drops the stale 11-param
overload). Applied surgically to the connected DB inside a transaction with a
test-call gate. Verified: `/api/search` now returns HTTP 200 (`total: 4` with no
query, `0` for a no-match query, no error).

### ⚠️ R2 — Local migrations and the remote database have diverged
The remote `supabase_migrations.schema_migrations` history contains ~13
`20251110224xxx` migrations that **do not exist in this repo**, while ~14 local
migrations (`20251108…20260605`: chat, billing, notifications, AI-moderation,
fraud rules) are **not recorded on the remote**. The app works because the remote
got that logical schema via the differently-timestamped `20251110224xxx` set.
**Consequence: `supabase db push` is NOT safe** — it would try to re-create
already-existing objects and fail/partially-apply. This needs a deliberate
reconciliation (`supabase migration repair` / regenerating a baseline), not a
blind push. Until then, targeted, idempotent fixes (like R1) are the safe path.

---

## Critical

### ✅ C1 — Privilege escalation via `user_metadata.role`
`hasAdminRole()` (`apps/web/src/lib/adminRole.ts`) trusted `user_metadata.role`
in addition to `app_metadata.role`. In Supabase, `user_metadata`
(`raw_user_meta_data`) is **writable by the user themselves** via
`supabase.auth.updateUser({ data: { role: 'admin' } })`. `app_metadata` is not.

This guard protects the admin pages (`/admin/moderation`, `/admin/reports`) and
the admin APIs `api/moderation/{analyze,review,queue}` and
`api/reports/{list,update}`. Those routes then use the **service-role client**
(`supabaseService()`), which bypasses Row-Level Security — so RLS provided no
backstop. **Any authenticated user could self-promote to admin** and
approve/reject/flag any advert, read/triage all reports, etc.

**Fix:** `hasAdminRole()` now reads `app_metadata.role` / `app_metadata.roles`
only, aligning it with the database `is_admin()` function
(`supabase/migrations/20251005191500_enable_rls_and_policies.sql`), which is the
source of truth. Verified: no code path writes the admin role into
`user_metadata`, so legitimate admins (provisioned via `app_metadata`) are
unaffected.

---

## High

### ✅ H1 — `api/auth/check-email` had no rate limiting
The endpoint is a public email-existence oracle (returns `available: false` when
an account exists) and its docstring falsely claimed it was rate-limited. It also
calls the service-role `auth.admin.listUsers()` on every request.

**Fix:** added per-IP rate limiting (20 req/min) via the existing
`withRateLimit`/`createRateLimiter` infrastructure (`apps/web/src/lib/rateLimiter.ts`).

### ⚠️ H1b — `listUsers()` existence check is incorrect at scale
`auth.admin.listUsers()` without pagination only returns the first page
(~50 users), so once the user base grows the check returns false "available" for
emails on later pages, and it scans users on every call. Uniqueness is still
enforced by Supabase Auth at `signUp`, so the impact is degraded pre-validation
UX, not a data-integrity hole.
**Recommended:** expose a `SECURITY DEFINER` RPC `email_exists(text)` doing an
indexed lookup and call it instead (requires a migration — left for a decision).

---

## Medium

### ✅ M1 — Missing HTTP security headers
`next.config.ts` set only `Cache-Control`. Added baseline headers on all routes:
`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-DNS-Prefetch-Control`.

### ✅ M2 — Blanket public caching of authenticated/API responses
`next.config.ts` applied `Cache-Control: public, max-age=3600,
stale-while-revalidate=86400` to `/:path*` — i.e. **every** response, including
authenticated pages (`/profile`) and API JSON. Shared caches/CDNs could serve one
user's private data to another. The rule was removed; immutable caching of
`/_next/static` and `/images` is retained.
**Follow-up:** re-introduce public caching per public route via route segment
config (`export const revalidate = ...`) where safe.

### ✅ M3 — `Content-Security-Policy` and `Permissions-Policy`
Added `Content-Security-Policy-Report-Only` (allowlisting Next.js, Supabase
REST+realtime, Stripe, Upstash) — Report-Only does not block, so it is safe to
observe before enforcing; promote to `Content-Security-Policy` once the browser
console shows no legitimate violations. Added `Permissions-Policy:
camera=(), microphone=(), geolocation=()` — confirmed via code audit that none of
these are used; WebAuthn (`publickey-credentials-*`) keeps its default `self`
allowlist by intentionally not being listed. **When promoting CSP to enforcing,**
reconcile `frame-ancestors 'none'` (in the CSP) with `X-Frame-Options: SAMEORIGIN`
— they currently disagree (harmless under Report-Only); pick one policy for
framing so same-origin embeds don't break unexpectedly.

### ✅ M4 — `typescript.ignoreBuildErrors` flipped to `false`
The project already type-checks cleanly under `strict: true` (`pnpm typecheck` = 0
errors) and CI already gates on `pnpm typecheck`/`lint`/`build`/tests
(`.github/workflows/ci.yml`). The only gap was the build itself ignoring type
errors, so the flag was flipped to `false`. Verified: a full `pnpm build`
succeeds. (The ~99 `any`/`as any` usages remain a quality backlog, but they do
not produce type errors under the current config.)

---

## Notes / lower priority

- ℹ️ **N1 — Two parallel admin checks.** App layer uses `hasAdminRole()`
  (JWT parse); `isAdmin()` in `apps/web/src/lib/supabaseServer.ts` calls the DB
  `is_admin()` RPC but is **unused**. Consolidating routes onto the RPC adds
  defense-in-depth (one authority) at the cost of a DB round-trip per request.
- ℹ️ **N2 — `getServerSession()` uses `auth.getSession()`** (no server-side JWT
  revalidation) and `getServerUser()`/`requireAuth()`/`isAdmin()` derive from it.
  These helpers are currently **unused by routes** (the moderation/media routes
  call `auth.getUser()` directly, which is correct). If they are ever adopted for
  gating, switch them to `auth.getUser()` first.
- ℹ️ **N3 — Large files** worth decomposing: `PostForm.tsx` (~2.6k lines),
  `ad/[id]/page.tsx` (~2.0k), `SearchFilters.tsx` (~1.0k).
- ℹ️ **N4 — ~27 `console.log`** left in code paths; route through the existing
  logger or strip in production.

---

## Provisioning an admin user (previously undocumented)

Admin authority is the JWT `app_metadata.role` claim, which only the service role
can set. From a trusted server/script using the **service-role key**:

```ts
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
await admin.auth.admin.updateUserById("<user-uuid>", {
  app_metadata: { role: "admin" },
});
```

Equivalent SQL (run as a privileged DB role):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'admin@example.com';
```

The user must obtain a fresh JWT (re-login / token refresh) for the claim to take
effect. Never set the role via `user_metadata` (see C1).

---

## Documentation findings

- **✅ D1 — `docs/API_REFERENCE.md`** previously documented ~13 of ~58 routes while
  claiming full coverage. Regenerated from source to cover all 58 route files
  (chat, billing, notifications, media, catalog, moderation, webauthn, etc.).
- **✅ D2 — `docs/ARCHITECTURE.md`** rate-limit section corrected: `/api/auth/register`
  is **not** rate-limited; the documented 429 response contract was also wrong and
  was fixed to the real envelope.
- **✅ D3 — `docs/INSTALL.md`** references to the non-existent `supabase/reports.sql`
  (3×) removed/replaced with the migration-based flow; env-var guidance corrected.
- **✅ D4 — `docs/TODO.md`** stale chat items marked done; the false "no undocumented
  routes" note replaced with an accurate pointer.
- **✅ D6 — Env drift:** `.env.example` updated — added `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_BASE_URL`, `RATE_LIMIT_SEARCH_IP_PER_MIN`;
  clarified that `SUPABASE_URL` is scripts-only.
- **⚠️ D5 — Still missing:** no `CONTRIBUTING.md`, no top-level threat-model/
  `SECURITY.md`, no `apps/web/.env.example`. (Admin provisioning is now documented
  above.) Left for a decision.

## Large-file refactor

⚠️ See `docs/REFACTORING_LARGE_FILES.md` for a staged, test-first plan for
`PostForm.tsx` (~2.6k), `ad/[id]/page.tsx` (~2.0k) and `SearchFilters.tsx`
(~1.0k). Not executed: these are untested, behavior-critical files; a safe
decomposition needs a characterization-test net and manual QA first.

---

## Changed in this pass

Code:
- `apps/web/src/lib/adminRole.ts` — drop `user_metadata` from admin check (C1).
- `apps/web/src/app/api/auth/check-email/route.ts` — add per-IP rate limit (H1).
- `apps/web/next.config.ts` — add security headers (M1); remove unsafe blanket
  public caching (M2); add CSP Report-Only + Permissions-Policy (M3); flip
  `ignoreBuildErrors` to `false` (M4).

Docs/config:
- `.env.example` — document missing required env vars (D6).
- `docs/API_REFERENCE.md` — regenerated to cover all 58 routes (D1).
- `docs/ARCHITECTURE.md` — fix rate-limit claims (D2).
- `docs/INSTALL.md` — remove dead `reports.sql` refs, fix env guidance (D3).
- `docs/TODO.md` — un-stale chat items + audit note (D4).
- `docs/REFACTORING_LARGE_FILES.md` — staged refactor plan (N3).
- `docs/SECURITY_AUDIT.md` — this file.

Verification: `pnpm build` ✅, `pnpm typecheck` ✅ (0 errors), `pnpm test` ✅
(78/78), `eslint` ✅ on changed files.

---

## Changed in later passes (runtime fixes, anti-fraud, i18n)

Code:
- `supabase/migrations/20260625120000_fix_search_adverts_function.sql` — fix the
  broken `search_adverts` function (R1); applied surgically to the connected DB.
- `apps/web/src/lib/chat/scrubContacts.ts` (+ tests) and `chat/send/route.ts` —
  chat anti-fraud: mask off-platform contacts (email/URL/IBAN/formatted phone),
  preserve IMEIs/EANs/serials, log a risk signal.
- `apps/web/src/lib/fraud/checkUserBlocked.ts` (+ tests) — add `failClosed` option;
  `billing/checkout` and advert **publish** now fail **closed** (a transient DB
  read error must not wave a possibly-blocked user through a payment/publish).
  Brand-new users with no profile row are never blocked. Draft-create stays
  fail-open (low risk).
- `apps/web/src/app/onboarding/page.tsx`, `app/register/messages.ts` — real RU
  translations (were falling back to English).
- **i18n de-hardcoding** across all 5 `i18n/locales/*.json` (en/ru/nl/fr/de) +
  components — replaced hardcoded English with `t()`:
  - `app/page.tsx` (home hero, quick-actions, stat labels, "post a listing")
  - global chrome shown on **every** page: `components/topbar.tsx` (trust
    signals), `components/legal-footer.tsx` (tagline + links),
    `components/main-header.tsx` ("Trust-first"), `components/UserMenu.tsx`
    (Sign in / Join / account menu / sign out), `components/bottom-nav.tsx`
    ("More" — added the missing `common.more` key)
  - `components/info-carousel.tsx` (home trust cards)
  Verified in-browser (locale=ru): home content, topbar, footer and UserMenu all
  render Russian. Still hardcoded (next pass): login page, ad-detail labels
  ("PRICE"/"Posted"), and the pre-existing `advert.gallery` vs `upload.gallery`
  key mismatch in NL/DE.
- `apps/web/next.config.ts` — `viewport-fit=cover` + themeColor (safe-area / PWA).
- `apps/web/src/app/search/page.tsx` — buyer-friendly empty-state via AdsGrid's
  empty-state API.

Verification: `pnpm build` ✅, `pnpm typecheck` ✅ (0), `pnpm test` ✅ (103),
i18n key-consistency ✅. Search fix verified via live `/api/search` (HTTP 200).

⚠️ **Deferred:** wiring the `fraud-detection` Edge Function + 8 seed rules into the
listing flow. Its `fraud_rules` table comes from local migrations **not applied to
the remote** and the function's deployment state is unknown (see R2) — wiring a
call to a possibly-absent function is unsafe until the migration drift is fixed.

---

## How to fix the migration drift (R2) — run this yourself (needs `supabase link`)

The CLI was not linked at the audit date (`Cannot find project ref`), so the
following commands were proposed for an authenticated environment.

> [!CAUTION]
> **Do not run this historical migration-reconciliation sequence.** The remote state and project runbook may have changed. Reproduce drift against the current environment and follow only the database procedure approved in `docs/MASTER_PRODUCTION_TZ.md` and `AGENTS.md`.

```bash
# 0. Link + safety
supabase link --project-ref <your-project-ref>
supabase db dump -f backup_$(date +%F).sql            # full backup before any change

# 1. See the exact drift (the 13 remote-only 20251110224xxx vs the local-only set)
supabase migration list --linked

# 2. HISTORICAL PROPOSAL (DO NOT RUN): adopt the remote as source of truth.
#    Pull the real remote schema into a fresh baseline migration, then reconcile
#    history so the CLI and DB agree:
supabase db pull                                       # writes a baseline from remote
#    For each local migration the remote already has (under a different name),
#    mark it applied so push won't try to re-create it:
#    supabase migration repair --status applied <version>
#    For remote-only versions not in the repo, `db pull` captures their schema.

# 3. Verify a dry run is clean BEFORE pushing anything:
supabase db push --dry-run

# 4. Only then apply genuinely-new migrations (e.g. the search fix R1):
supabase db push
```

Do **not** run a bare `supabase db push` against the current drift — it will try
to re-create objects that already exist and fail/partially-apply. The R1 search
fix was applied out-of-band precisely to avoid this; its migration
(`20260625120000`) is idempotent, so a later clean push is harmless.
