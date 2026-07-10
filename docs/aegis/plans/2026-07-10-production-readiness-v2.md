# LyVoX Production Readiness V2: implementation plan

Дата: 2026-07-10
Master: [MASTER_PRODUCTION_TZ.md](../../MASTER_PRODUCTION_TZ.md)
Release gates: [RELEASE_GATES.md](../../production/RELEASE_GATES.md)
Capability contract: [CAPABILITY_ACTIVATION_MATRIX.md](../../production/CAPABILITY_ACTIVATION_MATRIX.md)
Agent protocol: [AGENT_EXECUTION_PROTOCOL.md](../../production/AGENT_EXECUTION_PROTOCOL.md)

## Goal

Довести LyVoX до `R0 Technical Ready` до регистрации компании, затем активировать `R1 Contact-only Production` и последующие коммерческие режимы без архитектурной переделки.

Production-complete означает:

- core marketplace доказан E2E и operationally supportable;
- security/reliability/recovery gates зелёные;
- дизайн соответствует каноническому anti-AI contract;
- внешние функции либо `VERIFIED + READY/ON`, либо честно `CODE_COMPLETE + BLOCKED_EXTERNAL`;
- случайное наличие ключа не активирует money/identity;
- ни одна публичная фраза не обещает выключенную возможность.

## Architecture

### Release modes

`R0 Technical Ready
  -> R1 Contact-only Production
  -> R2 Own Revenue
  -> R3 Contracted Integrations
  -> R4 Transactional Marketplace`

### Control plane

`platform.launch_mode

- integration registry
- admin desired state
- secret presence
- legal/company approvals
- provider health
- global/individual kill switch
  = effective capability`

### Evidence plane

`task plan -> atomic implementation -> independent verification
  -> CI/staging evidence on exact SHA -> master status`

## Tech stack

- Next.js 16 App Router, React 19, TypeScript;
- Tailwind CSS 4, Radix primitives, Onest;
- Supabase Postgres/Auth/Storage/Realtime;
- Vercel deployment and cron;
- Upstash Redis/rate limit/config cache;
- Sentry;
- Vitest/Testing Library;
- Playwright to be made a real release gate;
- Stripe/Twilio/Resend/itsme/Bpost/model providers behind adapters.

## Baseline and authority references

Authority order:

1. `AGENTS.md` and `CLAUDE.md` invariants;
2. `docs/MASTER_PRODUCTION_TZ.md` target/status;
3. release/capability/design/agent contracts linked above;
4. `docs/features/*.md` for detailed product behavior;
5. code, migrations and reproducible runtime evidence for current truth;
6. old audits/checklists only as historical discovery material.

Baseline 2026-07-10:

- local typecheck, 974 tests, build and lint complete; 213 lint warnings remain;
- GitHub CI and main protection are release blockers;
- production dependency audit has critical/high advisories;
- CSP is report-only;
- debug/test-auth surfaces are in production build;
- health/E2E/restore proof are absent;
- runtime settings are not wired to production call sites;
- public legal content/claims and email DNS are not release-ready;
- design contract in code contains strong AI-template patterns.

## Compatibility boundary

The plan must preserve:

- existing public route shapes and valid deep links unless a redirect is specified;
- API envelope `{ok:true,data}` / `{ok:false,error}`;
- five-locale key parity and no hardcoded visible copy;
- Supabase client boundaries and RLS-first authorization;
- fixed 13-argument `search_adverts` RPC contract;
- existing contact-only listings/search/chat behavior while control plane is migrated;
- current database rows and user drafts;
- default OFF for every regulated or paid capability;
- no production money movement before F2/F3;
- no secret values in database, client bundle, logs or admin response.

## Requirements-ready check

Ready now:

- R0/R1/R2/R3/R4 boundaries;
- capability state model and admin behavior;
- anti-AI design direction;
- release evidence and agent workflow;
- contact-only core scope.

External but represented as explicit gates:

- operator legal form and registration data;
- final legal/privacy/terms sign-off;
- VAT/accounting interpretation;
- PSD2/AML/provider/NBB conclusion;
- provider contracts, tariffs and production credentials.

These unknowns do not block R0. They block only the capability/release that consumes them.

## Change-necessity check

Each P0 change below closes a measured release blocker. Decorative features, broad rewrites and speculative abstractions are out of scope until R0 gates are green.

