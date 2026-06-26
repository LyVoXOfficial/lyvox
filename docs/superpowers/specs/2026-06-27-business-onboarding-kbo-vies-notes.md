# Business-Seller Onboarding + KBO/VIES Verification — Build Note

**Date:** 2026-06-27
**Slice:** "Become a professional seller (юр) + verify the company" — Phase A0
**Status:** Build-ready design. Grounded in live migrations + API behaviour verified against the live VIES REST API (2026-06-27).
**Canonical design doc:** `docs/superpowers/specs/2026-06-26-marketplace-accounts-trust-design.md` (§3.2, §5.2, §5.2.1, §6, §8.3).

This note synthesizes four research dossiers (VIES, KBO, codebase conventions, flow) into one concrete plan and **resolves their conflicts with explicit choices**. The three load-bearing decisions are called out in §0.

---

## 0. Decisions taken (read this first)

These resolve the conflicts between the dossiers. Everything downstream depends on them.

| # | Decision | Why |
|---|---|---|
| **D1** | **VIES is authoritative ONLY for `vat_liable` businesses.** A Belgian *eenmanszaak* under the ~€25k franchise has a KBO number and **no VAT** → VIES returns `isValid:false` for a perfectly legitimate trader. Branch the async check on `vat_liable`. | R2 correction; confirmed against schema (`vat_liable boolean default false`, `vat_number` nullable & separate). |
| **D2** | **Non-VAT (KBO-only) traders in A0 → admin-manual-approve.** KBO Open Data CSV (SFTP + daily delta + matcher) is deferred to **A1**. Do not imply VIES covers them. | KBO has **no free official JSON API**; Open Data terms/schema are unverified (R2 flagged). Don't block the build on an SFTP pipeline. |
| **D3** | **MS_UNAVAILABLE policy = PROVISIONAL-PUBLISH.** On clean B0 format-check the business may go `status='active'` provisionally while the `vies` row is `pending`; **`entity_verified` stays false, so the "Verified Business / VAT-registered" badge and the VIES-validated trader panel are withheld** until a real `verified` row lands. A VIES outage never blocks all new traders. | §5.2.1 default; reconciles the §6.7 "B1-required" tension by gating the *badge/panel* on B1, not the *listing*. |
| **D4** | **The publish gate matches D3:** `canSellAsBusiness` requires `phone-verified (L3)` AND `business.status='active'` AND `is_business_member`. It does **NOT** require `entity_verified`. `entity_verified` gates only the badge + DSA trader panel. | Without this, "provisional" is a contradiction (advisor bug #3). |
| **D5** | **Admin-override + non-VAT-approve write a `method='kbo' status='verified'` row** (`evidence.source='admin_override'`), NOT `method='manual'`. | **The trigger only flips `entity_verified` for `method IN ('kbo','vies')`** (verifications migration L32-38). A `manual` row flips nothing — R4's escape hatch is broken as written. (advisor bug #1) |
| **D6** | **Self-certification is stored OFF the ledger**, in a new column `businesses.self_certified_at timestamptz` (+ `self_certified_ip text`), NOT as a `verifications` row. | `uq_ver_active` is unique on `(subject_type, subject_id, method) WHERE status IN ('pending','verified')`. A `manual:verified` self-cert row would collide with the D5 admin-override path on the same `(business, manual)` slot. Off-ledger avoids the collision and is what §8.3 reads for the "self-certification timestamp". (advisor bug #2) |
| **D7** | **The async verify route UPDATEs the existing `vies:pending` row** inserted at B0 — it never INSERTs a second `vies` row (would collide on `uq_ver_active`). | Ledger mechanics. |

---

## 1. Scope & non-goals

**In scope (A0):**
- A logged-in, phone-verified user converts to a professional seller: `profiles.seller_type='business'` + a `businesses` row (draft) with consumer-law fields.
- Synchronous **B0** format validation (offline KBO mod-97 + Belgian-VAT mod-97 + postcode), then row creation via the existing `create_business` RPC + an authenticated UPDATE for the remaining fields.
- Asynchronous **B1** entity verification: **VIES REST** for `vat_liable` traders; **admin-manual-approve** for KBO-only traders (D2).
- App-layer "sell-as-business" publish gate (D4) — RLS does **not** enforce B1 (confirmed: `adv_team_insert` checks only `is_business_member`).
- A read endpoint that branches member (full) vs public (§8.3 DSA trader-panel subset).

**Non-goals (explicitly deferred):**
- **No ID-document copy, no payment-account capture** (Art. 30(1)(b)/(c) deferred per §5.2; GDPR data-minimization; no company-free obligation in A0).
- **No KBO Open Data ingestion** (→ A1). KBO-only traders are admin-approved in A0 (D2).
- **No `requestIdentifier` consultation-number audit** — VIES only issues one when the caller passes its own requester VAT, which LyVoX does not have pre-incorporation. Store `requestDate` + outcome now; add requester params once LyVoX is VAT-registered.
- Third-party KBO JSON (cbeapi.be free tier) — **enrichment/autofill only**, never the system of record. Out of A0 critical path.

**Capability-flag note:** KBO/VIES are **FREE and company-free** → **NOT flag-gated** (`lib/capabilities.ts`). Ship active in A0. Only Stripe Identity / itsme / WhatsApp remain flagged.

---

## 2. Verification approach

### 2.1 B0 — offline format check (synchronous, no network)

Two checks, both mirroring live SQL so the client/server pre-check matches the DB CHECK constraints:

**KBO/CBE enterprise number** — 10 digits, leading `0` or `1`, ISO 7064 **MOD 97-10**. `check = 97 − (first8 mod 97)`; the result is always in `[1,97]`, so **no `==0 → 97` special case is needed** (the branch in the live SQL is unreachable dead code — do **not** port it to JS as a "fix").

```ts
// apps/web/src/lib/verification/kbo.ts  — pure, no network. Mirrors validate_belgian_vat() + businesses_kbo_format.
export function normalizeKbo(input: string | null | undefined): string | null {
  const d = String(input ?? "").replace(/\D/g, "");   // == public.normalize_kbo()
  return d ? d : null;
}
export function isValidKbo(input: string): boolean {
  const digits = String(input).replace(/^BE/i, "").replace(/\D/g, "");
  if (!/^[01]\d{9}$/.test(digits)) return false;        // 10 digits, leading 0/1 (DB CHECK ^[01][0-9]{9}$)
  const base = Number(digits.slice(0, 8));
  const check = Number(digits.slice(8, 10));
  return 97 - (base % 97) === check;                    // result is always 1..97
}
// Belgian VAT base == KBO number. A vat_liable trader's VAT digits must equal its KBO digits.
export function isValidBelgianVat(input: string): boolean {
  return isValidKbo(input);                              // same mod-97 on the 10-digit base
}
```

Normalize KBO to 10 bare digits **before** writing (the wizard + server both call `normalizeKbo`); `create_business` already runs `normalize_kbo()` internally, but the strict `businesses_kbo_format` CHECK (`^[01][0-9]{9}$`) means a non-normalized value would be rejected — so normalize client-side for UX and server-side for safety.

### 2.2 B1 — VIES REST cross-check (asynchronous, `vat_liable` only — D1)

**Endpoint (use GET in A0 — no requester VAT yet, so no `requestIdentifier` either way):**
```
GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/BE/vat/{10digits}
```
Live valid response (verified): `{ isValid:true, requestDate, userError:"VALID", name, address, requestIdentifier:"", vatNumber }`.
Invalid number: `{ isValid:false, userError:"INVALID", name:"", address:"" }`.
Input/availability errors come back in a **different envelope**: `{ actionSucceed:false, errorWrappers:[{error:"MS_UNAVAILABLE"|...}] }` (HTTP 200).

> **When LyVoX has its own BE VAT**, switch to `POST /check-vat-number` with `requesterMemberStateCode`/`requesterNumber` to obtain the auditable `requestIdentifier` consultation number. Helper is written to support both (pass optional `requester`).

```ts
// apps/web/src/lib/verification/vies.ts  — server-only. No key required.
const VIES_BASE = "https://ec.europa.eu/taxation_customs/vies/rest-api";

export type ViesResult =
  | { outcome: "valid"; name: string; address: string; requestIdentifier: string; requestDate: string }
  | { outcome: "invalid"; requestDate: string }
  | { outcome: "unavailable"; error: string }   // transient → retry/backoff
  | { outcome: "bad_input"; error: string };     // hard → fail, no retry

const TRANSIENT = new Set([
  "MS_UNAVAILABLE", "MS_MAX_CONCURRENT_REQ", "GLOBAL_MAX_CONCURRENT_REQ",
  "SERVICE_UNAVAILABLE", "TIMEOUT", "SERVER_BUSY",
]);

export async function checkViesVat(
  countryCode: string,
  vatNumber: string,
  requester?: { memberStateCode: string; number: string }, // set once LyVoX has a BE VAT → POST + requestIdentifier
): Promise<ViesResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000); // GET observed ~3.4s; 8s headroom
  try {
    const digits = vatNumber.replace(/[^0-9A-Za-z]/g, "");
    const url = requester
      ? `${VIES_BASE}/check-vat-number`
      : `${VIES_BASE}/ms/${countryCode}/vat/${digits}`;
    const init: RequestInit = requester
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            countryCode, vatNumber: digits,
            requesterMemberStateCode: requester.memberStateCode, requesterNumber: requester.number,
          }),
          signal: ac.signal, cache: "no-store",
        }
      : { method: "GET", headers: { Accept: "application/json" }, signal: ac.signal, cache: "no-store" };

    const res = await fetch(url, init);
    if (!res.ok) return { outcome: "unavailable", error: `HTTP_${res.status}` };
    const data = await res.json();

    if (data?.actionSucceed === false) {
      const code = data?.errorWrappers?.[0]?.error ?? "UNKNOWN";
      return TRANSIENT.has(code) ? { outcome: "unavailable", error: code } : { outcome: "bad_input", error: code };
    }
    const isValid = data?.valid ?? data?.isValid; // POST→valid, GET→isValid
    if (isValid === true) {
      return {
        outcome: "valid",
        name: data.name ?? "", address: data.address ?? "",
        requestIdentifier: data.requestIdentifier ?? "", requestDate: data.requestDate,
      };
    }
    return { outcome: "invalid", requestDate: data?.requestDate };
  } catch (e) {
    return { outcome: "unavailable", error: (e as Error)?.name === "AbortError" ? "TIMEOUT" : "NETWORK" };
  } finally {
    clearTimeout(timer);
  }
}
```

### 2.3 Authoritative cross-check logic (the name match — BE returns `NOT_PROCESSED`)

VIES's API-side approximate name/address match is **`NOT_PROCESSED` for Belgium** (verified live). So **we do the name match ourselves**:

1. `outcome:"valid"` → normalize-compare VIES `name` against `businesses.legal_name` (lowercase, strip legal-form suffixes like `NV/SA/BV/SRL`, collapse whitespace). **Strong match** → auto-verify (write `vies:verified`). **Weak/no match** → write `vies:pending` with `evidence.name_match="mismatch"` and route to admin manual review (do not auto-promote on a name mismatch).
2. `outcome:"invalid"` → definitive: `vies:failed`. Block publish; statement-of-reasons (B6).
3. `outcome:"unavailable"` (transient) → leave `vies:pending`, bump `evidence.retry_count` + `evidence.next_retry_at` (exp backoff 2s/8s/30s + jitter), cron re-attempts. **Provisional publish stands** (D3).
4. `outcome:"bad_input"` → `vies:failed` immediately, no retry (B0 should have prevented this).

### 2.4 MS_UNAVAILABLE / VIES-down policy (D3) — concrete

- B0 clean → `status='active'` **provisionally**, `entity_verified=false`, `vies:pending`.
- Badge + VIES trader panel **withheld** until a `vies:verified` row flips `entity_verified=true`.
- Definitive `vies:failed` (INVALID) → if currently provisional `active`, app demotes to `status='suspended'` (B3) + statement-of-reasons (B6) + appeal (B7).
- **Prolonged MS_UNAVAILABLE escape hatch = admin-manual-approve**, which writes a **`kbo:verified` row** (D5) → trigger flips `entity_verified=true` → app keeps `status='active'`. This is also the A0 path for KBO-only traders (D2).

---

## 3. Backend pieces

### 3.1 Helper files (new)

| File | Export(s) | Notes |
|---|---|---|
| `apps/web/src/lib/verification/kbo.ts` | `normalizeKbo`, `isValidKbo`, `isValidBelgianVat` | pure, no network (§2.1) |
| `apps/web/src/lib/verification/vies.ts` | `checkViesVat`, `ViesResult` | server-only, no key (§2.2) |
| `apps/web/src/lib/verification/nameMatch.ts` | `normalizeLegalName`, `legalNameMatches(a,b)` | strip legal-form suffixes; used in §2.3 |
| `apps/web/src/lib/auth/canSellAsBusiness.ts` | `canSellAsBusiness(supabase, userId, businessId)` | app-layer publish gate (D4) |
| `apps/web/src/lib/validations/business.ts` | zod schemas: `createBusinessSchema` | mirrors B0 format checks |

```ts
// apps/web/src/lib/auth/canSellAsBusiness.ts  (D4 — does NOT require entity_verified)
import { isViewerVerified } from "@/lib/auth/requireVerified";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function canSellAsBusiness(
  supabase: SupabaseClient, userId: string, businessId: string,
): Promise<{ ok: true } | { ok: false; reason: "phone" | "membership" | "not_active" }> {
  if (!(await isViewerVerified(supabase, userId))) return { ok: false, reason: "phone" };
  const { data: isMember } = await supabase.rpc("is_business_member", { b_id: businessId, min_role: "member" });
  if (!isMember) return { ok: false, reason: "membership" };
  const { data: b } = await supabase.from("businesses").select("status").eq("id", businessId).maybeSingle();
  if ((b as { status?: string } | null)?.status !== "active") return { ok: false, reason: "not_active" };
  return { ok: true };
}
```

### 3.2 New `ApiErrorCode` members (add to `apps/web/src/lib/apiErrors.ts`)

`BUSINESS_NOT_FOUND` (404), `KBO_IN_USE` (409), `VAT_IN_USE` (409), `ENTITY_VERIFICATION_PENDING` (200/409 context-dependent), `ENTITY_VERIFICATION_FAILED` (409). Reuse existing `UNAUTHENTICATED`, `FORBIDDEN`, `VERIFICATION_REQUIRED`, `INVALID_PAYLOAD`, `RATE_LIMITED`.

> **KBO_IN_USE vs VAT_IN_USE distinction:** `handleSupabaseError` maps `23505` → `BAD_INPUT`/409 **generically** (no per-constraint code). To distinguish, **branch on the constraint name in `error.message`** before falling through to `handleSupabaseError`: `businesses_kbo_number_key` → `KBO_IN_USE`, `businesses_vat_number_key` → `VAT_IN_USE`. (Both unique constraints are auto-named by Postgres from `kbo_number unique` / `vat_number unique`.)

### 3.3 API route contracts

All routes: `export const runtime = "nodejs"`; `supabaseServer()` (cookie-bound) for user-context calls so `auth.uid()` resolves; `supabaseService()` (service-role, bypasses RLS) **only** for the async/cron verification writes; `safeJsonParse` + zod `validateRequest`; `createSuccessResponse(data)` / `createErrorResponse(code,{status,detail})`; rate-limited via `createRateLimiter`/`withRateLimit`.

#### `POST /api/business` — create + B0
- **File:** `apps/web/src/app/api/business/route.ts`
- **Auth:** required → 401 `UNAUTHENTICATED`. **Phone-verified required** (L3 is the human hinge to become a business) → `isViewerVerified`, else 403 `VERIFICATION_REQUIRED` (`detail:"phone"`).
- **Body:** `{ legal_name, trade_name?, legal_form?, kbo_number, vat_number?, vat_liable:boolean, address_line, postcode, city, country?="BE", email, phone_e164?, withdrawal_terms, self_certified:true }`
- **Flow (cookie client throughout):**
  1. zod B0 validate (`isValidKbo`; if `vat_liable` then `vat_number` required + `isValidBelgianVat`; `validate_belgian_postcode` mirror) → `INVALID_PAYLOAD` 400 on fail.
  2. `rpc("create_business", { p_legal_name, p_kbo: kbo_number, p_vat: vat_number ?? null })` → `business_id`. On `23505` branch by constraint name → `KBO_IN_USE`/`VAT_IN_USE` 409 (§3.2).
  3. `UPDATE businesses SET trade_name, legal_form, address_line, postcode, city, country, phone_e164, vat_liable, email(public override), withdrawal_terms, self_certified_at=now(), self_certified_ip=<ip> WHERE id=:business_id` (RLS `biz_owner_write`: `created_by=auth.uid()`).
  4. `UPDATE profiles SET seller_type='business' WHERE id=auth.uid()`.
  5. If `vat_liable`: `INSERT verifications {subject_type:'business', subject_id:business_id, method:'vies', status:'pending', evidence:{queued_at}}`. Else (KBO-only, D2): **no `vies` row**; leave for admin-approve.
  6. **Provisional publish (D3):** `UPDATE businesses SET status='active'` *if* B0 passed. (Founder dial — if strict mode is ever chosen, skip this and keep `draft`.)
  7. If `vat_liable`, fire-and-forget enqueue the async verify (or rely on cron sweep).
- **Response 200:** `{ ok:true, data:{ business_id, status:"active", entity_verified:false, verification:{ vies:"pending"|"n/a" } } }`

#### `POST /api/business/[id]/verify` — async VIES (idempotent; UPDATEs the pending row — D7)
- **File:** `apps/web/src/app/api/business/[id]/verify/route.ts`
- **Auth:** business `admin`+ (`is_business_member(id,'admin')`) for manual re-trigger, **OR** the cron/job via service-role. Else 403 `FORBIDDEN`. Rate-limited (VIES politeness).
- **Body:** none. Reads `vat_number`/`vat_liable`/`legal_name` from the row.
- **Flow (service-role for the writes so RLS can't block the system actor):**
  - If `!vat_liable` → 200 `{ data:{ method:"kbo", status:"pending", note:"awaiting admin approve (no VAT)" } }` (D2).
  - `checkViesVat("BE", vat_number)`:
    - `valid` + `legalNameMatches` → **UPDATE** the `vies:pending` row → `status='verified', verified_at=now(), evidence={requestDate, name_match:"auto"}`. Trigger flips `entity_verified=true`. App keeps/sets `status='active'` (B1).
    - `valid` + name mismatch → UPDATE row `evidence.name_match='mismatch'`, stays `pending`; flag for admin.
    - `invalid` → UPDATE row `status='failed', evidence={userError:"INVALID"}`. App: if was provisional `active` → `status='suspended'` (B3) + B6.
    - `unavailable` → UPDATE row `evidence.retry_count++, next_retry_at=…`; stays `pending`. Provisional active stands.
    - `bad_input` → UPDATE row `status='failed'`, no retry.
- **Response 200:** `{ ok:true, data:{ method:"vies", status:"verified"|"failed"|"pending", entity_verified:bool, business_status:"active"|"draft"|"suspended", evidence:{ requestDate, requestIdentifier?, userError?, name_match? } } }`

#### `GET /api/business/[id]` — read (branches by viewer)
- **File:** `apps/web/src/app/api/business/[id]/route.ts`
- **Member/admin** (`is_business_member`) → full private row incl. `status`, `entity_verified`, latest `verifications` summary, `withdrawal_terms`, `self_certified_at`.
- **Public** (anon/non-member) → only if `status='active'`; §8.3 trader-panel subset: `legal_name, trade_name, address_*, kbo_number, vat_number, email, phone_e164, withdrawal_terms, self_certified_at, entity_verified`. Never `created_by`, never kyc, **never third-party director names**.
- **404** `BUSINESS_NOT_FOUND`.
- **Response 200:** `{ ok:true, data:{ business:{…subset…}, badges:{ verified_business:entity_verified, vat_registered:!!vat_number && entity_verified } } }`

#### `GET /api/cron/business-verify` — VIES retry sweep
- **File:** `apps/web/src/app/api/cron/business-verify/route.ts`
- **Auth:** `Authorization: Bearer ${CRON_SECRET}`, **fail-closed 401** (exact `saved-search-alerts` pattern). `supabaseService()`.
- **Flow:** sweep `verifications WHERE method='vies' AND status='pending' AND (evidence->>'next_retry_at')::timestamptz <= now()`, re-call `checkViesVat` per row with backoff (same branch logic as `/verify`). No DDL — `evidence` jsonb already exists. Add a `vercel.json` cron entry.

#### Admin manual-approve (escape hatch + KBO-only path — D5)
- Extend the existing admin moderation surface (`apps/web/src/app/admin/...`). Action writes a **`kbo:verified`** row (`evidence:{source:'admin_override', approved_by, approved_at}`) → trigger flips `entity_verified=true` → app sets `status='active'`. **Not** a `manual` row (would not flip the cache — D5).

#### Out-of-slice (named, follow same envelope)
`PATCH /api/business/[id]` (owner edit trader fields), `POST /api/business/[id]/members` (invite). Needed for the cabinet, not the critical path.

---

## 4. Wizard UI

**Pattern (match the codebase — R3):** plain `"use client"` component, `useState` for `currentStep` + a single `formData` object, shadcn `Card/Input/Select/Button/Checkbox/Label`, `apiFetch` + read `result.data?.X`, `sonner` toasts keyed by i18n with English `|| "…"` fallback, the `tr(k, fb)` wrapper (client `t()` returns the raw key on miss). **No react-hook-form, no client zod** (zod is server-side only here).

**Where it lives:**
- Page: `apps/web/src/app/pro/page.tsx` (server component). Mirror `post/page.tsx`: fetch user via `supabaseServer().auth.getUser()`; build `t`/`tf` from `getI18nProps()`; gate with `isViewerVerified` (the L3 half). If not signed-in/verified → render a sign-in/verify Card (not a redirect). Else render `<ProOnboardingWizard locale messages>`.
- Wizard client component: `apps/web/src/app/pro/ProOnboardingWizard.tsx`.
- Add `/pro` to the `middleware.ts` protected-prefix list (hard auth) **or** self-guard in the page like `/post`. Recommend self-guard (consistent with `/post`).

**Gating by `seller_type`:** the wizard's final submit sets `profiles.seller_type='business'` server-side (step 4 of `POST /api/business`). If the user already has an `active` business, `/pro` should route to the business cabinet instead of re-running onboarding.

**Steps:**
1. **Intro + L3 check** — explain professional-seller obligations; if not phone-verified, route through `TrustGate` `requireTrust("verified", …)`.
2. **Identity** — `legal_name*`, `trade_name`, `legal_form` (select: BV/SRL, NV/SA, eenmanszaak, …).
3. **Registration numbers** — `kbo_number*` (live `isValidKbo` feedback), `vat_liable` checkbox, `vat_number` (required + `isValidBelgianVat` iff `vat_liable`). Optional cbeapi.be autofill of name/address (enrichment only).
4. **Address + contact** — `address_line*`, `postcode*` (Belgian-postcode check), `city*`, `country=BE`, public `email*`, public `phone_e164`.
5. **Consumer-law terms** — `withdrawal_terms*` (14-day right-of-withdrawal text, CEL VI.45/VI.83), optional `returns_url`.
6. **Self-certification + submit** — `self_certified` checkbox (legal-compliance attestation → `self_certified_at`); on submit POST `/api/business`; `toast.success`; route to the cabinet showing "verification pending."

**Validation:** client = light hand-rolled (mirror `isValidKbo`/`isValidBelgianVat` for instant feedback); server = authoritative zod (`createBusinessSchema`) + DB CHECK backstop.

**i18n keys to add (all 5 locales — `en/ru/nl/fr/de`; the completeness vitest fails the build on drift). New `pro` namespace, static literal keys only:**
```
pro.title, pro.intro.heading, pro.intro.body, pro.intro.requires_phone,
pro.step, pro.of, pro.next, pro.back, pro.submit,
pro.identity.legal_name, pro.identity.trade_name, pro.identity.legal_form,
pro.reg.kbo, pro.reg.kbo_invalid, pro.reg.vat_liable, pro.reg.vat, pro.reg.vat_invalid,
pro.address.line, pro.address.postcode, pro.address.postcode_invalid, pro.address.city,
pro.contact.email, pro.contact.phone,
pro.terms.withdrawal, pro.terms.withdrawal_help, pro.terms.returns_url,
pro.certify.label, pro.certify.required,
pro.submit.success, pro.submit.error,
pro.status.pending, pro.status.verified, pro.status.failed,
pro.badge.verified_business, pro.badge.vat_registered
```

---

## 5. State machine

Three orthogonal axes — never merged:
- **`verifications.status`** (per method row): `pending → verified | failed | expired | revoked`.
- **`businesses.status`**: `draft → active → suspended`. **Owned by the app** (the trigger never writes it).
- **`businesses.entity_verified`** (bool cache): **flipped ONLY by the `sync_verification_caches` trigger**, and only for `method IN ('kbo','vies')`.

```
B0  POST /api/business
  format-valid → create_business (draft) → UPDATE fields + self_certified_at
              → seller_type='business'
              → IF vat_liable: INSERT vies:pending   ELSE: (no row; admin path)
              → status='active' (PROVISIONAL, D3)   entity_verified=false
  → state: status=active, entity_verified=false  (listed, no badge)

B1  async /verify or cron  (vat_liable)
  VIES valid + name match → UPDATE vies row → verified
        └─ trigger → entity_verified=TRUE → badge unlocked (B1)   status stays active
  VIES invalid            → UPDATE vies row → failed
        └─ entity_verified stays false; app → status=suspended (B6 reason, B7 appeal)
  VIES transient          → vies stays pending (retry meta); provisional active stands

B1  admin-approve  (KBO-only OR prolonged MS_UNAVAILABLE — D5)
  INSERT kbo:verified {source:'admin_override'}
        └─ trigger → entity_verified=TRUE → badge unlocked   status active
```

| Event | `verifications` write | `entity_verified` | `businesses.status` | Writer |
|---|---|---|---|---|
| Wizard submit (B0) | `vies:pending` (iff vat_liable) | false | `draft`→`active` provisional | app (RPC + UPDATE) |
| VIES clean match | UPDATE `vies:verified` | **→true** (trigger) | stays `active` (B1) | trigger flips bool; app keeps status |
| VIES definitive INVALID | UPDATE `vies:failed` | false | `suspended` if was active | app |
| VIES transient | UPDATE retry meta, stays `pending` | false | unchanged | cron/job |
| Admin approve / non-VAT | INSERT `kbo:verified` | **→true** (trigger) | `active` | admin app (service-role) |
| DSA suspend (B3) | flag / `failed` row | unchanged | `suspended` | admin app |

**Invariant:** the trigger owns `entity_verified` (kbo/vies only); the app owns `businesses.status`; self-certification lives off-ledger in `businesses.self_certified_at`.

---

## 6. Task breakdown (dependency order, TDD-friendly — hand to writing-plans)

**Schema (migration) — small, additive:**
- **T1** Migration: `alter table businesses add column self_certified_at timestamptz, add column self_certified_ip text, add column withdrawal_terms text, add column returns_url text`. (No trigger change needed — D5/D6 avoid it.) Test: columns exist; existing rows unaffected.

**Pure helpers (no network — pure unit tests):**
- **T2** `lib/verification/kbo.ts` (`normalizeKbo`, `isValidKbo`, `isValidBelgianVat`). Tests: NBB `0203201340`✓, InBev `0417497106`✓, mod-97 fail, leading-`1`, `BE` prefix/dots stripped, check-digits `97` accepted.
- **T3** `lib/verification/nameMatch.ts` (`normalizeLegalName`, `legalNameMatches`). Tests: "NV Anheuser-Busch InBev" ≈ "Anheuser-Busch InBev NV"; reject unrelated.
- **T4** `lib/validations/business.ts` `createBusinessSchema` (zod) + `vat_liable ⇒ vat_number required & valid`. Tests: valid payload passes; missing VAT when liable fails; bad KBO fails.

**VIES helper (mockable fetch):**
- **T5** `lib/verification/vies.ts` `checkViesVat`. Tests (mock fetch): valid GET → `valid`; invalid → `invalid`; `{actionSucceed:false, errorWrappers:[{error:"MS_UNAVAILABLE"}]}` → `unavailable`; `INVALID_INPUT` → `bad_input`; non-2xx → `unavailable`; abort → `TIMEOUT`. (Branch transient set.)

**Error codes + gate:**
- **T6** Add `ApiErrorCode` members (§3.2) + constraint-name branch helper for `23505` → `KBO_IN_USE`/`VAT_IN_USE`. Test: helper maps each constraint name.
- **T7** `lib/auth/canSellAsBusiness.ts` (D4 — no `entity_verified` requirement). Tests (mock supabase): phone-fail→`phone`; non-member→`membership`; draft→`not_active`; active+member+phone→ok.

**Routes:**
- **T8** `POST /api/business` (create + B0 + provisional publish). Tests: unauth→401; unverified-phone→403; valid vat_liable→`{business_id,status:"active",verification:{vies:"pending"}}` + `vies:pending` row + `seller_type='business'`; KBO-only→no vies row; duplicate KBO→409 `KBO_IN_USE`; bad format→400.
- **T9** `POST /api/business/[id]/verify` (async; **UPDATE** pending row — D7). Tests (mock VIES): valid+match→`vies:verified` + `entity_verified=true`; invalid→`failed` + suspend; transient→stays pending + retry meta; `!vat_liable`→pending/admin note; non-admin & non-cron→403.
- **T10** `GET /api/business/[id]` (member vs public branch). Tests: member→full; public+active→§8.3 subset (no `created_by`); public+draft→404; badges computed.
- **T11** `GET /api/cron/business-verify` (sweep). Tests: no/bad bearer→401; due pending rows re-checked; `next_retry_at` advances on transient.
- **T12** Admin manual-approve action writing `kbo:verified` (D5). Tests: writes `kbo:verified` (not `manual`); `entity_verified` flips; `status='active'`.

**UI:**
- **T13** i18n keys in all 5 locales (§4). Test: `i18n-completeness` vitest green.
- **T14** `app/pro/page.tsx` server gate + sign-in/verify Card + cabinet redirect when business exists.
- **T15** `app/pro/ProOnboardingWizard.tsx` (6 steps, light client validation, `apiFetch`+`result.data`, sonner). 
- **T16** §8.3 public DSA trader panel rendered read-only on `app/ad/[id]/page.tsx` (and/or `app/user/[id]/page.tsx`) from `GET /api/business/[id]` public subset; badge gated on `entity_verified`.

**Integration:**
- **T17** Wire `canSellAsBusiness` into the business branch of the advert publish path (returns `VERIFICATION_REQUIRED` 403 with `detail` = phone|membership|not_active). Test: provisional business (active, entity_verified=false) **can** publish; draft cannot.
- **T18** `vercel.json` cron entry for `/api/cron/business-verify`; final review + deploy + prod verify.

---

## 7. Open questions / risks

1. **Provisional vs strict (D3) is a founder dial.** Chosen: provisional. If legal prefers strict B1-before-listing, flip step 6 of `POST /api/business` to keep `draft` and make admin-approve the only publish path — D5 (`kbo:verified` override) is then mandatory, not optional.
2. **Name-match threshold** (§2.3) needs tuning — too strict sends legit traders to admin review; too loose auto-verifies mismatches. Start conservative (auto-verify only on strong match), measure admin queue volume.
3. **KBO-only traders are 100% admin-manual in A0 (D2).** If the *eenmanszaak* volume is high, the admin queue is the bottleneck → prioritize the A1 KBO Open Data CSV matcher (SFTP `kbo-bce-webservice@economie.fgov.be`; verify the CSV schema field names before building the matcher).
4. **`requestIdentifier` audit gap** — no consultation number until LyVoX has its own BE VAT. The `vies.ts` helper already supports the POST+requester upgrade; flip it on once incorporated and set `VIES_REQUESTER_VAT` env.
5. **`23505` constraint-name parsing** is brittle if Postgres constraint names ever change. Lower-risk alternative: `SELECT` for existing `kbo_number`/`vat_number` before the RPC and return `KBO_IN_USE`/`VAT_IN_USE` pre-emptively (one extra round-trip).
6. **Director/representation match** (matching the signing user against a published KBO director) is **server-side only, boolean result only** — never republish third-party director names in the §8.3 panel (KBO reuse terms + GDPR; CJEU 22 Nov 2022 on UBO). Deferred with the Open Data path.
7. **`supabaseService()` silently falls back to the cookie client** if `SUPABASE_SERVICE_ROLE_KEY` is unset (one-time `console.warn`). The cron + async-verify writes **assume RLS-bypass** — if the key is missing, those writes run as no-one and fail. Guard with `SERVICE_ROLE_MISSING` or assert the key in the cron route.

---

**Sources (current, 2026):** VIES REST live — `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{CC}/vat/{VAT}` and `…/check-vat-number`; SOAP fallback `…/services/checkVatService.wsdl`; EC proof-of-check guidance `https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm`; VIES error enum `https://viesapi.eu/vies-rest-api-documentation/`. KBO: Public Search (no reuse) `https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html`; Open Data (free CSV/SFTP) and Web Service (paid €50/2000) under `https://economie.fgov.be/en/themes/enterprises/crossroads-bank-enterprises`; cbeapi.be (free 2500/day, enrichment only) `https://cbeapi.be/en`.
