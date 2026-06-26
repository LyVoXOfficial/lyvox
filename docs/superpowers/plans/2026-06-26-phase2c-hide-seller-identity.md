# Phase 2c — Hide Seller Identity From Unverified Viewers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the listing page, show the seller's identity (profile card + name) **only to phone-verified viewers** (and to the listing owner); everyone else sees a "verify your phone to see the seller & contact them" card that opens the existing Trust Gate. The listing itself (photos/title/price/description) stays fully public.

**Architecture:** The ad page is a server component. Reuse `isViewerVerified` (Phase 2b) to compute `viewerVerified` for the current viewer once, server-side, then gate the three places seller identity leaks: the `SellerCard` (replace with a client `SellerIdentityGate` card when not allowed), the `AdvertContactPanel` seller name (pass `viewerVerified`; show a generic label otherwise — the Message button already routes through the gate), and the JSON-LD `seller.name` (always generic, so crawlers can't scrape names). The gate card calls `requireTrust("verified", () => window.location.reload())` so a successful verification re-renders the page with identity unlocked.

**Tech Stack:** Next.js 16 (App Router, server components), React 19, Supabase (`isViewerVerified` server helper), the Phase-2b `TrustGateProvider`/`useTrustGate`, Tailwind v4, Vitest (jsdom), custom `useI18n()`.

## Global Constraints

- **Next.js pinned at `16.0.11`** — never downgrade. See `memory/deploy-pipeline.md`.
- **"Verified" = `isViewerVerified(supabase, userId)`** from `@/lib/auth/requireVerified` (Phase 2b): `phones.verified === true` OR `profiles.verified_phone === true`, fail-closed. Reuse it — do NOT reimplement.
- **Allowed to see seller identity = the viewer is verified OR is the listing owner** (`currentUserId === data.seller.id`). Everyone else (anonymous, signed-in-unverified) is gated.
- **Browse stays open:** photos, title, price, description, location remain public. Only the *seller's identity/profile* and the contact affordance are gated (contact is already gated server-side in Phase 2b).
- **The gate is friendly UX over real enforcement:** contact/publish are already server-enforced (Phase 2b). Hiding identity is presentation-only; it MUST NOT be the security boundary.
- **API envelope:** `createSuccessResponse(data)` → `{ ok:true, data }`; clients read `body.data.*` (see `memory/api-envelope.md`).
- **Every user-facing string localized in all 5 locales** (`apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`); `node scripts/check-i18n-keys.js` MUST pass.
- **Clean-build / no-dirty-tree discipline** (`memory/deploy-pipeline.md` Gotcha #2): after EVERY task `git status` must be clean (commit all files you changed, incl. any edited to keep `tsc` green). Before the final push verify with `rm -rf apps/web/.next && pnpm build`. Local cached builds / dirty trees mask errors.
- **Tests:** Vitest jsdom. `i18n`/`tsc`/`pnpm build` gates per task as noted.
- **Commits** end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; never stage `.claude/` or `.env*`.

**Reference facts (verbatim from recon):**
- `apps/web/src/app/ad/[id]/page.tsx`: server component. Line ~313: `const [resolvedUserId, i18n] = await Promise.all([loadCurrentUserId(), getI18nProps()]); currentUserId = resolvedUserId; locale = i18n.locale; messages = i18n.messages; data = await loadAdvertData(id, currentUserId);`. `loadCurrentUserId()` is at line ~1072 (returns the viewer's user id via `supabaseServer().auth.getUser()`). `data.seller` is `SellerInfo { id, displayName, verifiedEmail, verifiedPhone, trustScore, createdAt, activeAdverts }`. `const sellerName = data.seller.displayName ?? sellerCardLabels.unknownSellerLabel` (~line 561). `<SellerCard seller={data.seller} locale={locale} {...sellerCardLabels} />` (~line 675). `<AdvertContactPanel advert={favoriteAdvert} seller={data.seller} currentUserId={currentUserId} … sellerName={sellerName} />` (~lines 962-972). JSON-LD `seller: { "@type":"Organization", "@id": …, name: data.seller.displayName ?? "LyVoX seller" }` (lines 524-528).
- `apps/web/src/components/SellerCard.tsx`: default export, renders `seller.displayName`, member-since, email/phone verified status, trust score, active-adverts count — i.e. the seller's profile/identity.
- `apps/web/src/components/AdvertContactPanel.tsx`: `"use client"`; renders `{sellerName}` (~line 176) in the seller info card; the Message button already calls `requireTrust("verified", () => void startChat())` (Phase 2b).
- `useTrustGate()` from `@/components/trust/TrustGateProvider` → `{ requireTrust(level: "auth"|"verified", run: () => void) }` (Phase 2b), mounted at root.

---

### Task 1: `SellerIdentityGate` client card (+ i18n)

**Files:**
- Create: `apps/web/src/components/trust/SellerIdentityGate.tsx`
- Modify: `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`

**Interfaces:**
- Consumes: `useTrustGate` (Phase 2b). Produces: `<SellerIdentityGate />` — a card that mirrors the visual frame of the seller card and shows a "verify your phone to see the seller and contact them" message + a button that calls `requireTrust("verified", () => window.location.reload())` (so a completed verification re-renders the server page with identity unlocked).

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/trust/SellerIdentityGate.tsx
"use client";

import { ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useTrustGate } from "@/components/trust/TrustGateProvider";

export default function SellerIdentityGate() {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };
  const { requireTrust } = useTrustGate();

  const unlock = () => requireTrust("verified", () => window.location.reload());

  return (
    <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-medium">{tr("seller_gate.title", "Verify to see the seller")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("seller_gate.body", "Confirm your phone number to view the seller's profile and contact them. It keeps the marketplace safe for everyone.")}
          </p>
          <Button type="button" onClick={unlock} className="mt-3">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {tr("seller_gate.cta", "Verify my phone")}
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add the `seller_gate` i18n keys to all 5 locales**

- en: `"seller_gate": { "title": "Verify to see the seller", "body": "Confirm your phone number to view the seller's profile and contact them. It keeps the marketplace safe for everyone.", "cta": "Verify my phone", "name_hidden": "Verified users only" }`
- ru: `"Подтвердите, чтобы увидеть продавца"`, `"Подтвердите номер телефона, чтобы видеть профиль продавца и связаться с ним. Это защищает площадку для всех."`, `"Подтвердить телефон"`, `"Только для подтверждённых"`
- nl: `"Verifieer om de verkoper te zien"`, `"Bevestig je telefoonnummer om het profiel van de verkoper te zien en contact op te nemen. Zo blijft de marktplaats veilig."`, `"Telefoon verifiëren"`, `"Alleen geverifieerde gebruikers"`
- fr: `"Vérifiez pour voir le vendeur"`, `"Confirmez votre numéro pour voir le profil du vendeur et le contacter. Cela protège la place de marché."`, `"Vérifier mon téléphone"`, `"Utilisateurs vérifiés uniquement"`
- de: `"Bestätigen, um den Verkäufer zu sehen"`, `"Bestätigen Sie Ihre Telefonnummer, um das Verkäuferprofil zu sehen und Kontakt aufzunehmen. Das schützt den Marktplatz."`, `"Telefon bestätigen"`, `"Nur verifizierte Nutzer"`

(`name_hidden` is used by Task 3 for the contact panel's generic seller label.)

- [ ] **Step 3: Verify i18n + types**

Run: `node scripts/check-i18n-keys.js` → PASS
Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/trust/SellerIdentityGate.tsx apps/web/src/i18n/locales
git commit -m "feat(trust): SellerIdentityGate card (verify to see seller)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Compute `viewerVerified` on the ad page + gate the SellerCard

**Files:**
- Modify: `apps/web/src/app/ad/[id]/page.tsx`

**Interfaces:**
- Consumes: `isViewerVerified` (Phase 2b), `SellerIdentityGate` (Task 1). Produces: a server-computed `viewerVerified: boolean` + `canSeeSeller = viewerVerified || isOwnListing`; the `SellerCard` render becomes `canSeeSeller ? <SellerCard/> : <SellerIdentityGate/>`.

This is server wiring — verified by `tsc` + clean `build` + the live check (Task 4).

- [ ] **Step 1: Add imports + a `loadViewerVerified` helper**

At the top of `apps/web/src/app/ad/[id]/page.tsx` add:
```typescript
import { isViewerVerified } from "@/lib/auth/requireVerified";
import SellerIdentityGate from "@/components/trust/SellerIdentityGate";
```
Add a helper next to `loadCurrentUserId` (around line 1072):
```typescript
async function loadViewerVerified(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const supabase = await supabaseServer();
    return await isViewerVerified(supabase, userId);
  } catch (error) {
    console.warn("Failed to resolve viewer verification", error);
    return false; // fail-closed: hide identity if we can't confirm
  }
}
```

- [ ] **Step 2: Compute `viewerVerified` + `canSeeSeller` in the page body**

After `currentUserId = resolvedUserId;` and after `data = await loadAdvertData(id, currentUserId);` succeeds (where `data.seller` is available), add:
```typescript
const viewerVerified = await loadViewerVerified(currentUserId);
const isOwnListing = !!currentUserId && currentUserId === data.seller.id;
const canSeeSeller = viewerVerified || isOwnListing;
```
(Place this where both `currentUserId` and `data` are in scope, before the JSX return.)

- [ ] **Step 3: Gate the SellerCard render**

Replace the `<SellerCard seller={data.seller} locale={locale} {...sellerCardLabels} />` (line ~675) with:
```tsx
{canSeeSeller ? (
  <SellerCard seller={data.seller} locale={locale} {...sellerCardLabels} />
) : (
  <SellerIdentityGate />
)}
```

- [ ] **Step 4: Verify types + clean build**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0
Run: `rm -rf apps/web/.next && pnpm build` → exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/ad/[id]/page.tsx
git commit -m "feat(trust): gate the seller profile card behind viewer verification

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Hide the seller name in the contact panel + JSON-LD

**Files:**
- Modify: `apps/web/src/app/ad/[id]/page.tsx`
- Modify: `apps/web/src/components/AdvertContactPanel.tsx`

**Interfaces:**
- Consumes: `canSeeSeller` (Task 2), `seller_gate.name_hidden` i18n (Task 1). Produces: `AdvertContactPanel` gains a `canSeeSeller: boolean` prop; renders the real `sellerName` only when `canSeeSeller`, else a generic label. JSON-LD `seller.name` is always generic.

- [ ] **Step 1: JSON-LD — always use a generic seller name**

In `apps/web/src/app/ad/[id]/page.tsx` (lines 524-528), change `name: data.seller.displayName ?? "LyVoX seller"` to:
```typescript
      name: "LyVoX seller",
```
(So crawlers / anonymous HTML never carry the seller's display name. The `@id` URL `/user/{id}` is an opaque id, not a name — leave it.)

- [ ] **Step 2: Pass `canSeeSeller` to AdvertContactPanel**

In the `<AdvertContactPanel … />` render (lines ~962-972), add the prop:
```tsx
  canSeeSeller={canSeeSeller}
```

- [ ] **Step 3: Gate the seller name in AdvertContactPanel**

In `apps/web/src/components/AdvertContactPanel.tsx`:
- Add `canSeeSeller: boolean` to `AdvertContactPanelProps`.
- Destructure `canSeeSeller` in the component params.
- Add the `tr` lookup for the hidden label (the component already has a `tr` helper). Where it renders `{sellerName}` (~line 176), change to:
```tsx
{canSeeSeller ? sellerName : tr("seller_gate.name_hidden", "Verified users only")}
```
- (Leave the verification badges/email/phone status as-is — they describe the SELLER's verification, not the viewer's, and don't reveal identity. The Message button already routes through `requireTrust("verified", …)`, so contact stays gated.)

- [ ] **Step 4: Verify types + clean build**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0
Run: `rm -rf apps/web/.next && pnpm build` → exit 0

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/ad/[id]/page.tsx apps/web/src/components/AdvertContactPanel.tsx
git commit -m "feat(trust): hide seller name from unverified viewers (contact panel + JSON-LD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Full verification + deploy + live check

**Files:** none (verification + release).

- [ ] **Step 1: Clean full gate**

```bash
git status   # MUST be clean
node scripts/check-i18n-keys.js
npx tsc -p apps/web/tsconfig.json --noEmit
rm -rf apps/web/.next && pnpm build
pnpm test
```
Expected: clean tree, i18n PASS, tsc 0, clean build exit 0, all tests green.

- [ ] **Step 2: Push + deploy + wait Ready** (`git push origin main`; `vercel ls lyvox-frontend` until `Ready`, not `● Error`).

- [ ] **Step 3: Live verification on www.lyvox.be**

```bash
# An anonymous viewer of a listing must NOT receive the seller's display name in the HTML
# (replace <ID> with a real active advert id from /api/search):
ID=$(curl -s 'https://www.lyvox.be/api/search?limit=1' | python -c "import sys,json;print(json.load(sys.stdin)['data']['items'][0]['id'])")
curl -s "https://www.lyvox.be/ad/$ID" | grep -c "LyVoX seller"     # JSON-LD generic present
curl -s "https://www.lyvox.be/ad/$ID" | grep -o 'seller_gate\|Verify to see the seller\|Только для подтверждённых' | head
# The listing itself still renders for anonymous (browse open):
curl -s -o /dev/null -w "%{http_code}\n" "https://www.lyvox.be/ad/$ID"
```
Expected: the listing page returns `200` for anonymous; the JSON-LD seller name is the generic `"LyVoX seller"`; the page shows the seller-gate card (not the seller's real display name) for an anonymous viewer. Then in a browser: as an anonymous/unverified user, the seller profile card is replaced by "Verify to see the seller" and clicking it opens the Trust Gate; as a **verified** user, the real seller card + name appear.

- [ ] **Step 4: ⚠️ REMIND THE USER — the verified-tier SMS E2E test (deferred from Phase 2b) is still owed.** Before calling the verified-only model fully done, the user must complete the real end-to-end OTP test on prod (sign in unverified → Message seller / Verify to see seller → enter phone → confirm an SMS actually arrives → enter code → seller/chat unlocks). Surface this explicitly.

---

## Self-Review

**1. Spec coverage (Phase 2c = spec Section F's "hide seller identity from unverified viewers"):**
- Compute viewer-verified server-side (reuse `isViewerVerified`) → Task 2. ✅
- Gate the seller profile card (`SellerCard` → `SellerIdentityGate` that opens the Trust Gate) → Tasks 1, 2. ✅
- Hide the seller name in the contact panel + JSON-LD → Task 3. ✅
- Owner still sees their own seller card (`isOwnListing`) → Task 2. ✅
- Browse/listing stays public; contact already server-gated (Phase 2b) → unchanged. ✅
- Out of scope (correctly): the verified-tier SMS E2E test belongs to Phase 2b's verification and is surfaced as a reminder in Task 4.

**2. Placeholder scan:** No "TBD"/vague steps. Tasks 2/3 say "around line N / where X is in scope" because they edit a large existing server file whose exact surrounding lines the implementer must match; the change itself is fully specified with the exact before/after.

**3. Type consistency:** `viewerVerified`/`canSeeSeller`/`isOwnListing` defined in Task 2, consumed in Tasks 2/3. `isViewerVerified` reused (Phase 2b). `SellerIdentityGate` consistent (Tasks 1, 2). `canSeeSeller` prop on `AdvertContactPanel` consistent (Task 3). `seller_gate.*` i18n keys consistent (Tasks 1, 3).
