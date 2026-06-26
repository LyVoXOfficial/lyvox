# Phase 2b — Trust Gate + Verified-Only Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make high-intent actions (contact a seller, publish a listing) require a **phone-verified** account, enforced server-side, and give users a friendly **Trust Gate** modal that signs them in / registers / verifies their phone in place and then replays the action.

**Architecture:** A small server helper `isViewerVerified` (auth **+** phone-verified, reading `phones.verified` OR `profiles.verified_phone`) gates `POST /api/chat/start` and `POST /api/adverts` with `403 VERIFICATION_REQUIRED`. On the client, a root-mounted `TrustGateProvider` exposes `requireTrust(level, run)`: for `level:"auth"` it shows a compact email+password login (+ a register tab reusing the existing `RegisterForm`); for `level:"verified"` it additionally shows a phone-OTP step. **The phone step uses the project's existing, proven Twilio endpoints `POST /api/phone/request` (sends the SMS, upserts the `phones` row) + `POST /api/phone/verify` (sets `phones.verified=true`)** — NOT Supabase-native `signInWithOtp`. (Decision basis: the one currently-verified user has `phones.verified=true`, which only the Twilio `/api/phone/verify` flow sets; native OTP is unproven here, and the custom endpoints exist precisely because native SMS likely isn't configured. The Twilio endpoints also run under the existing session, avoiding any sign-in/session-swap risk.) When the required tier is met, the modal closes and `run` is replayed. The contact-seller button routes through `requireTrust("verified", startChat)` and also maps a server `403 VERIFICATION_REQUIRED` to re-opening the gate, so the gate and the server guard always agree (server stays authoritative).

**Tech Stack:** Next.js 16 (App Router, `runtime=nodejs` routes), React 19, Supabase (browser client `@/lib/supabaseClient`, server `supabaseServer()`, native phone OTP), Zod, Vitest (jsdom), Tailwind v4 + shadcn `Dialog`, sonner toasts, custom `useI18n()`.

## Global Constraints

