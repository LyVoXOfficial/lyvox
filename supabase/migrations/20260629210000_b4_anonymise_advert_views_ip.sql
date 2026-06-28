-- B4: Anonymise ip_address in advert_views (GDPR — plaintext PII removal).
--
-- The raw IP is no longer needed: viewer dedup uses viewer_key (md5 hash for
-- anonymous visitors) from F11. Rate limiting reads IP from the HTTP request
-- at runtime — not from the database.
--
-- Strategy:
--   1. Anonymise existing rows:
--        IPv4  → /24 mask  (zero the last octet,    e.g. 1.2.3.4   → 1.2.3.0)
--        IPv6  → /48 mask  (zero bytes 7–16,         e.g. 2001:db8::1 → 2001:db8::)
--        NULL  → stays NULL
--   2. New rows will no longer receive ip_address (removed from the API route).
--      The column is kept (nullable) so the table DDL stays stable; all new
--      rows land with ip_address = NULL.

-- Idempotent: the WHERE clause skips rows already anonymised (i.e. whose
-- ip_address already equals the truncated network address for their family).

UPDATE public.advert_views
SET ip_address =
  CASE
    -- IPv4: zero the last octet (apply /24 network mask)
    WHEN family(ip_address) = 4
      THEN network(set_masklen(ip_address::inet, 24))::inet
    -- IPv6: apply /48 prefix
    WHEN family(ip_address) = 6
      THEN network(set_masklen(ip_address::inet, 48))::inet
    ELSE NULL
  END
WHERE ip_address IS NOT NULL
  AND (
    -- IPv4 not yet a /24 network address (host bits beyond octet 3 are non-zero)
    (family(ip_address) = 4
      AND ip_address != network(set_masklen(ip_address, 24))::inet)
    OR
    -- IPv6 not yet a /48 network address
    (family(ip_address) = 6
      AND ip_address != network(set_masklen(ip_address, 48))::inet)
  );

COMMENT ON COLUMN public.advert_views.ip_address IS
  'Anonymised visitor IP (/24 for IPv4, /48 for IPv6). Raw IPs removed 2026-06-29 (B4/GDPR). New rows have NULL here; dedup uses viewer_key instead.';
