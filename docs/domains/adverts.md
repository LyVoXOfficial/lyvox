last_sync: 2025-10-28

# Adverts & Media Domain

## Overview
- Manages the full lifecycle of marketplace listings: draft creation, enrichment, publication, archival, and teardown.
- Orchestrates Supabase Storage uploads for gallery media (`ad-media` bucket) via signed URLs.
- Intersects with moderation (`reports`), reputation (`trust_score`), and taxonomy (`categories`, `locations`).
- Related docs: [requirements.md](../requirements.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [domains/moderation.md](./moderation.md), [domains/phones.md](./phones.md).

## Data Model
- `public.adverts`
  - Columns: `id uuid`, `user_id uuid`, `category_id uuid`, `title`, `description`, `price numeric`, `currency text` (default `'EUR'`), `condition text`, `location text`, `status text`, `created_at`, `updated_at`, `location_id uuid` (optional FK).
  - Statuses in use: `draft`, `active`, `archived`. Moderation APIs may set `inactive` during takedowns. `blocked` is reserved for future workflows.
- `public.ad_item_specifics`: JSON key/value blob keyed by `advert_id` (1:1).
- `public.media`: gallery rows storing storage `url` (path), optional `w`/`h`, sortable via `sort`, with `created_at` timestamp.
- Lookup tables: `public.categories`, `public.locations` (public select enabled).
- Relationships:
  - `adverts.user_id` → `auth.users.id`.
  - `media.advert_id` → `adverts.id` (1:n).
  - `ad_item_specifics.advert_id` → `adverts.id` (1:1).
  - `reports.advert_id` → `adverts.id` (see [domains/moderation.md](./moderation.md)).
  - Audit events captured in `public.logs` (`advert_*`, `media_*` actions).

## API Surface
- `POST /api/adverts` — creates draft advert seeded with default category and EUR currency.
- `PATCH /api/adverts/:id` — updates advert fields, specifics JSON, and transitions status (`draft` ↔ `active` ↔ `archived`). Guards against publishing without media and logs status changes.
- `DELETE /api/adverts/:id` — deletes advert, associated `media` & `ad_item_specifics`, removes storage objects, logs action.
- Media workflow endpoints:
  - `POST /api/media/sign` — generates signed upload URL/token (12-item cap, path prefix enforcement).
  - `POST /api/media/complete` — persists metadata for uploaded object, deduplicates by storage path, returns signed download URL.
  - `GET /api/media/list?advertId=` — lists media ordered by `sort`, returns signed URLs valid for ~10 minutes.
  - `POST /api/media/reorder` — re-sequences gallery order.
  - `DELETE /api/media/:id` — removes media row, storage object, and compacts ordering.
- All endpoints use SSR-aware Supabase clients (`supabaseServer()` for user context, `supabaseService()` for privileged storage/log ops).

## RLS & Security
- `public.adverts` (see `20251005191500_enable_rls_and_policies.sql`):
  - Public `SELECT` limited to rows with `status = 'active'`.
  - Owners (`user_id = auth.uid()`) can select and manage their own adverts.
  - Admins (`public.is_admin()`) have unrestricted access.
- `public.media`:
  - Public selects allowed only when parent advert is active.
  - Owners can view/manage their media via parent ownership checks.
  - Admin override through `public.is_admin()`.
- `public.ad_item_specifics` is always mutated through guarded API routes; ownership enforced by server logic (`advert.user_id`).
- All denied operations (sign/list/reorder/delete) write audit entries to `public.logs`.

## Rate Limiting
- No explicit rate limits today. Abuse mitigated via:
  - Storage path validation (`${userId}/${advertId}/...`).
  - Media cap of 12 items per advert.
- TODO.md entry “Evaluate rate limiting strategy for media upload/complete endpoints once production traffic increases.” tracks future work.

## Integrations & Dependencies
- Storage: Supabase Storage `ad-media` bucket.
- Taxonomy: categories and locations used in advert creation (seeded via `scripts/seedCategories.ts` and vehicle migrations).
- Moderation: admin takedowns triggered from `/api/reports/update` may set advert status to `inactive` and adjust trust score.
- Logging: `public.logs` persists `advert_*`, `media_*` and denial events for audit/DSAR needs.

## Improvements & TODO Links
- TODO.md: implement cascading make/model/year selectors using vehicle tables (transport listings).
- TODO.md: evaluate dedicated rate limiting for media endpoints once production data justifies it.
- PLAN.md: moderation roadmap should formalise `blocked` state before exposing it in the UI.

## Change Log
- 2025-10-28: Initial domain documentation based on current API implementation and migrations.

---

## 🔗 Related Docs

**Domains:** [moderation.md](./moderation.md) • [devops.md](./devops.md) • [deals.md](./deals.md) • [trust_score.md](./trust_score.md)
**Development:** [security-compliance.md](../development/security-compliance.md)
