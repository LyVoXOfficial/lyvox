last_sync: 2025-10-28

# Moderation & Reports Domain

## Overview
- Provides abuse reporting, complaint triage, and escalation tooling for marketplace listings.
- Interacts with `public.reports`, `public.logs`, and `public.trust_score` to store outcomes and reputation adjustments.
- Admin workflows run through server-side Supabase client (`supabaseService()`) backed by service-role credentials.
- Related docs: [domains/adverts.md](./adverts.md), [domains/trust_score.md](./trust_score.md), [requirements.md](../requirements.md), [API_REFERENCE.md](../API_REFERENCE.md).

## Data Model
- `public.reports`:
  - Columns: `id bigint`, `advert_id uuid`, `reporter uuid`, `reason text`, `details text`, `status text` (`pending`, `accepted`, `rejected`), `reviewed_by uuid`, `created_at`, `updated_at`.
  - FK: `advert_id` → `public.adverts.id`; reporter/reviewer reference `auth.users.id`.
- `public.trust_score`: trust ledger keyed by `user_id uuid`, `score int`, `created_at`, `updated_at`.
- `public.logs`: audit stream for moderation events (`report_create`, `report_update`, admin denials, rate-limit hits).
- Relationships:
  - Reports to adverts (1:n), enabling owners to monitor complaints.
  - Moderation decisions optionally adjust the advert owner’s `trust_score` via `trust_inc` (see [domains/trust_score.md](./trust_score.md)).

## API Surface
- `POST /api/reports/create` — authenticated users file complaints; applies rate limits (`report:user`, `report:ip`). Duplicates against the same advert while `status='pending'` are rejected.
- `GET /api/reports/list?status=` — admin-only listing (guards with `hasAdminRole` + service role). Supports statuses `pending|accepted|rejected`. Rate limited by `report:admin` window.
- `POST /api/reports/update` — admin-only resolution endpoint; accepts `accepted` or `rejected`, optional `unpublish` flag. On acceptance it may:
  - Call `trust_inc(uid, pts)` to subtract trust points (`-15`).
  - Optionally unpublish the advert (`status` -> `inactive` reserved for moderation takedown in future, currently sets `'inactive'` via service role when requested).
  - Log action in `logs`.
- UI entry point `/app/admin/reports/page.tsx` (server component) consumes these APIs.

## RLS & Security
- RLS policies (see `20251004122000_initial_reports_policies.sql` + `20251005191500_enable_rls_and_policies.sql`):
  - Authenticated users can insert reports where `reporter = auth.uid()` and read ones they filed or that target their adverts.
  - Admins (`public.is_admin()`) can perform all operations.
  - `public.logs` selects restricted to service/admin; inserts allowed for authenticated actors writing their own actions.
- Admin identification uses helper `public.is_admin()` which inspects JWT `app_metadata.role` (configured via Supabase Auth).

## Rate Limiting
- User report submission: `report:user` (default 5 per 10 minutes per user) and fallback `report:ip` (50 per 24h per IP).
- Admin moderation endpoints: `report:admin` (default 60 operations per minute per admin) from `.env` overrides.
- Logs capture denial events to audit rate-limit hits via `withRateLimit` hooks.

## Integrations & Dependencies
- Trust adjustments leverage `public.trust_inc(uid uuid, pts int)` defined in migrations (increments `public.trust_score`).
- Emails/notifications for moderation are not yet implemented (tracked in TODO below).
- DSAR obligations require retention of resolved reports for ≥12 months (see [requirements.md](../requirements.md#data-retention)).

## Improvements & TODO Links
- TODO.md: expand automated API coverage to include report list/update error paths.
- Future work: implement notification channel for accepted reports (add TODO entry if prioritised).
- Ensure final blocked advert workflow (status `'blocked'`) is implemented before trust penalties automatically unpublish listings.

## Change Log
- 2025-10-28: Compiled moderation domain doc based on current API and migrations.

---

## 🔗 Related Docs

**Domains:** [trust_score.md](./trust_score.md) • [deals.md](./deals.md) • [adverts.md](./adverts.md) • [chat.md](./chat.md)
**Development:** [security-compliance.md](../development/security-compliance.md)
