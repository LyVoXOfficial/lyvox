# LyVoX API Reference

> Generated from source code on 2026-06-25. Documents all **58 route handler files** (`src/app/api/**/route.ts`) in the LyVoX Next.js App Router, yielding ~63 endpoint operations.

## Conventions

**Standard envelope.** Most endpoints use helpers from `src/lib/apiErrors.ts`:
- Success: `{ "ok": true, "data": <payload> }` (the **Response** payloads below are the contents of `data` unless noted).
- Error: `{ "ok": false, "error": "<CODE>", "detail"?: "<string>" }` with an appropriate HTTP status (400/401/403/404/409/429/500).

**Deviations** (flagged per-endpoint): the `catalog/*` routes return bare arrays/objects with a `{ "error": "<message>" }` error shape; `auth/check-email`, `locale`, and `catalog/schema` return custom top-level shapes; the `moderation/*` routes hand-build `{ ok, data }` / `{ ok, error }` (shape-conformant, not via the helpers).

**Auth.** "user" means the handler calls `supabase.auth.getUser()` and returns 401 if absent. Some routes call `getUser()` but do **not** 401 — they return a public/empty payload for anonymous callers; these are marked **none (optional)**. "admin" means `hasAdminRole(user)` is required (checks `app_metadata.role`/`roles` == `admin`; 403 otherwise).

**Rate limiting.** Via `withRateLimit`/`createRateLimiter` (Upstash sliding window). **Fails open** when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are unset (limiter returns success). On limit: HTTP 429 `RATE_LIMITED` with `Retry-After`/`RateLimit-*` headers. Multi-tier routes enforce user-keyed AND IP-keyed limits.

---

## Auth

### POST /api/auth/register
- Auth: none
- Rate limit: no
- Request (JSON, `registerSchema`): `email` (string, valid email), `password` (string, min 8, ≥3 of upper/lower/digit/symbol), `confirmPassword` (must equal password), `consents` `{ terms: true, privacy: true, marketing?: boolean }` (terms & privacy must be true), `locale?` (en|nl|fr|ru|de)
- Behavior: `supabase.auth.signUp`, upserts `profiles` row (service role) with consent snapshot, logs `consent_accept`.
- Response: `{ verificationRequired: boolean }` (HTTP 201). Errors: `INVALID_JSON`, validation (`INVALID_PAYLOAD`), `SIGNUP_FAILED`/`EMAIL_IN_USE`, `SIGNUP_INCOMPLETE` (500), `SERVICE_ROLE_MISSING` (500), `PROFILE_UPSERT_FAILED`.

### POST /api/auth/signout
- Auth: none (calls `signOut`; no user check)
- Rate limit: no
- Request: none
- Response: `{}` (empty data).

### GET /api/auth/check-email
- Auth: none
- Rate limit: yes — per IP, 20/60s (`prefix: check-email:ip`)
- Request (query): `email` (string, valid email)
- Behavior: service-role `listUsers()` scan (first page only — noted unreliable at scale in code; see docs/SECURITY_AUDIT.md H1b).
- Response (custom top-level, **not** enveloped): `{ ok: true, available: boolean }` with `Cache-Control: no-store`. On invalid email: `{ ok: false, error: "INVALID_EMAIL", detail }` (400). On service/internal errors it returns `available: true` (fails safe).

### POST /api/auth/webauthn/enroll
- Auth: user
- Rate limit: no
- Request (JSON, `enrollSchema`): `friendlyName?` (string 1–100, default `"Biometric Key"`)
- Behavior: `supabase.auth.mfa.enroll({ factorType: "webauthn" })`.
- Response: `{ factorId: string, friendlyName: string }` (HTTP 201). Errors: `INVALID_JSON`, `BAD_INPUT`, `UNAUTHENTICATED` (401), `INTERNAL_ERROR` (500).

### GET /api/auth/webauthn/list
- Auth: user
- Rate limit: no
- Request: none
- Response: `{ credentials: Array<{ id, factorId, friendlyName, createdAt, lastUsedAt, factorType: "webauthn" }> }` (WebAuthn MFA factors).

