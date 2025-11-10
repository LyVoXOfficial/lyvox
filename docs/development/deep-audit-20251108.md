# Deep Audit Report — 2025-11-08

## 1. Engagement Overview

- **Scope:** End-to-end audit across all phases (`Phase 0` Foundation → `Phase 6` Production Readiness) as documented in `docs/development/MASTER_CHECKLIST.md` and `docs/PLAN.md`.
- **Stakeholders:** LyVoX Core PM (product scope), Lead Backend Engineer (Supabase & API), Lead Frontend Engineer (Next.js UI), Security & Compliance Officer (GDPR/DSA), Operations Lead (monitoring & runbooks).
- **Primary Artifacts Reviewed:** `supabase/migrations/**`, `supabase/config.toml`, `apps/web/src/**`, documentation under `docs/development/**` and `docs/domains/**`, architectural references (`docs/ARCHITECTURE.md`, `docs/requirements.md`), and runtime configuration (`apps/web/src/lib/**`, `apps/web/src/app/api/**`).
- **Methodology:** Document cross-check, targeted code inspection, configuration review, and gap analysis against checklist acceptance criteria. Severity is rated High/Medium/Low; effort estimates are S (≤1d), M (≤3d), L (>3d).

## 2. Summary of Findings

- Public RLS policy on `profiles` grants full-table read access, exposing phone/consent data (Phase 0, High).
- Search and advert experiences make dozens of serial media/signing requests, lacking batching and causing heavy load (Phase 1, High).
- MFA flows are incomplete: TOTP disabled in config and login lacks `mfa.challenge` handling, while WebAuthn routes hit unsupported Supabase APIs (Phase 2–3, High).
- Phase 4–5 initiatives (chat, billing, notifications, AI moderation, fraud, Itsme) remain unimplemented beyond documentation.
- Monitoring and automated testing are minimal, leaving no production observability or regression safety net (Phase 6, Medium).

## 3. Recommendations & Next Actions

- Lock down `public.profiles` access via security barrier view + policy rewrite, then validate anon client access.
- Refactor media delivery to return signed URLs in search/advert RPCs, eliminating N+1 `/api/media/public` calls; drop verbose console logging.
- Turn on TOTP in Supabase config, add MFA challenge UX, and gate WebAuthn routes behind feature flags until provider support is confirmed.
- Schedule dedicated epics for chat, billing, notifications, AI moderation, fraud, and Itsme—each needs migrations, APIs, and UI baselines.
- Wire Sentry (or equivalent), add Supabase health checks, and expand unit/E2E coverage for core flows; integrate into CI.

## 4. Phase 0 – Foundation Audit

- **High – RLS exposes private profile data.** Current policy `Public read profile public fields` allows unrestricted `SELECT` over `public.profiles`, relying on API filtering, which fails if a malicious client queries PostgREST directly. This jeopardizes GDPR compliance for phone/consent metadata.

```56:118:supabase/migrations/20251102034546_mvp_rls_complete.sql
drop policy if exists "Public read profile public fields" on public.profiles;
create policy "Public read profile public fields" on public.profiles
  for select using (true); -- All users can read, but API should filter fields
```

- **Action:** Replace with column-limited view or tighten policy (e.g., restrict to public fields via security barrier view). Test access with anon key before rollout. _Effort: M._

- **Medium – Generated Supabase types missing.** `supabase/types/database.types.ts` contains only a CLI warning, so all `TablesInsert` usages fallback to `any`, undermining type safety for migrations/API.

```1:2:supabase/types/database.types.ts
Need to install the following packages:
supabase@2.54.11
```

- **Action:** Re-run `supabase gen types typescript --local` post-migrations, commit generated file, and wire into `package.json` script for CI. _Effort: S._

- **Medium – Rate limiting silently disables without Upstash env.** `createRateLimiter` returns a permissive stub when Redis vars unset; only console warning emitted. Production misconfigurations would go undetected, nullifying throttling guarantees.

```49:78:apps/web/src/lib/rateLimiter.ts
if (!redisClient) {
  disabledLogger();
  return async () => ({
    success: true,
    limit,
    remaining: limit,
    reset: Math.floor(Date.now() / 1000) + windowSec,
    retryAfterSec: 0,
  });
}
```

- **Action:** Add health check (on boot) that surfaces disabled limiter via metrics/monitoring and optionally hard-fail sensitive endpoints (OTP/report) if env misconfigured. _Effort: M._

- **Low – PostGIS dependency not documented.** `search_adverts` gracefully degrades but relies on PostGIS for radius queries; deployment playbook lacks explicit instruction.
  - **Action:** Update `docs/development/database-schema.md` and infra checklist to mandate PostGIS enablement or feature toggle. _Effort: S._

## 5. Phase 1 – Core MVP Audit

