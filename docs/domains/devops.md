last_sync: 2025-10-28

# Operations & DevOps Domain

## Overview
- Captures operational requirements: deployment, security perimeter (Cloudflare), backups, observability, and scheduled jobs.
- Synthesises content from [requirements.md](../requirements.md), [INSTALL.md](../INSTALL.md), and roadmap items in [PLAN.md](../PLAN.md).

## Deployment & Environments
- Hosting: Vercel for Next.js frontend/API (see `docs/INSTALL.md` for setup commands).
- Database/Storage/Auth: Supabase project (Postgres + Storage + Auth). Keep CLI linked (`supabase/config.toml`).
- Package management: pnpm + Turborepo (`pnpm install`, `pnpm dev`, `turbo.json` tasks).

## Security Perimeter
- Cloudflare WAF/Zero Trust (planned rollout):
  - Enforce IP reputation, bot mitigation, and geo restrictions (EU default). Track progress in [PLAN.md](../PLAN.md) section “Production - безопасность и соответствие”.
  - Integrate with Cloudflare Zero Trust for admin interfaces (VPN or device posture policies).
- JWT role enforcement: `public.is_admin()` derived from Supabase JWT `app_metadata.role`; environment variable `SUPABASE_JWT_ADMIN_ROLE` documents mapping.
- Secrets management: `.env.local` for local dev, Vercel project environment variables for production. Never bundle `SUPABASE_SERVICE_ROLE_KEY` client-side.

## Backups & Disaster Recovery
- Supabase automated backups (daily) + optional manual `supabase db dump --linked` per release.
- Storage objects (ad-media) rely on Supabase Storage replication; consider periodic exports to cold storage (TODO).
- Recommend snapshotting `pnpm-lock.yaml` with each release tag to guarantee reproducible installs.

## Observability & Monitoring
- Logging:
  - Application-level logs via `public.logs` (moderation, phone, consent actions) for audit.
  - Platform logs (Vercel, Cloudflare) retain request metadata (ensure minimal PII per requirements).
- Rate limit telemetry: Upstash REST metrics (configure alerts for `otp:*` and `report:*` buckets).
- Future enhancements (see TODOs): integrate Sentry/Logflare for application errors, configure Supabase Alerts for slow queries.

## Scheduled Jobs & Automation
- Edge / cron tasks (per PLAN/TODO):
  - Cleanup expired `phone_otps` and anonymise aged `logs` entries.
  - Maintenance of vehicle seed data (scripts under `/scripts`). Ensure migrations stay canonical.
- Use Supabase Cron or external scheduler (GitHub Actions) to invoke maintenance functions.

## Compliance & Data Residency
- GDPR/DSA obligations summarised in [requirements.md](../requirements.md#privacy--compliance).
- Recupel/WEEE compliance for commercial sellers targeted for March 2025 (see TODO entry).
- DSAR workflow: service-role exports across `profiles`, `phones`, `adverts`, `media`, `reports`, `trust_score`, `logs`.

## Improvements & TODO Links
- TODO.md already tracks WAF configuration, Recupel validation, automated API tests.
- Add follow-up TODO if we adopt new monitoring stack (e.g., “Integrate Sentry for Next.js API routes”).
- Revisit `@supabase/ssr` upgrades per new TODO entry once stable version >0.7.x ships.

## Change Log
- 2025-10-28: Initial consolidation of operational guidance.

---

## 🔗 Related Docs

**Domains:** [adverts.md](./adverts.md)
**Development:** [security-compliance.md](../development/security-compliance.md) • [MASTER_CHECKLIST.md](../development/MASTER_CHECKLIST.md) • [deep-audit-20251108.md](../development/deep-audit-20251108.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)
