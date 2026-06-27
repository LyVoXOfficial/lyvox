# Business Cabinet (/pro) + Pro-Subscription Seam — Build Note

**Status:** Build-ready slice. Company-free; ACTIVE. The LAST company-free A0 slice. Builds the
business seller's cabinet on `/pro` and a flag-gated pro-subscription CTA seam.

## 0. Scope / decisions
- **In scope (this slice):** (A) `/pro` routes signed-in phone-verified users who **already own an active
  business** to a **Business Cabinet** instead of the onboarding wizard (closes the deferred item);
  (B) the cabinet shows the business summary + verification status/badges + the business's listings +
  the team-member list (read); (C) **edit trader fields** via `PATCH /api/business/[id]` (owner);
  (D) a **"Upgrade to Pro" CTA** rendered ONLY when the `pro_subscriptions` capability flag is ON
  (built in the foundation; OFF now → the CTA is hidden — Decision 3 activation-ready).
- **Deferred (clearly out of scope — follow-ups):** full team invite/role management (POST members +
  invite-by-email lookup); the Stripe `mode:"subscription"` checkout + webhook + entitlement wiring
  (needs the founder's plan shape + pricing, §10.1) — only the CTA SEAM is built now, flag-gated.
- **Pricing/plan shape is a founder decision (§10.1)** — not invented here; the subscription rail is a
  follow-up the founder activates by setting the plan + flipping `CAPABILITY_PRO_SUBSCRIPTIONS`.

## 1. Pieces

### 1.1 `PATCH /api/business/[id]` — owner edits trader fields
- File: extend `apps/web/src/app/api/business/[id]/route.ts` with a `PATCH` export (the GET already exists).
- Auth: `supabaseServer().auth.getUser()`; require `is_business_member(id,'owner')` (owners edit the
  business) → else 403 `FORBIDDEN`; 404 `BUSINESS_NOT_FOUND` if missing.
- Body (zod, all optional — a partial update): `trade_name?, legal_form?, address_line?, postcode?, city?,
  country?, email?, phone_e164?, withdrawal_terms?, returns_url?`. Do NOT allow editing `legal_name`,
  `kbo_number`, `vat_number`, `vat_liable`, `status`, `entity_verified`, `created_by` here (identity +
  verification-affecting fields are locked; changing VAT would require re-verification — out of scope).
  Reuse the Belgian postcode regex; reuse `createBusinessSchema`-style field bounds.
- Update via the cookie client (RLS `biz_owner_write` allows owner). Return `createSuccessResponse({ ok:true })`.
- **TDD** in the route test: non-owner → 403; owner → 200 + the update applies; an attempt to set a locked
  field (e.g. `kbo_number`) is ignored/stripped by the schema (assert it's not in the update).

### 1.2 Cabinet route + view — `apps/web/src/app/pro/page.tsx` + `apps/web/src/app/pro/BusinessCabinet.tsx`
- In `pro/page.tsx` (server), after the existing auth/verify gate: load the user's active business
  (`businesses` where `created_by = user.id AND status='active'`, via the cookie client + `is_business_member`
  for membership; the page is for the owner so cookie-client RLS is fine). If a business exists → render
  `<BusinessCabinet business={…} listings={…} members={…} flags={{ proSubscriptions: isCapabilityEnabled('pro_subscriptions') }} />`. Else → render the existing `<ProOnboardingWizard>` (unchanged).
- `BusinessCabinet.tsx` (can be a server component with a small client edit child): shows
  - Business header (legal/trade name, "Business seller" chip, verification status: Verified Business /
    pending / VAT-registered badges — reuse `deriveSellerBadges` + `TraderPanel` summary).
  - Verification state line (entity_verified ? "Verified" : "Verification pending / action needed").
  - The business's **listings** (reuse `ProfileAdvertsList` or a simple list of the business's adverts —
    `adverts` where `business_id = business.id`).
  - The **team** member list (from `business_members` joined to profiles display_name; owner sees the list).
  - An **Edit** affordance opening the edit form (§1.3).
  - The flag-gated **"Upgrade to Pro"** CTA: `{flags.proSubscriptions && <UpgradeProCta/>}` (hidden now).
- i18n: `pro.cabinet.*` keys in all 5 locales (guard passes).

### 1.3 Edit form — `apps/web/src/app/pro/BusinessEditForm.tsx` (client)
- A small `"use client"` form (plain useState, shadcn, apiFetch, sonner, `tr`) that PATCHes the editable
  trader fields to `/api/business/[id]`; on success toast + refresh. Light client validation (postcode).
- i18n `pro.cabinet.edit.*` ×5.

## 2. Task breakdown (dependency order, TDD)
- **T1** `PATCH /api/business/[id]` (owner-only, partial trader-field update, locked-field stripping) + route tests.
- **T2** `pro/page.tsx` cabinet routing (active-business → cabinet, else wizard) + `BusinessCabinet.tsx`
  (summary + verification + listings + team list + flag-gated Pro CTA) + `pro.cabinet.*` i18n ×5.
- **T3** `BusinessEditForm.tsx` (client) wired to PATCH + `pro.cabinet.edit.*` i18n ×5.
- **T4** final review + deploy + prod verify (an owner with an active business sees the cabinet, not the wizard;
  edit persists; the Pro CTA is hidden with the flag OFF; a user with no business still gets the wizard).

## 3. Follow-ups (post-slice)
- Pro-subscription Stripe `mode:"subscription"` checkout + webhook + entitlement (founder plan/pricing first).
- Full team management: POST `/api/business/[id]/members` (invite-by-email → service-role user lookup),
  role changes, removal; the anti-escalation RLS is already in place (`bm_*` policies).
- Storefront/banner, bulk CSV listing import, pro analytics (Phase A1 growth).
