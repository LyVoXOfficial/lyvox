# Design: T37 / B6 — Trust Score UI badges (profile page)

**Date:** 2026-06-28  
**Status:** Approved → Implementation pending  
**Approach:** Approach A — SSR initial score + `router.refresh()` after API call  
**Branch:** `feat/foundations-batch-2`

---

## 1. Goal

Wire the already-computed `trust_score` (loaded server-side on `/user/[id]`) into two visible UI surfaces:

1. **Header card** — compact trust tier badge, visible to everyone.
2. **Sidebar card** — verifiable component facts + composite score, visible to everyone; owner gets an additional "How to improve" section and a Refresh button.

Fix the rate-limit key on `POST /api/trust/refresh` to be per-user, not per-IP.

---

## 2. Tier system (`lib/trust/trustTier.ts`)

Pure function, no DB calls, safe for both server and client imports.

| Tier key | Score range | Rationale |
|---|---|---|
| `new` | 0–14 | No verifications / brand-new account |
| `rising` | 15–34 | Phone verified or moderate activity |
| `trusted` | 35–59 | Phone + activity, established seller without itsme |
| `top` | 60–100 | itsme verified + active seller |

Max achievable score pre-F3 (no escrow deals): 60 (itsme=20 + phone=15 + email=5 + full activity=20).

```ts
export type TrustTier = "new" | "rising" | "trusted" | "top";

export interface TrustTierInfo {
  tier: TrustTier;
  labelKey: string;     // i18n key, e.g. "trust_score.tier_trusted"
  colorClass: string;   // Tailwind/CSS class for badge styling
}

export function deriveTrustTier(score: number): TrustTierInfo
```

Color mapping:
- `new` → muted/neutral pill
- `rising` → teal-light pill (`oklch(0.56 0.13 178 / 0.12)` bg, `--priD` text)
- `trusted` → teal solid pill (trust-gradient bg, white text)  
- `top` → trust-gradient with gold shadow

---

## 3. Header badge (`TrustScoreBadge.tsx`)

RSC-compatible (no `"use client"`). Rendered inside the existing badges row in the header card, after `SellerBadgePill` items.

**Shows:** tier label pill only. **No score number** (cold-start UX: a "21/100" repels legitimate newcomers).

```tsx
<TrustScoreBadge score={trust_score} t={t} />
```

Renders a single pill with tier icon (Shield for trusted/top, Sparkle for rising, nothing for new) + tier label string. Styled to match existing `SellerBadgePill` height (28px).

---

## 4. Sidebar card (`TrustScoreCard.tsx`)

RSC-compatible. Receives all data as props (no fetching). Placed in the sidebar column above the reviews card.

**Props:**
```ts
{
  score: number;
  lastComputedAt: string | null;
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  itsmeVerified: boolean;
  createdAt: string | null;
  activeListingsCount: number;
  isOwnProfile: boolean;
  locale: string;
  t: (key: string) => string;
}
```

**Layout (top → bottom):**

1. **Title row**: "Trust & Reputation" + composite score number (e.g. `32`) + `/100` in muted text + tier badge pill.
2. **Last updated**: "Updated {relative date}" in muted 12px text (or "Not yet calculated").
3. **Component facts** (visible to all, no formula weights/thresholds):
   - ✓/✗ ID verified (itsme)
   - ✓/✗ Phone verified
   - ✓/✗ Email verified
   - Deals completed: `0` (greyed, with "More after deals launch" note — F3-gated; hidden when `0` and not own profile)
   - Member since: formatted date
   - Active listings: count
4. **Owner-only section** (when `isOwnProfile`):
   - "How to improve your score" subheader
   - Conditional tips for unearned verifications (no formula pts shown):
     - If `!verifiedEmail`: "Verify your email address"
     - If `!verifiedPhone`: "Verify your phone number"  
     - If `!itsmeVerified`: "Verify your identity with itsme"
     - If all verified: "Your verifications are complete ✓"
   - `<TrustScoreRefreshButton />` (Client Component slot)

---

## 5. Refresh button (`TrustScoreRefreshButton.tsx`)

`"use client"` component. Rendered inside `TrustScoreCard` as a child (RSC can pass Client Components as children).

**Behaviour:**
1. User clicks "Refresh my score".
2. Sets `isRefreshing = true`, renders spinner.
3. `POST /api/trust/refresh` — standard `fetch`.
4. On `200`: calls `router.refresh()` (re-runs RSC tree with fresh DB data), then shows "Score updated" for 2 s.
5. On `429`: shows "Try again in {min} min" (parses `Retry-After` header).
6. On other error: shows "Could not refresh. Try again."
7. After `router.refresh()` completes, client state (`isRefreshing`) is reset naturally since the component re-renders from server.