## Existence and reuse check

Reuse:

- `platform_settings` and `platformSettings.ts` as the non-secret store/cache;
- `capabilities.ts` identifiers during migration;
- existing Supabase auth, listing, search, chat, moderation and billing tests;
- current semantic tokens/Radix/Onest;
- Sentry, Turnstile, Upstash and VIES integrations;
- Shannon runbook and config;
- existing feature PRDs.

Do not create:

- a second settings database;
- a browser secret manager;
- a second UI component library;
- another master backlog;
- another payment implementation before F3.

## Architecture-integrity check

- One effective capability resolver.
- One canonical Vercel/cron config.
- One admin shell and authorization pattern.
- One release-gate record per release.
- One design contract.
- One source of current status.
- Provider-specific code lives behind typed adapters.
- Public copy reads fact projection, not provider/env directly.

## Risks and retirement plan

| Legacy surface                        | Transition                                          | Retirement condition                      |
| ------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| Sync `isCapabilityEnabled` call sites | Migrate behind effective resolver, add static guard | No production call site remains           |
| Env-only flags                        | Keep as safe default during migration               | Admin/runtime registry verified           |
| Disabled adapter stubs                | Keep explicit unsupported fallback                  | Real adapter contract/sandbox verified    |
| Universal gradient/mesh utilities     | Migrate route verticals                             | No product use; utility removed           |
| Competing docs/checklists             | Add superseded banner/link                          | Repository search finds one status master |
| Stale E2E spec                        | Replace with deterministic harness                  | CI Playwright gate green                  |
| Duplicate Vercel config               | Determine actual project root and keep one          | Staging/prod cron inventory matches       |

## Execution order

P0 tasks are ordered by blast radius and release dependency. Tasks may run in parallel only when file ownership does not overlap.

---

## Task P0-00: consolidate source of truth

Owner: Sol
Verifier: Luna
Depends on: none

Files:

- `README.md`
- `CLAUDE.md`
- `docs/MASTER_PRODUCTION_TZ.md`
- `docs/MASTER_TODO.md`
- `docs/PROJECT_VISION_AND_TZ.md`
- `docs/features/FOUNDATIONS-F1-F14.md`
- old operational/design docs named by the audit

Steps:

1. Declare master as the only target/status source.
2. Reclassify vision as product strategy, MASTER_TODO as legacy PRD catalog, foundations as ticket definitions.
3. Remove duplicate current-order claims and stale status authority.
4. Link subordinate release/capability/design/agent specs.
5. Correct CSP/SEC-DEP/OPS priority contradictions.

Verify:

- repository search has one «single source of truth»;
- all relative links resolve;
- no old checklist is used by README/CLAUDE as current status.

Evidence: documentation diff and link/search output.

## Task P0-01: repair CI and protect main

Owner: Terra
Verifier: Luna
Depends on: P0-00

Files:

- `.github/workflows/ci.yml`
- `.github/dependabot.yml`
- optional `scripts/check-production-audit.mjs`
- GitHub ruleset/branch settings outside repository

Steps:

1. Replace invalid checkout/setup-node SHA with verified current immutable SHA.
2. Pin gitleaks to immutable SHA.
3. Replace audit grep with structured severity/package gate.
4. Add Playwright job when P0-07 lands and migration/security gates as required checks.
5. Make `ci-success` depend on every release job.
6. Configure main ruleset: PR, required checks, no force push.
7. Ensure Vercel production deploy waits for required CI.

Verify:

- intentionally failing PR cannot merge/deploy;
- clean PR runs all jobs and `ci-success`;
- no `uses: ...@v*` mutable action remains.

Evidence: CI URLs and ruleset export/screenshot.

## Task P0-02: eliminate production dependency blockers

Owner: Sonnet
Verifier: Terra + Luna
Depends on: P0-01

Files:

- `package.json`
- `apps/web/package.json`
- `pnpm-lock.yaml`
- affected imports/tests only

Steps:

1. Resolve critical `next-i18next/i18next-fs-backend` chain or remove unused package.
2. Upgrade/override reachable high advisories in Supabase realtime, Sentry/Rollup, ws, minimatch/picomatch/flatted.
3. Prove removed packages are not runtime-required.
4. Add temporary exception records only for unreachable non-critical advisory with owner/expiry.

Verify:

- `pnpm install --frozen-lockfile`;
- focused regressions for affected runtime packages;
- full typecheck/test/lint/build;
- `pnpm audit --prod` meets G2.

Evidence: audit before/after and dependency review.

## Task P0-03: launch mode and money hard-stop

Owner: Terra
Verifier: Fable5 for public surface, Luna for direct API
Depends on: P0-01

Files:

- `apps/web/src/lib/capabilities.ts`
- new `apps/web/src/lib/integrations/types.ts`
- new `apps/web/src/lib/integrations/registry.ts`
- new `apps/web/src/lib/integrations/status.ts`
- `apps/web/src/app/api/billing/checkout/route.ts`
- `apps/web/src/app/api/billing/subscribe/route.ts`
- related billing UI/tests
- migration for `platform.launch_mode`

Steps:

1. Add `contact_only`, `paid_platform_services`, `marketplace_payments`.
2. Separate `paid_boosts` from `boost_ranking`.
3. Make money resolver fail closed on config-store error.
4. Guard every billing/money API before Stripe import/call.
5. Hide/disable corresponding UI from the same public projection.
6. Default production and staging to `contact_only` until explicit gate.

Verify:

- Stripe SDK not called in contact-only with valid-looking live env;
- direct POST returns FEATURE_DISABLED;
- UI CTA absent/disabled with honest explanation;
- emergency off always wins.

Evidence: unit + Playwright + request trace.

## Task P0-04: capability registry and admin control plane

Owner: Terra
Verifier: Sonnet code review, Luna E2E
Depends on: P0-03

Files:

- integration files from P0-03
- `apps/web/src/lib/settings/platformSettings.ts`
- `apps/web/src/lib/env.ts`
- `.env.example`
- new `apps/web/src/lib/integrations/health.ts`
- new `apps/web/src/lib/integrations/publicCapabilities.ts`
- new `apps/web/src/app/admin/layout.tsx`
- new `apps/web/src/app/admin/settings/page.tsx`
- new `apps/web/src/app/api/admin/settings/integrations/**`
- migrations for settings revision, append-only audit, approval records

Steps:

1. Implement complete registry and blocker reason codes.
2. Detect required `all/any` env without returning values.
3. Add legal/company/release/provider health gates.
4. Add optimistic revision and append-only before/after/reason/actor audit.
5. Build dense admin settings UI with MFA/step-up for risky activation.
6. Implement safe smoke actions and emergency off.
7. Complete `.env.example` and env validation for all runtime providers.

Verify:

- registry coverage/static guard;
- non-admin 403, CSRF rejected;
- OFF/missing/legal/provider-down/READY/ON/emergency E2E;
- no secret-like value in response/log/client;
- propagation across instances <= 60s.

Evidence: tests, migration audit, screenshots, staging smoke.

## Task P0-05: migrate all runtime guards and public claims

Owner: Sonnet
Verifier: Terra + Fable5 + Luna
Depends on: P0-04

Files:

- all direct production `isCapabilityEnabled` call sites;
- `apps/web/src/lib/adapters/index.ts`;
- layout, Pro, billing, translation cron, advert translations, discover;
- `apps/web/src/app/register/messages.ts`;
- listing/auth/trust components;
- five locale files when copy changes.

Steps:

1. Replace sync/env checks with effective resolver.
2. Make discover, error tracking, analytics and translations obey declared capability.
3. Prevent disabled stubs from ever reporting implementation ready.
4. Replace static identity/human-support claims with factual copy.
5. Add static guard against direct business call-site env/provider checks.

Verify:

- search finds only allowlisted direct env reads inside registry/adapters;
- all five locales stay equal and encoding guard is zero;
- capability OFF blocks UI and API;
- no generic `Verified` without evidence.

Evidence: guard tests, locale test, product E2E.

## Task P0-06: security truth cleanup

Owner: Terra
Verifier: Luna + adversarial Sonnet
Depends on: P0-01, P0-02

Files:

- `apps/web/src/lib/security/csp.ts`
- `apps/web/src/middleware.ts`
- CSP report route/config
- `apps/web/src/app/(protected)/debug/auth/page.tsx`
- `apps/web/src/app/(protected)/profile/test-auth/page.tsx`
- admin/auth/RLS tests
- `supabase/functions/maintenance-cleanup/**`
- `supabase/config.toml`

Steps:

