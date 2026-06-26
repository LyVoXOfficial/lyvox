# Stage 1 — Discovery & Search (UX overhaul)

_Design spec · 2026-06-25 · part of the staged "whole-core" user-friendliness overhaul
(Stages: **1 Discovery/Search** → **1.5 Passkeys / biometric login** → 2 Listing detail &
offers → 3 Sell → 4 Trust/escrow → 5 Engagement). Stage 1.5 = a friendly UX over the
existing WebAuthn scaffolding (`/api/auth/webauthn/*`, `lib/webauthn.ts`): "log in once,
then bind a device passkey → unlock with Face/Touch ID". Pulled in early because it is both
a wow-feature and an anti-fraud lever, and the foundation already exists._

## Implementation phasing (each phase ships + is verified on www.lyvox.be)
Ordered by dependency: the Trust Gate (F) gates the like action and swipe-up actions, so it
must land **with** likes and **before** the swipe deck.
1. **Phase 1** — Discovery feed (A) + instant search (B) + filters/sort (C).
2. **Phase 2** — Trust Gate (F) + likes & popularity formula (G).
3. **Phase 3** — Swipe mode (E) + the simple "make an offer" message (swipe-up action).
4. **Phase 4** — Saved searches + alerts (D).

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
- A **swipe "Discover" deck** lets users like (right), pass (left), act (up), and open (tap)
  adverts; the deck reranks toward their taste and never repeats cards.
- **Likes** drive a real popularity ranking (`views·0.3 + likes·3 + favorites·5`), shown as a
  count on cards — distinct from the heart/favorite.
- High-intent actions (publish, message, offer, like) flow through one **Trust Gate** that asks
  anonymous users to register/login and unverified users to verify their phone, then replays
  the action — instead of failing or silently redirecting.
- All new UI is localized in 5 locales; `pnpm build` ✅, `tsc` ✅, i18n check PASS, tests ✅.

## Scope — seven parts (A–D = browse/search · E–G = swipe, gate, likes)

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

### E. Swipe mode ("Discover" — a Tinder-style deck)
A playful, **opt-in** way to browse — a full-screen card deck reachable from a "Discover"
entry on the home feed and `/search`. It is a *second view* over the same data, never the
only way in.
- **New** `app/discover/page.tsx` + `components/discover/SwipeDeck.tsx` (client): a stack of
  large advert cards (photo-first: image, title, price, location, the heart, a like count).
  Cards come from `/api/search` reranked toward the user's taste (see below); the deck
  prefetches the next ~10 and tracks "seen" ids so the same advert isn't shown twice.
- **Gestures** (touch + mouse drag + keyboard arrows + on-screen buttons for accessibility):
  - **Swipe RIGHT = Like 👍** — a public popularity signal. Calls `POST /api/likes` (Section G),
    bumps the like count, and feeds the taste engine. **Not** a favorite. Requires auth →
    if anonymous, the Trust Gate (Section F) opens; the pending like is replayed after sign-in.
  - **Swipe LEFT = Pass** — recorded locally only (taste signal: down-weight this
    category/seller/price band). No server call.
  - **Swipe UP = Act** — opens the **actions sheet** for that advert: *Message seller*,
    *Make an offer*, *Open listing*. Message/offer route through the Trust Gate first.
  - **Tap = Open** the full listing (`/ad/{id}`).
  - The **heart on the photo = Favorite** (existing favorites system) — independent of swipe.
- **Taste engine** `lib/taste.ts` (client, localStorage, anonymous-friendly): keeps lightweight
  weights per `{category_id, price_band, location, seller}` from likes (+), favorites (++) and
  passes (−). The deck asks `/api/search` for a candidate pool (newest + popular) and reorders
  it client-side by a taste score; cold-start (no signal) = popularity order. No ML, no new
  table — purely a reranking heuristic. Cleared with a "Reset preferences" control.
- **Themed decks ("Drops")**: optional preset decks the deck header can switch between —
  e.g. "Near you", "Under €50", "Just listed", "Popular now" — each just a different
  `/api/search` query feeding the same SwipeDeck. Stage-1 ships 3–4 presets.
