# Phase 3 — Swipe Mode ("Discover") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Ship the opt-in Tinder-style "Discover" swipe deck (spec Section E) — a second view over the
same `/api/search` data, with like/pass/act gestures, a client taste-rerank, themed "Drops", and a
swipe-up actions sheet (Message / Make an offer / Open) routed through the existing Trust Gate.

**Architecture:** Front-end only — **no DB/API/RPC changes**. `/api/search` already returns
`user_id` (seller = `peer_id`) and `category_id` per item (RPC `search_adverts` RETURNS TABLE,
fields pass through `...rest`); the deck consumes a richer card type than `AdvertCard`. Reuses Phase 2a
likes (`useLikes`), Phase 2b Trust Gate (`useTrustGate().requireTrust`), favorites (`useFavorites`),
and chat (`/api/chat/start` + `/api/chat/send`). Gestures via raw pointer events + CSS transforms
(no new dependency); `prefers-reduced-motion` → cross-fade.

**Tech Stack:** Next 16 App Router (client components), React 19, Tailwind v4, sonner, custom i18n,
Vitest.

## Global Constraints
- No new npm dependency (gestures = pointer events + CSS transform).
- No DB/API/RPC change. The deck reads `/api/search` (envelope `{ok,data:{items,...}}`, item has
  `id,user_id,category_id,title,price,currency,location,image,created_at,seller_verified,like_count`).
- Likes = **Auth** tier (`requireTrust("auth", …)` then `useLikes().addLike`); Message/Offer = **Verified**
  tier (`requireTrust("verified", …)`); 403 `VERIFICATION_REQUIRED` re-opens the gate and replays.
- Every user-facing string via `t("key")`; **add every key to all 5 locale files** (en/ru/nl/fr/de) —
  the `i18n-completeness` test enforces presence in en.json + locale parity. ru native; nl/fr/de drafted.
- Honor `prefers-reduced-motion`. Tap targets ≥40px. Reuse existing card/token styles.
- Identity stays gated: the deck card shows photo/title/price/location/like — **never a seller name**.
- After each task: `vitest run` + `tsc --noEmit` clean; commit.

---

### Task 1: `lib/seenAdverts.ts` — seen-tracking store
**Files:** Create `apps/web/src/lib/seenAdverts.ts`; Test `apps/web/src/lib/__tests__/seenAdverts.test.ts`
**Interfaces — Produces:** `getSeenAdverts(): Set<string>`, `addSeenAdverts(ids: string[]): void`,
`isSeen(id: string): boolean`, `clearSeenAdverts(): void`. localStorage key `lyvox:seenAdverts`,
cap 500 FIFO, SSR/private-mode safe (guard `typeof window`, try/catch). Mirror `lib/recentlyViewed.ts`.

- [ ] Test: add 3 ids → all seen; adding >500 evicts oldest (FIFO); clear empties; bad/no localStorage → no throw, empty set.
- [ ] Run test → FAIL. Implement. Run → PASS. Commit.

### Task 2: `lib/taste.ts` — taste weights + scoring
**Files:** Create `apps/web/src/lib/taste.ts`; Test `apps/web/src/lib/__tests__/taste.test.ts`
**Interfaces — Consumes:** a `DeckCard` (Task 3) but to avoid a cycle, score takes a plain
`{categoryId, price, location, sellerId}`. **Produces:**
`recordSignal(card, kind: "like"|"favorite"|"pass"): void` (weights: like +1, favorite +2, pass −1),
`scoreCard(card): number`, `resetTaste(): void`, `getTasteWeights()`. localStorage key
`lyvox:taste`, SSR/private-mode safe. Weights kept per `category:<id>`, `seller:<id>`,
`loc:<location>`, `price:<band>` where band = `Math.floor(price/50)` bucket (null price → no band).
`scoreCard` = sum of the card's four dimension weights (missing dims contribute 0).

