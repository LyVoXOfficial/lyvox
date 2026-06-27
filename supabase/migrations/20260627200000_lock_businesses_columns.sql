-- Integrity: the authenticated role had table-wide UPDATE on businesses, letting an owner bypass the
-- API route + zod strip via direct PostgREST and set entity_verified/status/kbo/vat etc.
-- Restrict authenticated to ONLY the owner-editable trader columns. Verification/status writes go
-- through SECURITY DEFINER (the sync_verification_caches trigger, create_business RPC) or the
-- service-role client, none of which are affected by a grant on the authenticated role.
revoke update on public.businesses from authenticated;
grant update (trade_name, legal_form, address_line, postcode, city, country, email, phone_e164, withdrawal_terms, returns_url)
  on public.businesses to authenticated;