- **Seen-tracking** `lib/seenAdverts.ts` (localStorage, cap ~500, FIFO) so refreshes don't
  repeat cards; resettable.
- Reuse the "Trust, in colour" tokens; honor `prefers-reduced-motion` (cross-fade instead of
  fling). Empty deck → "You're all caught up" with a link back to the feed.

### F. Trust Gate + verified-only interaction model
LyVoX is **browse-open, act-verified**. Anyone can browse, search, and view a listing
anonymously; everything else is gated by a **real, server-enforced** trust tier — the Trust
Gate is the friendly front-end over that enforcement, **not** a cosmetic modal.

**Action tiers** (decided 2026-06-26 with the user; blast radius = 0 — only 2 users / 4 active
adverts in the DB, none owned by unverified users, so enforcement is safe with no migration):

| Tier | Actions |
|------|---------|
| **Open** (anonymous) | browse feed, search, view a listing's photos/title/price/description |
| **Auth** (account; phone NOT required) | **like** 👍, **favorite** ❤️ |
| **Verified** (account **+** phone-verified) | **contact / message a seller**, **publish a listing**, **make an offer** (Stage-3 action), and **seeing seller identity / contact affordance** |

Correction to an earlier draft: the codebase did **not** enforce phone-verification anywhere
(neither `POST /api/adverts` nor `POST /api/chat/start` checked it — only auth). This model
**adds** that enforcement.

- **Server guard (the source of truth)** `lib/auth/requireVerified.ts`: given a request,
  returns the user iff signed-in **and** phone-verified (reads `phones.verified` /
  `profiles.verified_phone`, the same signals `/api/me` exposes); otherwise a `403`
  `VERIFICATION_REQUIRED` (new `ApiErrorCode`). Applied to `POST /api/chat/start` and
  `POST /api/adverts`. The like/favorite routes keep their existing **auth-only** check.
- **Client gate** `components/trust/TrustGate.tsx` + `lib/useTrustGate.ts` — a hook
  `requireTrust(level: "auth" | "verified", run: () => void)` that reads auth + `verifiedPhone`
  from `/api/me` and, if the tier isn't met, opens the modal; on success it **replays** `run`:
  - **Not signed in** → compact **email+password login** (browser client
    `supabase.auth.signInWithPassword`) with a tab/link to **register** (reuse the existing
    standalone `RegisterForm`). Do **not** extract the full `LoginPageInner` — a small inline
    form is enough.
  - **Signed in but (level = "verified" and) phone unverified** → inline **phone-verification**
    reusing the **live** Supabase-native OTP flow that `/verify` already uses
    (`supabase.auth.signInWithOtp` → `verifyOtp` → set `profiles.verified_phone`), **not** the
    unused custom `/api/phone/*` endpoints.
  - **Tier already met** → run immediately (no modal).
- Routes that return `VERIFICATION_REQUIRED`/`401` make the client open the gate at the right
  tier and replay — so the gate and the server guard agree, and the server stays authoritative.
- **Hide seller identity from unverified viewers:** on the ad-detail page the contact panel
  shows the seller name + "Message seller" **only** to verified viewers; everyone else sees a
  "Verify your phone to contact the seller" card that opens the Trust Gate. (The listing itself
  — photos/title/price/description — stays open.) Nothing sensitive is otherwise exposed today
  (no raw phone/email is rendered; contact is chat-based).
- **Passkeys tie-in (Stage 1.5):** once signed in via the gate, offer "Enable fast sign-in on
  this device" → `/api/auth/webauthn/enroll`. Enrollment UX is Stage 1.5; this stage leaves the
  hook/affordance only.

### G. Likes & popularity formula
Likes are a **public popularity signal** distinct from favorites (private save list).
- **New table** `public.advert_likes` (mirrors the favorites table):
  `user_id uuid not null references auth.users(id) on delete cascade,
   advert_id uuid not null references public.adverts(id) on delete cascade,
   created_at timestamptz not null default now(), primary key (user_id, advert_id)`.
  **RLS — mirror the existing `favorites` table** (favorites already uses public-read): a
  `user_manage_own_likes` policy (`for all using (auth.uid() = user_id) with check
  (auth.uid() = user_id)`) plus a `public_read_likes` policy (`for select using (true)`) so
  per-advert counts are readable. Indexes `(user_id, created_at desc)` and `(advert_id)`. Add a
  `get_advert_like_count(advert_id uuid) returns bigint` SQL helper (mirroring
  `get_advert_favorite_count`). Shipped as a migration, applied surgically via `pg`. (Likes are
  a public popularity signal, so public-read is consistent with favorites; choosing own-rows-only
  `select` would silently break the `/api/top-adverts` count query, which reads rows directly.)
