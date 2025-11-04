# LyVoX Installation & Operations Guide

## Prerequisites
- Node.js 20+ (see `.nvmrc`).
- pnpm 10.17 (managed via `corepack enable`).
- Supabase CLI (`npm install -g supabase`), configured with project credentials.
- Access to the Supabase project (database + storage) and Twilio account for OTPs.
- Optional: Upstash (or compatible Redis with REST API) for rate limiting.
- Optional: MCP сервисы настроены для работы с Supabase и Vercel (см. `docs/MCP_SERVICES.md`).

## Local Development
1. **Clone repository**
   ```bash
   git clone git@github.com:lyvox/lyvox.git
   cd lyvox
   ```
2. **Install dependencies**
   ```bash
   corepack enable
   pnpm install
   ```
3. **Environment variables**
   - Copy `.env.example` to `.env.local` or export variables in your shell.
   - Ensure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and Twilio credentials are populated before running API routes.
4. **Run Supabase locally (optional)**
   ```bash
   supabase init            # once per machine
   supabase start           # starts Postgres, auth, storage
   supabase db reset        # applies default schema
   psql "$SUPABASE_DB_URL" -f supabase/reports.sql
   ```
5. **Seed taxonomy**
   ```bash
   pnpm exec tsx scripts/seedCategories.ts
   ```
6. **Launch web app**
   ```bash
   pnpm dev                 # runs turborepo -> apps/web dev server on :3000
   ```
7. **Lint & format**
   ```bash
   pnpm lint
   pnpm format
   ```

## Database Migrations
- Place SQL migrations under `supabase/migrations/` (timestamped directories).
- Apply locally via `supabase db push` or manually with `psql`.
- For production, use `supabase db deploy` after testing locally.
- Existing `supabase/reports.sql` should be split into migration files before automation; track follow-up in `docs/TODO.md`.

## Deploying to Vercel
1. Connect the GitHub repository to Vercel.
2. Configure project settings:
   - Framework: Next.js (App Router).
   - Build command: `pnpm turbo run build`.
   - Install command: `pnpm install`.
   - Output directory: `.vercel/output` (default).
3. Populate environment variables (copy from `.env.example`, omit server-only secrets from client scope). Ensure:
   - `SUPABASE_SERVICE_ROLE_KEY` is set in server environment only.
   - Twilio credentials are provided, and Supabase admin accounts have `app_metadata.role = 'admin'`.
   - Upstash Redis variables are added once rate limiting middleware ships.
4. Grant Vercel access to Supabase via service role (use Vercel Encrypted KV or environment secrets).
5. Trigger deployment (push to `main` or create PR).

## Supabase Configuration Checklist
- Enable Row Level Security on all domain tables; apply policies from `docs/requirements.md`.
- Configure Storage bucket `ad-media` with public read and authenticated write policies.
- Create RPC `trust_inc` and triggers by running `supabase/reports.sql` once.
- Apply the new migrations (`supabase/migrations/20251004120000`-`20251004122000`) so `reports`, `trust_score`, triggers, and `trust_inc` are provisioned (`pnpm supabase db push`).
- Deploy and schedule the Supabase Edge Function `maintenance-cleanup` (see `supabase/functions/maintenance-cleanup`) to purge expired OTPs and anonymise audit logs.
## WAF & Zero Trust Checklist
- **Cloudflare:**
  - Enforce HTTPS, HTTP/2, and bot management.
  - Create rules to block high-risk geographies (optional) and rate-limit login/API routes.
  - Enable Turnstile or Managed Challenge on `/api/phone/*` once CAPTCHA UX is defined.
- **Zero Trust:**
  - Require SSO (e.g., Google Workspace) for admin routes in staging via Cloudflare Access.
  - Restrict `/api/reports/*` and `/admin/*` to trusted IP ranges or Access policies.
  - Log all WAF events and export to SIEM (minimum 90-day retention).
- **Secrets hygiene:**
  - Rotate Twilio and Supabase service keys quarterly.
  - Store secrets in Vercel + Supabase secrets managers; disallow `.env` commits via pre-commit hook.

## Operations Runbook
- **Incidents:** escalate Twilio failures or Supabase outages; disable OTP requirement via feature flag (future) if SMS degraded.
- **Backups:** rely on Supabase automated backups; schedule weekly verification restores in staging.
- **Monitoring:** configure Supabase logs + Vercel Analytics; alert on 5xx spikes and OTP error rates.
- **DSAR / GDPR:** follow workflow in `docs/requirements.md` and record completion in `logs` (`action = 'dsar_export'`).

## Useful Commands
| Task | Command |
| --- | --- |
| Start app only | `pnpm --filter web dev` |
| Build production | `pnpm build` |
| Run tests (add when available) | `pnpm test` |
| Seed categories (idempotent) | `pnpm exec tsx scripts/seedCategories.ts` |

Keep this guide updated when deployment tooling, rate limiting, or infrastructure changes.
