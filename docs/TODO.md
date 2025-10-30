# LyVoX TODO

- [x] Enable RLS and apply the policies described in `docs/requirements.md` for `adverts`, `media`, `categories`, `profiles`, `phones`, `phone_otps`, and `logs` (create timestamped Supabase migrations).
- [x] Replace `LYVOX_ADMIN_EMAIL` / `NEXT_PUBLIC_ADMIN_EMAIL` checks with Supabase JWT role claims (`app_metadata.role = 'admin'`) and update UI conditionals accordingly.
- [x] Implement Upstash-backed rate limiting middleware for `/api/phone/*` and `/api/reports/*` endpoints using `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
- [x] Break down `supabase/reports.sql` into incremental migrations and register them with the Supabase CLI.
- [x] Add a scheduled job (Edge Function or cron) to delete expired `phone_otps` rows and anonymise stale `logs` entries beyond retention windows.
- [ ] Expand automated API tests to cover happy/error-paths described in `docs/API_REFERENCE.md`.
- [ ] Capture and validate Recupel membership IDs for commercial sellers before allowing electronic listings (WEEE compliance, 2025-03-29).
- [ ] Implement cascading make/model/year selectors for Transport listings using `seed/transport_make_model.csv`, require mileage & condition inputs, and surface a dedicated EV subcategory.
- [ ] Ship migrations for `conversations`, `conversation_participants`, `messages`, refresh `supabase/types/database.types.ts`, and sync domain docs for realtime chat.
- [ ] Expose chat server actions or `/api/chat/*` endpoints that enforce participant membership, rely on `supabaseService()` server-side only, and apply rate limiting on send.
- [ ] Deliver client-only chat UI (`ChatWindow.tsx`) with Supabase Realtime subscription lifecycle (subscribe/retry/unsubscribe) and optimistic message handling.
- [ ] Add QA coverage: preview smoke-test for realtime chat, reconnection scenarios, and Sentry alerting for channel/system errors.
- [ ] Notifications for chat: define event→channel matrix (email/push), templates, and delivery logs; implement dedupe + quiet hours.
- [ ] Retention policy for chat: TTLs, DSAR export, soft-delete + cron cleanup for expired messages/conversations.
- [ ] Moderation integration: message-level reports, auto-mute rules, admin review surfaces.

_No undocumented or deprecated API routes were detected during the 2025-10-05 audit._
- [x] Add consent management UI in profile settings (toggle marketing opt-in, export history).
- [x] Add automated tests for  `/api/auth/register` and onboarding redirects. 
- [ ] Revisit @supabase/ssr once a stable release >0.7.x is published; upgrade only after successful 'pnpm install', 'pnpm exec tsc --noEmit', and manual SSR auth smoke-test via 'supabaseServer()'.
- [ ] Review OTP TTL and resend UX; confirm 10-minute expiry and audit logging satisfy product requirements.
- [ ] Evaluate rate limiting strategy for media upload/complete endpoints once production traffic increases.
 
## Internationalization (i18n)
- [ ] Audit UI strings and replace hardcoded text with `t()` across pages (ad detail, profile, posting, auth, admin).
- [ ] Add hreflang and SEO meta for alternates; per-locale OG tags.
- [ ] Localise email/push templates (terms/privacy links per locale).
- [ ] Add currency/number/date helpers based on chosen locale; validate Transport category formatting.
- [ ] Language switcher: remember last choice; add footer and settings entry.

## Vehicle catalog i18n
- [ ] Populate `vehicle_make_i18n`, `vehicle_model_i18n`, `vehicle_generation_i18n` from curated CSVs in `seed/i18n/` (avoid machine translation of proper names).
- [ ] Update API/queries to join i18n tables by cookie locale; add graceful fallback to EN.
- [ ] Keep `body/fuel/transmission` as codes in UI dictionaries; map existing EN values to codes where needed.
- [ ] Neutralise `vehicle_makes.category_path` to a slug (e.g., `transport/cars`) and translate labels in UI.

## German (de) rollout
- [ ] Verify and QA auto-translated vehicle summaries (spot-check technical accuracy).
- [ ] Add missing German translations in seed CSVs under `seed/i18n/*`.
- [ ] Check SEO hreflang coverage after adding `de` (alternates and OG `alternateLocale`).

## Vehicle deep content i18n
- [ ] Render localized `inspection_tips` / `pros` / `cons` / `common_issues` from `vehicle_generation_i18n` in listing cards and detail views.