### POST /api/auth/webauthn/verify
- Auth: user
- Rate limit: no
- Request (JSON, `verifySchema`): `factorId?` (uuid; if omitted, first WebAuthn factor is used)
- Behavior: `mfa.challenge` then `mfa.verify`.
- Response: `{ verified: true }`. Errors: `NOT_FOUND` (404, no factors), `INTERNAL_ERROR` (500).

### DELETE /api/auth/webauthn/remove
- Auth: user
- Rate limit: no
- Request (JSON, `removeSchema`): `factorId` (uuid, required)
- Behavior: verifies factor belongs to user, `mfa.unenroll`.
- Response: `{ removed: true }`. Errors: `NOT_FOUND` (404), `INTERNAL_ERROR` (500).

---

## Adverts

### POST /api/adverts
- Auth: user
- Rate limit: no
- Request: none (creates a draft)
- Behavior: blocks blocked users (403), picks default active level-1 category, inserts `adverts` row (status `draft`, currency `EUR`).
- Response: `{ advert: { id, status, category_id } }`. Errors: `FORBIDDEN` (403, blocked), `CATEGORY_LOOKUP_FAILED` (500), `CREATE_FAILED`.

### GET /api/adverts/{id}
- Auth: none (optional) — public for `active` adverts; for non-active, owner-only (else 404)
- Rate limit: no
- Request (path): `id` (uuid; non-UUID → 404)
- Behavior: service-role fetch; loads `ad_item_specifics`.
- Response: `{ advert: { id, user_id, title, description, price, currency, condition, location, created_at, updated_at, status, category_id, specifics } }`. Errors: `NOT_FOUND` (404).

### PATCH /api/adverts/{id}
- Auth: user (owner-only; non-owner → 403 + audit log `advert_update_denied`)
- Rate limit: no
- Request (path) `id`; (JSON, `updateAdvertSchema`, all optional): `title` (3–200), `description` (≤10000), `price` (number ≥0, nullable), `currency` (EUR|USD|GBP|RUB), `condition` (new|used|for_parts), `location` (≤200, nullable), `category_id` (uuid), `status` (draft|active|archived), `specifics` (record<string,string>, nullable)
- Behavior: enforces status transitions; publishing (`active`) requires blocked-check (403), description ≥10 chars, category, condition, and ≥1 media; upserts/clears `ad_item_specifics`; logs `advert_status_change`.
- Response: `{}` (empty data). Errors: `MISSING_ID`, `INVALID_PAYLOAD` (invalid status/transition), `BAD_INPUT` (`DESCRIPTION_TOO_SHORT`/`CATEGORY_REQUIRED`/`CONDITION_REQUIRED`/`MEDIA_REQUIRED`), `NOT_FOUND` (404), `FORBIDDEN` (403), `UPDATE_FAILED`.

### DELETE /api/adverts/{id}
- Auth: user (owner-only; non-owner → 403 + audit log `advert_delete_denied`)
- Rate limit: no
- Request (path): `id`
- Behavior: deletes `ad_item_specifics`, `media` rows + storage objects (`ad-media` bucket), then advert; logs `advert_delete`.
- Response: `{}`. Errors: `MISSING_ID`, `NOT_FOUND` (404), `FORBIDDEN` (403), `UPDATE_FAILED`.

### POST /api/adverts/{id}/view
- Auth: none (optional) — records `user_id` if present, else anonymous
- Rate limit: yes — per IP, 100/60s (`prefix: adverts:view`)
- Request (path): `id` (uuid)
- Behavior: inserts `advert_views` (ip, user-agent), calls RPC `get_advert_view_count`.
- Response: `{ message: "View tracked", advert_id, view_count }` (insert failure is non-critical → still 200 with a "tracking failed" message). Errors: `BAD_INPUT` (invalid uuid), `NOT_FOUND` (404).

---

## Media

All media routes use the `ad-media` bucket; `MEDIA_LIMIT_PER_ADVERT = 12`. Auth + ownership via `requireAuthenticatedUser` / `ensureAdvertOwnership` (`src/app/api/media/_shared.ts`).

