# Phase 4 — Saved Searches + Alerts (Stage 1) Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Spec Section D, Stage 1 — let users save a search (q + filters), list saved searches with an
"N new since saved" badge, re-run them, toggle an (stored, not-yet-firing) alert, and delete. Works
logged-out via localStorage. **Alert *delivery* (cron/Edge scan) is Stage 5 — out of scope.**

**Architecture:** One additive DB table (`saved_searches`); `new_count` computed in the API by calling
the **existing** `search_adverts` RPC with the saved filters and counting rows with
`created_at > last_seen_at` (no RPC change — the live RPC already handles category/price/location/
full-text/condition/verified_only). Reuses the `{ok,data}` envelope, `withRateLimit`, zod, and the
search filter shape. Anonymous users get a localStorage mirror.

**Tech Stack:** Next 16 App Router, Supabase (pg + RLS), zod, Vitest. DB applied surgically via `pg`
+ `SUPABASE_DB_URL` (transactional, test-call gated, **never** `supabase db push`).

## Global Constraints
- DB change is **additive only** (new table; no change to existing tables/functions). RLS owner-only.
- Auth required on all `/api/saved-searches*` (401 otherwise); zod-validated; `{ok,data}` envelope;
  rate-limited per the favorites/likes pattern. Cap 50 saved searches/user.
- `filters` jsonb = `{category_id, price_min, price_max, location, verified_only, condition, sort_by}`
  (same keys the search route consumes).
- Every user-facing string via `t("key")`; add all `saved.*` keys to **all 5** locales (ru native,
  nl/fr/de drafted → pending-review doc). i18n-completeness test must stay green.
- After each task: `vitest run` + `tsc --noEmit` clean; commit.

---

### Task 1: DB migration — `saved_searches` table
**Files:** Create `supabase/migrations/20260626140000_saved_searches.sql`
Table per spec (id, user_id FK auth.users on delete cascade, name, query, filters jsonb default '{}',
alert_enabled bool default true, last_seen_at timestamptz default now(), created_at default now()),
index `(user_id, created_at desc)`, RLS enabled, owner-only policy (`for all using/with check
auth.uid() = user_id`). Idempotent (mirror `advert_likes` migration).
- [ ] Write migration. Apply surgically via `pg` inside a transaction using `SUPABASE_DB_URL` from
      `.env.local`. **Test-call gate:** after apply, verify `to_regclass('public.saved_searches')` is
      non-null, RLS is enabled, and the owner policy exists. Commit the SQL file.

### Task 2: `lib/savedSearches.ts` — local mirror + pure match helper
**Files:** Create `apps/web/src/lib/savedSearches.ts`; Test `apps/web/src/lib/__tests__/savedSearches.test.ts`
**Produces:**
- `type SavedSearchFilters = { category_id?: string|null; price_min?: number|null; price_max?: number|null; location?: string|null; verified_only?: boolean|null; condition?: string|null; sort_by?: string|null }`.
- `type LocalSavedSearch = { id: string; name: string; query: string|null; filters: SavedSearchFilters; created_at: string }`.
- localStorage CRUD (key `lyvox:savedSearches`, cap 50, SSR/private-safe; mirror `recentlyViewed.ts`):
  `getLocalSavedSearches()`, `addLocalSavedSearch(s)`, `removeLocalSavedSearch(id)`.
- Pure `savedSearchMatches(filters: SavedSearchFilters, query: string|null, advert): boolean` —
  the matching predicate (category exact, price range incl. null-price, location ilike substring,
  condition exact, verified_only ⇒ advert.sellerVerified, q ⇒ case-insensitive substring in
  title/description). Used for tests + (future) local new-count.
- [ ] Tests: local CRUD (cap/dedupe/SSR-safe); `savedSearchMatches` true/false across each dimension
      (category, price band incl. free items, location substring, condition, verified_only, q text).
- [ ] Run → FAIL → implement → PASS → commit.

### Task 3: API — list/create
**Files:** Create `apps/web/src/app/api/saved-searches/route.ts`; Test `…/__tests__/saved-searches-route.test.ts`
- `GET` (auth) → select caller's rows (RLS) ordered `created_at desc`; for each, compute `new_count`:
  `supabase.rpc("search_adverts", { ...filters mapped to *_filter params, sort_by:"created_at_desc",
  page_offset:0, page_limit:100 })` then count rows with `created_at > last_seen_at` (capped at 100 →
  expose `new_count` + `new_count_capped` bool). Envelope `{ok,data:{items:[{...row, new_count}]}}`.
  Rate-limit 60/min.
- `POST {name, query?, filters}` (auth, zod) → reject if caller already has ≥50 (400); insert; return the row. Rate-limit 30/min.
- [ ] Tests (mock supabase + rate-limit like `adverts-verify`/`likes-route`): 401 when unauthed;
      POST over cap → 400; POST happy path inserts; GET returns rows with computed new_count.
- [ ] Run → FAIL → implement → PASS → commit.

### Task 4: API — delete/patch
**Files:** Create `apps/web/src/app/api/saved-searches/[id]/route.ts`; extend the route test.
- `DELETE` (auth, owner via RLS) → remove by id.
- `PATCH {alert_enabled?, seen?}` (auth, zod) → if `seen===true` set `last_seen_at=now()`; if
  `alert_enabled` provided, set it. Return updated row.
- [ ] Tests: 401 unauthed; PATCH seen updates last_seen_at; PATCH alert toggles; DELETE removes.
- [ ] Run → FAIL → implement → PASS → commit.

### Task 5: UI — "Save this search" on /search
**Files:** Modify `apps/web/src/app/search/page.tsx`
Add a "Save this search" button in the results header (next to the Discover link). On click: if
signed in → POST `/api/saved-searches` with current `q`+filters (name defaults to `q` or a filter
summary) → toast; if anonymous → `addLocalSavedSearch` + a gentle "sign in to get alerts" toast.
- [ ] Build; `tsc`. Commit.

### Task 6: UI — `/saved` page + menu link
**Files:** Create `apps/web/src/app/saved/page.tsx` (+ client list component if needed); add a link in
the profile/account menu (`components/UserMenu.tsx` or the profile page).
Server-load the caller's saved searches (or client-fetch GET). Each row: name + filter summary, a
"N new" badge (from `new_count`), a "Re-run" link to `/search?<params>`, an alert toggle (PATCH
`alert_enabled`), a delete (DELETE). Opening/re-running a row PATCHes `seen:true`. Anonymous → render
the localStorage list (no new_count / no alert toggle), with a sign-in nudge.
- [ ] Build; `tsc`. Commit.

### Task 7: i18n + final review + deploy + verify
- [ ] Add `saved.*` keys to all 5 locales (ru native, nl/fr/de drafts → pending-review doc).
- [ ] `vitest run` (i18n guard green) + `tsc` + clean `next build`.
- [ ] Whole-branch review (opus). Fix Critical/Important.
- [ ] Merge to main, push, deploy. Verify on prod: `/saved` reachable (auth-gated → behavior for anon);
      `/api/saved-searches` 401 when unauthed (curl); "Save this search" present on `/search`.
      Authed save/list/new-count/alert/delete need a manual signed-in check.

## Self-review notes
- new_count via existing RPC (no RPC change) — confirmed the live RPC accepts verified_only +
  condition_filter and returns created_at + seller_verified. ✓
- Alert delivery (firing) is Stage 5 — only the stored toggle ships now. ✓
- Local→server migration on sign-in is a nice-to-have, NOT in Stage 1. ✓
