last_sync: 2025-10-28

# Phone Verification Domain

## Overview
- Handles SMS-based phone verification required for trust & safety workflows.
- Uses Twilio Lookup + Messaging APIs, rate-limited through Upstash Redis.
- Data persisted in `public.phones` and `public.phone_otps`; audit events written to `public.logs`.
- Related docs: [requirements.md](../requirements.md), [domains/profile.md](./profile.md), [API_REFERENCE.md](../API_REFERENCE.md).

## Data Model
- `public.phones`:
  - `user_id uuid` (PK), `e164 text` (unique), `verified boolean`, `lookup jsonb` (carrier metadata), `updated_at timestamptz`.
  - Represents the canonical verified number; mirrored into `profiles.phone` for display backwards-compatibility.
- `public.phone_otps`:
  - `id bigint`, `user_id uuid`, `e164 text`, `code text`, `expires_at timestamptz`, `attempts int`, `used boolean`, `created_at timestamptz`.
  - Stores active OTP challenges; cron job (see TODOs) should purge expired rows.
- Relationships:
  - `phones.user_id` ↔ `auth.users.id` (1:1, cascade delete).
  - OTP rows reference `auth.users` via nullable `user_id` (for pre-auth flows).

## API Surface
- `POST /api/phone/request` — issues OTP codes:
  - Validates E164 format, ensures Twilio credentials available.
  - Upserts `phones` record (sets `verified=false`, stores lookup payload).
  - Inserts OTP row and sends SMS via Twilio Messaging API.
  - Logs `phone_request` audit entry.
- `POST /api/phone/verify` — confirms OTP:
  - Validates last unused OTP for the user + phone, enforces expiry (10 min), attempt limit (5).
  - Marks OTP as `used`, sets `phones.verified=true`, logs `phone_verify`.
- Supporting UI located under `/profile/phone` and the onboarding flow.

## RLS & Security
- Policies (see `20251005191500_enable_rls_and_policies.sql`):
  - `phones`: owners (`user_id = auth.uid()`) can read and upsert their own record; admins manage via `public.is_admin()`.
  - `phone_otps`: owners can read/manage their rows; admins also allowed. RLS combined with API logic ensures OTP secrets remain scoped.
- `logs` insert policy allows authenticated users to record their own actions; admin/service role can audit.

## Rate Limiting
- `phone_request` endpoint: user limit (`otp:user`) default 5 per 15 minutes, IP limit (`otp:ip`) default 20 per hour (fallback bucket).
- Admin overrides configurable through environment variables listed in `.env.example` (e.g., `RATE_LIMIT_OTP_USER_PER_15M`).
- Verification endpoint (`phone/verify`) is not rate-limited but increments `attempts` and locks after 5 tries.

## Integrations & Configuration
- Environment variables (see `.env.example`):
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `TWILIO_LOOKUP_URL`.
  - Upstash Redis: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Cron/Edge function should purge expired OTPs and anonymise old lookup payloads (tracked in TODO).
- DSAR exports must include phone number + verification flag (documented in [requirements.md](../requirements.md#data-retention)).

## Improvements & TODO Links
- TODO.md already covers cron cleanup for expired OTPs (completed) and broader DSAR workflows.
- TODO.md: "Review OTP TTL and resend UX; confirm 10-minute expiry and audit logging satisfy product requirements."
- Consider masking `lookup` payload before storing or trimming to minimal fields to reduce PII exposure.

## Change Log
- 2025-10-28: First domain write-up covering Twilio workflow, rate limits, and RLS protections.

---

## 🔗 Related Docs

**Domains:** [devops.md](./devops.md) • [profile.md](./profile.md) • [trust_score.md](./trust_score.md) • [adverts.md](./adverts.md)
**Development:** [security-compliance.md](../development/security-compliance.md)
