last_sync: 2025-10-28

# Profiles Domain

## Overview
- Manages end-user identity metadata that extends Supabase Auth (`auth.users`).
- Stores marketing and GDPR consent snapshots consumed by onboarding and settings flows.
- SSR access handled via `supabaseServer()` and related API routes (see `apps/web/src/app/api/me/route.ts`).
- Related docs: [requirements.md](../requirements.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [API_REFERENCE.md](../API_REFERENCE.md).

## Data Model
- Table `public.profiles` (see supabase/types):
  - `id uuid` (PK, references `auth.users.id`).
  - `display_name text` (nullable).
  - `phone text` (legacy display field, not authoritative for verification).
  - `verified_email boolean`, `verified_phone boolean`.
  - `consents jsonb` — latest GDPR snapshot (`terms`, `privacy`, `marketing` with `accepted_at`).
  - `created_at timestamptz`.
- Relationships:
  - 1:1 with `auth.users` (managed by Supabase Auth triggers).
  - Linked functionally to `public.trust_score`, `public.phones`, and `logs` (audit trail).
- ERD reference: `profiles` node in [requirements.md](../requirements.md#system-architecture).

## API Surface
- `GET /api/me` — returns current auth session, profile details, trust score, phone information (SSR safe).
- `POST /api/profile/update` — upserts `display_name` for the authenticated user.
- `GET /api/profile/consents` — fetches consent snapshot + history.
- `POST /api/profile/consents` — updates marketing opt-in, logs change in `logs`.
- Related UI entry points: `/profile`, `/profile/edit`, `/profile/phone` (see `apps/web/src/app/profile/**`).

## RLS & Security
- Policies (see `20251005191500_enable_rls_and_policies.sql`):
  - Owners (`auth.uid()`) can select, insert (via upsert), update, and delete their own `profiles` row.
  - Admins (`public.is_admin()`) bypass restrictions for operational support.
- `logs` table accepts inserts from authenticated sessions; admin/service role reads audit history.
- `public.is_admin()` helper inspects JWT `app_metadata.role` claim.

## Rate Limiting
- No dedicated rate limits for profile endpoints; rely on Supabase auth session throttling.
- Consents updates log to `logs` for audit but are not rate-limited. Consider adding if abuse noticed.

## Integrations & Dependencies
- Supabase Auth is the single source of truth for identity; profile rows are secondary metadata.
- Consents rely on `apps/web/src/lib/consents.ts` helpers for schema coercion.
- SSR client obtains cookies via `supabaseServer()` (see `apps/web/src/lib/supabaseServer.ts`).

## Open Issues & TODO
- TODO: add DSAR export coverage in automated tests (`TODO.md`: Expand automated API tests).
- TODO: tighten validation for `display_name` (currently length only).
- Future work: unify `phone` column with `phones` table once SMS flow fully migrates (track in new TODO entry if prioritised).

## Change Log
- 2025-10-28: Initial domain summary extracted from current API + migrations.

---

## 🔗 Related Docs

**Domains:** [trust_score.md](./trust_score.md) • [consents.md](./consents.md) • [phones.md](./phones.md)
**Development:** [security-compliance.md](../development/security-compliance.md)
**Core:** [API_REFERENCE.md](../API_REFERENCE.md)