- **API** `app/api/likes/route.ts` (POST) + `app/api/likes/[advertId]/route.ts` (DELETE),
  **mirroring `/api/favorites`**: POST `{advert_id}` inserts the caller's like (idempotent on
  the `23505` unique violation), DELETE removes it. **Auth required** (401 otherwise) — this is
  the **Auth** tier, NOT verified. Rate-limited per user (same `withRateLimit` pattern as
  favorites). A like count for rendering comes from `get_advert_like_count` (detail page) and
  the `LikesProvider` (own liked-state). A client `LikesProvider` + `useLikes()` + `LikeToggle`
  mirror `FavoritesProvider`/`useFavorites`/`FavoriteToggle`.
- **Popularity formula:** `app/api/top-adverts/route.ts` changes its score from
  `views·1 + favorites·5` to **`views·0.3 + likes·3 + favorites·5`** (likes weighted between
  cheap views and high-effort favorites). Computed from `like_count` + `favorite_count`
  aggregates; keep it a single bounded query. "Popular now" deck (Section E) and any
  "Top/Popular" rails read this endpoint.
- **UI:** advert cards and the detail page show a 👍 like count next to the heart;
  the swipe deck's right-swipe and a tappable like button on cards both call `/api/likes`
  (through the Trust Gate). Favorites UI is unchanged.

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
- Unit (vitest): `lib/taste.ts` (weight update from like/favorite/pass, taste-score ranking,
  cold-start = popularity order), `lib/seenAdverts.ts` (cap/FIFO/dedupe), and a pure
  `popularityScore({views,likes,favorites})` helper used by `/api/top-adverts`.
- API: `app/api/saved-searches` CRUD and `app/api/likes` (auth required, toggle insert/delete,
  rate-limit, ownership, validation) — mock supabase like the existing route tests.
- Trust Gate: a small test that `requireTrust` runs the action immediately when verified, opens
  the register panel when anonymous, opens phone-verify when unverified, and replays the action
  after each gate clears.
- Live: verify on www.lyvox.be (infinite scroll loads, instant results appear, filter sheet,
  save+list, swipe deck likes/passes, like count + popularity, the Trust Gate on a contact/like
  action) after each deploy. Gate every push on `tsc`, `pnpm build`, i18n PASS, `pnpm test`.

## Out of scope (later stages)
Map view (needs a map lib + reliable geo) · full offer management — accept / counter / expire
(Stage 2; Stage 1's swipe-up "Make an offer" is just a structured offer **message** in chat) ·
server-side taste/recommendation ML (Stage 1 taste is a client localStorage heuristic) ·
passkey **enrollment UX** (Stage 1.5 — Stage 1 only leaves the affordance) · fast photo-first
sell + AI assist (Stage 3) · itsme/escrow/disputes (Stage 4) · alert delivery job + push/email
(Stage 5).

## Data flow summary
`Home (SSR latest) → DiscoveryFeed → /api/search (paged)`;
`SearchBar (debounced) → /api/search?limit=6 + localStorage recent`;
`SearchFilters → URL params → /api/search (now incl. condition + sort) → search_adverts RPC`;
`Save search → /api/saved-searches → saved_searches table`;
`/saved → GET /api/saved-searches (+new_count) → re-run /search`;
`/discover → SwipeDeck → /api/search (taste-reranked) → right=POST /api/likes · up=actions sheet · tap=/ad/{id}`;
`High-intent action → useTrustGate → (auth panel | phone-verify) → replay action`;
`Like/favorite/view counts → /api/top-adverts (views·0.3 + likes·3 + favorites·5) → Popular rails & deck`.
