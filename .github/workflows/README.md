# LyVoX CI/CD workflows

Current release requirements are defined only in [`docs/MASTER_PRODUCTION_TZ.md`](../../docs/MASTER_PRODUCTION_TZ.md) and [`docs/production/RELEASE_GATES.md`](../../docs/production/RELEASE_GATES.md). This README describes workflow files; it is not a status tracker.

## CI

[`ci.yml`](ci.yml) is expected to run on pushes and pull requests for protected branches.

Required job families:

- lint and TypeScript;
- production build and bundle budget;
- i18n key parity;
- unit/integration tests;
- structured production and complete workspace dependency audits;
- secret scanning;
- Playwright critical journeys once the P0 E2E harness lands;
- one summary job required by branch protection.

Every third-party action must use a verified immutable commit SHA. A green local run does not replace green CI on the exact release commit.

## Local checks

Run relevant focused tests while implementing. Before merge, the repository gates must be green:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
node scripts/check-i18n-keys.js
```

Do not add a second checklist workflow or progress tracker beside `docs/MASTER_PRODUCTION_TZ.md`.

## Secrets

CI/build secrets are configured in GitHub/Vercel secret stores. Never paste values into this file, workflow logs, repository variables intended for client code, or documentation.

CI build jobs use non-secret placeholders and must never read Production credentials.

[`deploy-production.yml`](deploy-production.yml) is the only repository-controlled Production path. It runs only after a successful canonical `CI` push run on `main`. A dependency-free Node script verifies the workflow, GitHub Actions app id and current SHA; validates the linked Vercel project; builds that exact SHA as staged Production; rechecks CI and Production-target drift; then promotes through the Vercel REST API. The Git integration for `main` is disabled in `apps/web/vercel.json`.

Activation requires these GitHub `Production` environment secrets:

- `VERCEL_TOKEN`;
- `VERCEL_ORG_ID`;
- `VERCEL_PROJECT_ID`.

The Vercel project must also keep these fail-closed settings:

- Git link `LyVoXOfficial/lyvox`, Production Branch `main`;
- Root Directory `apps/web`, Framework `Next.js`, Node.js `24.x`, без custom Build/Install/Output overrides;
- Ignored Build Step disabled;
- Settings → Environments → Production → Branch Tracking → **Auto-assign Custom Production Domains OFF**.

The last setting is required for staged→promote. Secrets alone are intentionally insufficient.

There is intentionally no manual arbitrary-SHA dispatch. Re-run the original verified workflow when a safe retry is needed.

Runtime/provider secrets are governed by [`docs/production/CAPABILITY_ACTIVATION_MATRIX.md`](../../docs/production/CAPABILITY_ACTIVATION_MATRIX.md).

## Release governance

- `main` must require all release checks and disallow force-push.
- Production deployment must not bypass red CI.
- E2E, staging, restore, security and rollback evidence are independent gates.
- Workflow success is not permission to enable a paid, identity or regulated capability.

Evidence and remaining blockers for this workflow are recorded in [`P0-01.md`](../../docs/production/evidence/P0-01.md), never in this descriptive README.
