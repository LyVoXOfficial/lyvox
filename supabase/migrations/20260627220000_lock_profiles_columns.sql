-- profiles had table-wide UPDATE for authenticated (RLS is row-only). Restrict to the user-editable
-- columns so the entitlement/trust columns (pro_until, stripe_customer_id, verified_email,
-- itsme_verified, itsme_kyc_level, rating, flags, blocked_until, total_deals) can only be
-- written by service-role (Stripe webhook/subscribe, registration) and SECURITY DEFINER triggers.
--
-- Authenticated write paths enumerated (all cookie-client, supabaseServer / anon-key SSR):
--   display_name     — profile/edit/page.tsx (upsert) + api/profile/update/route.ts (upsert)
--   phone            — profile/edit/page.tsx (upsert) + VerifyPhoneClient.tsx (update)
--   verified_phone   — VerifyPhoneClient.tsx (update after OTP success)
--   consents         — api/profile/consents/route.ts (update)
--   seller_type      — api/business/route.ts (update via supabase cookie client, step 5)
--   notification_preferences — api/notifications/preferences/route.ts (update)
--
-- IMPORTANT COMPANION REQUIREMENT (outside this migration's scope):
--   auth/callback/route.ts sets itsme_verified + itsme_kyc_level via the cookie client.
--   Those columns are intentionally excluded here (trust columns, exploit surface).
--   The callback route MUST be changed to use supabaseService() for that update before this
--   migration is applied to production, or itsme users will silently lose their verified badge.
--   See: apps/web/src/app/auth/callback/route.ts lines 123-129.
--
-- Service-role writes (UNAFFECTED by this grant):
--   verified_email        — sync_profile_verified_email SECURITY DEFINER trigger (20260626160000)
--   itsme_verified        — auth/callback/route.ts (MUST migrate to service-role before deploy)
--   itsme_kyc_level       — auth/callback/route.ts (same)
--   pro_until             — billing/webhook/route.ts (supabaseService)
--   stripe_customer_id    — billing/subscribe/route.ts (supabaseService) + webhook (supabaseService)
--   rating, total_deals   — no authenticated path writes these (system/admin only)
--   flags, blocked_until  — no authenticated path writes these (admin/fraud system only)

revoke update on public.profiles from authenticated;
grant update (display_name, phone, verified_phone, consents, seller_type, notification_preferences)
  on public.profiles to authenticated;
