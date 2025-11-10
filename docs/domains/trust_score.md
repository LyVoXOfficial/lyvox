last_sync: 2025-10-28

# Trust Score Domain

## Overview
- Tracks reputation adjustments for users based on moderation outcomes and future heuristics.
- Backed by `public.trust_score` table and `public.trust_inc(uid uuid, pts int)` helper function.
- Consumed by profile surfaces (`/profile` page) and moderation tooling (`/api/reports/update`).
- Related docs: [domains/moderation.md](./moderation.md), [domains/profile.md](./profile.md), [requirements.md](../requirements.md).

## Data Model
- Table `public.trust_score` (see `supabase/migrations/20251004121000_create_trust_score_table.sql`):
  - `user_id uuid` (PK ↔ `auth.users.id`).
  - `score int` (initially 0, positive = higher trust, negative = penalties).
  - `created_at timestamptz`, `updated_at timestamptz` (managed by trigger `set_updated_at`).
- Helper function `public.trust_inc(uid uuid, pts int)`:
  - Upserts a row for the user, increments `score` by `pts`, touches `updated_at`.
  - Called from `/api/reports/update` when admins accept complaints (currently `-15` pts).
- No dedicated API endpoints; modifications occur through service-role code paths.

## RLS & Security
- Policies (same migration as moderation RLS):
  - Authenticated users can `SELECT` their own trust score (`user_id = auth.uid()`).
  - Only admins (`public.is_admin()`) are allowed to mutate rows (`FOR ALL` with `is_admin()`).
- `trust_inc` executes with invoker rights, so callers must hold admin/service role to avoid RLS rejection.
- Audit trail: moderation endpoints insert `report_update` entries into `public.logs` capturing applied penalties.

## Rate Limiting
- No explicit rate limit; all write operations originate from administrator flows already guarded by `report:admin` limiter.
- Consider adding soft caps if automated heuristics ever adjust trust frequently.

## Integrations & Dependencies
- Profile display: `/api/me` fetches trust score (`supabase.from("trust_score").select("score")`).
- Moderation: `/api/reports/update` drives increments/decrements via service-role client.
- Future signals (e.g., phone verification, successful trades) can reuse `trust_inc` once defined.

## Improvements & TODO Links
- TODO: design positive trust accrual events (e.g., verified identity, successful sales) — add concrete tickets in `docs/PLAN.md` when prioritised.
- TODO: monitor for score floor/ceiling; consider bounding values to safeguard from overflow.
- Ensure audit exports (DSAR) continue to include `trust_score` snapshot (already documented in [requirements.md](../requirements.md#data-retention)).

## Change Log
- 2025-10-28: First version summarising trust score mechanics and integration points.

---

## 🔗 Related Docs

**Domains:** [moderation.md](./moderation.md) • [adverts.md](./adverts.md) • [profile.md](./profile.md) • [deals.md](./deals.md)
**Development:** [security-compliance.md](../development/security-compliance.md)