- **High – Search page triggers N× media RPC storm.** `/search` fetches results via `/api/search`, then issues up to 24 additional `/api/media/public` calls, each spawning storage signed URLs with service role, adding 2× Supabase traffic per query and leaking noisy console logs.

```119:190:apps/web/src/app/search/page.tsx
const mediaPromises = ids.slice(0, 24).map(async (id) => {
  const mediaResponse = await fetch(`/api/media/public?advertId=${id}`);
  ...
});
```

```47:111:apps/web/src/app/api/media/public/route.ts
const storage = supabaseService().storage.from("ad-media");
const items =
  records?.map(async (record) => {
    ...
    const { data, error } = await storage.createSignedUrl(path, SIGNED_DOWNLOAD_TTL_SECONDS);
```

- **Action:** Extend `search_adverts` (or a view) to surface leading media URL(s) and pre-signed paths in one query; alternatively add bulk media endpoint that batches IDs. Remove per-request logging. _Effort: L._

- **Medium – Header auth polling is overly aggressive.** `MainHeader` polls Supabase every 5 seconds, adds multiple visibility listeners, and writes to console on each auth event, impacting battery and triggering noisy logs.

```37:101:apps/web/src/components/main-header.tsx
const intervalId = setInterval(checkSession, 5000);
...
console.log("Header: User check:", hasUser, user?.email);
```

- **Action:** Rely on `supabase.auth.onAuthStateChange` + fetch-on-focus without interval, promote to shared session hook, and strip debug logging. _Effort: M._

- **Medium – Home hero still creates per-image signed URLs server-side.** `getFreeAds`/`getLatestAds` call `storage.createSignedUrl` for every media record on each request, creating 34+ service calls even when cached.

```61:156:apps/web/src/app/page.tsx
const { data, error } = await storage.createSignedUrl(url, SIGNED_DOWNLOAD_TTL_SECONDS);
```

- **Action:** Precompute public CDN paths (e.g., moving media to public bucket or caching signed URLs in column) or batch via new RPC returning signed URLs. _Effort: M._

- **Low – Media public endpoint misuses error helper.** `createErrorResponse` call passes `message` (ignored), so clients receive generic errors without detail when advert inactive.

```39:44:apps/web/src/app/api/media/public/route.ts
return createErrorResponse(ApiErrorCode.FORBIDDEN, {
  status: 403,
  message: "Media is only available for active adverts"
});
```

- **Action:** Rename to `detail` or centralize error mapping. _Effort: S._

## 6. Phase 2 – Dependent Features Audit

- **High – TOTP MFA disabled in runtime config.** `supabase/config.toml` keeps `[auth.mfa.totp]` `enroll_enabled = false`, yet UI relies on `supabase.auth.mfa.enroll({ factorType: "totp" })`, causing runtime enrol failures in production.

```245:254:supabase/config.toml
[auth.mfa.totp]
enroll_enabled = false
verify_enabled = false
```

- **Action:** Toggle TOTP in Supabase project settings (or via CLI), confirm via dashboard, and add CI smoke test hitting `/api/auth/totp` happy path. _Effort: S._

- **Medium – WebAuthn APIs exposed despite provider unavailability.** `/api/auth/webauthn/*` directly calls `supabase.auth.mfa.enroll({ factorType: "webauthn" })`. Per `docs/supabase-webauthn-enable.md`, Supabase rejects these on current plan, so endpoints surface 500s.

```72:83:apps/web/src/app/api/auth/webauthn/enroll/route.ts
const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
  factorType: "webauthn",
  friendlyName,
});
```

- **Action:** Gate routes behind feature flag (`SUPABASE_WEB_AUTHN_ENABLED`), return 409 with UX guidance when disabled, and suppress menu entry until plan upgrade. _Effort: M._

- **High – Advert detail page still client-only with verbose Supabase chatter.** `/app/ad/[id]/page.tsx` is marked `"use client"`, does 10+ sequential `supabase.from` calls from the browser, and dumps raw `console.log` output. Tasks `UI-016..UI-020` remain unimplemented (no `AdvertGallery`, `AdvertDetails`, `SellerCard`, similar ads).

```1:210:apps/web/src/app/ad/[id]/page.tsx
"use client";
...
const advertResponse = await apiFetch(`/api/adverts/${id}`);
console.log(`API response for advert ${id}:`, { status: advertResponse.status, ok: advertResponse.ok });
...
const { data: makeData } = await supabase.from("vehicle_makes").select(...);
```

- **Action:** Rebuild advert page as SSR route handler that preloads advert, media, seller data via single RPC/view, and encapsulate gallery/details/seller into dedicated components per checklist. Remove logging and anonymous Supabase fan-out. _Effort: L._

- **Medium – Post form lacks draft autosave + status indicator.** `PostForm` tracks `draftCreationInProgress` but never persists drafts; users lose progress on navigation.
  - **Action:** Implement debounced draft mutation hitting `/api/adverts/draft` per UI-014 spec, surface `Saving…/Saved` banner, and add integration test to guard. _Effort: M._