### POST /api/media/sign
- Auth: user (advert owner; else 403 + log `media_sign_denied`)
- Rate limit: no
- Request (JSON, `signMediaSchema`): `advertId` (uuid), `fileName` (1–255), `contentType` (must start `image/`), `fileSize` (int >0, ≤5MB)
- Behavior: enforces 12-item limit (409 `LIMIT_REACHED`); creates a signed upload URL (TTL 5 min).
- Response: `{ path, token, expiresIn: 300, orderIndex, max: 12 }`. Errors: `LIMIT_REACHED` (409), `SIGNED_URL_FAILED`.

### POST /api/media/complete
- Auth: user (advert owner; else 403)
- Rate limit: no
- Request (JSON, `completeMediaSchema`): `advertId` (uuid), `storagePath` (string, must match `userId/advertId/...` and end with extension), `width?` (int >0), `height?` (int >0)
- Behavior: verifies path prefix `${user.id}/${advertId}/` (403 + log `media_complete_denied`); enforces 12-limit; inserts `media` row; returns signed download URL (TTL 15 min). Reused path → `{ reused: true }`.
- Response: `{ media: { id, url (signed), sort, w, h, storagePath } }`. Errors: `FORBIDDEN` (403), `LIMIT_REACHED` (409), `CREATE_FAILED`, `SIGNED_URL_FAILED`.

### GET /api/media/list
- Auth: user (advert owner; else 403 + log `media_list_denied`)
- Rate limit: no
- Request (query): `advertId` (required)
- Behavior: signed download URLs (TTL 10 min); legacy `http(s)` URLs returned as-is.
- Response: `{ items: Array<{ id, url, storagePath, sort, w, h, created_at }>, expiresIn: 600 }`. Errors: `MISSING_ADVERT_ID`.

### GET /api/media/public
- Auth: none — public, only for `active` adverts
- Rate limit: no
- Request (query): `advertId` (required)
- Behavior: 403 if advert not active; service-role signed URLs (TTL 10 min).
- Response: `{ items: Array<{ id, url, storagePath, sort, w, h, created_at }>, expiresIn: 600 }`. Errors: `MISSING_ADVERT_ID`, `NOT_FOUND` (404), `FORBIDDEN` (403, inactive).

### POST /api/media/reorder
- Auth: user (advert owner; else 403 + log `media_reorder_denied`)
- Rate limit: no
- Request (JSON, `reorderMediaSchema`): `advertId` (uuid), `orderedIds` (array of uuids, min 1)
- Behavior: validates all IDs belong to advert (else `UNKNOWN_MEDIA_ID`); rewrites `sort`.
- Response: `{}`. Errors: `UNKNOWN_MEDIA_ID` (400).

### DELETE /api/media/{id}
- Auth: user (advert owner; else 403 + log `media_delete_denied`)
- Rate limit: no
- Request (path): `id` (media id)
- Behavior: removes storage object + `media` row; re-sequences remaining `sort` values.
- Response: `{}`. Errors: `MISSING_ID`, `NOT_FOUND` (404), `UPDATE_FAILED`.

---

## Catalog

> All catalog routes are public (no auth), `dynamic = "force-dynamic"`, no rate limit. Unless noted, the success body is a **bare array** (not enveloped); errors are `{ "error": "<message>" }` with status 500/400/404.

### GET /api/catalog/contract-types
- Request (query): `lang?` (en|fr|nl|ru|de, default en)
- Response: bare array of `{ id, code, slug, name, description, sort_order }` (from `job_contract_types`).

### GET /api/catalog/cp-codes
- Request (query): `lang?` (en|fr|nl, default en), `search?` (matches code or localized name)
- Response: bare array of `{ code, name, sector }` (from `cp_codes`).

### GET /api/catalog/device-brands
- Request (query): `device_type?` (filters brands having models of that type), `search?` (ilike on name)
- Response: bare array of `{ id, slug, name, logo_url, country, website }` (active `device_brands`).

### GET /api/catalog/device-models
- Request (query): `brand` or `brand_id` (required), `device_type` (required), `search?`, `limit?` (default 20)
- Behavior: RPC `search_device_models`.
- Response: bare array (RPC result). Errors: 400 if `brand`/`device_type` missing.

### GET /api/catalog/epc-ratings
- Request (query): `lang?` (en|fr|nl, default en)
- Response: bare array of `{ code, name, description, max_kwh_per_sqm_year, color, sort_order }` (from `epc_ratings`).

