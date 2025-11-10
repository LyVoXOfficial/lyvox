last_sync: 2025-10-28

# Deals & Reservations Domain

## Overview
- Defines the buyer↔seller reservation workflow (“social escrow”) that sits between a public advert and an offline meetup.
- Tracks handshake lifecycle events, trust adjustments, and post-deal reviews without moving funds.
- Depends on adverts, profiles, trust_score, moderation logs, and future review UI.
- Related docs: [domains/adverts.md](./adverts.md), [domains/moderation.md](./moderation.md), [domains/trust_score.md](./trust_score.md), [domains/profile.md](./profile.md), [requirements.md](../requirements.md).

## Data Model
- `public.deals` (proposed schema):
  - Primary key `id uuid default gen_random_uuid()`.
  - Foreign keys: `advert_id uuid` → `public.adverts.id` (cascade delete), `seller_id uuid` → `public.profiles.id`, `buyer_id uuid` → `public.profiles.id`.
  - Workflow `status text` with allowed values:
    - `initiated`, `seller_accepted`, `both_confirmed_meetup`, `completed_success`, `failed_buyer_no_show`, `failed_seller_refused`, `cancelled_by_seller`, `cancelled_by_buyer`.
  - Timestamp columns capturing confirmations (`buyer_reservation_confirmed_at`, `seller_reservation_confirmed_at`, `buyer_done_confirmed_at`, `seller_done_confirmed_at`) plus `created_at` / `updated_at` (triggered via `set_updated_at()`).
- `public.adverts` extension:
  - New `deal_status text` with values `active`, `reserved_pending_confirmation`, `reserved`, `sold`, `failed_deal` (default `active`). Aligns advert visibility with deal progress.
- `public.reviews` (new table):
  - Columns: `id uuid`, `deal_id uuid` → `public.deals.id`, `rater_id uuid`, `target_id uuid`, `rating integer` (1–5), `comment text`, `created_at timestamptz`.
  - Enables buyer/seller reputation scoring post-successful deals.
- Relationships:
  - `deals` tie adverts to two profile rows (seller/buyer).
  - Trust score updates reference both participants (see [domains/trust_score.md](./trust_score.md)).
  - Reviews supply long-term reputation signals for marketplace UX badges.

## API Surface
- `POST /api/deals/create` — buyer creates `initiated` deal; enforces anti-spam limits (≤3 active).
- `POST /api/deals/accept` — seller moves deal to `seller_accepted`, advert `deal_status` → `reserved_pending_confirmation`.
- `POST /api/deals/confirm` — buyer or seller confirms meetup intent; when both set, status → `both_confirmed_meetup`, advert `deal_status` → `reserved`.
- `POST /api/deals/complete` — both confirm a successful exchange; status → `completed_success`, advert `deal_status` → `sold`, trust_score increments (+3 each), review prompts triggered.
- `POST /api/deals/fail` — either party records failure outcomes (`failed_buyer_no_show`, `failed_seller_refused`, or cancellations). Adjusts advert `deal_status` → `failed_deal` (optionally reverting to `active` after moderator review).
- `GET /api/deals/list` — returns deals where user is buyer or seller (tabbed UI for “Requests”, “Reservations”, “Sold”, etc.).
- `GET /api/deals/stats` — aggregates success/failure counts for trust display (“4 of 4 successful”). Feeds seller acceptance decisions.
- All endpoints reuse Supabase SSR clients (`supabaseServer()` for auth cookies, `supabaseService()` for trusted transitions and logging).

## RLS & Security
- `public.deals` policies (to be added):
  - Insert: buyers (`auth.uid() = buyer_id`) may create deals targeting other users; enforce `buyer_id != seller_id` server-side.
  - Select/Update: restricted to participants (`buyer_id = auth.uid() OR seller_id = auth.uid()`) and admins via `public.is_admin()`.
  - Delete: service/admin only; regular users cancel through status change endpoints.
- `public.reviews` policies should ensure only participants in a `completed_success` deal can leave feedback (one review per rater/target pair).
- Every status transition should write to `public.logs` (actions like `deal_create`, `deal_confirm`, `deal_fail`) for audit and DSAR exports.
- Anti-abuse rules (≤3 active deals per buyer) enforced at API layer, with violations logged.

## Rate Limiting & Anti-Abuse
- Deal creation inherits generic `withRateLimit`; add dedicated limiter (TODO) to prevent spam (e.g., `deal:user`, `deal:ip`).
- Buyers exceeding failure thresholds (`failed_buyer_no_show`) trigger trust penalties, optionally temporary blocks (future automation).
- Sellers see buyer history (counts from `GET /api/deals/stats`) before accepting to discourage unreliable reservations.

## Integrations & Dependencies
- Adverts: update `adverts.deal_status` in sync with deals lifecycle. Ensure moderation endpoints respect reserved/sold states.
- Trust score: apply deltas (completed +3/+3, failed buyer −5, failed seller −5). See [domains/trust_score.md](./trust_score.md) for integration details.
- Reviews: future UI surfaces average ratings (“Надёжный продавец ★4.8”). Requires additional RLS, pagination, and display components.
- Notifications: seller/buyer reminders (confirm meeting, leave review) can reuse existing email/SMS infrastructure.

## Improvements & TODO Links
- TODO.md items:
  - Implement deals domain (buyer↔seller commitments).
  - Extend adverts with `deal_status` field and transition handling.
  - Add RLS policies for `public.deals`.
  - Integrate trust_score deltas and `public.reviews` table.
  - Introduce rate limits for `/api/deals/create` and related endpoints.
  - Build UI flows for buyer/seller confirmation + review prompts.
- PLAN.md milestone “M2.5 – Secure Reservations & Deals Layer” tracks rollout stages.
- Update `docs/requirements.md` once schema is finalised (table definitions, ERD, retention requirements).

## Change Log
- 2025-10-28: Initial domain documentation capturing RFC scope, schema, and integration points.

---

## 🔗 Related Docs

**Domains:** [moderation.md](./moderation.md) • [chat.md](./chat.md) • [adverts.md](./adverts.md) • [trust_score.md](./trust_score.md)
**Development:** [security-compliance.md](../development/security-compliance.md)