- **Next.js pinned at `16.0.11`** — never downgrade. See `memory/deploy-pipeline.md`.
- **Trust tiers (from the spec, decided with the user):** browse/search/view = open; like/favorite = **auth**; contact/publish/offer + seeing seller identity = **verified** (auth + phone-verified). This plan enforces the **verified** tier on contact + publish; likes/favorites keep their existing auth-only behavior; hiding seller identity is **Phase 2c**.
- **The gate is friendly UX over a REAL server guard** — every protected action keeps its server-side check; the modal is never the source of truth.
- **Verified = `phones.verified === true` OR `profiles.verified_phone === true`** (the Supabase-native OTP flow sets `profiles.verified_phone`; use OR, not `??`, so a stale `phones.verified=false` row can't mask a verified profile).
- **API envelope:** `createSuccessResponse(data)`→`{ok:true,data}`; `createErrorResponse(code,{status,detail})`→`{ok:false,error,detail}` (`@/lib/apiErrors`). Clients read `body.data.*` / `body.error` (see `memory/api-envelope.md`).
- **Every user-facing string localized in all 5 locales** (`apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`); `node scripts/check-i18n-keys.js` MUST pass. Add keys in the task that introduces the UI.
- **Tests:** Vitest jsdom. Single file: `npx vitest run <path>`. Mock Supabase with `vi.mock("@/lib/supabaseServer")`; mock rate-limiting with `vi.mock("@/lib/rateLimiter", () => ({ createRateLimiter: () => async () => ({success:true}), withRateLimit: (h) => h }))`.
- **i18n in client components:** `const { t } = useI18n()` from `@/i18n`; dot-notation keys; `tr(k, fb)` fallback helper.
- **Clean-build / no-dirty-tree discipline (learned the hard way — see `memory/deploy-pipeline.md` Gotcha #2):** after EVERY task, `git status` must be clean — commit **all** files you changed (if you edit a file outside the task's primary scope to keep `tsc` green, commit it in the SAME task). Local `pnpm build` reuses the `.next` cache and runs against the working tree, so it can pass on a dirty tree even when the commit is broken. Before the final push (Task 11), verify with a **clean** build: `rm -rf apps/web/.next && pnpm build`.
- **Commits** end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; never stage `.claude/` or `.env*`.

**Reference facts (verbatim from recon):**
- `apps/web/src/app/api/chat/start/route.ts`: `const supabase = await supabaseServer(); const { data:{ user } } = await supabase.auth.getUser(); if (!user) return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });` then parses `{advert_id?, peer_id}` and is exported as nested `withRateLimit(withRateLimit(baseHandler, {...}), {...})`.
- `apps/web/src/app/api/adverts/route.ts`: `export async function POST() { const supabase = await supabaseServer(); const { data:{ user } } = await supabase.auth.getUser(); if (!user) return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 }); ... }` (no rate-limit wrapper).
- `/api/me` verified resolution: reads `profiles.verified_phone` and `phones.verified`.
- **Twilio phone OTP (the path this plan uses):** `POST /api/phone/request` — body `{ phone }` (E.164, e.g. `+32…`), auth required, **upserts the `phones` row + creates a `phone_otps` row + sends the Twilio SMS**, returns `{ ok:true, data:{} }` (or `500 SMS_SEND_FAIL` if Twilio send fails, `401 UNAUTH` if not signed in). `POST /api/phone/verify` — body `{ code, phone }`, auth required, HMAC-checks the OTP and on success **sets `phones.verified=true`**, returns `{ ok:true, data:{} }` (errors: `OTP_NOT_FOUND`/`OTP_EXPIRED`/`OTP_INVALID` 400, `OTP_LOCKED` 429). Both are rate-limited. Requires `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM` env in prod.
- Browser client: `import { supabase } from "@/lib/supabaseClient"` (singleton); `supabase.auth.signInWithPassword({ email, password })`.
- `RegisterForm` (`apps/web/src/app/register/RegisterForm.tsx`) is a standalone client component taking `{ initialLocale }`.
- Layout nesting: `<I18nProvider><FavoritesProvider><LikesProvider>{…children}</LikesProvider></FavoritesProvider></I18nProvider>` (`apps/web/src/app/layout.tsx`).
- `AdvertContactPanel` (`apps/web/src/components/AdvertContactPanel.tsx`, client): `startChat` POSTs `/api/chat/start`, and on `!currentUserId` / `response.status===401` does `router.push(loginHref)`.

---

### Task 1: `VERIFICATION_REQUIRED` error code + `requireVerified` server guard

**Files:**
- Modify: `apps/web/src/lib/apiErrors.ts`
- Create: `apps/web/src/lib/auth/requireVerified.ts`
- Test: `apps/web/src/lib/auth/__tests__/requireVerified.test.ts`

**Interfaces:**
- Produces: `ApiErrorCode.VERIFICATION_REQUIRED`. And in `requireVerified.ts`:
  - `isViewerVerified(supabase, userId: string): Promise<boolean>` — true iff `phones.verified === true` OR `profiles.verified_phone === true`. (This is the only export consumed by Tasks 2, 3 and the Phase-2c ad page; do NOT add an unused `requireVerified` wrapper.)

- [ ] **Step 1: Add the error code**

In `apps/web/src/lib/apiErrors.ts`, add to the `ApiErrorCode` enum after `RATE_LIMITED`:
```typescript
  VERIFICATION_REQUIRED = "VERIFICATION_REQUIRED",
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/web/src/lib/auth/__tests__/requireVerified.test.ts
import { describe, it, expect, beforeEach } from "vitest";

const tableData: Record<string, { data: unknown; error: unknown }> = {};
function builder(table: string) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = () => b;
  (b as { maybeSingle: unknown }).maybeSingle = async () => tableData[table] ?? { data: null, error: null };
  return b;
}
const supabase = { from: (t: string) => builder(t) } as never;

const { isViewerVerified } = await import("@/lib/auth/requireVerified");

describe("isViewerVerified", () => {
  beforeEach(() => { tableData.profiles = { data: null, error: null }; tableData.phones = { data: null, error: null }; });

  it("true when phones.verified is true", async () => {
    tableData.phones = { data: { verified: true }, error: null };
    tableData.profiles = { data: { verified_phone: false }, error: null };
    expect(await isViewerVerified(supabase, "u1")).toBe(true);
  });

  it("true when profiles.verified_phone is true even if a stale phones row says false (OR, not ??)", async () => {
    tableData.phones = { data: { verified: false }, error: null };
    tableData.profiles = { data: { verified_phone: true }, error: null };
    expect(await isViewerVerified(supabase, "u1")).toBe(true);
  });

  it("false when neither signal is true", async () => {
    tableData.phones = { data: { verified: false }, error: null };
    tableData.profiles = { data: { verified_phone: false }, error: null };
    expect(await isViewerVerified(supabase, "u1")).toBe(false);
  });

  it("false when both rows are missing", async () => {
    expect(await isViewerVerified(supabase, "u1")).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/lib/auth/__tests__/requireVerified.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```typescript
// apps/web/src/lib/auth/requireVerified.ts
import type { SupabaseClient } from "@supabase/supabase-js";

/** True iff the user's phone is verified by EITHER signal (phones.verified OR profiles.verified_phone).
 *  OR — not ?? — so a stale phones.verified=false row can't mask a verified profile, and vice-versa. */
export async function isViewerVerified(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<boolean> {
  const [profileRes, phoneRes] = await Promise.all([
    supabase.from("profiles").select("verified_phone").eq("id", userId).maybeSingle(),
    supabase.from("phones").select("verified").eq("user_id", userId).maybeSingle(),
  ]);
  const profileVerified = (profileRes.data as { verified_phone?: boolean } | null)?.verified_phone === true;
  const phoneVerified = (phoneRes.data as { verified?: boolean } | null)?.verified === true;
  return profileVerified || phoneVerified;
}
```

(The `403 VERIFICATION_REQUIRED` response itself is built inline by the route handlers in Tasks 2–3, using the `ApiErrorCode.VERIFICATION_REQUIRED` added in Step 1 — there is no `requireVerified` wrapper to keep this minimal and avoid an unused export.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/lib/auth/__tests__/requireVerified.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit** (stage apiErrors.ts + the new auth dir)

```bash
git add apps/web/src/lib/apiErrors.ts apps/web/src/lib/auth
git commit -m "feat(trust): VERIFICATION_REQUIRED + requireVerified server guard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Enforce verification on `POST /api/chat/start`

**Files:**
- Modify: `apps/web/src/app/api/chat/start/route.ts`
- Test: `apps/web/src/app/api/chat/start/__tests__/chat-start-verify.test.ts`

**Interfaces:**
- Consumes: `isViewerVerified` (Task 1). `POST /api/chat/start` now returns `403 VERIFICATION_REQUIRED` when the (authenticated) caller is not phone-verified, BEFORE attempting to start the chat.

- [ ] **Step 1: Read the route** to find the exact auth-check block, then write the failing test

Read `apps/web/src/app/api/chat/start/route.ts`. The base handler already does the `if (!user)` 401. You will insert a verification check immediately after, using `isViewerVerified(supabase, user.id)`.

```typescript
// apps/web/src/app/api/chat/start/__tests__/chat-start-verify.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const isVerifiedMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({ supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: () => ({}) }) }));
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true }),
  withRateLimit: (h: unknown) => h,
}));
vi.mock("@/lib/auth/requireVerified", () => ({ isViewerVerified: (...a: unknown[]) => isVerifiedMock(...(a as [])) }));

const { POST } = await import("../route");

describe("POST /api/chat/start verification gate", () => {
  beforeEach(() => { getUserMock.mockReset(); isVerifiedMock.mockReset(); });

  it("403 VERIFICATION_REQUIRED when signed in but unverified", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    isVerifiedMock.mockResolvedValue(false);
    const res = await POST(new Request("https://x.test/api/chat/start", { method: "POST", body: JSON.stringify({ peer_id: "11111111-1111-4111-8111-111111111111" }) }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
  });

  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(new Request("https://x.test/api/chat/start", { method: "POST", body: JSON.stringify({ peer_id: "11111111-1111-4111-8111-111111111111" }) }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/app/api/chat/start/__tests__/chat-start-verify.test.ts`
Expected: the 403 test FAILS (currently no verification check — it would proceed past auth).

- [ ] **Step 3: Add the verification check**

In `apps/web/src/app/api/chat/start/route.ts`, add the import:
```typescript
import { isViewerVerified } from "@/lib/auth/requireVerified";
```
Immediately after the existing `if (!user) { return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 }); }` block, insert:
```typescript
  if (!(await isViewerVerified(supabase, user.id))) {
    return createErrorResponse(ApiErrorCode.VERIFICATION_REQUIRED, { status: 403, detail: "Phone verification required to contact a seller" });
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/app/api/chat/start/__tests__/chat-start-verify.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/chat/start/route.ts apps/web/src/app/api/chat/start/__tests__/chat-start-verify.test.ts
git commit -m "feat(trust): require phone verification to contact a seller

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Enforce verification on `POST /api/adverts` (publish)

**Files:**
- Modify: `apps/web/src/app/api/adverts/route.ts`
- Test: `apps/web/src/app/api/adverts/__tests__/adverts-verify.test.ts`

**Interfaces:**
- Consumes: `isViewerVerified` (Task 1). `POST /api/adverts` returns `403 VERIFICATION_REQUIRED` for an authenticated-but-unverified caller, after the existing 401 check.

- [ ] **Step 1: Read the route, write the failing test**

Read `apps/web/src/app/api/adverts/route.ts`. The POST starts `const supabase = await supabaseServer(); const { data:{ user } } = await supabase.auth.getUser(); if (!user) return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });`. Insert the verification check after it.

```typescript
// apps/web/src/app/api/adverts/__tests__/adverts-verify.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const isVerifiedMock = vi.fn();
vi.mock("@/lib/supabaseServer", () => ({ supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: () => ({}) }) }));
vi.mock("@/lib/auth/requireVerified", () => ({ isViewerVerified: (...a: unknown[]) => isVerifiedMock(...(a as [])) }));