**State machine:** `idle → loading → (success | error) → idle`

---

## 6. API fix (`app/api/trust/refresh/route.ts`)

Change rate-limit key from IP to authenticated user ID:

```diff
-  makeKey: (_req, _userId, ip) => ip ?? "anonymous",
+  getUserId: async (_req) => {
+    const supabase = await supabaseServer();
+    const { data: { user } } = await supabase.auth.getUser();
+    return user?.id ?? null;
+  },
+  makeKey: (_req, userId, ip) => userId ?? ip ?? "anonymous",
```

This uses the existing `getUserId` hook on `withRateLimit` — the wrapper calls it before the handler, so the user ID is available in `makeKey`. Falls back to IP for anonymous requests (which the handler will reject with 401 anyway).

Idempotency: the upsert (`ON CONFLICT (user_id) DO UPDATE`) is already idempotent — calling refresh twice with the same inputs writes the same score.

---

## 7. Profile page changes (`app/user/[id]/page.tsx`)

1. Update `trust_score` DB query to also fetch `last_computed_at`:
   ```ts
   supabase.from("trust_score")
     .select("score, last_computed_at")
     .eq("user_id", userId)
     .maybeSingle()
   ```
   (Cast needed until `pnpm gen:types` is run — B5.)

2. Add `lastComputedAt: string | null` to `PublicProfileData` type.

3. Remove `void trust_score` (line 482).

4. Render `<TrustScoreBadge>` inside the badges row (header card), after existing `SellerBadgePill` items.

5. Render `<TrustScoreCard>` as the first item in the sidebar column (before `TraderPanel` / reviews).

---

## 8. i18n — new keys (all 5 locales: en/fr/nl/de/ru)

New top-level `trust_score` section in each locale JSON:

```json
"trust_score": {
  "tier_new": "New Seller",
  "tier_rising": "Building Trust",
  "tier_trusted": "Trusted Seller",
  "tier_top": "Top Seller",
  "card_title": "Trust & Reputation",
  "score_label": "Trust score",
  "last_updated": "Updated {date}",
  "last_updated_never": "Not yet calculated",
  "fact_id_verified": "ID verified",
  "fact_phone_verified": "Phone verified",
  "fact_email_verified": "Email verified",
  "fact_deals": "Deals completed",
  "fact_deals_soon": "Available after deals launch",
  "fact_member_since": "Member since",
  "fact_active_listings": "Active listings",
  "improve_title": "How to improve your score",
  "improve_verify_email": "Verify your email address",
  "improve_verify_phone": "Verify your phone number",
  "improve_verify_itsme": "Verify your identity with itsme",
  "improve_all_done": "Your verifications are complete",
  "refresh_cta": "Refresh my score",
  "refreshing": "Refreshing…",
  "refresh_success": "Score updated",
  "refresh_error_rate": "Try again in {min} min",
  "refresh_error": "Could not refresh. Try again."
}
```

The i18n guard test (`parity check`) will fail until all 5 locales have the same keys — the implementation step must add them to all 5 simultaneously.

---

## 9. Anti-gaming constraints

- **Formula weights never shown**: The sidebar card shows binary/count facts only — no `+N pts` annotations.
- **Tier thresholds never shown**: The tier label appears without mentioning its score boundary.
- **`/api/trust/refresh` is auth-only**: Unauthenticated calls return 401 before rate-limit fires.
- **Improvement tips show WHAT to do, not WHAT points it earns**: Only behavioural guidance.

---

## 10. Files inventory

| Action | File |
|---|---|
| **Create** | `apps/web/src/lib/trust/trustTier.ts` |
| **Create** | `apps/web/src/components/trust/TrustScoreBadge.tsx` |
| **Create** | `apps/web/src/components/trust/TrustScoreCard.tsx` |
| **Create** | `apps/web/src/components/trust/TrustScoreRefreshButton.tsx` |
| **Modify** | `apps/web/src/app/user/[id]/page.tsx` |
| **Modify** | `apps/web/src/app/api/trust/refresh/route.ts` |
| **Modify** | `apps/web/src/i18n/locales/en.json` |
| **Modify** | `apps/web/src/i18n/locales/fr.json` |
| **Modify** | `apps/web/src/i18n/locales/nl.json` |
| **Modify** | `apps/web/src/i18n/locales/de.json` |
| **Modify** | `apps/web/src/i18n/locales/ru.json` |

---

## 11. Out of scope

- Trust score display on listing cards / ad pages (noted as future work in §4 of T37 PRD — "единый источник" means same DB value, wiring to ad cards is a separate ticket).
- `trust_score_components` table per DATA review (F14 future hardening — out of scope here).
- Seller response time metric (no data source yet).
- Dispute-free % metric (no escrow data yet — F3-gated).
