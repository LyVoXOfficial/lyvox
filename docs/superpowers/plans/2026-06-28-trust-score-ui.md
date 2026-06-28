# Trust Score UI (T37 / B6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the server-side `trust_score` value into two visible surfaces on `/user/[id]` — a compact tier badge in the profile header and a verifiable-facts sidebar card — and fix the refresh API rate-limit key to be per-user.

**Architecture:** The profile page is a Server Component (`force-dynamic`). Initial score and profile flags come from the existing `loadPublicProfileData` SSR fetch (extended to also return `last_computed_at`). The sidebar card is an RSC that slots in a thin `"use client"` refresh button; on success the button calls `router.refresh()` which re-runs the RSC tree, picking up the newly upserted score from DB. No client-side score state is needed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Upstash Redis, Vitest, lucide-react.

## Global Constraints

- All user-visible strings go through `t(key)` — **never hardcode copy**. Keys must be added to all 5 locales (`en`, `fr`, `nl`, `de`, `ru`) simultaneously or the i18n parity test (`apps/web/src/i18n/__tests__/i18n-completeness.test.ts`) will fail.
- **No formula weights or tier thresholds** may appear in any user-visible text (anti-gaming, F14).
- `trust_score.components` and `trust_score.last_computed_at` columns are not yet in generated DB types (`database.types.ts`) — use an `as any` cast with eslint-disable comment until `pnpm gen:types` is run (B5).
- Rate-limit for `POST /api/trust/refresh` must be keyed by **authenticated user ID**, not IP. Uses the `getUserId` hook already on `withRateLimit`.
- Checks must stay green: `pnpm typecheck && pnpm test && pnpm lint`.
- Branch: `feat/foundations-batch-2`. Commit after each task.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| **Create** | `apps/web/src/lib/trust/trustTier.ts` | Pure score→tier mapping |
| **Create** | `apps/web/src/lib/trust/__tests__/trustTier.test.ts` | Unit tests for tier mapping |
| **Create** | `apps/web/src/components/trust/TrustScoreBadge.tsx` | Compact header pill (RSC) |
| **Create** | `apps/web/src/components/trust/TrustScoreRefreshButton.tsx` | Client refresh button |
| **Create** | `apps/web/src/components/trust/TrustScoreCard.tsx` | Sidebar facts card (RSC) |
| **Modify** | `apps/web/src/app/user/[id]/page.tsx` | Extend query, render components |
| **Modify** | `apps/web/src/app/api/trust/refresh/route.ts` | Per-user rate limit key |
| **Modify** | `apps/web/src/app/api/trust/refresh/__tests__/refresh-route.test.ts` | Document per-user intent |
| **Modify** | `apps/web/src/i18n/locales/en.json` | New `trust_score.*` section |
| **Modify** | `apps/web/src/i18n/locales/fr.json` | Same |
| **Modify** | `apps/web/src/i18n/locales/nl.json` | Same |
| **Modify** | `apps/web/src/i18n/locales/de.json` | Same |
| **Modify** | `apps/web/src/i18n/locales/ru.json` | Same |

---

### Task 1: `trustTier.ts` — pure tier derivation + tests

**Files:**
- Create: `apps/web/src/lib/trust/trustTier.ts`
- Create: `apps/web/src/lib/trust/__tests__/trustTier.test.ts`

**Interfaces:**
- Produces: `TrustTier`, `TrustTierInfo`, `deriveTrustTier(score: number): TrustTierInfo` — used by Tasks 3 and 5.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/trust/__tests__/trustTier.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { deriveTrustTier } from "../trustTier";