- [ ] Test: like a card raises its category/seller/loc/price-band score; pass lowers; favorite double-weights; cold start (no signals) → score 0 for all; reset clears; private-mode safe.
- [ ] Run → FAIL. Implement. Run → PASS. Commit.

### Task 3: `lib/discover/deck.ts` — deck card type, mapper, rerank, Drops presets
**Files:** Create `apps/web/src/lib/discover/deck.ts`; Test `apps/web/src/lib/discover/__tests__/deck.test.ts`
**Interfaces — Consumes:** raw search item (with `user_id`,`category_id`); `scoreCard` (Task 2);
`isSeen` (Task 1). **Produces:**
- `type DeckCard = { id; title; price: number|null; currency: string|null; location: string|null; image: string|null; createdAt: string|null; sellerVerified: boolean; likeCount: number; sellerId: string|null; categoryId: string|null }`.
- `mapSearchItemToDeckCard(item): DeckCard` (snake→camel; `user_id`→`sellerId`, `category_id`→`categoryId`).
- `type Drop = { key: string; query: Record<string,string> }` and `DROPS: Drop[]` — Stage-1 presets, each a `/api/search` query string map: `just_listed` (`sort_by=created_at_desc`), `under_50` (`price_max=50&sort_by=created_at_desc`), `verified` (`verified_only=true`), `cheapest` (`sort_by=price_asc`). (No geo "Near you" in Stage-1.)
- `rerankByTaste(cards: DeckCard[]): DeckCard[]` — stable sort by `scoreCard` desc; equal scores keep source order (cold start = source order untouched).
- `filterUnseen(cards: DeckCard[]): DeckCard[]` — drop `isSeen(id)`.

- [ ] Test: mapper carries sellerId/categoryId + camelCase; rerank is stable and orders higher-taste first; cold-start preserves input order; filterUnseen removes seen ids; DROPS each have a valid query map.
- [ ] Run → FAIL. Implement. Run → PASS. Commit.

### Task 4: `components/discover/SwipeCard.tsx` — presentational card
**Files:** Create `apps/web/src/components/discover/SwipeCard.tsx`
**Interfaces — Consumes:** `DeckCard`. **Produces:** `<SwipeCard card transform overlay onTap />` — pure
visual: full-bleed photo (fallback "No photo" block), gradient scrim, title/price/location, like-count
chip, favorite heart (existing `FavoriteToggle variant="overlay"`), and a directional overlay hint
(LIKE/PASS/ACT) driven by `overlay` prop. `transform` (string) applied to the card for drag. No gesture
logic here (Task 5 owns it). Reuse existing tokens; no seller name rendered.

- [ ] Build component (typecheck only; visual). Commit. (No unit test — presentational; covered by deck tests + prod verify.)

### Task 5: `components/discover/SwipeDeck.tsx` — deck state + gestures
**Files:** Create `apps/web/src/components/discover/SwipeDeck.tsx`
**Interfaces — Consumes:** `DeckCard[]` initial; Tasks 1-4; `useLikes`, `useFavorites`, `useTrustGate`.
**Produces:** `<SwipeDeck initial drop onActOpen />`.
Behavior: keep a queue; render top ~2-3 cards stacked; **pointer drag** (pointerdown/move/up) →
translate+rotate the top card; release past threshold (X) flings; **keyboard** ←/→/↑ + on-screen
buttons mirror gestures; `prefers-reduced-motion` → cross-fade swap (no fling).
- RIGHT = like: `requireTrust("auth", () => { addLike(id); recordSignal(card,"like"); advance(); })`.
- LEFT = pass: `recordSignal(card,"pass"); advance()` (no network).
- UP = act: `onActOpen(card)` (Task 7 sheet).
- TAP (no drag) = open `/ad/{id}`.
- On advance: `addSeenAdverts([id])`; when queue < 5, fetch next page via `/api/search` (the drop query + `page`), map, `filterUnseen`, `rerankByTaste`, append (dedupe). Empty → "You're all caught up" + link to feed. Fetch error → inline retry.