### GET /api/catalog/job-categories
- Request (query): `lang?` (en|fr|nl|de|ru, default en)
- Response: bare array of `{ id, slug, parent_id, is_active, name }` (from `job_categories`).

### GET /api/catalog/property-types
- Request (query): `lang?` (en|fr|nl|de|ru, default en)
- Response: bare array of `{ id, slug, category, is_active, name }` (from `property_types`).

### GET /api/catalog/fields
- Request (query): `category` (slug, required), `lang?` (default en)
- Behavior: returns hard-coded field-group definitions per category type (property/job/electronics).
- Response: **bare object** `{ category_slug, category_type, uses_specialized_table, field_groups: [{ name, label, fields: [...] }] }`. Errors: 400 (`category` missing), 404 (unknown category), 501 (type without definitions).

### GET /api/catalog/schema
- Request (query): `category_id` OR `category_slug` (one required)
- Behavior: resolves active `catalog_subcategory_schema` walking up parent categories; loads `catalog_fields` + `catalog_field_options`.
- Response (**enveloped**): `{ ok: true, data: { category, resolved_category_id, schema: { id, version, steps }, fields: Record<field_key, {...}> } }`. Errors: `{ ok: false, error: "<message>" }` with 400/404/500.

---

## Categories

### GET /api/categories/tree
- Auth: none (public)
- Rate limit: no (cached via `revalidate = 3600`)
- Request (query, `categoryTreeQuerySchema`): `locale?` (en|nl|fr|ru|de, default en)
- Behavior: builds recursive tree of active categories with localized names.
- Response: `{ tree: CategoryTreeNode[], locale, count }` (empty: `{ tree: [] }`). Each node: `{ id, parent_id, slug, level, name, path, sort, icon, is_active, children? }`. Errors: validation, `FETCH_FAILED`.

---

## Chat

### GET /api/chat/history
- Auth: user
- Rate limit: no
- Request (query): `conversationId` (uuid, required), `cursor?` (numeric message id), `limit?` (default 50, max 100)
- Behavior: verifies participant (403 if not); paginated, returns chronological order.
- Response: `{ messages: Array<{ id, conversation_id, author_id, body, created_at, updated_at }>, has_more: boolean, next_cursor: number|null }`. Errors: `BAD_INPUT`, `FORBIDDEN` (403).

### POST /api/chat/start
- Auth: user
- Rate limit: yes — user 10/60s (`chat:start:user`) AND IP 30/3600s (`chat:start:ip`, bucket `global`)
- Request (JSON, `startConversationSchema`): `advert_id?` (uuid), `peer_id` (uuid, required)
- Behavior: cannot start with self (400); if `advert_id`, advert must exist & be active; returns existing conversation if found, else creates conversation + participants (owner/peer); logs `chat_start`.
- Response: `{ conversation_id, created: boolean }`. Errors: `BAD_INPUT`, `NOT_FOUND` (404), `FORBIDDEN` (403), `CREATE_FAILED`.

### POST /api/chat/send
- Auth: user
- Rate limit: yes — user 20/60s (`chat:send:user`) AND IP 100/3600s (`chat:send:ip`, bucket `global`)
- Request (JSON, `sendMessageSchema`): `conversation_id` (uuid), `body` (string 1–5000)
- Behavior: verifies participant (403); inserts `messages`; logs `chat_send`.
- Response: `{ message: { id, conversation_id, author_id, body, created_at } }`. Errors: `FORBIDDEN` (403), `CREATE_FAILED`.

### POST /api/chat/read
- Auth: user
- Rate limit: **no** (exported as `baseHandler` directly)
- Request (JSON, `markReadSchema`): `conversation_id` (uuid)
- Behavior: verifies participant (403); updates `last_read_at`; logs `chat_read`.
- Response: `{}`. Errors: `FORBIDDEN` (403), `UPDATE_FAILED`.

---

## Billing

### GET /api/billing/products
- Auth: none (public)
- Rate limit: no
- Request: none
- Response: `{ products: Array<{ id, code, name, price_cents, currency, active }> }` (active only, ordered by price).