describe("deriveTrustTier", () => {
  it("score 0 → new", () => {
    expect(deriveTrustTier(0).tier).toBe("new");
    expect(deriveTrustTier(0).labelKey).toBe("trust_score.tier_new");
    expect(deriveTrustTier(0).colorVariant).toBe("muted");
  });

  it("score 14 → new (boundary)", () => {
    expect(deriveTrustTier(14).tier).toBe("new");
  });

  it("score 15 → rising", () => {
    expect(deriveTrustTier(15).tier).toBe("rising");
    expect(deriveTrustTier(15).labelKey).toBe("trust_score.tier_rising");
    expect(deriveTrustTier(15).colorVariant).toBe("teal-light");
  });

  it("score 34 → rising (boundary)", () => {
    expect(deriveTrustTier(34).tier).toBe("rising");
  });

  it("score 35 → trusted", () => {
    expect(deriveTrustTier(35).tier).toBe("trusted");
    expect(deriveTrustTier(35).labelKey).toBe("trust_score.tier_trusted");
    expect(deriveTrustTier(35).colorVariant).toBe("teal");
  });

  it("score 59 → trusted (boundary)", () => {
    expect(deriveTrustTier(59).tier).toBe("trusted");
  });

  it("score 60 → top", () => {
    expect(deriveTrustTier(60).tier).toBe("top");
    expect(deriveTrustTier(60).labelKey).toBe("trust_score.tier_top");
    expect(deriveTrustTier(60).colorVariant).toBe("gold");
  });

  it("score 100 → top", () => {
    expect(deriveTrustTier(100).tier).toBe("top");
  });

  it("clamps negative scores to 0 (→ new)", () => {
    expect(deriveTrustTier(-5).tier).toBe("new");
  });

  it("clamps scores above 100 to 100 (→ top)", () => {
    expect(deriveTrustTier(150).tier).toBe("top");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- --run apps/web/src/lib/trust/__tests__/trustTier.test.ts
```

Expected: `Error: Cannot find module '../trustTier'`

- [ ] **Step 3: Create `trustTier.ts`**

Create `apps/web/src/lib/trust/trustTier.ts`:

```typescript
export type TrustTier = "new" | "rising" | "trusted" | "top";

export interface TrustTierInfo {
  tier: TrustTier;
  /** i18n key — pass to t() to get the localised label */
  labelKey: string;
  colorVariant: "muted" | "teal-light" | "teal" | "gold";
}

const TIERS: { maxScore: number; tier: TrustTier; labelKey: string; colorVariant: TrustTierInfo["colorVariant"] }[] = [
  { maxScore: 14,  tier: "new",     labelKey: "trust_score.tier_new",     colorVariant: "muted" },
  { maxScore: 34,  tier: "rising",  labelKey: "trust_score.tier_rising",  colorVariant: "teal-light" },
  { maxScore: 59,  tier: "trusted", labelKey: "trust_score.tier_trusted", colorVariant: "teal" },
  { maxScore: 100, tier: "top",     labelKey: "trust_score.tier_top",     colorVariant: "gold" },
];

export function deriveTrustTier(score: number): TrustTierInfo {
  const clamped = Math.max(0, Math.min(100, score));
  const entry = TIERS.find((t) => clamped <= t.maxScore) ?? TIERS[TIERS.length - 1];
  return { tier: entry.tier, labelKey: entry.labelKey, colorVariant: entry.colorVariant };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- --run apps/web/src/lib/trust/__tests__/trustTier.test.ts
```

Expected: `10 tests passed`

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/trust/trustTier.ts apps/web/src/lib/trust/__tests__/trustTier.test.ts
git commit -m "feat(T37/B6): trustTier pure function + tests"
```

---

### Task 2: i18n — add `trust_score.*` keys to all 5 locales

**Files:**
- Modify: `apps/web/src/i18n/locales/en.json`
- Modify: `apps/web/src/i18n/locales/fr.json`
- Modify: `apps/web/src/i18n/locales/nl.json`
- Modify: `apps/web/src/i18n/locales/de.json`
- Modify: `apps/web/src/i18n/locales/ru.json`

**Interfaces:**
- Produces: `t("trust_score.tier_new")`, `t("trust_score.card_title")`, etc. — used by Tasks 3, 4, 5 and the profile page.
- The i18n parity test in `apps/web/src/i18n/__tests__/i18n-completeness.test.ts` checks that all 5 locales share exactly the same key set. **All 5 files must be edited in this task.**

- [ ] **Step 1: Add to `en.json`**

In `apps/web/src/i18n/locales/en.json`, add a new top-level `"trust_score"` object. Add it after the existing `"trust"` key:

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

- [ ] **Step 2: Add to `fr.json`**

In `apps/web/src/i18n/locales/fr.json`, add the same key set after the `"trust"` key:

```json
"trust_score": {
  "tier_new": "Nouveau vendeur",
  "tier_rising": "En progression",
  "tier_trusted": "Vendeur de confiance",
  "tier_top": "Meilleur vendeur",
  "card_title": "Confiance & Réputation",
  "score_label": "Score de confiance",
  "last_updated": "Mis à jour {date}",
  "last_updated_never": "Pas encore calculé",
  "fact_id_verified": "Identité vérifiée",
  "fact_phone_verified": "Téléphone vérifié",
  "fact_email_verified": "Email vérifié",
  "fact_deals": "Transactions complétées",
  "fact_deals_soon": "Disponible après le lancement des transactions",
  "fact_member_since": "Membre depuis",
  "fact_active_listings": "Annonces actives",
  "improve_title": "Comment améliorer votre score",
  "improve_verify_email": "Vérifiez votre adresse email",
  "improve_verify_phone": "Vérifiez votre numéro de téléphone",
  "improve_verify_itsme": "Vérifiez votre identité avec itsme",
  "improve_all_done": "Vos vérifications sont complètes",
  "refresh_cta": "Actualiser mon score",
  "refreshing": "Actualisation…",
  "refresh_success": "Score mis à jour",
  "refresh_error_rate": "Réessayez dans {min} min",
  "refresh_error": "Impossible de rafraîchir. Réessayez."
}
```

- [ ] **Step 3: Add to `nl.json`**

In `apps/web/src/i18n/locales/nl.json`:

```json
"trust_score": {
  "tier_new": "Nieuwe verkoper",
  "tier_rising": "Vertrouwen opbouwen",
  "tier_trusted": "Vertrouwde verkoper",
  "tier_top": "Topverkoper",
  "card_title": "Vertrouwen & Reputatie",
  "score_label": "Vertrouwensscore",
  "last_updated": "Bijgewerkt {date}",
  "last_updated_never": "Nog niet berekend",
  "fact_id_verified": "Identiteit geverifieerd",
  "fact_phone_verified": "Telefoon geverifieerd",
  "fact_email_verified": "E-mail geverifieerd",
  "fact_deals": "Voltooide transacties",
  "fact_deals_soon": "Beschikbaar na lancering van transacties",
  "fact_member_since": "Lid sinds",
  "fact_active_listings": "Actieve advertenties",
  "improve_title": "Hoe u uw score kunt verbeteren",
  "improve_verify_email": "Verifieer uw e-mailadres",
  "improve_verify_phone": "Verifieer uw telefoonnummer",
  "improve_verify_itsme": "Verifieer uw identiteit met itsme",
  "improve_all_done": "Uw verificaties zijn volledig",
  "refresh_cta": "Mijn score vernieuwen",
  "refreshing": "Vernieuwen…",
  "refresh_success": "Score bijgewerkt",
  "refresh_error_rate": "Probeer het over {min} min opnieuw",
  "refresh_error": "Kon niet vernieuwen. Probeer het opnieuw."
}
```

- [ ] **Step 4: Add to `de.json`**

In `apps/web/src/i18n/locales/de.json`:

```json
"trust_score": {
  "tier_new": "Neuer Verkäufer",
  "tier_rising": "Vertrauen aufbauen",
  "tier_trusted": "Vertrauenswürdiger Verkäufer",
  "tier_top": "Top-Verkäufer",
  "card_title": "Vertrauen & Reputation",
  "score_label": "Vertrauensscore",
  "last_updated": "Aktualisiert {date}",
  "last_updated_never": "Noch nicht berechnet",
  "fact_id_verified": "Identität verifiziert",
  "fact_phone_verified": "Telefon verifiziert",
  "fact_email_verified": "E-Mail verifiziert",
  "fact_deals": "Abgeschlossene Transaktionen",
  "fact_deals_soon": "Verfügbar nach Transaktionsstart",
  "fact_member_since": "Mitglied seit",
  "fact_active_listings": "Aktive Anzeigen",
  "improve_title": "So verbessern Sie Ihren Score",
  "improve_verify_email": "Bestätigen Sie Ihre E-Mail-Adresse",
  "improve_verify_phone": "Bestätigen Sie Ihre Telefonnummer",
  "improve_verify_itsme": "Bestätigen Sie Ihre Identität mit itsme",
  "improve_all_done": "Ihre Verifizierungen sind abgeschlossen",
  "refresh_cta": "Meinen Score aktualisieren",
  "refreshing": "Wird aktualisiert…",
  "refresh_success": "Score aktualisiert",
  "refresh_error_rate": "In {min} Min. erneut versuchen",
  "refresh_error": "Konnte nicht aktualisieren. Bitte erneut versuchen."
}
```

- [ ] **Step 5: Add to `ru.json`**

In `apps/web/src/i18n/locales/ru.json`:

```json
"trust_score": {
  "tier_new": "Новый продавец",
  "tier_rising": "Набирает доверие",
  "tier_trusted": "Проверенный продавец",
  "tier_top": "Топ продавец",
  "card_title": "Доверие и репутация",
  "score_label": "Рейтинг доверия",
  "last_updated": "Обновлено {date}",
  "last_updated_never": "Ещё не рассчитано",
  "fact_id_verified": "Личность подтверждена",
  "fact_phone_verified": "Телефон подтверждён",
  "fact_email_verified": "Email подтверждён",
  "fact_deals": "Завершённых сделок",
  "fact_deals_soon": "Доступно после запуска сделок",
  "fact_member_since": "Участник с",
  "fact_active_listings": "Активных объявлений",
  "improve_title": "Как улучшить ваш рейтинг",
  "improve_verify_email": "Подтвердите email",
  "improve_verify_phone": "Подтвердите номер телефона",
  "improve_verify_itsme": "Подтвердите личность через itsme",
  "improve_all_done": "Все проверки пройдены",
  "refresh_cta": "Обновить мой рейтинг",
  "refreshing": "Обновление…",
  "refresh_success": "Рейтинг обновлён",
  "refresh_error_rate": "Попробуйте через {min} мин",
  "refresh_error": "Не удалось обновить. Попробуйте ещё раз."
}
```

- [ ] **Step 6: Run the i18n parity test**

```bash
pnpm test -- --run apps/web/src/i18n/__tests__/i18n-completeness.test.ts
```

Expected: all tests pass (previously this would fail if any locale was missing the `trust_score` key set).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/i18n/locales/en.json apps/web/src/i18n/locales/fr.json apps/web/src/i18n/locales/nl.json apps/web/src/i18n/locales/de.json apps/web/src/i18n/locales/ru.json
git commit -m "feat(T37/B6): i18n trust_score.* keys — all 5 locales"
```

---

### Task 3: `TrustScoreBadge` — compact header pill (RSC)

**Files:**
- Create: `apps/web/src/components/trust/TrustScoreBadge.tsx`

**Interfaces:**
- Consumes: `deriveTrustTier` from `@/lib/trust/trustTier` (Task 1); `t("trust_score.tier_*")` keys (Task 2).
- Produces: `<TrustScoreBadge score={number} t={fn} />` — used by Task 7 (profile page header).

No dedicated unit test (pure presentational RSC; correctness verified by typecheck + visual inspection). Typecheck is the gate.

- [ ] **Step 1: Create `TrustScoreBadge.tsx`**

Create `apps/web/src/components/trust/TrustScoreBadge.tsx`:

```tsx
import React from "react";
import { ShieldCheck, TrendingUp, Star } from "lucide-react";
import { deriveTrustTier, type TrustTierInfo } from "@/lib/trust/trustTier";

interface TrustScoreBadgeProps {
  score: number;
  t: (key: string) => string;
}

function TierIcon({ colorVariant }: { colorVariant: TrustTierInfo["colorVariant"] }) {
  switch (colorVariant) {
    case "teal-light":
      return <TrendingUp className="mr-1 h-3 w-3" aria-hidden="true" />;
    case "teal":
      return <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />;
    case "gold":
      return <Star className="mr-1 h-3 w-3" aria-hidden="true" />;
    default:
      return null;
  }
}

const BASE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: "28px",
  padding: "0 12px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
};

export function TrustScoreBadge({ score, t }: TrustScoreBadgeProps) {
  const { labelKey, colorVariant } = deriveTrustTier(score);

  let style: React.CSSProperties;
  let className = "";

  switch (colorVariant) {
    case "gold":
      className = "lyvox-trust-gradient";
      style = { ...BASE_STYLE, color: "#fff", boxShadow: "0 2px 8px oklch(0.72 0.18 68 / 0.4)" };
      break;
    case "teal":
      className = "lyvox-trust-gradient";
      style = { ...BASE_STYLE, color: "#fff", boxShadow: "0 2px 8px oklch(0.55 0.12 172 / 0.3)" };
      break;
    case "teal-light":
      style = { ...BASE_STYLE, background: "oklch(0.56 0.13 178 / 0.12)", color: "var(--priD)" };
      break;
    default:
      style = { ...BASE_STYLE, background: "var(--muted)", color: "var(--muted-foreground)" };
  }

  return (
    <span className={className} style={style}>
      <TierIcon colorVariant={colorVariant} />
      {t(labelKey)}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/trust/TrustScoreBadge.tsx
git commit -m "feat(T37/B6): TrustScoreBadge header pill component"
```

---

### Task 4: `TrustScoreRefreshButton` — client refresh button

**Files:**
- Create: `apps/web/src/components/trust/TrustScoreRefreshButton.tsx`

**Interfaces:**
- Consumes: `router.refresh()` from `next/navigation`; `fetch("/api/trust/refresh", { method: "POST" })`.
- Produces: `<TrustScoreRefreshButton refreshCta={string} refreshingLabel={string} refreshSuccess={string} refreshErrorRate={string} refreshError={string} />` — used by Task 5 (TrustScoreCard).

No unit test (client component requiring JSDOM router mocks — tested manually in Task 7 via visual inspection). Typecheck is the gate.

- [ ] **Step 1: Create `TrustScoreRefreshButton.tsx`**

Create `apps/web/src/components/trust/TrustScoreRefreshButton.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

interface TrustScoreRefreshButtonProps {
  refreshCta: string;
  refreshingLabel: string;
  refreshSuccess: string;
  refreshErrorRate: string;
  refreshError: string;
}

type State = "idle" | "loading" | "success" | "error" | "rate_limited";

export function TrustScoreRefreshButton({
  refreshCta,
  refreshingLabel,
  refreshSuccess,
  refreshErrorRate,
  refreshError,
}: TrustScoreRefreshButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [retryAfterMin, setRetryAfterMin] = useState<number | null>(null);

  async function handleRefresh() {
    if (state === "loading") return;
    setState("loading");
    setRetryAfterMin(null);

    try {
      const res = await fetch("/api/trust/refresh", { method: "POST" });

      if (res.ok) {
        router.refresh();
        setState("success");
        setTimeout(() => setState("idle"), 2000);
      } else if (res.status === 429) {
        const retryAfterSec = parseInt(res.headers.get("Retry-After") ?? "3600", 10);
        setRetryAfterMin(Math.ceil(retryAfterSec / 60));
        setState("rate_limited");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 14px",
    borderRadius: "var(--r)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: state === "loading" ? "not-allowed" : "pointer",
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--priD)",
    opacity: state === "loading" ? 0.7 : 1,
    width: "100%",
    justifyContent: "center",
  };

  return (
    <div style={{ marginTop: "12px" }}>
      <button
        onClick={handleRefresh}
        disabled={state === "loading"}
        style={buttonStyle}
        type="button"
      >
        {state === "loading" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {refreshingLabel}
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {refreshCta}
          </>
        )}
      </button>

      {state === "success" && (
        <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--priD)", fontWeight: 500, textAlign: "center" }}>
          {refreshSuccess}
        </p>
      )}
      {state === "rate_limited" && retryAfterMin !== null && (
        <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--muted-foreground)", textAlign: "center" }}>
          {refreshErrorRate.replace("{min}", String(retryAfterMin))}
        </p>
      )}
      {state === "error" && (
        <p style={{ marginTop: "6px", fontSize: "12px", color: "oklch(0.55 0.18 25)", textAlign: "center" }}>
          {refreshError}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/trust/TrustScoreRefreshButton.tsx
git commit -m "feat(T37/B6): TrustScoreRefreshButton client component"
```

---

### Task 5: `TrustScoreCard` — sidebar facts card (RSC)

**Files:**
- Create: `apps/web/src/components/trust/TrustScoreCard.tsx`

**Interfaces:**
- Consumes: `deriveTrustTier` (Task 1), `TrustScoreRefreshButton` (Task 4), `formatDate` from `@/i18n/format`, `t("trust_score.*")` keys (Task 2).
- Produces:

```tsx
<TrustScoreCard
  score={number}
  lastComputedAt={string | null}
  verifiedEmail={boolean}
  verifiedPhone={boolean}
  itsmeVerified={boolean}
  createdAt={string | null}
  activeListingsCount={number}
  isOwnProfile={boolean}
  locale={string}
  t={(key: string) => string}
/>
```

Used by Task 7 (profile page sidebar).

- [ ] **Step 1: Create `TrustScoreCard.tsx`**

Create `apps/web/src/components/trust/TrustScoreCard.tsx`:

```tsx
import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { deriveTrustTier } from "@/lib/trust/trustTier";
import { TrustScoreBadge } from "@/components/trust/TrustScoreBadge";
import { TrustScoreRefreshButton } from "@/components/trust/TrustScoreRefreshButton";
import { formatDate } from "@/i18n/format";

interface TrustScoreCardProps {
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

function FactRow({ verified, label }: { verified: boolean; label: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
        padding: "4px 0",
        color: verified ? "var(--foreground)" : "var(--muted-foreground)",
      }}
    >
      {verified ? (
        <CheckCircle2 className="h-4 w-4 flex-none" style={{ color: "oklch(0.56 0.13 178)" }} aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 flex-none" style={{ color: "var(--muted-foreground)" }} aria-hidden="true" />
      )}
      {label}
    </li>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "13px",
        padding: "4px 0",
        color: "var(--foreground)",
      }}
    >
      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </li>
  );
}

export function TrustScoreCard({
  score,
  lastComputedAt,
  verifiedEmail,
  verifiedPhone,
  itsmeVerified,
  createdAt,
  activeListingsCount,
  isOwnProfile,
  locale,
  t,
}: TrustScoreCardProps) {
  const { tier } = deriveTrustTier(score);

  const lastUpdatedText = lastComputedAt
    ? t("trust_score.last_updated").replace(
        "{date}",
        formatDate(lastComputedAt, locale, { year: "numeric", month: "short", day: "numeric" }),
      )
    : t("trust_score.last_updated_never");

  const allVerified = verifiedEmail && verifiedPhone && itsmeVerified;

  const improvementTips: string[] = [];
  if (!verifiedEmail) improvementTips.push(t("trust_score.improve_verify_email"));
  if (!verifiedPhone) improvementTips.push(t("trust_score.improve_verify_phone"));
  if (!itsmeVerified) improvementTips.push(t("trust_score.improve_verify_itsme"));

  return (
    <section
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r)",
        padding: "18px",
        boxShadow: "var(--shS)",
      }}
      aria-label={t("trust_score.card_title")}
    >
      {/* Title + score number + tier badge */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t("trust_score.card_title")}
          </span>
          <TrustScoreBadge score={score} t={t} />
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span style={{ font: "800 28px/1 Inter, system-ui, sans-serif", letterSpacing: "-0.02em" }}>
            {score}
          </span>
          <span style={{ fontSize: "14px", color: "var(--muted-foreground)", fontWeight: 500 }}>/100</span>
        </div>

        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted-foreground)" }}>
          {lastUpdatedText}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "var(--border)", margin: "12px 0" }} />

      {/* Verifiable component facts */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <FactRow verified={itsmeVerified} label={t("trust_score.fact_id_verified")} />
        <FactRow verified={verifiedPhone} label={t("trust_score.fact_phone_verified")} />
        <FactRow verified={verifiedEmail} label={t("trust_score.fact_email_verified")} />
        <InfoRow label={t("trust_score.fact_deals")} value={`0 — ${t("trust_score.fact_deals_soon")}`} />
        {createdAt && (
          <InfoRow
            label={t("trust_score.fact_member_since")}
            value={formatDate(createdAt, locale, { year: "numeric", month: "short" })}
          />
        )}
        <InfoRow label={t("trust_score.fact_active_listings")} value={String(activeListingsCount)} />
      </ul>

      {/* Owner-only: improvement tips + refresh button */}
      {isOwnProfile && (
        <>
          <div style={{ height: "1px", background: "var(--border)", margin: "12px 0" }} />

          <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
            {t("trust_score.improve_title")}
          </p>

          {allVerified ? (
            <p style={{ fontSize: "13px", color: "var(--priD)", fontWeight: 500 }}>
              {t("trust_score.improve_all_done")} ✓
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {improvementTips.map((tip) => (
                <li key={tip} style={{ fontSize: "13px", color: "var(--foreground)", padding: "3px 0", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                  <span style={{ color: "var(--priD)", flexShrink: 0, fontWeight: 700 }}>→</span>
                  {tip}
                </li>
              ))}
            </ul>
          )}

          <TrustScoreRefreshButton
            refreshCta={t("trust_score.refresh_cta")}
            refreshingLabel={t("trust_score.refreshing")}
            refreshSuccess={t("trust_score.refresh_success")}
            refreshErrorRate={t("trust_score.refresh_error_rate")}
            refreshError={t("trust_score.refresh_error")}
          />
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/trust/TrustScoreCard.tsx
git commit -m "feat(T37/B6): TrustScoreCard sidebar facts component"
```

---

### Task 6: Fix refresh API — per-user rate limit key

**Files:**
- Modify: `apps/web/src/app/api/trust/refresh/route.ts`
- Modify: `apps/web/src/app/api/trust/refresh/__tests__/refresh-route.test.ts`

**Interfaces:**
- Change `makeKey` from IP-based to user-ID-based using the existing `getUserId` option on `withRateLimit`.

- [ ] **Step 1: Update `route.ts`**

In `apps/web/src/app/api/trust/refresh/route.ts`, replace the final `export const POST` block:

```typescript
// Before:
export const POST = withRateLimit(handleRefresh, {
  limiter: refreshLimiter,
  makeKey: (_req, _userId, ip) => ip ?? "anonymous",
});

// After:
export const POST = withRateLimit(handleRefresh, {
  limiter: refreshLimiter,
  getUserId: async (_req) => {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  },
  makeKey: (_req, userId, ip) => userId ?? ip ?? "anonymous",
});
```

Full updated file for clarity (only the export block changes):

```typescript
import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { computeTrustScore } from "@/lib/trust/trustScore";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";

export const runtime = "nodejs";

const refreshLimiter = createRateLimiter({
  limit: 10,
  windowSec: 60 * 60,
  prefix: "trust:refresh",
});

async function handleRefresh(_req: Request): Promise<Response> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const [profileResult, advertCountResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("verified_email, verified_phone, itsme_verified, created_at, flags")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("adverts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  if (profileResult.error) {
    return createErrorResponse(ApiErrorCode.FETCH_FAILED, { status: 500 });
  }

  const profile = profileResult.data;
  if (!profile) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  const flags = profile.flags as Record<string, unknown> | null;
  const activeRiskFlags = flags ? Object.values(flags).filter(Boolean).length : 0;

  const accountAgeDays = profile.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000)
    : 0;

  const components = computeTrustScore({
    verifiedEmail: profile.verified_email ?? false,
    verifiedPhone: profile.verified_phone ?? false,
    itsmeVerified: (profile as Record<string, unknown>).itsme_verified === true,
    accountAgeDays,
    activeAdverts: advertCountResult.count ?? 0,
    completedDeals: 0,
    disputeCount: 0,
    activeRiskFlags,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- components/last_computed_at added by F14 migration, not yet in generated types
  const { error: upsertError } = await (supabase as any).from("trust_score").upsert(
    {
      user_id: user.id,
      score: components.total,
      components,
      last_computed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  return createSuccessResponse({ components });
}

export const POST = withRateLimit(handleRefresh, {
  limiter: refreshLimiter,
  getUserId: async (_req) => {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  },
  makeKey: (_req, userId, ip) => userId ?? ip ?? "anonymous",
});
```

- [ ] **Step 2: Add a comment to the test documenting per-user intent**

In `apps/web/src/app/api/trust/refresh/__tests__/refresh-route.test.ts`, add a comment at the top of the `describe` block (after `describe("POST /api/trust/refresh — F14", () => {`):

```typescript
// Rate limit is keyed by authenticated user ID (not IP) — see withRateLimit getUserId option in route.ts.
// The rateLimiter mock here bypasses the rate limit entirely; the per-user key logic is an integration
// concern tested implicitly by the withRateLimit + rateLimiter unit tests in lib/rateLimiter.test.ts.
```

- [ ] **Step 3: Run the full test suite**

```bash
pnpm test -- --run apps/web/src/app/api/trust/refresh/__tests__/refresh-route.test.ts
```

Expected: all existing tests pass (the mock stubs `withRateLimit` as passthrough, so the new `getUserId` option is irrelevant to the unit tests).

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/trust/refresh/route.ts apps/web/src/app/api/trust/refresh/__tests__/refresh-route.test.ts
git commit -m "fix(T37/B6): rate-limit trust refresh by user ID not IP"
```

---

### Task 7: Wire profile page — extend query + render both components

**Files:**
- Modify: `apps/web/src/app/user/[id]/page.tsx`

**Interfaces:**
- Consumes: `TrustScoreBadge` (Task 3), `TrustScoreCard` (Task 5), all data from extended `loadPublicProfileData`.
- This task has no new test — correctness is verified by `pnpm typecheck && pnpm test && pnpm lint` + manual/visual check.

- [ ] **Step 1: Add imports**

At the top of `apps/web/src/app/user/[id]/page.tsx`, add after the existing imports:

```typescript
import { TrustScoreBadge } from "@/components/trust/TrustScoreBadge";
import { TrustScoreCard } from "@/components/trust/TrustScoreCard";
```

- [ ] **Step 2: Extend `PublicProfileData` type**

In the `PublicProfileData` type (around line 20), add `lastComputedAt`:

```typescript
type PublicProfileData = {
  id: string;
  display_name: string | null;
  created_at: string | null;
  verified_email: boolean | null;
  verified_phone: boolean | null;
  rating: number | null;
  trust_score: number;
  last_computed_at: string | null;   // ← add this line
  adverts_count: number;
  reviews_count: number;
  seller_type: "individual" | "business" | null;
  itsme_verified: boolean | null;
  active_adverts: Array<{
    id: string;
    title: string;
    price: number | null;
    status: string | null;
    created_at: string;
    location: string | null;
    media: { url: string | null; signedUrl: string | null; sort: number | null }[] | null;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    author: {
      display_name: string | null;
    } | null;
  }>;
};
```

- [ ] **Step 3: Extend trust_score DB query to fetch `last_computed_at`**

In `loadPublicProfileData` (around line 74–80), replace the trust_score query:

```typescript
// Before:
const { data: trustScoreData } = await supabase
  .from("trust_score")
  .select("score")
  .eq("user_id", userId)
  .maybeSingle();

const trustScore = trustScoreData?.score ?? 0;

// After:
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- last_computed_at not yet in generated types (B5)
const { data: trustScoreData } = await (supabase as any)
  .from("trust_score")
  .select("score, last_computed_at")
  .eq("user_id", userId)
  .maybeSingle() as { data: { score: number; last_computed_at: string | null } | null };

const trustScore = trustScoreData?.score ?? 0;
const lastComputedAt = trustScoreData?.last_computed_at ?? null;
```

- [ ] **Step 4: Add `lastComputedAt` to the return value**

In the `return { ... }` at the end of `loadPublicProfileData` (around line 210), add:

```typescript
return {
  id: profile.id,
  display_name: profile.display_name,
  created_at: profile.created_at,
  verified_email: profile.verified_email,
  verified_phone: profile.verified_phone,
  rating: (profile as unknown as { rating?: number | null }).rating ?? null,
  seller_type: (profile.seller_type as "individual" | "business" | null) ?? null,
  itsme_verified: profile.itsme_verified ?? null,
  trust_score: trustScore,
  last_computed_at: lastComputedAt,   // ← add this line
  adverts_count: adverts.length,
  reviews_count: reviewsList.length,
  active_adverts: adverts.map((ad) => ({
    id: ad.id,
    title: ad.title,
    price: ad.price ? Number(ad.price) : null,
    status: ad.status,
    created_at: ad.created_at ?? "",
    location: ad.location,
    media: mediaByAdvert.get(ad.id) ?? [],
  })),
  reviews: reviewsList.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    created_at: review.created_at ?? "",
    author: review.author ? { display_name: review.author.display_name } : null,
  })),
};
```

- [ ] **Step 5: Destructure `last_computed_at` in the page component**

In `PublicProfilePage`, in the destructuring block (around line 407), add `last_computed_at`:

```typescript
const {
  display_name,
  created_at,
  verified_email,
  verified_phone,
  rating,
  trust_score,
  last_computed_at,          // ← add this line
  adverts_count,
  reviews_count,
  active_adverts,
  reviews,
  seller_type,
  itsme_verified,
} = profile;
```

- [ ] **Step 6: Remove `void trust_score` and add `TrustScoreBadge` to header**

Find and remove the line (around line 482):
```typescript
// Delete this line entirely:
void trust_score;
```

Then in the "Trust badge row" section (around line 633–648), add `TrustScoreBadge` after the `SellerBadgePill` map:

```tsx
{/* Trust badge row (mockup lines 585-590) */}
<div className="flex flex-wrap gap-2">
  {badges.map((badge) => (
    <SellerBadgePill
      key={badge}
      badge={badge}
      label={
        <>
          <BadgeIcon badge={badge} />
          {t(badgeI18nKey(badge))}
        </>
      }
    />
  ))}
  {/* Trust tier badge — always visible */}
  <TrustScoreBadge score={trust_score} t={t} />
</div>
```

- [ ] **Step 7: Add `TrustScoreCard` to sidebar**

In the sidebar `<div className="flex flex-col gap-4">` (around line 710), add `TrustScoreCard` as the first child, before the TraderPanel:

```tsx
<div className="flex flex-col gap-4">

  {/* Trust & Reputation card — visible to all viewers */}
  <TrustScoreCard
    score={trust_score}
    lastComputedAt={last_computed_at}
    verifiedEmail={verified_email ?? false}
    verifiedPhone={verified_phone ?? false}
    itsmeVerified={itsme_verified ?? false}
    createdAt={created_at}
    activeListingsCount={active_adverts.length}
    isOwnProfile={isOwnProfile}
    locale={locale}
    t={t}
  />

  {/* DSA Trader Panel — public for all viewers (юр only) */}
  {businessHasPublicName && (
    <TraderPanel business={business!} t={tPanel} locale={locale} />
  )}

  {/* Reviews sidebar panel (mockup lines 622-625) */}
  {/* ... existing reviews section unchanged ... */}
```

- [ ] **Step 8: Run all checks**

```bash
pnpm typecheck && pnpm test && pnpm lint
```

Expected: all pass. If the lint warns about `as any` on the new trust_score query, verify the `eslint-disable-next-line` comment is present.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/user/[id]/page.tsx
git commit -m "feat(T37/B6): wire trust score UI — header badge + sidebar card on profile page"
```

---

## Self-Review

**Spec coverage check:**

| Spec §  | Requirement | Task covering it |
|---|---|---|
| §2 | Tier system 0-14/15-34/35-59/60-100 | Task 1 |
| §3 | Header pill — tier label only, no bare number | Task 3, 7 |
| §4 | Sidebar card — verifiable facts, score number, visible to all | Task 5, 7 |
| §4 | Owner-only improvement tips + refresh button | Task 5 |
| §5 | Refresh button: POST → router.refresh() → 2s success → reset | Task 4 |
| §5 | 429 → parse Retry-After → show "{min} min" message | Task 4 |
| §6 | Per-user rate limit key via getUserId hook | Task 6 |
| §7 | Extended DB query for `last_computed_at` | Task 7 |
| §7 | Remove `void trust_score` | Task 7 |
| §8 | All 5 locales, `trust_score.*` keys | Task 2 |
| §9 | No formula weights/thresholds in UI copy | Tasks 2, 5 (improve tips have no "+X pts") |
| §10 | All files listed | Tasks 1-7 |
| §11 | Ad card wiring explicitly out of scope | Not in plan ✓ |

**No placeholders found.** All steps have exact code or exact commands.

**Type consistency check:**
- `TrustTierInfo.colorVariant` — defined in Task 1 as `"muted" | "teal-light" | "teal" | "gold"`, consumed by Task 3 `TierIcon` switch — consistent. ✓
- `deriveTrustTier` returns `TrustTierInfo` — consumed by Task 3 and Task 5 — consistent. ✓
- `TrustScoreCard` props match Task 7 usage exactly: `score`, `lastComputedAt`, `verifiedEmail`, `verifiedPhone`, `itsmeVerified`, `createdAt`, `activeListingsCount`, `isOwnProfile`, `locale`, `t`. ✓
- `TrustScoreRefreshButton` props: `refreshCta`, `refreshingLabel`, `refreshSuccess`, `refreshErrorRate`, `refreshError` — all passed from Task 5 via `t("trust_score.*")` keys defined in Task 2. ✓
- `PublicProfileData.last_computed_at: string | null` added in Task 7 Step 2; populated in Step 4; destructured in Step 5; passed to `TrustScoreCard` in Step 7. ✓
