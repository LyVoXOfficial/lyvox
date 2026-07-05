# SEC-ENV — Secret hygiene: restricted keys + rotation procedure

Step 12 of `docs/MASTER_PRODUCTION_TZ.md`. Companion to the automated guards:
- `apps/web/src/lib/security/envHygieneGuard.ts` (+ its vitest guard) — CI fails on a
  `NEXT_PUBLIC_` env var with a secret-shaped name, or a `"use client"` file importing
  `supabaseService`.
- `apps/web/src/lib/env.ts` — `validateEnv()` warns (never hard-fails) when
  `STRIPE_SECRET_KEY` looks like a full-access key instead of a restricted one.
- `.github/workflows/ci.yml` `secrets` job — gitleaks scans every push/PR for committed
  secret values (SEC-DEP, step 11).

This document covers what those guards *cannot* check: the actual permission scope of
live keys held in Vercel, and the procedure to rotate them.

## 1. Stripe — restricted keys

Stripe secret keys come in two shapes:
- `sk_live_…` / `sk_test_…` — full account access (Payouts, Balance, Account settings,
  everything). **Do not use this in production.**
- `rk_live_…` / `rk_test_…` — a **restricted key**, scoped per-resource to None /
  Read / Write. This is what `STRIPE_SECRET_KEY` must be in every environment that can
  reach production data.

### Minimum scopes LyVoX's Stripe usage actually needs

Grep `process.env.STRIPE_SECRET_KEY` usage (`apps/web/src/lib/stripe/client.ts`, consumed by
`app/api/billing/{checkout,subscribe,webhook}/route.ts`) — the app only:
creates Checkout Sessions, creates/reads Subscriptions, creates/reads Customers, and
verifies webhook signatures (which uses `STRIPE_WEBHOOK_SECRET`, not the secret key).

| Resource | Access |
|---|---|
| Checkout Sessions | Write |
| Subscriptions | Write |
| Customers | Write |
| Prices / Products | Read |
| Webhook Endpoints | None (managed via dashboard, not API) |
| Everything else (Payouts, Balance, Account, Payment Links, Radar, Connect, Tax, Issuing, Treasury, Files, Reporting) | **None** |

### Creating the restricted key

1. Stripe Dashboard → Developers → API keys → **Create restricted key**.
2. Set the scopes from the table above; leave every other resource at **None**.
3. Name it descriptively, e.g. `lyvox-prod-web` / `lyvox-preview-web`.
4. Copy the `rk_live_…` (or `rk_test_…` for preview/staging) value — shown once.

## 2. Rotation procedure (any secret)

Applies to `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
`TWILIO_AUTH_TOKEN`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN`, `UPSTASH_REDIS_REST_TOKEN`,
`CRON_SECRET`, `RESEND_API_KEY`/`SENDGRID_API_KEY`.

Trigger rotation on: a scheduled cadence (recommended: every 90 days for Stripe/Supabase),
suspected exposure (accidental log, screen-share, offboarded team member), or a gitleaks
CI hit.

1. **Create the new credential** in the provider's dashboard *without revoking the old
   one yet* (Stripe/Supabase/Twilio all support multiple simultaneous active keys).
2. **Update Vercel env** for every affected environment — Production first, then Preview:
   `vercel env add <KEY> production` (or via the Vercel dashboard → Project → Settings →
   Environment Variables). Never put a secret in `NEXT_PUBLIC_*` (see the automated guard
   in §0) or commit it to `.env.example` (which must stay blank placeholders only).
3. **Redeploy** so the running instance picks up the new value (`vercel --prod` or push to
   `main`; env var changes alone do not hot-reload a running deployment).
4. **Verify live** on `www.lyvox.be` that the surface using the credential still works —
   e.g. after rotating `STRIPE_SECRET_KEY`, exercise a Checkout Session creation
   (`/api/billing/checkout`) and confirm no 500; after rotating `STRIPE_WEBHOOK_SECRET`,
   confirm the next real Stripe webhook event is accepted (Stripe Dashboard → Webhooks →
   delivery log shows 2xx).
5. **Revoke the old credential** at the provider once step 4 is confirmed green.
6. **Log the rotation** — date, credential, reason — as an entry below.

### Rotation log

| Date | Credential | Reason | Verified by |
|---|---|---|---|
| — | — | (no rotations yet — this table starts empty at SEC-ENV ship) | — |

## 3. What CI already catches vs. what it can't

| Risk | Caught by |
|---|---|
| Secret value committed to git (past or present commit) | gitleaks (`secrets` CI job, SEC-DEP) |
| `NEXT_PUBLIC_`-prefixed env var with a secret-shaped name | `envHygieneGuard.ts` (this step) |
| `"use client"` component importing the service-role client | `envHygieneGuard.ts` (this step) — `supabaseService.ts`'s `import "server-only"` also hard-fails the build for this |
| A live Stripe key that is full-access (`sk_live_`) instead of restricted (`rk_live_`) | `validateEnv()` boot warning (this step) — **advisory only**, cannot force a dashboard-side rotation |
| Whether a rotation actually happened / key age | **Nothing automated** — tracked manually via the rotation log above; a future OPS-AUDIT step could alert on key age via provider APIs |
