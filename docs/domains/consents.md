last_sync: 2025-10-28

# Consents & GDPR Domain

## Overview
- Records user consent snapshots for terms, privacy, and marketing communication.
- Stored as JSON in `public.profiles.consents`, audited via `public.logs`.
- Aligns with GDPR/DSAR commitments outlined in [requirements.md](../requirements.md#privacy--compliance).
- Related docs: [domains/profile.md](./profile.md), [API_REFERENCE.md](../API_REFERENCE.md), [requirements.md](../requirements.md).

## Data Model
- `profiles.consents jsonb` structure (see `apps/web/src/lib/consents.ts`):
  - Keys: `terms`, `privacy`, `marketing` — each contains `{ accepted: boolean, version: string, accepted_at: string }`.
  - Schema evolution handled by `coerceConsentSnapshot` to backfill defaults.
- `public.logs` entries capture consent actions (`consent_update`, `consent_accept`).
- No dedicated table beyond `profiles`; history maintained in logs.

## API Surface
- `GET /api/profile/consents` — returns current snapshot + chronological log (optionally downloadable via `?format=download`).
- `POST /api/profile/consents` — toggles marketing opt-in/out, updates snapshot, appends audit entry through service-role client.
- `/api/me` also exposes `consents` field for SSR consumers.

## RLS & Security
- `public.profiles` RLS grants owners full control; admin override via `public.is_admin()` (see `20251005191500_enable_rls_and_policies.sql`).
- Logs readable only by admins/service role; inserts limited to the acting user (ensures tamper evidence).
- API endpoints rely on `supabaseServer()` (anon key + cookies) and escalate to service role for log writes.

## Rate Limiting
- No explicit rate limiting applied to consent updates (low-risk). Consider introducing if abuse detected.
- Logs provide traceability for audit/compliance reviews.

## Integrations & Dependencies
- Email platform integrations (future) should consume marketing opt-in from this snapshot.
- DSAR export pipeline uses service role to fetch both `profiles.consents` and audit logs.
- Onboarding flow ensures `terms` and `privacy` entries are recorded before enabling critical features (see `docs/ONBOARDING_REQUIREMENTS.md`).

## Improvements & TODO Links
- Ensure consent versions bump when legal text changes (add runbook entry).
- Expand automated tests covering download/export format (ties into TODO “expand automated API tests”).
- Consider storing consent schema version constants in a shared config to prevent drift between frontend and backend.

## Change Log
- 2025-10-28: Established dedicated consent documentation referencing existing API flows.

---

## 🔗 Related Docs

**Domains:** [profile.md](./profile.md) • [deals.md](./deals.md) • [trust_score.md](./trust_score.md) • [chat.md](./chat.md)
**Development:** [security-compliance.md](../development/security-compliance.md)
