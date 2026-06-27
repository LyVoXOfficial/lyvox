# Anti-Fraud Tier 0 (bots / disposable / velocity) — Build Note

**Status:** Build-ready slice spec. Company-free; ACTIVE. Tier 0 sits ABOVE the deployed Tier 1
(Belgian-mobile + Twilio Lookup line-type). Target surface: **account registration** (`/api/auth/register`),
the cheapest place to stop mass/bot/disposable signups before they ever reach phone verification.

## 0. Decisions
- **Three independent layers, each degrades gracefully:** (A) disposable-email blocklist — needs nothing;
  (B) Cloudflare Turnstile — needs FREE keys (no company); if keys unset, it is a **no-op** (never blocks);
  (C) per-IP velocity limit on register — uses the existing `createRateLimiter`/`withRateLimit` (Upstash).
- **Turnstile is gated by key presence, NOT a capability flag** (it's free + company-free, so it ships
  active the moment the founder pastes keys). If `TURNSTILE_SECRET_KEY` unset → server verify returns
  `{ ok: true, skipped: true }`; if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset → the widget doesn't render and
  no token is required. So dev/unconfigured registration keeps working unchanged.
- **VPN/datacenter IP reputation** (IPQS/Telesign) is **deferred** — those need a paid key; leave a clear
  seam (the register route already has `getClientIp`) but do NOT build it here.

## 1. Pieces

### 1.1 Disposable-email blocklist — `apps/web/src/lib/antifraud/disposableEmail.ts`
- Bundle a static set of known disposable domains (a curated list — either vendor the
  `disposable-email-domains` npm package's JSON array, or commit a `disposable-domains.json` of a few
  hundred common ones: mailinator.com, guerrillamail.com, 10minutemail.com, temp-mail.org, yopmail.com,
  trashmail.com, getnada.com, sharklasers.com, throwawaymail.com, maildrop.cc, etc.). No network call.
- Export `isDisposableEmail(email: string): boolean` — lowercase, take the domain after `@`, membership test.
- Pure + unit-tested.

### 1.2 Turnstile server verify — `apps/web/src/lib/antifraud/turnstile.ts` (server-only)
```ts
export type TurnstileResult = { ok: true; skipped?: boolean } | { ok: false; codes: string[] };
export async function verifyTurnstile(token: string | null | undefined, ip?: string | null): Promise<TurnstileResult>
```
- If `process.env.TURNSTILE_SECRET_KEY` is unset → return `{ ok: true, skipped: true }` (no-op).
- Else if no `token` → `{ ok: false, codes: ["missing-input-response"] }`.
- Else POST `https://challenges.cloudflare.com/turnstile/v0/siteverify` as `application/x-www-form-urlencoded`
  with `secret`, `response: token`, and `remoteip: ip` (if present). 8s AbortController timeout.
  Parse `{ success: boolean, "error-codes": string[] }`. Return `{ ok: success }` (+ codes on failure).
  On network/timeout error → `{ ok: false, codes: ["internal-error"] }` (fail-closed only when a secret
  is configured — i.e., once Turnstile is on, a verify outage blocks; acceptable, registration is not hot-path).
- Unit-tested with mocked fetch (success / fail / missing-token / skipped-when-no-secret / timeout).

### 1.3 New `ApiErrorCode` members (`apps/web/src/lib/apiErrors.ts`)
`DISPOSABLE_EMAIL` (400), `CAPTCHA_REQUIRED` (400), `CAPTCHA_FAILED` (403), `RATE_LIMITED` (reuse existing).

### 1.4 Register route changes — `apps/web/src/app/api/auth/register/route.ts`
Insert AFTER request validation and BEFORE `supabase.auth.signUp`, in this order:
1. **Velocity:** wrap the handler with a per-IP `createRateLimiter` (e.g. 5/min/IP) via `withRateLimit`
   + `getClientIp` (mirror `phone/request/route.ts`). If the route is not currently rate-limited, add it;
   if it is, keep it.
2. **Disposable email:** `if (isDisposableEmail(email)) return createErrorResponse(ApiErrorCode.DISPOSABLE_EMAIL, { status: 400 })`.
3. **Turnstile:** read `turnstileToken` from the request body; `const t = await verifyTurnstile(turnstileToken, getClientIp(req))`;
   if `!t.ok` → `createErrorResponse(ApiErrorCode.CAPTCHA_FAILED, { status: 403, detail: t.codes?.join(",") })`.
   (When no secret is configured, `verifyTurnstile` returns ok+skipped, so this never blocks.)
- The register validation schema must accept an optional `turnstileToken: string`.

### 1.5 RegisterForm — `apps/web/src/app/register/RegisterForm.tsx`
- Render the Cloudflare Turnstile widget ONLY when `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set
  (so unconfigured envs are unchanged). Use the official script (`https://challenges.cloudflare.com/turnstile/v0/api.js`)
  loaded via `next/script`, an explicit-render or implicit `<div class="cf-turnstile" data-sitekey=…>` with a
  callback that stores the token in form state; include `turnstileToken` in the submit body.
- On the new error codes from the API, surface localized messages: `DISPOSABLE_EMAIL` → "Please use a
  non-disposable email address."; `CAPTCHA_FAILED`/`CAPTCHA_REQUIRED` → "Please complete the verification."
- Add the i18n keys to ALL 5 locales (guard test must pass).

## 2. Task breakdown (dependency order, TDD)
- **T1** `lib/antifraud/disposableEmail.ts` + bundled list + unit tests; add `DISPOSABLE_EMAIL` ApiErrorCode.
- **T2** `lib/antifraud/turnstile.ts` `verifyTurnstile` (mock-fetch tests incl. skipped-when-no-secret) + `CAPTCHA_*` codes.
- **T3** Register route: add per-IP rate-limit + disposable-email block + Turnstile verify; extend the register
  zod schema with optional `turnstileToken`; update/add the register-route test (disposable→400; captcha skipped
  when no secret → still works; captcha fail → 403; happy path unchanged).
- **T4** RegisterForm: conditional Turnstile widget + token in submit + error-code messages + i18n ×5.
- **T5** final review + deploy + prod verify (register still works with Turnstile OFF; disposable domain → 400).

## 3. Open / founder follow-ups
- Set FREE Cloudflare Turnstile keys (`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) in Vercel to
  ACTIVATE bot protection (until then it's a no-op — registration unaffected).
- VPN/datacenter IP reputation (IPQS/Telesign) deferred (paid key) — the `getClientIp` seam is in place.
