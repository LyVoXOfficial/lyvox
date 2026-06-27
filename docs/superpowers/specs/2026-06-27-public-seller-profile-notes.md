# Public Seller Profile Card — Build Note

**Status:** Build-ready slice. Company-free; ACTIVE. Enhances the EXISTING `/user/[id]` page into the
§8 trust card. We do NOT build the design's ideal `/seller/[handle]` opaque-slug route here (that's a
URL/SEO refinement needing a slug column + redirects) — **defer the slug rename as a follow-up**; keep
`/user/[id]`.

## 0. Decisions / invariants (read first)
- **Two privacy regimes (the crux):**
  - **физ (private seller):** keep the existing Phase-2c identity gate — `canSeeIdentity = viewerVerified || isOwnProfile`; the display name/avatar are redacted at the SERVER boundary for unverified viewers (already done — do NOT regress; [[rsc-prop-privacy]] — never pass a hidden private value as a client-component prop).
  - **юр (business seller):** the business **legal name + the DSA trader panel are PUBLIC** (Art. 30(7) requires it on the listing/profile interface) — they are NOT behind the identity gate. So a business profile shows the legal/trade name and the trader panel to EVERYONE (incl. anon/unverified). The физ gate must not hide a business's legal info.
- **Phase-A badge set only** (§8.4): Phone-verified, Email-verified, **Verified Business** (entity_verified), **VAT-registered** (vat_number && entity_verified), **Established Seller** (created_at ≥ 12 months AND ≥1 active listing). ID-verified is LATER (itsme/eID, flagged). Performance/rating badges (Top Seller, Highly Rated, Fast Replier) and the aggregate rating are **Phase B** — render NOTHING for them now (no rating data exists).
- **Profile→business link (Phase A):** a business profile is found via `businesses` where `created_by = profile.id AND status='active'` — readable by anon because RLS `biz_public_read` allows `status='active'` rows. (business_members is owner/member-RLS-locked, so don't use it for the public link.) One active business per person is the Phase-A assumption.

## 1. Pieces

### 1.1 `apps/web/src/lib/profile/sellerBadges.ts` (pure, unit-tested)
```ts
export type SellerBadge = "verified_business" | "vat_registered" | "id_verified"
  | "phone_verified" | "email_verified" | "established_seller";
export function deriveSellerBadges(input: {
  sellerType: "individual" | "business";
  verifiedEmail: boolean; verifiedPhone: boolean; idVerified: boolean;
  entityVerified: boolean; hasVat: boolean;
  createdAt: string | null; activeListings: number;
  now?: Date;
}): SellerBadge[]
```
- Compute the earned set, then order by §8.4 precedence and **cap at 3**:
  precedence (1) id_verified / verified_business · (2) vat_registered (юр) / phone_verified (физ) · (3) best of {established_seller, …performance later}.
- `established_seller` = `createdAt` ≥ 12 months before `now` AND `activeListings ≥ 1`.
- Tests: business verified+vat → [verified_business, vat_registered, …]; private phone-verified+old+listings → [phone_verified, established_seller, …]; cap-at-3; established threshold boundary (11mo vs 13mo).

### 1.2 Extract the DSA trader panel into a shared component — `apps/web/src/components/business/TraderPanel.tsx`
- Move the trader-info panel JSX currently inline in `apps/web/src/app/ad/[id]/page.tsx` (built in the business slice) into a reusable server-safe component `TraderPanel({ business })` taking the §8.3 public business subset (legal_name, trade_name, legal_form, address_*, kbo_number, vat_number, email, phone_e164, withdrawal_terms, self_certified_at, entity_verified) + the badges. Reuse the existing `pro.panel.*` i18n keys.
- Update `ad/[id]/page.tsx` to render `<TraderPanel business={…} />` (behavior-preserving refactor — the ad page output for business adverts must be unchanged).

### 1.3 Enhance `apps/web/src/app/user/[id]/page.tsx`
- In `loadPublicProfileData` (or alongside it): also select `seller_type` from profiles; load `itsme_verified` (for the future ID badge — currently flagged, so id_verified will be false unless itsme_verified). If `seller_type === 'business'`, load the active business via `from('businesses').select(<public subset>).eq('created_by', userId).eq('status','active').maybeSingle()`.
- Compute badges via `deriveSellerBadges(...)` with `activeListings = active_adverts.length` (or the real count).
- Render:
  - A **seller-type chip**: "Private seller" (neutral) for физ, "Business seller" (branded, `lyvox-trust-gradient`) for юр.
  - The **badge row** from `deriveSellerBadges` (replace/augment the current ad-hoc email/phone/trusted badges; keep it ≤3, use the trust gradient for identity/business badges, neutral for established).
  - For юр with a loaded business: render `<TraderPanel business={…} />` **OUTSIDE the identity gate** (public), and show the business legal/trade name as the header name (public — not gated).
  - For физ: keep the existing identity gate + `SellerIdentityGate` for unverified viewers exactly as today.
- i18n: add the seller-type chip + any new badge labels to ALL 5 locales (reuse existing `profile.*`/`trust.*`/`pro.panel.*` where present; the i18n guard must pass).
- Preserve listings + the reviews try/catch (Phase B) untouched. No rating signal added.

## 2. Task breakdown (dependency order, TDD)
- **T1** `sellerBadges.ts` + unit tests (the badge precedence + established threshold are the testable logic).
- **T2** Extract `TraderPanel.tsx` shared component + refactor `ad/[id]/page.tsx` to use it (behavior-preserving; verify the ad page still builds + renders the panel for business adverts).
- **T3** Enhance `/user/[id]`: seller_type + business load + chip + badges + public TraderPanel (юр) + business name as public header (юр) + preserve физ gate; i18n ×5.
- **T4** final review + deploy + prod verify (физ profile still gates name for anon; a business profile shows trader panel + Verified Business badge publicly).

## 3. Open / follow-ups
- `/seller/[handle]` opaque-slug route (privacy: stop exposing the user UUID in the URL) — deferred.
- Performance/rating badges + aggregate rating + the reviews system — Phase B (§8.5).
- ID-verified badge activates with itsme/eID (Phase B / Branch A Stripe Identity).
