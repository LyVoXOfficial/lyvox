# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

LyVoX is a Belgium-focused trust-first C2C/B2C marketplace. Stack: **Next.js 16 (App Router) + React 19 + TypeScript + Supabase (Postgres/Auth/Storage/Edge Functions) + Stripe + Upstash Redis**. pnpm monorepo, deployed on Vercel. Auth is **Supabase Auth + itsme (OIDC)** — never Auth0.

Backlog lives in `docs/MASTER_TODO.md`. Feature specs are in `docs/features/<id>-*.md`. Cross-cutting foundations are in `docs/features/FOUNDATIONS-F1-F14.md`.

## Commands

```bash
pnpm install          # install deps
pnpm dev              # Next.js dev server with Turbopack (runs typegen first via turbo)
pnpm build            # production build
pnpm typecheck        # tsc --noEmit on apps/web
pnpm test             # vitest run (all tests)
pnpm test -- --run apps/web/src/lib/fraud  # run single test directory
pnpm lint             # eslint
pnpm gen:types        # regenerate supabase/types/database.types.ts from linked DB
```

All four checks must stay green before merging: `pnpm typecheck && pnpm test && pnpm lint`.

## Monorepo layout

```
apps/web/          — Next.js app (only app in the monorepo for now)
supabase/
  migrations/      — timestamped SQL migrations (YYYYMMDDHHMMSS_*.sql)
  functions/       — Supabase Edge Functions (ai-moderation, fraud-detection, maintenance-cleanup)
  types/           — auto-generated database.types.ts (never edit by hand)
docs/              — specs, PRDs, audit reports — single source of truth for product
scripts/           — maintenance helpers (monitoring, seeding, checklist)
tests/             — e2e / shared test assets
```

## Architecture — apps/web/src

### Supabase clients — three separate files, never mix

| File | When to use |
|---|---|
| `lib/supabaseClient.ts` | **Browser only** — `createBrowserClient`, singleton, localStorage session |
| `lib/supabaseServer.ts` | **Server Components / API routes** — `createServerClient`, reads/sets cookies |
| `lib/supabaseService.ts` | **Server only, service-role** — bypasses RLS; import is guarded by `"server-only"` |

Always call `supabaseServer()` (async, returns client) in API routes. Use `supabaseService()` only where RLS must be bypassed (e.g., admin, webhook handlers). Never use the browser client in server code.

### API response envelope

All API routes return `{ok: true, data: {...}}` on success or `{ok: false, error: 'CODE', detail?: '...'}` on failure. Use `createSuccessResponse(data)` and `createErrorResponse(ApiErrorCode.*, {status})` from `lib/apiErrors.ts`. Clients must read `body.data.X`, not `body.X`.

### Rate limiting

`lib/rateLimiter.ts` wraps Upstash Redis. Use `createRateLimiter({limit, windowSec, prefix})` to get a function, then wrap handlers with `withRateLimit(handler, {limiter, makeKey})`. **F8 note:** `getClientIp()` currently reads `x-forwarded-for` first — this is being fixed to use the Vercel-trusted header instead (F8 ticket).

### Auth & trust tiers

- `lib/trust/deriveTrust.ts` — `deriveHumanLevel(profile)` → `L0–L4`; `deriveBusinessLevel(business)` → `B0–B1`.
- `lib/auth/requireVerified.ts` — `isViewerVerified(supabase, userId)` — requires phone verification.
- `lib/auth/canSellAsBusiness.ts` — requires L3+ human + B1 business.
- `lib/fraud/checkUserBlocked.ts` — `checkUserBlocked(userId, {failClosed?})`. On high-risk paths (publish, checkout) pass `failClosed: true` so a DB error blocks rather than waves through.

### Capability flags (feature flags)

Capabilities live in `lib/capabilities.ts`. Flip via env var (`CAPABILITY_PRO_SUBSCRIPTIONS=true`, etc.) — no code changes needed. Current gates: `pro_subscriptions`, `stripe_identity`, `itsme`, `whatsapp_otp`, `payments_escrow`.

### i18n

- Five locales: `en`, `fr`, `nl`, `de`, `ru` (all kept at parity — a guard test fails if any key is missing).
- Locale files: `src/i18n/locales/{en,fr,nl,de,ru}.json`.
- Client: `t()` from `react-i18next` — returns the raw key on miss.
- Server: `(key, fallback)` pattern — returns English fallback.
- **Never hardcode UI strings.** All copy goes through `t()`.

### SEO / structured data

JSON-LD generators live in `lib/seo/catalog/` (one file per category domain: `common.ts`, `electronics.ts`, `job.ts`, `property.ts`). They exist but are **not yet wired to ad pages** (tracked as F12). `lib/seo/generateMetadata.ts` and `lib/seo/generateJsonLd.ts` are the entry points.

### Billing (Stripe)

- `lib/stripe/client.ts` — `getStripe()` singleton.
- `lib/billing/` — checkout, products, purchases, subscribe, proStatus, webhook.
- Webhook handler at `app/api/billing/webhook/route.ts` verifies the Stripe signature; **F1** will add an idempotency journal (`webhook_events` table) here.

## Database conventions

- Every new table needs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + at minimum owner-only `SELECT`/`INSERT` policies. Service-role access is server-side only.
- Migrations are timestamped: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Write them idempotently (use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, etc.).
- After schema changes: `pnpm gen:types` to regenerate `supabase/types/database.types.ts`.
- Import DB types via `lib/supabaseTypes.ts` (`Tables<'table_name'>`, `TablesInsert<>`, `TablesUpdate<>`).

## Code navigation via graphify

The codebase has a pre-built knowledge graph at `graphify-out/` (rebuilt automatically after each commit via `.husky/post-commit`).

**Rule: before any broad search or exploration, consult the graph first.**

1. **Orient** — read `graphify-out/wiki/index.md` for a community map of the codebase, then open the relevant community article under `graphify-out/wiki/` to see which files, functions, and god-nodes belong to that cluster.
2. **Query** — use graph commands to navigate:
   - `/graphify query "how does rate limiting work"` — BFS traversal, broad context
   - `/graphify explain "withRateLimit"` — plain-language explanation of a node
   - `/graphify path "AdvertContactPanel" "ChatStartResponse"` — shortest path between two symbols
3. **Drill** — only then open specific files with `Grep`/`Read` to get exact lines and make edits.
4. **Staleness** — the graph is rebuilt on commit. If it diverges from the code (renamed files, new modules), trust the code and suggest `/graphify apps/web/src --update` to refresh.

**God nodes** (most connected — check these first when debugging cross-cutting issues):
consult `graphify-out/GRAPH_REPORT.md` → "God Nodes" section for the current top list.

**Do NOT** run broad `Grep` sweeps across `apps/web/src` before checking the graph; the graph finds clusters, call chains, and bridge nodes that plain text search misses.

## Key blockers / golden rules

- **⛔ No production money-flow code** until F3 (PSD2/AML legal gate) is closed — see `docs/features/escrow-legal-gate.md`. Schema design and provider abstraction are allowed.
- Every feature behind a **capability flag** or feature branch; atomic commits; branch naming `feat/<id>-<slug>`.
- Webhook handlers must be idempotent (F1 target: `INSERT … ON CONFLICT (event_id) DO NOTHING`).
- Money amounts and payout recipients are authorised **server-side** only (F2).
- `itsme_sub` uniqueness enforced at DB-constraint level, not just in code (F10).