1. Enforce CSP after reviewing reports; keep safe rollback flag.
2. Remove debug/test-auth from production or require non-production + admin.
3. Protect maintenance cleanup with explicit job auth; remove anonymous service-role reachability.
4. Complete sensitive column grants audit and admin MFA.
5. Verify Turnstile/rate limits fail closed on risk routes.

Verify:

- production-like headers show enforced CSP;
- normal authenticated user cannot reach diagnostics/test enrollment;
- unauthenticated cleanup invocation fails;
- focused security regression suite and live-safe authz audit.

Evidence: request/headers, tests, authz report.

## Task P0-07: real Playwright release harness

Owner: Sonnet
Verifier: Luna
Depends on: P0-03, P0-04

Files:

- `package.json` / `apps/web/package.json`
- `pnpm-lock.yaml`
- new `playwright.config.ts`
- replace `tests/e2e/catalog/catalog-flows.spec.ts`
- new deterministic fixture/seed helpers
- CI workflow

Steps:

1. Install pinned Playwright dependency and browsers in CI.
2. Create isolated test users/data with cleanup.
3. Cover auth, listing, search/detail, chat/report, moderation and capability gates.
4. Add Chromium full suite and Firefox/WebKit critical smoke.
5. Capture trace/screenshot on first failure; quarantine policy cannot hide red tests.

Verify:

- clean local/staging run;
- repeated run has no shared-state flakes;
- one intentional regression makes CI red.

Evidence: Playwright report/trace and CI URL.

## Task P0-08: health, observability and cron control

Owner: Terra
Verifier: Luna
Depends on: P0-04

Files:

- new `apps/web/src/app/api/health/route.ts`
- new private/admin readiness endpoint/page
- `apps/web/src/instrumentation.ts`
- Sentry configs/provider
- `vercel.json` and `apps/web/vercel.json`
- cron routes and tests
- optional migrations for `job_runs`

Steps:

1. Add public liveness without config leakage.
2. Add authenticated readiness with core/optional distinction.
3. Add release tags, PII scrub, error/latency/quota alerts.
4. Determine actual Vercel root; keep one cron config.
5. Inventory saved alerts, VIES, translations, cleanup; add locks/idempotency/last-success.
6. Correct email quiet-hours so deferred means not delivered.

Verify:

- simulated core failure makes readiness red but liveness behavior is defined;
- optional provider failure shows degraded;
- test Sentry/uptime/cron alert reaches owner;
- concurrent cron execution does not duplicate work.

Evidence: admin screenshot, alert receipt, job records.

## Task P0-09: staging, migrations, backups and restore

Owner: Terra
Verifier: Luna
Depends on: P0-01, P0-08

Files:

- new `docs/ops/STAGING.md`
- new `docs/ops/BACKUP_RESTORE.md`
- new `docs/ops/MIGRATION_RELEASE.md`
- staging config/seed helpers
- migrations touched by control plane

Steps:

1. Create isolated staging with synthetic/disposable data and no live outbound effects.
2. Document environment parity and intentional differences.
3. Define RPO/RTO and coverage for DB, Storage and critical config.
4. Restore a backup into isolated environment.
5. Run migrations and G6 smoke against restored data.
6. Rehearse roll-forward/rollback decision.

Verify:

- restoration timestamps and row/object checks;
- staging E2E on restored environment;
- no real email/SMS/payment observed.

Evidence: signed restore drill record and CI/staging URL.

## Task P0-10: production design foundation

Owner: Fable5
Verifier: Luna
Depends on: P0-05, P0-07

Files:

- `apps/web/src/app/globals.css`
- theme provider/root layout
- `apps/web/src/components/ui/**`
- visual fixtures/tests

Steps:

1. Implement token/radius/elevation/type contract without changing business logic.
2. Add real system/persisted/SSR-safe dark mode.
3. Remove universal gradient/mesh/glass utilities from primitives.
4. Standardize buttons, inputs, cards, badges, dialog, table, skeleton and focus.
5. Add reduced-motion and axe/visual harness.

Verify:

- primitives visual diff and axe;
- light/dark no-flash;
- 320px/400% zoom;
- five-locale typography fixtures.

Evidence: baseline/after screenshots and CI artifact.

## Task P0-11: public product-first redesign

Owner: Fable5 + bounded Sonnet slices
Verifier: Luna
Depends on: P0-10

