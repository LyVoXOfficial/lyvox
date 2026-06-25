# Stage 1 — Discovery & Search (UX overhaul)

_Design spec · 2026-06-25 · part of the staged "whole-core" user-friendliness overhaul
(Stages: 1 Discovery/Search → 2 Listing detail & contact → 3 Sell → 4 Trust/escrow → 5 Engagement)._

## Goal
Make the entry experience (find → browse) feel as fast, alive and trust-forward as
Avito/Vinted so the site is presentable. Everything ships to www.lyvox.be and is
verified there (local dev preview does not reflect CSS — see `memory/deploy-pipeline.md`).

## Success criteria
- Home shows an **infinite, never-empty** discovery feed; users can scroll endlessly.
- Typing in search shows **instant listing results + recent searches** before submitting.
- Filtering is a real **mobile bottom-sheet** with condition + sort + active chips.
- Logged-in users can **save a search** and see "N new since saved"; anonymous users get
  local saved searches.
- All new UI is localized in 5 locales; `pnpm build` ✅, `tsc` ✅, i18n check PASS, tests ✅.

## Scope — four parts

### A. Discovery feed (home)
- **New** `components/discovery/DiscoveryFeed.tsx` (client): renders an initial page passed
  from the server (SSR for first paint/SEO), then appends pages from `/api/search`
  (`sort_by=created_at_desc`, `page`, `limit=24`) via `IntersectionObserver` on a sentinel.
  Loading skeleton (reuse `AdsGridSkeleton`), end-of-feed state, error+retry.
- `app/page.tsx`: the "Latest adverts" section becomes `<DiscoveryFeed initial={latestAds} />`.
  Keep hero, info cards, categories carousel, and the "Free adverts" row.
- **New** `components/discovery/RecentlyViewed.tsx` (client) + `lib/recentlyViewed.ts`:
  on the ad-detail page, store a minimal card payload `{id,title,price,currency,location,image}`
  in `localStorage` (cap 20, dedupe, most-recent-first). RecentlyViewed renders that row
  directly from localStorage (no API). Hidden when empty. Horizontal swipe row.
- Trust-forward quick-filter chips ("Verified / Free / Near me") already exist in the hero;
  ensure "Verified" routes to `/search?verified_only=true`.

### B. Instant search (SearchBar)
- Extend `components/SearchBar.tsx`: on debounced input, in parallel with the existing
  category autocomplete, call `/api/search?q=<q>&limit=6` and show **top listing results**
  (thumbnail, title, price) in the dropdown, above category suggestions. Clicking a result
  → `/ad/{id}`; Enter → `/search?q=`.
- **New** `lib/recentSearches.ts`: store last 8 submitted queries in `localStorage`
  (dedupe, cap). Show "Recent searches" (clickable, removable) when the input is focused and
  empty. Submitting a query records it.
- No new API (reuse `/api/search`).

### C. Filters & sort
- `components/SearchFilters.tsx`: add a **Condition** filter (new / used / for_parts as
  checkboxes) and integrate **Sort** (relevance / newest / price asc / price desc) into the
  sheet (in addition to the results-header sort). Keep the active-chips + count and the
  sticky mobile apply/clear footer (already implemented).
- `app/search/page.tsx`: read `condition` + `sort_by` from the URL and pass them through.
- **RPC change:** extend `search_adverts` with a `condition_filter text default null`
  parameter (filter `a.condition = condition_filter` when set). Shipped as a new idempotent
  migration `supabase/migrations/<ts>_search_adverts_condition.sql` (CREATE OR REPLACE the
  12→13-param function + DROP the old 12-param overload), applied surgically via `pg`
  (additive, safe — same approach as the search fix). The API
  `app/api/search/route.ts` adds `condition_filter: params.condition` and the zod schema
  gains an optional `condition` enum.

