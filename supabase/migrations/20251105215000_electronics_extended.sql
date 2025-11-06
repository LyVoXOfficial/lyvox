-- Migration: Electronics Extended Dictionaries
-- Purpose: Extend electronics dictionaries with device models for autocomplete
-- Date: 2025-11-05
-- Dependencies: 20251105213527_catalog_dictionaries.sql (device_brands already created)

-- =============================================================================
-- DEVICE MODELS (Optional, for autocomplete)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.device_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.device_brands(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN (
    'phone', 'tablet', 'laptop', 'desktop', 'camera', 'tv', 
    'audio', 'console', 'watch', 'monitor', 'printer', 'other'
  )),
  release_year INT CHECK (release_year >= 2000 AND release_year <= EXTRACT(YEAR FROM NOW()) + 1),
  discontinued BOOLEAN DEFAULT false,
  
  -- Optional specs for filtering/search
  specs JSONB DEFAULT '{}', -- Flexible storage for model-specific specs
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, slug, device_type)
);

CREATE INDEX device_models_brand_idx ON public.device_models(brand_id);
CREATE INDEX device_models_type_idx ON public.device_models(device_type);
CREATE INDEX device_models_year_idx ON public.device_models(release_year);
CREATE INDEX device_models_active_idx ON public.device_models(brand_id, device_type) 
  WHERE discontinued = false;

-- GIN index for JSONB specs (for advanced search)
CREATE INDEX device_models_specs_idx ON public.device_models USING GIN (specs);

-- =============================================================================
-- STORAGE OPTIONS (Standardized values)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.storage_options (
  value TEXT PRIMARY KEY, -- '16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB', '4TB'
  value_bytes BIGINT NOT NULL, -- Actual bytes for calculations
  sort_order INT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('phone', 'tablet', 'laptop', 'desktop', 'other')),
  obsolete BOOLEAN DEFAULT false -- '16GB' is obsolete for modern phones
);

-- Insert common storage options
INSERT INTO public.storage_options (value, value_bytes, sort_order, category, obsolete) VALUES
  -- Phone/Tablet storage
  ('16GB', 16 * 1024 * 1024 * 1024::BIGINT, 1, 'phone', true),
  ('32GB', 32 * 1024 * 1024 * 1024::BIGINT, 2, 'phone', false),
  ('64GB', 64 * 1024 * 1024 * 1024::BIGINT, 3, 'phone', false),
  ('128GB', 128 * 1024 * 1024 * 1024::BIGINT, 4, 'phone', false),
  ('256GB', 256 * 1024 * 1024 * 1024::BIGINT, 5, 'phone', false),
  ('512GB', 512 * 1024 * 1024 * 1024::BIGINT, 6, 'phone', false),
  ('1TB', 1024 * 1024 * 1024 * 1024::BIGINT, 7, 'phone', false),
  -- Laptop/Desktop storage
  ('128GB', 128 * 1024 * 1024 * 1024::BIGINT, 1, 'laptop', false),
  ('256GB', 256 * 1024 * 1024 * 1024::BIGINT, 2, 'laptop', false),
  ('512GB', 512 * 1024 * 1024 * 1024::BIGINT, 3, 'laptop', false),
  ('1TB', 1024 * 1024 * 1024 * 1024::BIGINT, 4, 'laptop', false),
  ('2TB', 2 * 1024 * 1024 * 1024 * 1024::BIGINT, 5, 'laptop', false),
  ('4TB', 4 * 1024 * 1024 * 1024 * 1024::BIGINT, 6, 'laptop', false)
ON CONFLICT (value) DO NOTHING;

-- =============================================================================
-- MEMORY (RAM) OPTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.memory_options (
  value TEXT PRIMARY KEY, -- '2GB', '4GB', '6GB', '8GB', '12GB', '16GB', '32GB', '64GB'
  value_bytes BIGINT NOT NULL,
  sort_order INT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('phone', 'tablet', 'laptop', 'desktop', 'other'))
);

-- Insert common RAM options
INSERT INTO public.memory_options (value, value_bytes, sort_order, category) VALUES
  -- Phone/Tablet RAM
  ('2GB', 2 * 1024 * 1024 * 1024::BIGINT, 1, 'phone'),
  ('3GB', 3 * 1024 * 1024 * 1024::BIGINT, 2, 'phone'),
  ('4GB', 4 * 1024 * 1024 * 1024::BIGINT, 3, 'phone'),
  ('6GB', 6 * 1024 * 1024 * 1024::BIGINT, 4, 'phone'),
  ('8GB', 8 * 1024 * 1024 * 1024::BIGINT, 5, 'phone'),
  ('12GB', 12 * 1024 * 1024 * 1024::BIGINT, 6, 'phone'),
  ('16GB', 16 * 1024 * 1024 * 1024::BIGINT, 7, 'phone'),
  -- Laptop/Desktop RAM
  ('4GB', 4 * 1024 * 1024 * 1024::BIGINT, 1, 'laptop'),
  ('8GB', 8 * 1024 * 1024 * 1024::BIGINT, 2, 'laptop'),
  ('16GB', 16 * 1024 * 1024 * 1024::BIGINT, 3, 'laptop'),
  ('32GB', 32 * 1024 * 1024 * 1024::BIGINT, 4, 'laptop'),
  ('64GB', 64 * 1024 * 1024 * 1024::BIGINT, 5, 'laptop'),
  ('128GB', 128 * 1024 * 1024 * 1024::BIGINT, 6, 'laptop')
