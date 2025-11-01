# LyVoX – Architecture Overview

## Top-Level Topology

- **Frontend** - Next.js 16 (App Router with SSR/ISR), React 19.2, Tailwind 4, shadcn/ui. Entry point `apps/web/src/app/**`, shared UI and helpers in `apps/web/src/components/**` and `apps/web/src/lib/**`.
- **Backend** - Next.js Route Handlers under `apps/web/src/app/api/**` (Node runtime). Each handler wraps Supabase clients (`supabaseServer()` for user-scoped work, `supabaseService()` for privileged flows) built on `@supabase/supabase-js` 2.76.x and the latest stable `@supabase/ssr` 0.7.x.
- **Database** — Supabase Postgres with row-level security. Schema changes live in `supabase/migrations/**`; canonical types are generated to `supabase/types/database.types.ts`.
- **Storage** — Supabase Storage bucket `ad-media` for advert media assets.
- **Authentication** — Supabase Auth (magic-link and phone OTP). Itsme OAuth onboarding is planned.
- **Integrations** — Twilio (OTP), Upstash Redis (rate limiting), Cloudflare WAF (planned rollout), hosting via Vercel.

### Next-Gen Profile (apps/web/src/app/(protected)/profile)

The new user profile page is implemented in `apps/web/src/app/(protected)/profile/page.tsx`.
It uses a modular architecture with reusable components located in `apps/web/src/components/profile/`.

- `ProfileAdvertsList.tsx`: Displays a user's listings.
- `ProfileReviewsList.tsx`: Displays reviews for a user.
  Data is fetched server-side using a consolidated Supabase query for security and performance.

## Key User Journeys

- **Create advert:** Multi-step form (8 steps) → select category → choose condition → enter vehicle details (make/model/year with autocomplete, technical specs, options) → add description/photos/location → verify additional phone → preview → save draft or publish.
- **Verify phone:** Request OTP (rate limited) → confirm → mark number verified.
- **Moderation pipeline:** User submits report → moderator triages → resolve and optionally adjusts trust score.
- **Account creation:** Supabase sign-up → consent logging → onboarding checklist.

## Auth & Identity Flow

- **Profiles ↔ Auth linkage.** `public.profiles.id` matches `auth.users.id` one-to-one. All joins between auth and profile state rely on this shared primary key.
- **Phone storage.** Phone metadata resides in `public.phones` `{ user_id, phone_e164, status ('requested'|'verified'), created_at, verified_at }`. After successful verification the number is duplicated into `profiles.phone_number` for quick reads.
- **Itsme / KYC flag.** `profiles.itsme_verified` (boolean) is reserved for future Itsme OAuth results; no parallel table is required today.
- **Role & trust enforcement.** JWT `app_metadata.role` is treated as advisory. Every privileged Route Handler re-fetches `auth.getUser()` (or checks role claims manually when using `supabaseService()`) before executing sensitive mutations. Client-provided roles are never trusted.
- **Trust score lifecycle.** `public.trust_score` is read-only for clients. Only server code using the service role may call `trust_inc(uid, pts)`. The UI consumes the score via profile views and exposes no direct mutation path.

## Advert Lifecycle & Moderation

- **Statuses.** `draft` (owner only), `active` (public), `archived` (owner removed; can be reactivated), `blocked` (moderation takedown; irreversible by owner). `pending_review` is reserved for the future moderated funnel and currently unused in production.
- **Transitions.** Owners toggle `draft ↔ active ↔ archived`. Moderators/admins alone set `blocked`. When the moderated funnel launches it will route `draft → pending_review → active` after approval.
- **Reports.** `public.reports` links complaints to `advert_id`, `reporter_id`, stores `reason` (enum-like string), `details`, and `status` (`pending` → `accepted` → `rejected`). Resolution can keep the advert active, block it, or add trust penalties via `trust_inc`. Each report is traceable per reporter for audit and rate limiting.
- **Vehicle specifics.** Transport listings use a comprehensive 8-step form with:
  - Category and condition selection
  - Vehicle details: make (with autocomplete), model (cascading from make), year (from model data), steering wheel, body type, doors, color with optional hex code
  - Technical specs: power, engine type/volume (from model or manual), transmission (from model or manual), drive type
  - Condition details: mileage, vehicle condition (damaged/repaired/not damaged), customs cleared, warranty status, owners count, VIN
  - Options: 8 categories (comfort, interior, security, exterior, assistance, visibility, safety, multimedia) with checkbox selection and variant support (e.g., climate control zones)
  - Final details: description, photos (via UploadGallery), location, contact phone (from profile + additional with +32 verification)
  - Preview and publish/save/delete actions
  - All vehicle-specific data is stored in `ad_item_specifics.specifics` (JSON) with normalized references to `vehicle_makes`, `vehicle_models`, and reference tables (`steering_wheel`, `vehicle_colors`, `vehicle_doors`, `vehicle_conditions`, `engine_types`, `drive_types`, `vehicle_options`).