Files:

- home/header/navigation;
- listing card/no-photo;
- search/category/detail;
- auth pages;
- relevant locale files.

Steps:

1. Simplify home to search, real listings, categories, seller CTA and factual safety.
2. Remove three-card, blob, gradient headline, carousel-stack and fake trust patterns.
3. Make listing card product/data first; report/favourite keyboard/touch accessible.
4. Align search/category/detail hierarchy and all states.
5. Unify login/register and remove static unavailable promises.

Verify:

- DESIGN_SYSTEM route matrix at three viewports/two themes;
- axe and keyboard;
- five locale smoke;
- CWV/bundle no regression.

Evidence: visual report, Playwright, Lighthouse/RUM baseline.

## Task P0-12: product and admin flow redesign

Owner: Sonnet for behavior, Fable5 for UI
Verifier: Luna
Depends on: P0-10, P0-04

Files:

- `PostForm.tsx` and catalog form primitives;
- chat/profile/saved/compare/discover;
- admin shell/moderation/reports/settings;
- locale files.

Steps:

1. Fix semantic category selection, field-limit mismatches and draft/error states.
2. Complete chat reconnect/send failure/block/report states.
3. Build dense admin queues/tables/details with partial bulk failure.
4. Remove hover-only actions, nested card stacks and spinner-only pages.
5. Validate mobile safe area and long locale reflow.

Verify:

- product/admin state matrix;
- keyboard/touch/axe;
- Playwright happy + failure paths;
- visual baselines.

Evidence: route report and traces.

## Task P0-13: core product closure

Owner: Sol decomposes; Terra/Sonnet implement
Verifier: Luna
Depends on: P0-07, P0-12

Files:

- exact modules selected from failures in G6 E2E;
- corresponding feature specs/tests only.

Steps:

1. Run G6 end-to-end as buyer, seller, moderator and admin.
2. Convert each failure into a bounded child plan.
3. Fix authorization/data/state before adding new feature scope.
4. Verify account export/delete, notification fallback and abuse handling.
5. Close only with exact journey evidence.

Verify:

- all G6 checklist flows green;
- no manual DB edit needed;
- recovery and permission paths included.

Evidence: role-based Playwright suite and operations rehearsal.

## Task P0-14: legal, privacy, email and support package

Owner: Fable5 for code/copy structure, founder/legal human for approval
Verifier: Luna verifies runtime truth
Depends on: P0-05, P0-08

Files:

- `apps/web/src/lib/legal/entity.ts`
- legal pages and five locales;
- email sender/auth SMTP config;
- new `docs/legal/*` templates;
- support/incident runbooks.

Steps:

1. Create parameterized operator/legal content with approval version/hash.
2. Prepare RoPA, DPIA trigger, DPA register, retention and DSA role templates.
3. Configure inbound routing and outbound domain in non-production where possible.
4. Add bounce/complaint/suppression and verified preference behavior.
5. Define honest moderation/support hours and escalation.
6. Keep R1 blocked while placeholders/draft remain.

Verify:

- no public placeholder when R1;
- MX/SPF/DKIM/DMARC and send/receive/reply;
- consent/preferences/retention tests;
- public copy matches active release.

Evidence: DNS report, mail event IDs, legal approval record.

## Task P0-15: pre-customer security proof

Owner: Sol
Verifier: Luna + human reproduction
Depends on: P0-02, P0-06, P0-09, P0-13

Files:

- `docs/security/shannon-precustomer-runbook.md`
- `security/shannon/lyvox-precustomer.example.yaml`
- security evidence/fixes produced by findings

Steps:

1. Obtain explicit authorization for local/staging disposable target.
2. Complete WSL/runtime setup from runbook.
3. Run Shannon within declared scope, never production.
4. Reproduce findings; fix confirmed critical/high and relevant medium.
5. Rerun focused proof and full regression.

Verify:

- no confirmed exploitable critical/high;
- rejected finding has reproduction evidence;
- target contains no real customer/payment data.

Evidence: sanitized report and remediation links.

## Task P0-16: R0 release rehearsal

Owner: Sol
Verifier: Luna
Depends on: P0-00 through P0-15

Files:

- new `docs/production/evidence/R0-technical-ready.md`
- master status;
- no opportunistic product changes.

Steps:

1. Freeze one candidate SHA.
2. Run all G0-G14 on that SHA.
3. Deploy staging, apply migrations, run smoke/E2E/visual/security.
4. Rehearse rollback and emergency off.
5. Record every remaining external blocker by capability.
6. Mark R0 only after independent PASS.

Verify: complete [RELEASE_GATES.md](../../production/RELEASE_GATES.md).

Evidence: one signed release record with CI/staging/restore/security links.

---

## Task P1-01: production email and OTP adapters

Owner: Terra/Sonnet
Verifier: Luna
Depends on: R0 control plane

Files:

- `apps/web/src/lib/email/sender.ts` and new provider adapters/outbox;
- Twilio direct routes moved behind adapter;
- webhook/retry/bounce tests;
- admin integration status.

Target before company:

- Resend/SendGrid adapter `VERIFIED` in staging where account permits;
- SMS/WhatsApp adapter `CODE_COMPLETE + BLOCKED_EXTERNAL` if contract/number unavailable;
- outbox, idempotency, retry, bounce, complaint and cost caps complete.

## Task P1-02: identity adapters

Owner: Terra
Verifier: Luna + security peer
Depends on: control plane, legal templates

Files:

- typed itsme OIDC, Stripe Identity and optional WhatsApp adapters;
- callback/state/nonce/linking flows;
- DB uniqueness/authorization tests;
- public trust projection.

Target:

- official sandbox contract tests;
- ATO/link collision and replay tests;
- `CODE_COMPLETE + BLOCKED_KEYS/LEGAL` until contracts.

## Task P1-03: own-revenue readiness

Owner: Terra
Verifier: Luna + accounting/legal human
Depends on: R0, P0-03

Files:

- Pro/boost billing, products/prices, webhook journal;
- VAT parameter model and receipts;
- paid ranking disclosure;
- finance reconciliation runbook.

Target:

- Stripe test-mode E2E and deterministic webhook replay;
- live mode impossible before R2 gates;
- first activation needs no code edit.

## Task P1-04: remaining activation-ready integrations

Sol decomposes one provider per plan:

- translation provider with cost/quality sampling;
- AI moderation with human appeal and DPIA/DPA gate;
- Web Push/VAPID lifecycle;
- business/KYBC verification;
- Bpost/PUDO sandbox;
- analytics/consent and operational dashboards.

Each provider needs registry entry, adapter, timeout, typed errors, contract tests, health, admin status, fallback, audit and runbook.

## Task P1-05: transactional architecture without live money

Owner: Sol/Terra
Verifier: security peer + Luna
Depends on: F2 design; F3 remains external

Allowed:

- payment/deal/dispute/delivery state machines;
- server-authorized amounts/recipients;
- deterministic PSP simulator;
- webhook journal/out-of-order tests;
- reconciliation/refund/chargeback runbooks.

Forbidden before F3:

- live payout/escrow provider activation;
- code path that becomes live solely from inserting a key;
- public claim that funds are protected.

Target: `CODE_COMPLETE + BLOCKED_LEGAL`, not `VERIFIED`.

---

## Founder activation after R0

### R1

1. Register/approve operator identity.
2. Finalize legal/privacy/terms and support channels.
3. Upgrade commercial hosting/database plans.
4. Configure DNS/email and production monitoring.
5. Run R1 Go/No-Go and enable contact-only public traffic.

### R2

1. Finish VAT/accounting/price/refund sign-off.
2. Create restricted Stripe production credentials/products/webhooks.
3. Run test/live-safe smoke and canary.
4. Reconcile first real charge manually.

### R3

Activate one contracted provider at a time through its own gate and canary.

### R4

Proceed only after F2/F3 and the full transactional release checklist. Start with capped, manually reviewed pilot.

## Global verification

For every merged task:

- focused tests;
- typecheck;
- lint with no new warning in touched code;
- build when runtime/bundle changes;
- relevant Playwright/visual/axe;
- migration/authz/restore where applicable;
- CI on exact SHA;
- graphify update after code changes;
- evidence and master status in the same commit.

## Final completion criteria

- R0 G0-G14 all PASS.
- R1-R4 external blockers are explicit, not hidden.
- Every capability has implementation/activation state and runbook.
- No false public claim.
- No confirmed exploitable critical/high.
- CI protects production.
- Restore and rollback are proven.
- Design looks like LyVoX product, not a generated landing-page template.