const { POST } = await import("../route");

describe("POST /api/adverts verification gate", () => {
  beforeEach(() => { getUserMock.mockReset(); isVerifiedMock.mockReset(); });

  it("403 VERIFICATION_REQUIRED when signed in but unverified", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    isVerifiedMock.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
  });

  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST();
    expect(res.status).toBe(401);
  });
});
```

(Note: `POST` takes no args here — call `POST()`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run apps/web/src/app/api/adverts/__tests__/adverts-verify.test.ts`
Expected: 403 test FAILS.

- [ ] **Step 3: Add the verification check**

Add `import { isViewerVerified } from "@/lib/auth/requireVerified";`. After the `if (!user) return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });` line, insert:
```typescript
  if (!(await isViewerVerified(supabase, user.id))) {
    return createErrorResponse(ApiErrorCode.VERIFICATION_REQUIRED, { status: 403, detail: "Phone verification required to publish" });
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run apps/web/src/app/api/adverts/__tests__/adverts-verify.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/adverts/route.ts apps/web/src/app/api/adverts/__tests__/adverts-verify.test.ts
git commit -m "feat(trust): require phone verification to publish a listing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `useViewerTrust` hook (reads `/api/me`)

**Files:**
- Create: `apps/web/src/components/trust/useViewerTrust.ts`
- Test: `apps/web/src/components/trust/__tests__/useViewerTrust.test.ts`

**Interfaces:**
- Produces: `fetchViewerTrust(): Promise<{ signedIn: boolean; verifiedPhone: boolean; userId: string | null }>` — a pure async helper that GETs `/api/me` and normalizes it (`/api/me` returns `{ user, verifiedPhone, ... }`; treat a 401 / missing user as `signedIn:false`). The TrustGate uses this to decide which tier to show.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/components/trust/__tests__/useViewerTrust.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const { fetchViewerTrust } = await import("@/components/trust/useViewerTrust");

describe("fetchViewerTrust", () => {
  beforeEach(() => fetchMock.mockReset());

  it("signed-in + verified", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: "u1" }, verifiedPhone: true }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: true, verifiedPhone: true, userId: "u1" });
  });
  it("signed-in + unverified", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: "u2" }, verifiedPhone: false }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: true, verifiedPhone: false, userId: "u2" });
  });
  it("not signed in (no user)", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: null }) });
    expect(await fetchViewerTrust()).toEqual({ signedIn: false, verifiedPhone: false, userId: null });
  });
  it("network error → not signed in", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await fetchViewerTrust()).toEqual({ signedIn: false, verifiedPhone: false, userId: null });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run apps/web/src/components/trust/__tests__/useViewerTrust.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/components/trust/useViewerTrust.ts
export type ViewerTrust = { signedIn: boolean; verifiedPhone: boolean; userId: string | null };

export async function fetchViewerTrust(): Promise<ViewerTrust> {
  try {
    const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
    if (!res.ok) return { signedIn: false, verifiedPhone: false, userId: null };
    const data = await res.json().catch(() => null);
    const userId = data?.user?.id ?? null;
    if (!userId) return { signedIn: false, verifiedPhone: false, userId: null };
    return { signedIn: true, verifiedPhone: data?.verifiedPhone === true, userId };
  } catch {
    return { signedIn: false, verifiedPhone: false, userId: null };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run apps/web/src/components/trust/__tests__/useViewerTrust.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/trust/useViewerTrust.ts apps/web/src/components/trust/__tests__/useViewerTrust.test.ts
git commit -m "feat(trust): fetchViewerTrust helper (reads /api/me)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `TrustGateLogin` panel (compact email+password + register tab)

**Files:**
- Create: `apps/web/src/components/trust/TrustGateLogin.tsx`
- Modify: `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`

**Interfaces:**
- Consumes: `supabase` browser client (`@/lib/supabaseClient`), `RegisterForm` (`@/app/register/RegisterForm`).
- Produces: `<TrustGateLogin onSignedIn={() => void} locale={Locale} />` — a tabbed panel: "Sign in" (email+password → `supabase.auth.signInWithPassword`; on `data.session` calls `onSignedIn`) and "Create account" (renders `<RegisterForm initialLocale={locale} />`, which sends a confirmation email — show its own UI; account becomes usable after the user confirms + signs in).

- [ ] **Step 1: Create the component** (no unit test — exercised via the gate + live; verified by tsc/build)

```tsx
// apps/web/src/components/trust/TrustGateLogin.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import RegisterForm from "@/app/register/RegisterForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import type { Locale } from "@/lib/i18n";

