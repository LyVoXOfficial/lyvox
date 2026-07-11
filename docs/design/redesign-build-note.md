> [!CAUTION]
> **Исторический cloud-design handoff. Не исполнять инструкции `pixel-by-pixel`, не копировать устаревший макет и не выполнять описанный здесь production deploy.** Текущие приоритеты задаёт [`docs/MASTER_PRODUCTION_TZ.md`](../MASTER_PRODUCTION_TZ.md), а обязательный визуальный контракт — [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Содержимое ниже оставлено только для происхождения решений.

# LyVoX UI Redesign (from cloud-design handoff) — Build Note

**Goal:** recreate the cloud-design mockup **pixel-by-pixel** on the real Next.js pages. **Presentation only** —
do NOT change data fetching, props, gates, RLS, i18n keys, routes, or any logic I just built (chat, reviews,
erasure, trust gates). Only markup/styling/classes/layout change. Ship + prod-verify one screen at a time.

## Design source (read locally — no auth)
`docs/design/handoff/lyvox-marketplace-design-brief/project/LyVoX Screens.dc.html` — a single canvas; each screen
is an absolutely-positioned `<div>` with a `class="lbl"` heading + `data-screen-label`. Inline styles use CSS vars
defined in `<style>` at lines ~16-37. **`support.js` is the design-canvas React runtime — ignore it.**

**Screen line ranges (desktop unless noted):**
| Screen | Lines | Real page |
|---|---|---|
| Cover (reference only) | 40-75 | — |
| Home desktop / mobile | 77-264 / 265-319 | `apps/web/src/app/page.tsx` (+ `components/home/*`) |
| Search desktop / mobile | 320-378 / 379-411 | `apps/web/src/app/search/*` |
| Listing detail desktop / mobile | 412-526 / 527-565 | `apps/web/src/app/ad/[id]/page.tsx` |
| Seller profile desktop / mobile | 566-633 / 634-663 | `apps/web/src/app/user/[id]/page.tsx` |
| Business cabinet desktop / mobile | 664-747 / 748-782 | `apps/web/src/app/pro/*` |
| Chat desktop / mobile | 783-832 / 833-857 | `apps/web/src/app/(protected)/chat/*` |
| Auth register desktop / mobile | 858-898 / 899-926 | `apps/web/src/app/register/*` |
| Cookie banner / preferences | 927-983 | already shipped — align only |
| Dark mode (Home, Listing) | 984-1053 | our `.dark` theme — align only |

## Token reconciliation (our `globals.css` ALREADY matches the core)
Mockup `--pri`/`--mint`/`--bg`/`--fg`/`--bd`/`--gT` == our `--primary`/`--accent`/`--background`/`--foreground`/
`--border`/`.lyvox-trust-gradient` (verified identical oklch). **Foundation adds the missing tokens** to `:root`
(+ `.dark` equivalents): `--priD` (oklch 0.46 0.13 180), `--mintI` (0.40 0.10 172), `--amber` (0.83 0.14 72),
`--amberI` (0.46 0.12 58), `--cyan #11BDF9`, `--sec` (0.955 0.018 192), `--danger` (0.58 0.19 24); a radius scale
`--r:20px --rm:13px --rs:9px` (NOTE: existing `--radius` stays 0.95rem for shadcn; the new scale is for the redesigned
components); shadows `--shC` (card hover) `--shHi` (hero); the CTA gradient `--gC` (linear 180° 0.60→priD).
Do NOT remove/alter existing tokens — additive only, so the rest of the app is unaffected.

## Foundation (T0) — shared components used across screens (RESTYLE the existing ones, keep their props/logic)
- **Listing card** (`apps/web/src/components/ad-card.tsx` — the existing card): restyle to the mockup card
  (lines 151-211): `aspect-4/3` gradient image placeholder when no image, condition pill (top-left), favorite heart
  button (top-right, our `LikeToggle`/favorite wiring stays), optional gradient **Boost** badge (bottom-left), body =
  bold price (€ or gradient "Free"), 2-line clamped title, location with pin, footer row = **Verified** (teal shield)
  or **Private** (grey dot) chip + like count. Keep ALL existing props/data + the favorite/like handlers.
- **Site header** (the existing top bar + `main-header`): the mockup header (lines 81-105) = a thin trust-signal top
  bar (Verified-seller signals · Anti-fraud moderation · Made for Belgium) + main header (logo with shield, Categories
  chip, rounded search pill with gradient submit, language chip, gradient **Post a listing** CTA, avatar). Keep the
  existing nav/auth/i18n wiring; restyle only.
- **Trust badge + seller-type chip** (extend `lib/profile/sellerBadges` rendering / `components/business/TraderPanel`
  styling): Verified Business = trust-gradient pill; VAT-registered = teal-tint pill; Phone-verified = sec pill;
  Private = grey-dot chip; Business seller = mint label. (deriveSellerBadges logic unchanged.)
- **Seller mini-card** (top-sellers carousel item, lines 219-226): avatar square (gradient, initials), name + shield,
  "Business seller", ★ rating · count.
- Add the missing tokens to `globals.css` (light + dark) per above.

## Per-screen tasks (in order; each: read the screen's lines → restyle the page → tsc + build → review → deploy → prod-verify)
T1 Home · T2 Listing · T3 Search · T4 Seller · T5 Pro · T6 Chat · T7 Auth.

## Hard rules for every task
- Preserve every server data load, prop, `useI18n`/`tr(key,fallback)` call (keep i18n keys; add new ones to all 5
  locales only if the mockup introduces NEW copy, keeping the parity guard green), gate (`TrustGate`, verified checks),
  link/route, and the chat/reviews/erasure logic. If unsure whether something is logic vs presentation, KEEP it.
- Responsive: the mockup gives desktop + mobile per screen — implement both with Tailwind breakpoints; dark via `.dark`.
- Run `tsc --noEmit` + a clean `next build` before each deploy. Full test suite must stay green.
- Reuse the foundation components; don't fork parallel ones.
