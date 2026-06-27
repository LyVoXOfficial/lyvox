# Cookie Consent (ePrivacy) + Cookie Policy — Build Note

**Status:** Build-ready slice. Company-free, ACTIVE, additive/low-blast-radius. **Highest-value launch-checklist
item #2 engineering core.** Stops a LIVE ePrivacy breach: today 5 non-essential `localStorage` writers fire on
every visit with ZERO consent (Belgian Act 13 Jun 2005 Art.129 / ePrivacy 2002/58 Art.5(3)). From the legal/GDPR
audit workflow (`tasks/wtbt95kum.output`) + synthesis. The legal *prose* pages (privacy/terms/imprint + entity
config + ROPA) are a SEPARATE follow-up slice (1b) — this slice is the consent state machine + the cookie policy
(factual cookie inventory, not counsel-gated prose).

## 0. Decisions / invariants (read first)
- **Cookie consent is SEPARATE from the registration `ConsentSnapshot`** (`apps/web/src/lib/consents.ts` = per-user
  GDPR *processing* consent: terms/privacy/marketing, versioned, audit-logged). Cookie consent is **anonymous-visitor
  ePrivacy consent** with its own lifecycle. New namespace `apps/web/src/lib/cookieConsent/`. Do NOT touch `consents.ts`.
- **Belgian mechanics (non-negotiable):** layer-1 banner has **"Reject all" with equal prominence to "Accept all"**
  + a "Customize" affordance; **no pre-ticked boxes** (all non-essential categories default OFF); **no cookie wall**
  (browsing fully works with everything rejected); granular categories; consent persisted in a strictly-necessary
  first-party cookie; **re-prompt after 12 months**; preference center **always reachable** (footer link).
- **Categories:** `necessary` (always on, not togglable), `functional`, `analytics`. Necessary = the Supabase auth
  session (`supabaseClient.ts`) + Cloudflare Turnstile + the consent cookie itself + operational error logging.
  Functional = the 5 discovery libs. Analytics = reserved (no analytics lib gated today; category exists for when one lands).
- **Consent record:** a first-party cookie `lyvox_cookie_consent` = JSON `{ v:1, functional:boolean, analytics:boolean, ts:<epoch ms> }`.
  Absent cookie ⇒ undecided ⇒ banner shown, all non-essential treated as OFF. `ts` older than 365d ⇒ re-prompt.
- **SSR-safe:** all reads guard `typeof window`/`typeof document`. No server route needed (pure client cookie).

## 1. Pieces

### 1.1 `apps/web/src/lib/cookieConsent/inventory.ts` (the mandatory cookie audit)
- Export `type ConsentCategory = "necessary" | "functional" | "analytics"`.
- Export `const STORAGE_INVENTORY: { key: string; category: ConsentCategory; purpose: string; lib: string }[]`
  classifying every known client storage writer the audit found:
  - `sb-*` / Supabase session (`lib/supabaseClient.ts`) → `necessary`
  - Cloudflare Turnstile (security) → `necessary`
  - `lyvox_cookie_consent` (this cookie) → `necessary`
  - error logging (`lib/errorLogger.ts`) → `necessary` (operational/security, legitimate interest — NOT behavioural)
  - `lyvox:recentlyViewed` (`lib/recentlyViewed.ts`) → `functional`
  - `lyvox:taste*` (`lib/taste.ts`) → `functional`
  - recent searches (`lib/recentSearches.ts`) → `functional`
  - saved searches (`lib/savedSearches.ts`) → `functional`
  - seen adverts (`lib/seenAdverts.ts`) → `functional`