### GET /api/billing/benefits
- Auth: user
- Rate limit: no
- Request (query): `advert_id?`
- Behavior: returns currently-valid benefits (`valid_until > now`) for the user.
- Response: `{ benefits: Array<{ id, purchase_id, user_id, advert_id, benefit_type, valid_from, valid_until, created_at }> }`. Errors: `UNAUTH` (401), `FETCH_FAILED`.

### GET /api/billing/purchases
- Auth: user
- Rate limit: no
- Request (query): `status?`, `limit?` (default 20, max 100), `offset?` (default 0)
- Response: `{ purchases: Array<{ id, product_code, provider, status, amount_cents, currency, created_at, updated_at, products: { code, name } }>, total, limit, offset }`. Errors: `UNAUTH` (401), `BAD_INPUT`, `FETCH_FAILED`.

### POST /api/billing/checkout
- Auth: user
- Rate limit: yes — user 10/60s (`billing:checkout:user`) AND IP 20/3600s (`billing:checkout:ip`, bucket `global`)
- Request (JSON, `createCheckoutSchema`): `product_code` (string, required), `advert_id?` (uuid)
- Behavior: blocks blocked users (403); product must exist & be active; if `advert_id`, must belong to user (403); inserts pending `purchases` row; creates Stripe Checkout Session; updates row with session id.
- Response: `{ session_id, url }`. Errors: `UNAUTH` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CREATE_FAILED`, `INTERNAL_ERROR` (500, Stripe failure → purchase marked `failed`).

### POST /api/billing/webhook
- Auth: none (Stripe signature-verified via `stripe-signature` header + `STRIPE_WEBHOOK_SECRET`)
- Rate limit: no
- Request: raw Stripe event body. Handles `checkout.session.completed` (idempotent; marks purchase completed, creates `benefits` by product code prefix/duration, logs `purchase_completed`), `payment_intent.succeeded` (log only), `payment_intent.payment_failed` (marks purchase failed, logs).
- Response: `{ received: true }`. Errors: `BAD_INPUT` (400, missing/invalid signature), `INTERNAL_ERROR` (500).

---

## Notifications

### GET /api/notifications
- Auth: user
- Rate limit: no
- Request (query): `unread_only?` (`true`), `limit?` (default 20, max 100), `offset?` (default 0)
- Response: `{ notifications: Array<{ id, type, channel, title, body, payload, read_at, sent_at, created_at }>, total, limit, offset }`. Errors: `UNAUTH` (401), `BAD_INPUT`.

### POST /api/notifications/{id}/read
- Auth: user (owner of notification; else 403)
- Rate limit: no
- Request (path): `id`
- Behavior: sets `read_at` if not already read.
- Response: `{}`. Errors: `UNAUTH` (401), `BAD_INPUT`, `NOT_FOUND` (404), `FORBIDDEN` (403), `UPDATE_FAILED`.

### GET /api/notifications/preferences
- Auth: user
- Rate limit: no
- Request: none
- Response: `{ preferences: { email: Record<string,bool>, push: {...}, sms: {...} } }`. Errors: `UNAUTH` (401), `FETCH_FAILED`.

### POST /api/notifications/preferences
- Auth: user
- Rate limit: no
- Request (JSON, `updateNotificationPreferencesSchema`): `email?`, `push?`, `sms?` (each `Record<string, boolean>`)
- Behavior: merges with existing preferences on `profiles`.
- Response: `{ preferences: { email, push, sms } }`. Errors: `UNAUTH` (401), `UPDATE_FAILED`.

---

## Moderation

> All moderation routes build `{ ok, data }` / `{ ok, error }` JSON manually (shape-conformant). `dynamic = "force-dynamic"`, no caching. All require the admin role.

### GET /api/moderation/queue
- Auth: admin
- Rate limit: no
- Request (query): `status?` (pending|pending_review|flagged|all, default `pending`), `limit?` (default 50), `offset?` (default 0)
- Response: `{ ok: true, data: { adverts: [...], pagination: { total, limit, offset, hasMore } } }`. Errors: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `INVALID_STATUS` (400), `FETCH_FAILED` (500).

### POST /api/moderation/analyze
- Auth: admin
- Rate limit: no
- Request (JSON): `advert_id` (required)
- Behavior: fetches advert, invokes Supabase Edge Function `ai-moderation` (service-role bearer).
- Response: `{ ok: true, data: <edge function result> }`. Errors: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `MISSING_ADVERT_ID` (400), `ADVERT_NOT_FOUND` (404), `AI_MODERATION_FAILED`/`INTERNAL_ERROR` (500).

### POST /api/moderation/review
- Auth: admin
- Rate limit: no
- Request (JSON): `advert_id` (required), `action` (approve|reject|flag, required), `reason?`
- Behavior: service-role updates `adverts.moderation_status` + `status` (approve→active, reject/flag→draft); inserts `moderation_logs`.
- Response: `{ ok: true, data: { advert_id, action, status } }`. Errors: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `MISSING_REQUIRED_FIELDS`/`INVALID_ACTION` (400), `UPDATE_FAILED`/`INTERNAL_ERROR` (500).

---

## Reports

### POST /api/reports/create
- Auth: user
- Rate limit: yes — user 5/600s (`report:user`, env `RATE_LIMIT_REPORT_USER_PER_10M`) AND IP 50/86400s (`report:ip`, bucket `global`, env `RATE_LIMIT_REPORT_IP_PER_24H`)
- Request (JSON, `createReportSchema`): `advert_id` (uuid), `reason` (string 1–500), `details?` (string ≤2000, nullable)
- Behavior: blocks duplicate pending report by same reporter (409); inserts `reports`; logs `report_create`.
- Response: `{}`. Errors: `UNAUTH` (401), `ALREADY_REPORTED` (409), `CREATE_FAILED`.

### GET /api/reports/list
- Auth: admin (no explicit 401 for anonymous — `hasAdminRole(null)` is false → 403)
- Rate limit: yes — 60/60s (`report:admin`, env `RATE_LIMIT_ADMIN_PER_MIN`)
- Request (query): `status?` (default `pending`)
- Behavior: service-role select with joined advert.
- Response: `{ items: Array<{ id, reason, details, status, created_at, updated_at, advert_id, reporter, reviewed_by, adverts: { id, title, user_id } }> }`. Errors: `FORBIDDEN` (403), `SERVICE_ROLE_MISSING` (500), `FETCH_FAILED`.

### POST /api/reports/update
- Auth: admin (`UNAUTH` 401 if no user, then `FORBIDDEN` 403 if not admin)
- Rate limit: yes — 60/60s (`report:admin`, env `RATE_LIMIT_ADMIN_PER_MIN`)
- Request (JSON, `updateReportSchema`): `id` (positive int), `new_status` (accepted|rejected), `unpublish?` (boolean)
- Behavior: service-role updates `reports` (`reviewed_by`, `updated_at`); on `accepted` decrements seller trust via RPC `trust_inc` (−15) and optionally sets advert `status = inactive`; logs `report_update`.
- Response: `{}`. Errors: `UNAUTH` (401), `FORBIDDEN` (403), `SERVICE_ROLE_MISSING` (500), `NOT_FOUND` (404), `UPDATE_FAILED`.

---

## Profile

### GET /api/profile/get
- Auth: none (optional) — anonymous returns empty `{}`
- Rate limit: no
- Request: none
- Response: `{ display_name, phone, verified_email, verified_phone, created_at }` (or `{}` if no profile / unauthenticated). Errors: `FETCH_FAILED`.

### POST /api/profile/update
- Auth: user
- Rate limit: no
- Request (JSON, `updateProfileSchema`): `display_name?` (string 1–100)
- Behavior: upserts `profiles` row.
- Response: `{}`. Errors: `UNAUTH` (401), `UPDATE_FAILED`.

### GET /api/profile/adverts
- Auth: user
- Rate limit: no
- Request (query, `getUserAdvertsQuerySchema`): `page?` (int ≥1, default 1), `pageSize?` (int 1–100, default 12), `status?` (all|active|draft|archived, default all)
- Behavior: returns user's adverts with signed media URLs attached.
- Response: `{ adverts: Array<{ id, title, price, status, created_at, location, media: [{ url, signedUrl, sort }] }>, total, page, pageSize }`. Errors: `UNAUTHENTICATED` (401), `FETCH_FAILED`.

### GET /api/profile/consents
- Auth: user
- Rate limit: no
- Request (query): `format?` (`download` → adds `Content-Disposition` attachment header)
- Behavior: reads consent snapshot + service-role audit log history (`consent_accept`/`consent_update`).
- Response: `{ generatedAt, consents, history: Array<{ id, action, details, created_at }> }`. Errors: `UNAUTH` (401), `SERVICE_ROLE_MISSING` (500), `FETCH_FAILED`.

### POST /api/profile/consents
- Auth: user
- Rate limit: no
- Request (JSON, `updateConsentsSchema`): `marketingOptIn?` (boolean)
- Behavior: updates marketing consent snapshot on `profiles`; logs `consent_update` (service role).
- Response: `{ consents: <snapshot> }`. Errors: `UNAUTH` (401), `UPDATE_FAILED`, `SERVICE_ROLE_MISSING` (500), `INTERNAL_ERROR`.

---

## Favorites

### GET /api/favorites
- Auth: none (optional) — anonymous returns empty list with `authenticated: false`
- Rate limit: yes — 60/60s (`favorites:get`), keyed by userId or IP
- Request (query): `page?` (default 0), `limit?` (default 24, max 100)
- Behavior: returns favorites with first signed image + seller verified flag.
- Response: `{ items: Array<{ advert_id, favorited_at, advert: { ...fields, image, seller_verified } | null }>, total, page, limit, hasMore }` (anonymous: `{ items: [], total: 0, page: 0, limit: 0, hasMore: false, authenticated: false }`). Errors: `FETCH_FAILED`.

### POST /api/favorites
- Auth: user
- Rate limit: yes — 30/60s (`favorites:post`), keyed by userId or IP
- Request (JSON, `addFavoriteSchema`): `advert_id` (uuid)
- Behavior: advert must exist & be active; inserts `favorites` (duplicate → 200 "Already in favorites").
- Response: `{ message: "Added to favorites", advert_id }` (HTTP 201). Errors: `UNAUTH` (401), `INVALID_JSON`, `BAD_INPUT`, `NOT_FOUND` (404).

### DELETE /api/favorites/{advertId}
- Auth: user
- Rate limit: yes — 30/60s (`favorites:delete`), keyed by userId or IP
- Request (path): `advertId` (uuid)
- Behavior: deletes the user's favorite; 404 if none deleted.
- Response: `{ message: "Removed from favorites", advert_id }`. Errors: `UNAUTH` (401), `BAD_INPUT`, `NOT_FOUND` (404).

---

## Search

### GET /api/search
- Auth: none (public)
- Rate limit: yes — per IP, 60/60s (`search:ip`, env `RATE_LIMIT_SEARCH_IP_PER_MIN`). Instant/typeahead requests (`instant=1`) use a separate higher bucket, 240/60s (`search:instant:ip`, env `RATE_LIMIT_SEARCH_INSTANT_IP_PER_MIN`).
- Request (query, `searchAdvertsQuerySchema`): `q?` (1–200), `category_id?` (uuid), `price_min?`/`price_max?` (numeric; min≤max), `location?` (≤200), `condition?` (new|used|for_parts), `verified_only?` (true/1/yes), `lat?`/`lng?` (paired; valid coordinate ranges), `radius_km?` (>0, ≤1000, default 50), `sort_by?` (relevance|price_asc|price_desc|created_at_asc|created_at_desc, default created_at_desc), `page?` (default 0), `limit?` (default 24, max 100). `instant?` (1/true) — typeahead flag, only affects rate-limit bucket.
- Behavior: RPC `search_adverts`; projects each row to card fields (drops `description`, `condition`, `status`, `location_id`, `updated_at`, `relevance_rank`, `total_count`); coerces `seller_verified`; attaches signed `image` + `like_count`.
- Response: `{ items: [{ id, user_id, category_id, title, price, currency, location, created_at, seller_verified, image, like_count }], total, page, limit, hasMore }`. Errors: validation, `FETCH_FAILED`.

---

## Phone (Verification)

### POST /api/phone/request
- Auth: user
- Rate limit: yes — user 5/900s (`otp:user`, env `RATE_LIMIT_OTP_USER_PER_15M`), IP-fallback 5/900s (anonymous only), AND IP 20/3600s (`otp:ip`, env `RATE_LIMIT_OTP_IP_PER_60M`)
- Request (JSON, `requestOtpSchema`): `phone` (E.164, `^\+\d{8,15}$`)
- Behavior: optional Twilio carrier lookup; upserts `phones`; deactivates prior OTPs; stores HMAC-hashed 6-digit OTP (10-min expiry) in `phone_otps`; sends SMS via Twilio; logs `phone_request`.
- Response: `{}`. Errors: `UNAUTH` (401), `PHONE_SAVE_FAILED`, `OTP_CLEANUP_FAILED`, `OTP_CREATE_FAILED`, `SMS_SEND_FAIL` (500).

### POST /api/phone/verify
- Auth: user
- Rate limit: yes — user 5/900s (`otp:verify:user`), IP-fallback 5/900s (anonymous only), AND IP 20/3600s (`otp:verify:ip`)
- Request (JSON, `verifyOtpSchema`): `phone` (E.164), `code` (string 1–10)
- Behavior: finds latest unused OTP; checks expiry; locks after 5 attempts (429); HMAC-compares; on success marks OTP used and `phones.verified = true`; logs `phone_verify`.
- Response: `{}`. Errors: `UNAUTH` (401), `OTP_NOT_FOUND` (400), `OTP_EXPIRED` (400), `OTP_LOCKED` (429), `OTP_INVALID` (400), `PHONE_UPDATE_FAILED`.

---

## Misc

### POST /api/locale
- Auth: none
- Rate limit: no
- Request (JSON): `locale` (string)
- Behavior: resolves and sets `locale` cookie (1-year, `sameSite: lax`, not httpOnly).
- Response (custom top-level, **not** enveloped): `{ ok: true, locale }`. Errors: `{ ok: false, error: "INVALID_LOCALE" }` (400), `{ ok: false, error: "INTERNAL_ERROR" }` (500).

### GET /api/me
- Auth: none (optional) — anonymous returns all-null payload
- Rate limit: no
- Request: none
- Behavior: aggregates `profiles` + `phones` for the current user.
- Response: `{ user, profile, phone: { number, verified } | null, verifiedPhone, verifiedEmail, consents }` (anonymous: all `null`/`false`).

### POST /api/comparison
- Auth: user
- Rate limit: no
- Request (JSON, `payloadSchema`): `advertIds` (array of uuids, min 2, max 4; no duplicates)
- Behavior: loads active adverts with category, specifics, signed first image, seller trust score + verified flag; preserves request order.
- Response: `{ adverts: Array<{ id, title, price, currency, location, categoryId, categoryName, condition, image, createdAt, sellerVerified, sellerTrustScore, specifics }> }`. Errors: `UNAUTH` (401), `INVALID_JSON`, `BAD_INPUT` (validation / not enough active / not found / duplicates), `FETCH_FAILED`.

### GET /api/top-adverts
- Auth: none (public)
- Rate limit: yes — per IP, 60/60s (`top-adverts`)
- Request (query): `limit?` (default 10, max 100)
- Behavior: scores up to 1000 recent active adverts by `views*1 + favorites*5` (views last 30 days); attaches first image.
- Response: `{ adverts: Array<{ id, title, price, currency, location, status, created_at, user_id, view_count, favorite_count, popularity_score, image }>, total }`. Errors: `FETCH_FAILED` (500).

### GET /api/top-sellers
- Auth: none (public)
- Rate limit: yes — per IP, 60/60s (`top-sellers`)
- Request (query): `limit?` (default 10, max 100), `offset?` (default 0)
- Behavior: reads `top_sellers` materialized view.
- Response: `{ sellers: [...], total, limit, offset }`. Errors: `FETCH_FAILED` (500).

---

## Notes / unverified items

- Rate limits "fail open" if Upstash env vars are unset (all such routes effectively unlimited in that configuration).
- `reports/list` does not issue a distinct 401 for anonymous callers; `hasAdminRole(null)` returns false so anonymous requests get 403.
- `chat/history` accepts a `cursor` as a message id and filters `id < cursor`; the numeric-vs-uuid id type for `messages` is unverified from the route files alone.
