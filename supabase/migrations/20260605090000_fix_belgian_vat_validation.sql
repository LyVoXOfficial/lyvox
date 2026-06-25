-- Fix Belgian VAT/CBE validation.
--
-- The original function stripped all non-digits and then removed a leading 0.
-- Belgian enterprise/VAT numbers are 10 digits and commonly start with 0
-- (for example BE 0123.456.749), so that made valid numbers fail.

CREATE OR REPLACE FUNCTION validate_belgian_vat(vat TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  normalized TEXT;
  clean_vat TEXT;
  base_number BIGINT;
  check_digits INT;
  calculated_check INT;
BEGIN
  IF vat IS NULL THEN
    RETURN FALSE;
  END IF;

  normalized := UPPER(TRIM(vat));
  normalized := REGEXP_REPLACE(normalized, '^BE\s*', '', 'i');
  clean_vat := REGEXP_REPLACE(normalized, '[^0-9]', '', 'g');

  IF LENGTH(clean_vat) != 10 THEN
    RETURN FALSE;
  END IF;

  base_number := SUBSTRING(clean_vat, 1, 8)::BIGINT;
  check_digits := SUBSTRING(clean_vat, 9, 2)::INT;
  calculated_check := 97 - (base_number % 97);

  IF calculated_check = 0 THEN
    calculated_check := 97;
  END IF;

  RETURN calculated_check = check_digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_belgian_vat(TEXT) IS
  'Validates Belgian VAT/CBE number (BTW/TVA/KBO/BCE) using mod 97. Accepts optional BE prefix and preserves the leading zero in 10-digit numbers.';