## Media Upload Pipeline

- **Signed uploads.** `/api/media/sign` is available only to authenticated users. The handler validates advert ownership (or ensures the advert is a draft owned by the caller) before issuing a service-role signed URL.
- **Storage layout.** Media assets land under `ad-media/{user_id}/{advert_id}/{timestamp-filename}`. The bucket stays private; public views use signed URLs generated only after confirming the advert is `active`.
- **Metadata.** `public.media` stores `{ id, advert_id, user_id, path, width, height, order_index, created_at }`. The smallest `order_index` is treated as the cover/primary image, and UI clients can reorder images.
- **Limits & cleanup.** Up to 12 images per advert, ~5 MB per file (enforced in `UploadGallery`). A scheduled cleanup for orphaned files (uploads never attached to an advert after N hours) is tracked as a TODO.

## Row-Level Security Overview

- **Adverts.** Authors read/update their own records; everyone can read adverts with `status = 'active'`. Moderators/admins (checked via `is_admin()`) may update or block any advert.
- **Profiles.** Each user sees their full profile. Public readers get only whitelisted fields (display name, location, trust score); sensitive fields (email, phone number, consent meta) remain hidden.
- **Media.** Authors and moderators/admins access full metadata. Public delivery happens through verified signed URLs and only when the advert is active.
- **Reports.** Reporters and moderators/admins can read; only moderators/admins update `status`. Service-role handlers must still enforce role checks before bypassing RLS via `supabaseService()`.
- **Service role caution.** `supabaseService()` bypasses RLS; every privileged handler must validate authorisation prior to invoking service-role mutations.

## Rate Limiting & Abuse Control

- **Covered endpoints.** `/api/phone/request`, `/api/phone/verify`, `/api/auth/register`, `/api/reports/create`, `/api/reports/list`, `/api/reports/update`, and other sensitive routes wrap `withRateLimit` (Upstash Redis sliding window).
- **Key strategy.** Anonymous traffic keys rate limits by IP, authenticated flows by `user_id`. Roadmap: dynamic throttling that relaxes limits for high-trust users and tightens for new/low-trust accounts.
- **Response contract.** Breaches return HTTP 429 with body `{"error":"rate_limited","retry_after_seconds":<int>}`. `fetcher.ts` converts this to `RateLimitedError` for consistent UX messaging.

## Access Roles (Summary)

- **guest** — read-only public data.
- **user** — CRUD own adverts & media, submit reports, verify phone.
- **moderator/admin** — moderation queue, trust adjustments, user management.

## Reference Documents

- Detailed ER diagrams, RLS policy listings, and environment matrices live in `docs/requirements.md`.
- MCP services integration and usage: `docs/MCP_SERVICES.md`.

## Documentation Change Log

- 2025-10-05 - Document governance introduced (`project-rules.yaml`) and duplication audit recorded.
- 2025-10-27 - Stack updated to Next.js 16 / React 19.2 / TypeScript 5.9 / `@supabase/supabase-js` 2.76.x while pinning `@supabase/ssr` to the latest stable 0.7.x. Future upgrades of `@supabase/ssr` are permitted only after:
  1. `pnpm install` completes without registry errors,
  2. `pnpm exec tsc -p apps/web/tsconfig.json --noEmit` succeeds, and
  3. a manual SSR auth smoke-test (server-side `supabaseServer()` fetching the current profile) confirms session handling still works.