### D. Saved searches + alerts
- **New table** `public.saved_searches`:
  `id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users(id) on
  delete cascade, name text not null, query text, filters jsonb not null default '{}',
  alert_enabled boolean not null default true, last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()`. `filters` holds
  `{category_id, price_min, price_max, location, verified_only, condition, sort_by}`.
  **RLS owner-only** (select/insert/update/delete `using (auth.uid() = user_id)`),
  index `(user_id, created_at desc)`. Shipped as a migration and applied surgically via `pg`.
- **API** `app/api/saved-searches/route.ts`:
  - `GET` → list the caller's saved searches; for each, a `new_count` = count of active
    adverts matching `filters` with `created_at > last_seen_at` (computed via a count query /
    `search_adverts` total). Rate-limited per user.
  - `POST {name, query, filters}` → create (cap e.g. 50 per user).
  - `app/api/saved-searches/[id]/route.ts`: `DELETE` (owner), `PATCH {alert_enabled?, seen?}`
    (toggle alert; `seen:true` sets `last_seen_at=now()`).
  - Auth required (401 otherwise); zod-validated; standard `{ok,data}` envelope.
- **UI:**
  - `app/search/page.tsx`: a "Save this search" button (in the results header) → POST the
    current `q`+filters; toast on success; sign-in prompt if anonymous (or save locally).
  - **New** `app/saved/page.tsx` (+ a link in the profile/account menu): lists saved searches;
    each row re-runs the search (`/search?…`), shows a "N new" badge, an alert toggle, and a
    delete. Opening a saved search PATCHes `seen:true`.
  - **Anonymous**: `lib/savedSearches.ts` mirrors the same shape in `localStorage`
    (no `new_count`, no alerts) so the feature works logged-out; on sign-in we can migrate
    local → server (nice-to-have, not required for Stage 1).
- **Boundary:** actually *delivering* an alert when a new listing matches (cron / Edge
  Function scanning new adverts against saved searches → notifications) is **Stage 5**. Stage 1
  ships save + list + re-run + "N new since saved" + the alert toggle (stored, not yet firing).

## Mobile / tactile
Horizontal swipe rows (recently-viewed, categories), pull-friendly infinite feed, the filter
bottom-sheet with sticky apply/clear, tap targets ≥40px, smooth skeletons. Reuse the
"Trust, in colour" tokens/components already in place.

## Error handling & edge cases
- Feed/search fetch failure → inline retry (never a blank screen); empty result → the existing
  friendly empty-state.
- localStorage unavailable (private mode) → features degrade silently (no recent/recently-viewed).
- Saved-search `new_count` query is bounded (count only) and cached briefly to avoid load.
- Anonymous "Save search" → store locally + a gentle "sign in to get alerts" nudge.

## Testing
- Unit (vitest): `lib/recentSearches.ts` (dedupe/cap/order), `lib/recentlyViewed.ts`,
  `lib/savedSearches.ts` (local shape), and a pure `savedSearchMatches(filters, advert)` helper
  if used client-side.
- API: `app/api/saved-searches` CRUD (auth, ownership, validation) — mock supabase like the
  existing route tests.
- Live: verify on www.lyvox.be (infinite scroll loads, instant results appear, filter sheet,
  save+list) after each deploy. Gate every push on `tsc`, `pnpm build`, i18n PASS, `pnpm test`.

## Out of scope (later stages)
Map view (needs a map lib + reliable geo) · offers/negotiation in chat (Stage 2) · fast
photo-first sell + AI assist (Stage 3) · itsme/escrow/disputes (Stage 4) · alert delivery
job + push/email (Stage 5).

## Data flow summary
`Home (SSR latest) → DiscoveryFeed → /api/search (paged)`;
`SearchBar (debounced) → /api/search?limit=6 + localStorage recent`;
`SearchFilters → URL params → /api/search (now incl. condition + sort) → search_adverts RPC`;
`Save search → /api/saved-searches → saved_searches table`;
`/saved → GET /api/saved-searches (+new_count) → re-run /search`.
