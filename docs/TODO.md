# LyVoX TODO

- [x] Enable RLS and apply the policies described in `docs/requirements.md` for `adverts`, `media`, `categories`, `profiles`, `phones`, `phone_otps`, and `logs` (create timestamped Supabase migrations).
- [x] Replace `LYVOX_ADMIN_EMAIL` / `NEXT_PUBLIC_ADMIN_EMAIL` checks with Supabase JWT role claims (`app_metadata.role = 'admin'`) and update UI conditionals accordingly.
- [x] Implement Upstash-backed rate limiting middleware for `/api/phone/*` and `/api/reports/*` endpoints using `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
- [x] Break down `supabase/reports.sql` into incremental migrations and register them with the Supabase CLI.
- [x] Add a scheduled job (Edge Function or cron) to delete expired `phone_otps` rows and anonymise stale `logs` entries beyond retention windows.
- [ ] Expand automated API tests to cover happy/error-paths described in `docs/API_REFERENCE.md`.

_No undocumented or deprecated API routes were detected during the 2025-10-05 audit._
- [x] Add consent management UI in profile settings (toggle marketing opt-in, export history).
- [x] Add automated tests for  `/api/auth/register` and onboarding redirects. 
