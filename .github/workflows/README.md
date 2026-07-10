# LyVoX CI/CD workflows

Current release requirements are defined only in [`docs/MASTER_PRODUCTION_TZ.md`](../../docs/MASTER_PRODUCTION_TZ.md) and [`docs/production/RELEASE_GATES.md`](../../docs/production/RELEASE_GATES.md). This README describes workflow files; it is not a status tracker.

## CI

[`ci.yml`](ci.yml) is expected to run on pushes and pull requests for protected branches.

Required job families:

- lint and TypeScript;
- production build and bundle budget;
- i18n key parity;
- unit/integration tests;
- structured production dependency audit;
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

Do not run the retired `checklist:update` workflow and do not modify `docs/development/MASTER_CHECKLIST.md` as a current tracker.

## Secrets

CI/build secrets are configured in GitHub/Vercel secret stores. Never paste values into this file, workflow logs, repository variables intended for client code, or documentation.

At minimum, current build jobs may require:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Runtime/provider secrets are governed by [`docs/production/CAPABILITY_ACTIVATION_MATRIX.md`](../../docs/production/CAPABILITY_ACTIVATION_MATRIX.md).

## Release governance

- `main` must require all release checks and disallow force-push.
- Production deployment must not bypass red CI.
- E2E, staging, restore, security and rollback evidence are independent gates.
- Workflow success is not permission to enable a paid, identity or regulated capability.

The baseline audit dated 2026-07-10 found invalid pinned SHAs and a mutable gitleaks tag in `ci.yml`; fixing and proving those checks is task `P0-01`, not a completed state described by this README.
