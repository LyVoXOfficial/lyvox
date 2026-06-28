---
name: shannon
description: "Use when planning or running authorized LyVoX pre-customer security validation with KeygraphHQ Shannon, proof-by-exploitation pentesting, staging/local attack simulation, or release gating before first customers."
---

# Shannon

Use Shannon as a controlled pre-customer security gate for LyVoX-owned local or staging environments.

## When To Use

- The user asks for Shannon, KeygraphHQ/shannon, real attack simulation, proof-by-exploitation, pentesting, red-team style validation, or security gating before first customers.
- The task involves validating auth, authorization, API routes, rate limits, Supabase data isolation, trust tiers, fraud blocking, SSRF, XSS, injection, or payment-adjacent flows.

## Required Project Files

Before taking action, read:

1. `docs/security/shannon-precustomer-runbook.md`
2. `security/shannon/lyvox-precustomer.example.yaml`
3. `AGENTS.md`
4. `CLAUDE.md`

If `graphify-out/graph.json` exists and source navigation is needed, use graphify first for broad navigation.

## Safety Rules

- Run only against LyVoX-owned local or staging targets with explicit authorization.
- Never run Shannon against production, real customer data, real PII, real payment instruments, or live PSP money movement.
- Use disposable seeded data and dedicated test accounts.
- Keep populated credentials in ignored local files such as `security/shannon/lyvox-precustomer.local.yaml`.
- Do not paste secrets from `.env`, `.env.local`, provider config, Shannon workspaces, or reports into chat.
- Stop if the run causes sustained 5xx errors, queue buildup, unexpected outbound calls, rate-limit storms, or mutation outside disposable fixtures.

## Operating Procedure

1. Confirm the target is local or staging and belongs to LyVoX.
2. Verify Docker Desktop with WSL2 backend, a Linux WSL distro, Node.js 18+, and provider credentials.
3. Use `security/shannon/lyvox-precustomer.example.yaml` as the committed baseline.
4. Create a local untracked config only when disposable credentials are available.
5. Run Shannon from WSL, not native Windows PowerShell.
6. Review generated findings, reproduce confirmed issues where practical, create fixes, and rerun affected areas.
7. Do not clear first customer traffic while confirmed critical or high exploitable findings remain open.

## Local Commands

From WSL:

```bash
cd /mnt/c/LyvoxMarketPlace
npx @keygraph/shannon@latest setup
```

For a local app:

```bash
cd /mnt/c/LyvoxMarketPlace
npx @keygraph/shannon@latest start \
  -u http://host.docker.internal:3000 \
  -r /mnt/c/LyvoxMarketPlace \
  -c /mnt/c/LyvoxMarketPlace/security/shannon/lyvox-precustomer.example.yaml \
  -o /mnt/c/LyvoxMarketPlace/security/shannon/reports \
  -w lyvox-precustomer-local
```

For staging, replace the URL with a LyVoX-owned staging URL. Never replace it with production.
