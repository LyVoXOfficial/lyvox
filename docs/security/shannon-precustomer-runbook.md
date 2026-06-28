# Shannon Pre-Customer Pentest Runbook

## Purpose

Use Shannon as a controlled proof-by-exploitation security gate before LyVoX receives first customer traffic. Shannon is for authorized local or staging testing only: it analyzes the codebase and exercises a live target, so it can mutate data and trigger real side effects.

## Scope And Authorization

- Run only against LyVoX-owned local development or staging environments.
- Do not run against production, real customer data, real PII, real payment instruments, or live PSP money movement.
- Use disposable seeded data and dedicated test accounts for buyer, seller, business/pro, and admin paths.
- Keep all populated credentials in ignored local files, for example `security/shannon/lyvox-precustomer.local.yaml`.
- Treat findings as evidence to reproduce and fix, not as an automatic release blocker without review.

## Current Local Status

- Shannon source clone: `C:\Users\power\.codex\vendor_imports\KeygraphHQ-shannon`.
- Project graph: `graphify-out/` already exists and should be used for source navigation before broad code searches.
- This Windows host has Docker and Node available, but no usable Ubuntu WSL2 distro is currently installed. Shannon documents Windows support through WSL2, so install a Linux distro before running scans here.

## Prerequisites

- Docker Desktop running with the WSL2 backend enabled.
- Ubuntu 24.04 or another supported Linux distro in WSL2.
- Node.js 18+ inside WSL.
- A supported AI provider credential configured for Shannon. Anthropic is the recommended default in the Shannon docs.
- A local or staging LyVoX target with disposable data.
- Stripe and other external integrations in sandbox/test mode only.

## One-Time Setup

Run from WSL, not native Windows PowerShell:

```bash
cd /mnt/c/LyvoxMarketPlace
npx @keygraph/shannon@latest setup
```

Do not commit generated provider credentials or populated Shannon config files.

## Local Target Run

Start the app in a separate terminal:

```bash
cd /mnt/c/LyvoxMarketPlace
pnpm dev
```

From WSL, Docker containers reach the host app through `host.docker.internal`, not container-local `localhost`:

```bash
cd /mnt/c/LyvoxMarketPlace
npx @keygraph/shannon@latest start \
  -u http://host.docker.internal:3000 \
  -r /mnt/c/LyvoxMarketPlace \
  -c /mnt/c/LyvoxMarketPlace/security/shannon/lyvox-precustomer.example.yaml \
  -o /mnt/c/LyvoxMarketPlace/security/shannon/reports \
  -w lyvox-precustomer-local
```

## Staging Target Run

Use a LyVoX-owned staging URL with disposable data:

```bash
cd /mnt/c/LyvoxMarketPlace
npx @keygraph/shannon@latest start \
  -u https://staging.example.lyvox.invalid \
  -r /mnt/c/LyvoxMarketPlace \
  -c /mnt/c/LyvoxMarketPlace/security/shannon/lyvox-precustomer.example.yaml \
  -o /mnt/c/LyvoxMarketPlace/security/shannon/reports \
  -w lyvox-precustomer-staging
```

Replace the staging URL before use. Do not point this at production.

## Review And Release Gate

After each run:

- Review the generated Shannon report under `security/shannon/reports/` or the Shannon workspace deliverables.
- Reproduce confirmed issues manually where practical.
- Create implementation tasks for confirmed findings.
- Rerun Shannon after fixes for affected areas.
- Do not open first customer traffic while confirmed critical or high exploitable findings remain open.

## Stop Conditions

Stop the run if it creates sustained 5xx errors, queue buildup, unexpected outbound calls, provider rate-limit storms, or data mutation outside disposable fixtures.