ON CONFLICT (value) DO NOTHING;

-- =============================================================================
-- IMEI VALIDATION FUNCTION
-- =============================================================================

-- Validate IMEI using Luhn algorithm
CREATE OR REPLACE FUNCTION validate_imei(imei TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_imei TEXT;
  digit INT;
  sum INT := 0;
  i INT;
  doubled INT;
BEGIN
  -- Remove non-numeric characters
  clean_imei := REGEXP_REPLACE(imei, '[^0-9]', '', 'g');
  
  -- IMEI must be exactly 15 digits
  IF LENGTH(clean_imei) != 15 THEN
    RETURN FALSE;
  END IF;
  
  -- Luhn algorithm check
  FOR i IN 1..14 LOOP
    digit := SUBSTRING(clean_imei, i, 1)::INT;
    
    IF i % 2 = 0 THEN
      doubled := digit * 2;
      IF doubled > 9 THEN
        doubled := doubled - 9;
      END IF;
      sum := sum + doubled;
    ELSE
      sum := sum + digit;
    END IF;
  END LOOP;
  
  -- Check digit should make sum divisible by 10
  RETURN (sum * 9) % 10 = SUBSTRING(clean_imei, 15, 1)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_imei(TEXT) IS 
  'Validates IMEI number using Luhn algorithm. 
   Used for phone/tablet listings to ensure valid device identification.';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.device_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_options ENABLE ROW LEVEL SECURITY;

-- Public read-only
CREATE POLICY "public_read_device_models" ON public.device_models FOR SELECT USING (true);
CREATE POLICY "public_read_storage_options" ON public.storage_options FOR SELECT USING (true);
CREATE POLICY "public_read_memory_options" ON public.memory_options FOR SELECT USING (true);

-- =============================================================================
-- HELPER FUNCTIONS FOR AUTOCOMPLETE
-- =============================================================================

-- Search device models by brand and name (for autocomplete)
CREATE OR REPLACE FUNCTION search_device_models(
  p_brand_slug TEXT,
  p_device_type TEXT,
  p_search_term TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  brand_name TEXT,
  model_name TEXT,
  device_type TEXT,
  release_year INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.id,
    db.name AS brand_name,
    dm.name AS model_name,
    dm.device_type,
    dm.release_year
  FROM public.device_models dm
  JOIN public.device_brands db ON dm.brand_id = db.id
  WHERE db.slug = p_brand_slug
    AND dm.device_type = p_device_type
    AND dm.discontinued = false
    AND (
      p_search_term IS NULL 
      OR dm.name ILIKE '%' || p_search_term || '%'
    )
  ORDER BY dm.release_year DESC, dm.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION search_device_models(TEXT, TEXT, TEXT, INT) IS 
  'Autocomplete search for device models by brand and type. 
   Example: search_device_models(''apple'', ''phone'', ''iphone 13'', 10)';

-- =============================================================================
-- COMMENTS (Documentation)
-- =============================================================================

COMMENT ON TABLE public.device_models IS 
  'Device model catalog for autocomplete and validation. 
   Links to device_brands. Used for phones, tablets, laptops, etc.';

COMMENT ON TABLE public.storage_options IS 
  'Standardized storage capacity values (16GB, 32GB, etc.) 
   with byte values for accurate comparisons and sorting.';

COMMENT ON TABLE public.memory_options IS 
  'Standardized RAM/memory values (2GB, 4GB, etc.) 
   with byte values for accurate comparisons and sorting.';

-- =============================================================================
-- STATISTICS
-- =============================================================================

ANALYZE public.device_models;
ANALYZE public.storage_options;
ANALYZE public.memory_options;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (commented out)
-- =============================================================================

/*
-- To rollback this migration:

DROP FUNCTION IF EXISTS search_device_models(TEXT, TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS validate_imei(TEXT);

DROP POLICY IF EXISTS "public_read_memory_options" ON public.memory_options;
DROP POLICY IF EXISTS "public_read_storage_options" ON public.storage_options;
DROP POLICY IF EXISTS "public_read_device_models" ON public.device_models;

DROP INDEX IF EXISTS device_models_specs_idx;
DROP INDEX IF EXISTS device_models_active_idx;
DROP INDEX IF EXISTS device_models_year_idx;
DROP INDEX IF EXISTS device_models_type_idx;
DROP INDEX IF EXISTS device_models_brand_idx;

DROP TABLE IF EXISTS public.memory_options CASCADE;
DROP TABLE IF EXISTS public.storage_options CASCADE;
DROP TABLE IF EXISTS public.device_models CASCADE;
*/