export default function TrustGateLogin({ onSignedIn, locale }: { onSignedIn: () => void; locale: Locale }) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error || !data.session) {
        toast.error(tr("trust.login_failed", "Sign in failed. Check your email and password."));
        return;
      }
      toast.success(tr("trust.signed_in", "Signed in."));
      onSignedIn();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg bg-muted/50 p-1 text-sm">
        <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "login" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
          {tr("trust.tab_login", "Sign in")}
        </button>
        <button type="button" onClick={() => setMode("register")} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "register" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
          {tr("trust.tab_register", "Create account")}
        </button>
      </div>

      {mode === "login" ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="trust-email">{tr("trust.email", "Email")}</Label>
            <Input id="trust-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trust-password">{tr("trust.password", "Password")}</Label>
            <Input id="trust-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? tr("trust.signing_in", "Signing in…") : tr("trust.tab_login", "Sign in")}
          </Button>
        </form>
      ) : (
        <RegisterForm initialLocale={locale} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the `trust` i18n keys (login subset) to all 5 locales**

Add a `trust` namespace with at least: `tab_login`, `tab_register`, `email`, `password`, `signing_in`, `login_failed`, `signed_in`. (More keys come in Tasks 6 & 8.)

- en: `"trust": { "tab_login": "Sign in", "tab_register": "Create account", "email": "Email", "password": "Password", "signing_in": "Signing in…", "login_failed": "Sign in failed. Check your email and password.", "signed_in": "Signed in." }`
- ru: `"Войти"`, `"Создать аккаунт"`, `"Эл. почта"`, `"Пароль"`, `"Вход…"`, `"Не удалось войти. Проверьте почту и пароль."`, `"Вы вошли."`
- nl: `"Inloggen"`, `"Account aanmaken"`, `"E-mail"`, `"Wachtwoord"`, `"Inloggen…"`, `"Inloggen mislukt. Controleer e-mail en wachtwoord."`, `"Ingelogd."`
- fr: `"Se connecter"`, `"Créer un compte"`, `"E-mail"`, `"Mot de passe"`, `"Connexion…"`, `"Échec de la connexion. Vérifiez l'e-mail et le mot de passe."`, `"Connecté."`
- de: `"Anmelden"`, `"Konto erstellen"`, `"E-Mail"`, `"Passwort"`, `"Anmeldung…"`, `"Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen."`, `"Angemeldet."`

- [ ] **Step 3: Verify i18n + types**

Run: `node scripts/check-i18n-keys.js` → PASS
Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/trust/TrustGateLogin.tsx apps/web/src/i18n/locales
git commit -m "feat(trust): TrustGateLogin panel (login + register tab)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `TrustGatePhone` panel (Supabase-native OTP)

**Files:**
- Create: `apps/web/src/components/trust/TrustGatePhone.tsx`
- Modify: `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`

**Interfaces:**
- Consumes: `apiFetch` (`@/lib/fetcher`) → the proven Twilio endpoints. Produces: `<TrustGatePhone onVerified={() => void} />` — a two-step phone-verify form. Step 1 `POST /api/phone/request { phone }` (sends the Twilio SMS; the endpoint uses the existing session — no `userId` prop needed). Step 2 `POST /api/phone/verify { code, phone }` (sets `phones.verified=true`). Both return `{ ok, data }`; on a successful verify (`response.ok && body.ok`) it calls `onVerified`. The phone must be **E.164** (e.g. `+32…`) — the endpoint's zod schema enforces it; show the `+` hint in the input.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/trust/TrustGatePhone.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";

export default function TrustGatePhone({ onVerified }: { onVerified: () => void }) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!phone.trim().startsWith("+") || phone.trim().length < 8) { toast.error(tr("trust.phone_invalid", "Enter a valid phone number with country code (e.g. +32…).")); return; }
    setPending(true);
    try {
      const res = await apiFetch("/api/phone/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ phone: phone.trim() }),
      });
      const body = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !body?.ok) { toast.error(tr("trust.code_send_error", "Could not send the code.")); return; }
      toast.success(tr("trust.code_sent", "Code sent."));
      setStep("code");
    } catch {
      toast.error(tr("trust.code_send_error", "Could not send the code."));
    } finally {
      setPending(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!code || code.trim().length < 4) { toast.error(tr("trust.code_required", "Enter the SMS code.")); return; }
    setPending(true);
    try {
      const res = await apiFetch("/api/phone/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ code: code.trim(), phone: phone.trim() }),
      });
      const body = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !body?.ok) { toast.error(tr("trust.code_incorrect", "The code is incorrect.")); return; }
      toast.success(tr("trust.phone_verified", "Phone verified."));
      onVerified();
    } catch {
      toast.error(tr("trust.code_incorrect", "The code is incorrect."));
    } finally {
      setPending(false);
    }
  };

  return step === "phone" ? (
    <form onSubmit={sendCode} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="trust-phone">{tr("trust.phone", "Phone number")}</Label>
        <Input id="trust-phone" type="tel" autoComplete="tel" placeholder="+32…" required value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? tr("trust.sending", "Sending…") : tr("trust.send_code", "Send code")}
      </Button>
    </form>
  ) : (
    <form onSubmit={verify} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="trust-code">{tr("trust.code", "SMS code")}</Label>
        <Input id="trust-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? tr("trust.verifying", "Verifying…") : tr("trust.verify", "Verify")}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Add the phone i18n keys to all 5 locales** (inside `trust`)

Keys: `phone`, `phone_invalid`, `send_code`, `sending`, `code_send_error`, `code_sent`, `code`, `code_required`, `verify`, `verifying`, `code_incorrect`, `phone_verified`.
- en: `"phone":"Phone number","phone_invalid":"Enter a valid phone number.","send_code":"Send code","sending":"Sending…","code_send_error":"Could not send the code.","code_sent":"Code sent.","code":"SMS code","code_required":"Enter the SMS code.","verify":"Verify","verifying":"Verifying…","code_incorrect":"The code is incorrect.","phone_verified":"Phone verified."`
- ru: `"Номер телефона","Введите корректный номер.","Отправить код","Отправка…","Не удалось отправить код.","Код отправлен.","Код из SMS","Введите код из SMS.","Подтвердить","Проверка…","Неверный код.","Телефон подтверждён."`
- nl: `"Telefoonnummer","Voer een geldig nummer in.","Code versturen","Versturen…","Kon de code niet versturen.","Code verstuurd.","Sms-code","Voer de sms-code in.","Verifiëren","Verifiëren…","De code is onjuist.","Telefoon geverifieerd."`
- fr: `"Numéro de téléphone","Entrez un numéro valide.","Envoyer le code","Envoi…","Impossible d'envoyer le code.","Code envoyé.","Code SMS","Entrez le code SMS.","Vérifier","Vérification…","Le code est incorrect.","Téléphone vérifié."`
- de: `"Telefonnummer","Gültige Nummer eingeben.","Code senden","Senden…","Code konnte nicht gesendet werden.","Code gesendet.","SMS-Code","SMS-Code eingeben.","Bestätigen","Wird geprüft…","Der Code ist falsch.","Telefon bestätigt."`

- [ ] **Step 3: Verify i18n + types**

Run: `node scripts/check-i18n-keys.js` → PASS; `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/trust/TrustGatePhone.tsx apps/web/src/i18n/locales
git commit -m "feat(trust): TrustGatePhone panel (Supabase-native OTP)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: `TrustGateProvider` + `useTrustGate` + wire into layout

**Files:**
- Create: `apps/web/src/components/trust/TrustGateProvider.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/i18n/locales/{en,ru,nl,fr,de}.json`

**Interfaces:**
- Consumes: `fetchViewerTrust` (Task 4), `TrustGateLogin` (Task 5), `TrustGatePhone` (Task 6), shadcn `Dialog` (`@/components/ui/dialog`), `useI18n` (`locale` from it).
- Produces: `useTrustGate(): { requireTrust(level: "auth" | "verified", run: () => void): Promise<void> }`. `requireTrust` calls `fetchViewerTrust()`; if the tier is already met it runs `run` immediately; otherwise it opens the modal at the right stage (login if not signed in, phone if signed-in-but-unverified), stores `run` as the pending action, and replays it after the stage(s) complete. Mounted once at root via `<TrustGateProvider>`.

- [ ] **Step 1: Create the provider**

```tsx
// apps/web/src/components/trust/TrustGateProvider.tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { fetchViewerTrust } from "@/components/trust/useViewerTrust";
import TrustGateLogin from "@/components/trust/TrustGateLogin";
import TrustGatePhone from "@/components/trust/TrustGatePhone";

type Level = "auth" | "verified";
type Stage = "login" | "phone";
type TrustGateContextValue = { requireTrust: (level: Level, run: () => void) => Promise<void> };

const TrustGateContext = createContext<TrustGateContextValue | null>(null);

export function TrustGateProvider({ children }: { children: ReactNode }) {
  const { t, locale } = useI18n();
  const tr = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("login");
  const [level, setLevel] = useState<Level>("auth");
  const pendingRun = useRef<(() => void) | null>(null);

  const finish = useCallback(() => {
    setOpen(false);
    const run = pendingRun.current;
    pendingRun.current = null;
    if (run) run();
  }, []);

  const requireTrust = useCallback(async (lvl: Level, run: () => void) => {
    const trust = await fetchViewerTrust();
    const met = lvl === "auth" ? trust.signedIn : trust.signedIn && trust.verifiedPhone;
    if (met) { run(); return; }
    pendingRun.current = run;
    setLevel(lvl);
    setStage(trust.signedIn ? "phone" : "login");
    setOpen(true);
  }, []);

  // After sign-in: re-evaluate. If level is "verified" and phone still unverified, advance to phone; else finish.
  const handleSignedIn = useCallback(async () => {
    const trust = await fetchViewerTrust();
    if (level === "verified" && !(trust.signedIn && trust.verifiedPhone)) {
      setStage("phone");
    } else {
      finish();
    }
  }, [level, finish]);

  const value: TrustGateContextValue = { requireTrust };

  return (
    <TrustGateContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {stage === "login" ? tr("trust.gate_title_auth", "Sign in to continue") : tr("trust.gate_title_phone", "Verify your phone")}
            </DialogTitle>
            <DialogDescription>
              {stage === "login"
                ? tr("trust.gate_body_auth", "Create a free account or sign in to continue.")
                : tr("trust.gate_body_phone", "Confirm your phone number to contact sellers and publish listings.")}
            </DialogDescription>
          </DialogHeader>
          {stage === "login" ? (
            <TrustGateLogin locale={locale} onSignedIn={handleSignedIn} />
          ) : (
            <TrustGatePhone onVerified={finish} />
          )}
        </DialogContent>
      </Dialog>
    </TrustGateContext.Provider>
  );
}

export function useTrustGate(): TrustGateContextValue {
  const ctx = useContext(TrustGateContext);
  if (!ctx) throw new Error("useTrustGate must be used within TrustGateProvider");
  return ctx;
}
```

- [ ] **Step 2: Wire into layout** — add inside `<LikesProvider>`:

```tsx
import { TrustGateProvider } from "@/components/trust/TrustGateProvider";
// …
<LikesProvider>
  <TrustGateProvider>
    <TopBar />
    {/* …existing children… */}
  </TrustGateProvider>
</LikesProvider>
```

- [ ] **Step 3: Add the gate-title i18n keys** (inside `trust`, all 5 locales)

Keys: `gate_title_auth`, `gate_body_auth`, `gate_title_phone`, `gate_body_phone`.
- en: `"gate_title_auth":"Sign in to continue","gate_body_auth":"Create a free account or sign in to continue.","gate_title_phone":"Verify your phone","gate_body_phone":"Confirm your phone number to contact sellers and publish listings."`
- ru: `"Войдите, чтобы продолжить","Создайте бесплатный аккаунт или войдите, чтобы продолжить.","Подтвердите телефон","Подтвердите номер телефона, чтобы писать продавцам и публиковать объявления."`
- nl: `"Log in om door te gaan","Maak een gratis account of log in om door te gaan.","Verifieer je telefoon","Bevestig je telefoonnummer om verkopers te contacteren en te plaatsen."`
- fr: `"Connectez-vous pour continuer","Créez un compte gratuit ou connectez-vous pour continuer.","Vérifiez votre téléphone","Confirmez votre numéro pour contacter les vendeurs et publier des annonces."`
- de: `"Zum Fortfahren anmelden","Erstellen Sie ein kostenloses Konto oder melden Sie sich an.","Telefon bestätigen","Bestätigen Sie Ihre Nummer, um Verkäufer zu kontaktieren und zu veröffentlichen."`

- [ ] **Step 4: Verify i18n + types + clean build**

Run: `node scripts/check-i18n-keys.js` → PASS
Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0
Run: `rm -rf apps/web/.next && pnpm build` → exit 0 (the gate is now mounted in the root layout — confirm the whole app still builds clean)

- [ ] **Step 5: Commit** (stage the provider + layout + locales)

```bash
git add apps/web/src/components/trust/TrustGateProvider.tsx apps/web/src/app/layout.tsx apps/web/src/i18n/locales
git commit -m "feat(trust): TrustGateProvider + useTrustGate, mounted in layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Route the contact-seller action through the Trust Gate

**Files:**
- Modify: `apps/web/src/components/AdvertContactPanel.tsx`

**Interfaces:**
- Consumes: `useTrustGate` (Task 7). The "Message seller" button now calls `requireTrust("verified", startChat)` instead of redirecting to `/login` on no-auth; and `startChat` maps a server `403 VERIFICATION_REQUIRED` to re-opening the gate at the verified tier.

This is wiring — verified by tsc/build + the live check (Task 11).

- [ ] **Step 1: Read `AdvertContactPanel.tsx`** then make the edits

Add the import: `import { useTrustGate } from "@/components/trust/TrustGateProvider";` and in the component: `const { requireTrust } = useTrustGate();`.

Replace the current `startChat` entry guard. Currently `startChat` begins with `if (!currentUserId) { router.push(loginHref); return; }`. Change the BUTTON's onClick (the `onClick={startChat}` and the anonymous "Sign in to message" link) so that pressing message always goes through the gate:
- Make a `const onMessage = () => requireTrust("verified", () => { void startChat(); });` and use `onClick={onMessage}` for the message button. Remove the separate "Sign in to message" anonymous branch (the gate handles the anonymous case) — render the message button for everyone except the owner (`isOwnListing`).
- Inside `startChat`, KEEP the existing logic but replace the `if (!currentUserId) router.push(loginHref)` early-return with nothing (the gate guarantees auth+verified before `startChat` runs). Where it currently handles `response.status === 401`, ALSO handle `403`: read the JSON, and if `payload?.error === "VERIFICATION_REQUIRED"`, call `requireTrust("verified", () => void startChat())` (re-open the gate) instead of navigating; on `401` call `requireTrust("verified", () => void startChat())` too. (The gate replays.)

Concretely, the message control becomes (for non-owners):
```tsx
<Button type="button" onClick={() => requireTrust("verified", () => void startChat())} disabled={startingChat} className="h-11 flex-1 text-[15px]">
  {startingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
  {startingChat ? tr("contact.opening", "Opening chat…") : tr("contact.message", "Message seller")}
</Button>
```
and in `startChat`'s response handling:
```tsx
if (response.status === 401 || response.status === 403) {
  requireTrust("verified", () => void startChat());
  return;
}
```
(Remove the now-unused `loginHref` push in `startChat`; the `loginHref` prop may remain for other uses — leave the prop.)

- [ ] **Step 2: Verify types + clean build**

Run: `npx tsc -p apps/web/tsconfig.json --noEmit` → exit 0
Run: `rm -rf apps/web/.next && pnpm build` → exit 0

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AdvertContactPanel.tsx
git commit -m "feat(trust): route Message-seller through the Trust Gate (verified tier)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Full verification + deploy + live check

**Files:** none (verification + release).

- [ ] **Step 1: Clean full gate**

```bash
git status   # MUST be clean — no stray modified/untracked tracked files
node scripts/check-i18n-keys.js
npx tsc -p apps/web/tsconfig.json --noEmit
rm -rf apps/web/.next && pnpm build
pnpm test
```
Expected: `git status` clean, i18n PASS, tsc 0, **clean** build exit 0, all tests green (new: requireVerified, chat-start-verify, adverts-verify, useViewerTrust).

- [ ] **Step 2: Push + deploy + wait Ready** (`git push origin main`; `vercel ls lyvox-frontend` until `Ready`, not `● Error`).

- [ ] **Step 3: Live verification on www.lyvox.be**

```bash
# Contacting a seller requires verification: anonymous → 401; the route enforces it
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.lyvox.be/api/chat/start -H "Content-Type: application/json" -d '{"peer_id":"11111111-1111-4111-8111-111111111111","advert_id":"11111111-1111-4111-8111-111111111111"}'
# Publishing requires verification: anonymous → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.lyvox.be/api/adverts
# A listing page still renders for anonymous viewers (browse stays open)
curl -s -o /dev/null -w "%{http_code}\n" https://www.lyvox.be/
```
Expected: anonymous `POST /api/chat/start` → `401` (a signed-in-but-unverified user gets `403 VERIFICATION_REQUIRED`); anonymous `POST /api/adverts` → `401`; home → `200`.

- [ ] **Step 4: REAL end-to-end OTP check (the dependency the whole phase rests on — do NOT skip)**

The curls above only prove the gate *blocks*; they never complete a verification. The entire phase is dead if the Twilio SMS path doesn't actually deliver. In a browser on www.lyvox.be, signed in as a **phone-unverified** account (e.g. register a fresh test account, confirm email, sign in):
1. Open a listing you don't own → click **"Message seller"** → the Trust Gate opens at the **phone** step (you're signed in but unverified).
2. Enter a real phone number in **E.164** (`+32…`) → "Send code" → **confirm an SMS actually arrives** (this exercises `/api/phone/request` → Twilio). If it returns `SMS_SEND_FAIL`/no SMS, STOP: Twilio is not live in prod — the verified tier cannot be shipped; surface this to the user before relying on it.
3. Enter the code → "Verify" → the gate closes and the **chat opens** (the replay of the gated action now succeeds because the server guard sees `phones.verified=true`).
Also confirm: a signed-**out** user clicking "Message seller" opens the gate at the **login** step first, then advances to phone.

