# i18n Completeness & Recurrence Guard — Remediation Record

**Date:** 2026-06-26 · **Branch:** `i18n-completeness` (off `main`)
**Origin:** the [visual UI/UX review](../reviews/2026-06-26-visual-ux-review.md) surfaced English text
leaking onto non-English pages. A full static scan revealed the leak was far larger than the visible
surfaces.

## Goal
Every user-facing string referenced via `t/tr/tf/translate("key", …)` resolves to a real, localized
value in all 5 locales (en/ru/nl/fr/de), and a test prevents the class of bug from recurring.

## What was found (verified against source)
- **Catalog never wired up:** `catalog-{en,ru,nl,fr,de}.json` (≈233 keys/locale of listing-form field
  labels) existed with full translations but were **imported nowhere** (`server.ts`/`index.tsx` never
  loaded them). Per `CATALOG_I18N_README.md`, integration was an open TODO. → listing-form fields
  rendered raw dotted keys.
- **91 keys missing** from the loaded messages, referenced but never added: `admin.moderation.*` (24),
  `advert.trust.*`+`seller_checks_pending` (14), `billing.*` (15), `chat.*` (21), `comparison.*` (3),
  `profile.*` (5), `search.*` (5), `post.*` (2), `common.*` (2).
- **Mixed failure modes:** components with a local `(key, fallback)` wrapper (chat, billing, ad-card,
  ad-detail trust block, post `tf`) showed the **English fallback**; bare `t(key)` from `useI18n()`
  (admin moderation queue, catalog fields) showed the **raw dotted key**.
- **8 hardcoded English literals** with no `t()` at all: `post/page.tsx` (7), `category-list.tsx` (1,
  plus a second empty-state literal found while wrapping).

## Approach (isolated, test-gated)
1. **Catalog integration (Option 1):** deep-merge `catalog-*.json` into the main locale files
   (existing values win on the single collision `catalog.common.select_placeholder`), then delete the
   redundant `catalog-*.json` + README. One source of truth per locale → trivial parity guard.
   `scripts`: `.uxreview/merge-catalog.mjs`. Result: 1025 → 1258 keys/locale, parity preserved.
2. **Fill the 91 + author 7 new `post.*` + 1 `category.no_categories`:** canonical English extracted
   from existing fallbacks (`.uxreview/extract-en.mjs`); ru native, nl/fr/de drafted (3 parallel
   translator agents, validated for completeness + placeholder parity by
   `.uxreview/validate-merge.mjs`); inserted nested into all 5 locales
   (`.uxreview/insert-keys.mjs`). Result: 1258 → 1357 keys/locale, parity preserved.
3. **Wrap the literals:** `post/page.tsx` (7 via inline `tf`), `category-list.tsx` (2 — reused
   `footer.browse_listings`, added `category.no_categories`).
4. **Recurrence guard:** `apps/web/src/i18n/__tests__/i18n-completeness.test.ts` — (a) every
   `t/tr/tf/translate("dotted.key")` literal in source exists in en.json; (b) ru/nl/fr/de key sets
   match en exactly. Matcher includes bare `t(` (the earlier blind spot) and hyphenated keys.
   **Scope (honest):** this guards the *missing-key* and *locale-drift* failure modes — the systemic
   cause here (91 keys + ~200 unwired catalog keys). It deliberately does **not** detect newly-added
   *hardcoded* English JSX literals: a reliable detector would flag pre-existing literals across all
   ~301 source files and could not pass green without an allowlist (which rots). Mitigation for that
   narrower mode: code review, plus the fact that a hardcoded literal degrades to readable English
   while a missing key can render a raw dotted key (the worse mode the guard *does* catch).
   Known blind spot: dynamically-built keys (`` t(`a.${x}`) ``) aren't statically verifiable.

## Verification
- Referenced-but-missing keys: **0** (was 282 before catalog merge / 91 after).
- Locale parity: **true**, 1357 keys × 5.
- `vitest run`: **149/149 pass** (incl. new guard + catalog-component tests).
- `tsc --noEmit -p apps/web/tsconfig.json`: **clean**.
- Prod curl verification (public surfaces): see deploy step.
- Auth-gated surfaces (chat/billing/admin/listing form) verified via the unit guard, not browser
  (cannot self-authenticate).

## Follow-ups
- **nl/fr/de of the 98 added keys are machine-drafted** — native review tracked in
  [machine-translated-pending-review](../../i18n/machine-translated-pending-review.md).
- Design-taste items from the review (header declutter, language-label truncation, gate empty-states)
  remain open — not in this change.
