-- A0 Security Hardening: lock authenticated/anon writes to sensitive columns.
--
-- Root cause: the Supabase bootstrap grants `authenticated` AND `anon` table-wide
-- INSERT/UPDATE on every public table. RLS gives ROW security, not COLUMN security,
-- so any user-editable table with trust/moderation/ownership columns is self-grantable
-- via direct PostgREST. This migration column-scopes the writes (same pattern already
-- applied to businesses + profiles) for the confirmed live-exploitable tables.
--
-- PRECONDITION (deploy order): the application code that performs the now-removed
-- writes via the SERVICE-ROLE client must already be deployed (commits 2d913a1,
-- 6d0d4fd, e4a6f70 — adverts creation/status, phones+phone_otps writes, native phone
-- confirm). Applying this before that code is live would break those flows.

begin;

-- ── adverts ──────────────────────────────────────────────────────────────────
-- Exploit: direct INSERT/UPDATE could set business_id (impersonate a verified
-- trader), status (DB default is 'active' → instant public+unmoderated), moderation_status,
-- ai_moderation_*, user_id. Creation is now fully service-role; admin moderation already
-- service-role; owner-edit benign fields stay cookie-client. No INSERT for authenticated/anon.
revoke insert, update on public.adverts from authenticated, anon;
grant update (title, description, price, currency, condition, location, location_id, category_id)
  on public.adverts to authenticated;

-- ── phones ───────────────────────────────────────────────────────────────────
-- Exploit: owner could set phones.verified=true directly (self-verify, bypass OTP).
-- All phones writes are service-role now. Keep SELECT (status display).
revoke insert, update, delete on public.phones from authenticated, anon;

-- ── phone_otps ───────────────────────────────────────────────────────────────
-- Exploit: owner could tamper used/attempts/code_hash. Fully server-managed now
-- (all access service-role). Revoke writes AND select (OTP hashes must not be client-readable).
revoke insert, update, delete, select on public.phone_otps from authenticated, anon;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Fix prior lock regression: verified_phone was granted to authenticated, letting a
-- user PATCH their own trust flag (requireVerified = profiles.verified_phone OR phones.verified).
-- Re-issue the column grant WITHOUT verified_phone (now written server-side by the
-- native-confirm route + the verifications sync trigger).
revoke update on public.profiles from authenticated;
grant update (display_name, phone, consents, seller_type, notification_preferences)
  on public.profiles to authenticated;

-- ── catalog reference (RLS DISABLED → anon-writable) ──────────────────────────
-- Exploit: these tables have RLS disabled, so the table-wide grant lets ANY
-- unauthenticated visitor rewrite catalog config. Reference data — writes belong
-- to admin/service-role only.
-- NOTE: `spatial_ref_sys` is also RLS-disabled + anon-writable, but it is owned by
-- the PostGIS extension (not our role), so we cannot revoke its grants here (REVOKE
-- emits "no privileges could be revoked"). Residual low-risk (PostGIS EPSG reference
-- data); follow-up = ask Supabase support to lock it or confirm the API gateway
-- excludes system tables. Left out so this migration applies cleanly.
revoke insert, update, delete
  on public.catalog_fields, public.catalog_field_options, public.catalog_subcategory_schema
  from authenticated, anon;

commit;