- [ ] Build; typecheck. Commit. (Verified via prod E2E in Task 11.)

### Task 6: `app/discover/page.tsx` — route + Drops header
**Files:** Create `apps/web/src/app/discover/page.tsx`
**Interfaces — Consumes:** SwipeDeck, DROPS. **Produces:** the `/discover` route. SSR-fetch the initial
pool for the default drop (`just_listed`) from `/api/search` (reuse the home `getLatestAds`-style fetch
or call the search RPC path used elsewhere), map to `DeckCard[]`, render a header with Drop chips
(switching a Drop re-seeds the deck via client fetch) + `<SwipeDeck initial drop onActOpen=…/>`.
`export const dynamic = "force-dynamic"`.

- [ ] Build; typecheck. Commit.

### Task 7: `components/discover/DiscoverActions.tsx` — actions sheet (Message / Offer / Open)
**Files:** Create `apps/web/src/components/discover/DiscoverActions.tsx`
**Interfaces — Consumes:** the active `DeckCard` (has `sellerId`), `useTrustGate`. **Produces:** a bottom
sheet (reuse shadcn `Sheet`/`Dialog`) with three actions:
- **Open listing** → `router.push('/ad/'+id)`.
- **Message seller** → `requireTrust("verified", () => startConversation(card, null))`.
- **Make an offer** → `requireTrust("verified", () => startConversation(card, t("discover.offer_template")))`.
`startConversation(card, firstMessage|null)`: POST `/api/chat/start` `{advert_id:id, peer_id:sellerId}`;
on `{conversation_id}` → if `firstMessage`, POST `/api/chat/send` `{conversation_id, body:firstMessage}`;
then `router.push('/chat/'+conversation_id)`. On 403 `VERIFICATION_REQUIRED` → `requireTrust("verified", retry)`.
Guard: if `sellerId` is null, fall back to `router.push('/ad/'+id)`.

- [ ] Build; typecheck. Commit.

### Task 8: entry points + i18n
**Files:** Modify `apps/web/src/app/page.tsx` (home — add a "Discover" entry near the feed), and
`apps/web/src/app/search/page.tsx` (a "Swipe these results" / Discover link). Add i18n keys to all 5
locales: `discover.title`, `discover.subtitle`, `discover.enter` (entry CTA), `discover.empty_title`,
`discover.empty_body`, `discover.back_to_feed`, `discover.retry`, `discover.like`, `discover.pass`,
`discover.act`, `discover.open_listing`, `discover.message_seller`, `discover.make_offer`,
`discover.offer_template`, `discover.reset_prefs`, `discover.drop.just_listed`, `discover.drop.under_50`,
`discover.drop.verified`, `discover.drop.cheapest`.

- [ ] Add keys (en + ru native + nl/fr/de drafts → pending-review doc). Add entry links. `vitest run` (i18n guard green) + `tsc`. Commit.

### Task 9: Final review + deploy + verify
- [ ] `vitest run` (all green incl. i18n guard) + `tsc --noEmit` + clean `next build`.
- [ ] Dispatch whole-branch review (opus). Fix Critical/Important.
- [ ] Merge to main, push, deploy. Verify on prod: `/discover` 200; deck renders cards; (manual) right-swipe like prompts auth gate when signed out; up-swipe Message/Offer prompts verify gate; no seller name in deck HTML (anon curl `/discover` → real seller name = 0).

## Self-review notes
- Taste needs `categoryId`/`sellerId` — confirmed present in `/api/search` items (RPC returns them). ✓
- `peer_id` for chat = `sellerId` (item.user_id), already in the public response (no new exposure). ✓
- "Make an offer" = simple templated chat message (spec: "the simple 'make an offer' message"). ✓
- No "Near you" (geo) in Stage-1 — listed as out-of-scope to keep presets to existing query params.