- Export `const GATED_KEYS: string[]` = the exact localStorage keys for the 5 functional libs (read each lib's KEY const).
- **Test** `__tests__/inventory.test.ts`: every functional lib's KEY appears in `GATED_KEYS`; categories are valid;
  a guard test that fails if a new top-level `localStorage.setItem` key appears in `lib/` not present in the inventory
  (grep-based or a documented manual checklist — at minimum assert the 5 known keys are covered).

### 1.2 `apps/web/src/lib/cookieConsent/store.ts` (pure, SSR-safe, framework-free)
- `type CookieConsent = { functional: boolean; analytics: boolean; ts: number }`.
- `readConsent(): CookieConsent | null` — parse the cookie; null if absent/invalid. `null` ⇒ undecided.
- `isStale(c, now?): boolean` — `now - c.ts > 365*24*3600*1000`.
- `hasConsent(category, c?): boolean` — `necessary` ⇒ always true; else read cookie (or passed `c`) and return the
  category bool; **undecided/stale ⇒ false** (deny-by-default).
- `writeConsent(prefs: {functional:boolean; analytics:boolean}, now?): void` — set the cookie (1y max-age, `SameSite=Lax`,
  `Secure` in prod, path=/), stamp `ts`; then **purge gated storage for any category now OFF** (remove `GATED_KEYS`
  for functional=false). Dispatch a `window` event `lyvox:cookie-consent-changed` so subscribers re-read.
- Tunable via small constants; fully unit-tested (undecided→deny, grant→allow, stale→deny+re-prompt, reject purges keys).

### 1.3 Gate the 5 functional libs
- In each of `recentlyViewed.ts`, `taste.ts`, `recentSearches.ts`, `savedSearches.ts`, `seenAdverts.ts`: make the
  `localStorage` **write path** (the `writeStore`/setItem) early-return when `!hasConsent("functional")`, and the
  **read path** return empty/default when `!hasConsent("functional")` (so pre-consent stale data is not accessed).
  Behaviour with consent granted is byte-identical to today. Keep the existing `typeof window` + try/catch guards.
  Import `hasConsent` from `@/lib/cookieConsent/store`. Do NOT change the public function signatures (callers untouched).
- **Test:** each lib — with no consent cookie, `addX()`/`writeStore` performs NO `localStorage.setItem` (spy asserts 0
  calls) and `getX()` returns empty; after `writeConsent({functional:true})`, persistence works as before.

### 1.4 `useCookieConsent()` hook + provider — `apps/web/src/components/cookie/CookieConsentProvider.tsx`
- Client context exposing `{ consent: CookieConsent | null, decided: boolean, open: () => void, save: (prefs) => void }`.
  Subscribes to the `lyvox:cookie-consent-changed` event + provides the "open preference center" handle for the footer link.

### 1.5 `CookieBanner.tsx` + `CookiePreferenceCenter.tsx` — `apps/web/src/components/cookie/`
- **Banner** (layer 1): shown only when `!decided` (no/invalid/stale cookie). Buttons **Accept all** and **Reject all**
  with EQUAL visual prominence (same variant/size), plus **Customize** opening the preference center. Short text +
  link to `/legal/cookies`. No pre-ticked anything. Dismiss only via an explicit choice (no "X" that implies consent).
- **Preference center** (modal/sheet): three rows — Necessary (toggle disabled/always-on), Functional (off by default),
  Analytics (off by default) — Save + "Reject all" + "Accept all". Reopenable any time via the footer link.
- Mount `<CookieConsentProvider>` wrapping the tree + `<CookieBanner />` in `apps/web/src/app/layout.tsx` (near `<Toaster/>`).
- **Test** (jsdom/RTL): fresh visitor → banner visible with Reject-all present and equal-prominence (assert both buttons
  same variant); clicking Reject all writes consent with functional=false and hides the banner; no pre-checked toggle.

### 1.6 Cookie Policy page — `apps/web/src/app/legal/cookies/page.tsx`
- Renders the `STORAGE_INVENTORY` grouped by category as a table (name, purpose, category) + a paragraph on how to
  change preferences (button that opens the preference center). This is FACTUAL (the cookie inventory), not counsel-prose,
  so it ships now. Include a small "draft — pending final legal review" note (reuse a simple inline notice; the full
  `LegalDraftBanner` + entity config land in slice 1b). i18n the chrome via the UI catalog; the inventory rows are data.

### 1.7 Footer + i18n
- `legal-footer.tsx`: add to the Legal column a link to `/legal/cookies` (`common.cookies`) and a button
  **"Cookie settings"** (`common.cookie_settings`) that calls the provider's `open()`. (Keep existing terms/privacy links.)
- Add UI catalog keys ×5 (en/ru/nl/fr/de): `common.cookies`, `common.cookie_settings`, and the banner/preference-center
  strings under a `cookie.*` namespace (banner title/body, accept_all, reject_all, customize, necessary/functional/analytics
  labels+descriptions, save, learn_more). The i18n parity guard test must pass.

## 2. Task breakdown (dependency order, TDD)
- **T1** `inventory.ts` (+ `GATED_KEYS`) + test (classification completeness, 5 functional keys covered).
- **T2** `store.ts` (read/write/hasConsent/isStale/purge + event) + unit tests (deny-by-default, grant, stale, reject-purges).
- **T3** gate the 5 functional libs through `hasConsent("functional")` (read+write) + per-lib tests (no setItem pre-consent).
- **T4** `CookieConsentProvider` + `CookieBanner` + `CookiePreferenceCenter` + mount in layout + `cookie.*` i18n ×5 + RTL tests
  (reject-all present & equal-prominence, no pre-tick, save persists).
- **T5** `/legal/cookies` page (renders inventory) + footer links ("Cookies" + "Cookie settings") + `common.*` i18n ×5.
- **T6** whole-slice opus review + clean build + deploy + prod-verify (banner shows reject-all on layer 1; rejecting leaves
  functional localStorage empty in DevTools; accepting persists; `/legal/cookies` renders; footer "Cookie settings" reopens
  the center; i18n parity green).

## 3. Out of scope (follow-ups)
- **Slice 1b** — Privacy Policy + Terms + Imprint legal PROSE ×5 locales, `lib/legal/entity.ts` activation config
  (legalName/address/KBO/VAT placeholders + interim-controller name/address — founder input, activation-ready),
  `LegalDraftBanner` + `LEGAL_CONTENT_APPROVED` flag, `lib/legal/processing.ts` (privacy-policy ⇒ ROPA single source).
- **Slice 2** — GDPR erasure / account deletion (FK migrations + two-stage erasure orchestrator).
- DSA notice-and-action page = other A0 (moderation) slice; T&C will reference it.