- [ ] **Step 5: Done.** Phase 2c (hide seller identity from unverified viewers) follows as its own plan.

---

## Self-Review

**1. Spec coverage (Phase 2b = the enforcement + gate half of spec Section F):**
- Server `isViewerVerified` (the real source of truth, OR not `??`) + `VERIFICATION_REQUIRED` → Task 1. ✅
- Verified enforcement on contact + publish (403 built inline from `isViewerVerified`) → Tasks 2, 3. ✅
- Trust Gate: auth tier (login + register) → Task 5; verified tier (phone OTP via the **proven Twilio `/api/phone/*` endpoints**, not native OTP — decided after confirming the one verified user came through Twilio + real Twilio creds present) → Task 6; provider/hook + replay + mounted at root → Tasks 4, 7. ✅
- Contact routed through the gate (and 403 mapped to the gate) → Task 8. ✅
- Deferred to **Phase 2c** (correctly out of scope here): hiding seller identity from unverified viewers (needs the same `isViewerVerified` on the server page — built here, reused there). Likes/favorites keep auth-only (not re-gated through the modal in this phase).

**2. Placeholder scan:** No "TBD"/"add error handling" without code. Tasks 2/3/8 say "read the route/component first" because they are precise edits to existing files whose exact surrounding lines the implementer must match — the change itself is fully specified.

**3. Type consistency:** `isViewerVerified`/`requireVerified` (Task 1) consumed in Tasks 2, 3. `VERIFICATION_REQUIRED` consistent (Tasks 1, 2, 3, 8). `fetchViewerTrust`/`ViewerTrust` (Task 4) consumed in Task 7. `requireTrust(level, run)` signature consistent (Tasks 7, 8). `TrustGateLogin`(`onSignedIn`,`locale`) / `TrustGatePhone`(`userId`,`onVerified`) props consistent (Tasks 5, 6, 7).