## 7. Phase 3 – Advanced Auth & UX Audit

- **High – TOTP-required login flow missing challenge handling.** Password tab simply calls `supabase.auth.signInWithPassword` and expects `data.session`; it never inspects `data?.session.expires_at` or engages `supabase.auth.mfa.challenge`, so users with TOTP enabled receive a 400/`mfa_required` error with no prompt.

```73:108:apps/web/src/app/login/page.tsx
const { data, error } = await supabase.auth.signInWithPassword({
  email: validationResult.data.email,
  password,
});
...
} else if (data.session) {
  toast.success("Вход выполнен успешно");
  router.push(next);
}
```

- **Action:** Detect `error?.status === 400 && error.message.includes('MFA')`, fetch factors via `supabase.auth.mfa.listFactors`, launch TOTP code modal, and call `mfa.verify`. Add e2e coverage. _Effort: M._

- **Medium – Security settings session list fakes device data.** `SessionCard` derives browser/OS from the _current_ `navigator.userAgent` for every session instead of stored metadata, mislabeling other sessions and undermining revoke decisions.
  - **Action:** Persist user agent + geo info when issuing sessions (e.g., write to `logs` table) and render from server-sourced metadata. _Effort: M._

## 8. Phase 4 – Chat, Billing, Notifications Audit

- **High – Realtime chat stack not yet started.** No chat migrations (`conversations`, `messages`), no `/api/chat/*` routes, and no UI components (`ChatWindow`, `MessageList`, etc.) exist; only architecture docs are present.
  - **Action:** Prioritise database migration package (tables + RLS), generate Supabase types, and deliver minimal API send/history endpoints before wiring UI. _Effort: L._

- **High – Billing/boosting infrastructure absent.** Tables (`products`, `purchases`, `benefits`), Stripe integration endpoints, and UI (`BoostDialog`, `BillingPage`) are not present; environment variables for Stripe also missing.
  - **Action:** Decide on provider (Stripe vs Mollie), scaffold migrations, add secrets management, and provide checkout/webhook handlers with idempotency. _Effort: L._

- **Medium – Notification engine still theoretical.** No `notifications` table, API, or template set; `NotificationCenter` component missing.
  - **Action:** Implement schema + policies, create `lib/email` templates, add queue/backoff plan, and surface unread badge in header. _Effort: L._

## 9. Phase 5 – AI, Fraud, Itsme Audit

- **High – AI moderation edge pipeline missing.** No Supabase Edge function (`supabase/functions/ai-moderation`), DB fields (`ai_moderation_score`, `moderation_logs`), or API endpoints exist.
  - **Action:** Decide on OpenAI vs in-house model, scaffold moderation tables, and provide manual override flow tied to admin UI. _Effort: L._

- **Medium – Fraud detection tooling not implemented.** Tables (`fraud_rules`, account flags) and automation cron job absent; only `reports` table tracks manual fraud reasons.
  - **Action:** Create fraud rules schema with evaluation function, integrate with logs, and ensure trust_score updates accordingly. _Effort: M._

- **Medium – Itsme OAuth integration not initiated.** No `/api/auth/itsme/*` routes, profile fields, or configuration present.
  - **Action:** Obtain Itsme credentials, add profile columns (`itsme_verified`, `itsme_kyc_level`), handle callback flow, and update compliance docs. _Effort: M._

## 10. Phase 6 – Production Readiness Audit

- **Medium – Monitoring hooks unimplemented.** `errorLogger.sendToMonitoring` is a stub; no Sentry/LogRocket wiring or Supabase log forwarding exists, so production incidents wouldn’t page anyone.

```170:189:apps/web/src/lib/errorLogger.ts
  private sendToMonitoring(...) {
    // TODO: Implement actual monitoring integration
  }
```

- **Action:** Integrate Sentry (browser + server), configure DSN via env, and map logger levels to `captureException`. _Effort: M._

- **Medium – Automated test coverage sparse.** Only 3 unit tests (`api/catalog`, `auth/register`, `apiErrors`) and a single Playwright spec; critical flows (search, posting, verification) lack regression safety net.
  - **Action:** Establish Jest/Vitest suites per API module, expand Playwright smoke (login, post advert, verify phone), and run in CI. _Effort: M._

- **Low – Supabase/Vercel health not monitored.** No scripts or docs for checking Supabase resource usage (connection counts, rate limits) or Vercel deployment status beyond manual MCP usage.
  - **Action:** Automate `supabase db diff` + metrics check in weekly runbook, and document Vercel deployment verification steps. _Effort: S._

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [security-compliance.md](./security-compliance.md) • [database-schema.md](./database-schema.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)
**Core:** [API_REFERENCE.md](../API_REFERENCE.md)
