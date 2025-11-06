-- Migration: Real Estate Catalog
-- Purpose: Create specialized tables for real estate listings (sale & rent)
-- Date: 2025-11-05
-- Dependencies: 20251105213527_catalog_dictionaries.sql

-- =============================================================================
-- MAIN PROPERTY LISTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_listings (
  advert_id UUID PRIMARY KEY REFERENCES public.adverts(id) ON DELETE CASCADE,
  
  -- Classification
  property_type_id UUID REFERENCES public.property_types(id),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  
  -- Dimensions (REQUIRED)
  area_sqm NUMERIC NOT NULL CHECK (area_sqm > 0 AND area_sqm <= 10000),
  land_area_sqm NUMERIC CHECK (land_area_sqm > 0), -- For houses/land
  rooms INT CHECK (rooms >= 0 AND rooms <= 20),
  bedrooms INT CHECK (bedrooms >= 0 AND bedrooms <= 15),
  bathrooms NUMERIC CHECK (bathrooms >= 0 AND bathrooms <= 10), -- Allow 1.5 = 1 full + 1 half
  
  -- Building Info
  year_built INT CHECK (year_built >= 1800 AND year_built <= EXTRACT(YEAR FROM NOW())),
  renovation_year INT CHECK (renovation_year >= year_built AND renovation_year <= EXTRACT(YEAR FROM NOW())),
  floor INT CHECK (floor >= -3 AND floor <= 150), -- Negative = basement
  total_floors INT CHECK (total_floors > 0),
  
  -- Energy & Compliance (Belgium-specific)
  epc_rating TEXT REFERENCES public.epc_ratings(code),
  epc_cert_number TEXT, -- Format: YYYYMMDD-NNNNNNN-NN
  epc_kwh_per_sqm_year INT CHECK (epc_kwh_per_sqm_year > 0),
  peb_url TEXT, -- Link to official PEB/EPB certificate
  
  -- Heating & Utilities
  heating_type TEXT[], -- ['gas', 'electric', 'oil', 'heat_pump', 'solar', 'wood', 'district']
  water_heater_type TEXT CHECK (water_heater_type IN ('instant', 'tank', 'solar')),
  double_glazing BOOLEAN DEFAULT false,
  
  -- Rental-Specific Fields (NULL if for sale)
  rent_monthly NUMERIC CHECK (rent_monthly IS NULL OR rent_monthly > 0),
  rent_charges_monthly NUMERIC CHECK (rent_charges_monthly IS NULL OR rent_charges_monthly >= 0),
  syndic_cost_monthly NUMERIC CHECK (syndic_cost_monthly IS NULL OR syndic_cost_monthly >= 0),
  deposit_months NUMERIC CHECK (deposit_months IS NULL OR (deposit_months >= 0 AND deposit_months <= 3)), -- Belgium law: max 3 months
  lease_duration_months INT CHECK (lease_duration_months IS NULL OR (lease_duration_months >= 1 AND lease_duration_months <= 120)),
  available_from DATE,
  furnished TEXT CHECK (furnished IN ('unfurnished', 'semi_furnished', 'fully_furnished')),
  
  -- Sale-Specific Fields (HIDDEN from public)
  cadastral_reference TEXT, -- Format: DIV/SEC/PARCEL/SUBPARCEL
  land_registry_number TEXT,
  notary_name TEXT CHECK (LENGTH(notary_name) <= 200),
  
  -- Location Details (in addition to adverts.location)
  postcode TEXT NOT NULL CHECK (postcode ~ '^[1-9][0-9]{3}$'), -- 4-digit Belgian postcode
  municipality TEXT NOT NULL CHECK (LENGTH(municipality) <= 100),
  neighborhood TEXT CHECK (LENGTH(neighborhood) <= 100),
  
  -- Parking
  parking_spaces INT DEFAULT 0 CHECK (parking_spaces >= 0 AND parking_spaces <= 10),
  parking_type TEXT[], -- ['garage', 'carport', 'street', 'underground']
  
  -- Outdoor Space
  terrace_sqm NUMERIC CHECK (terrace_sqm IS NULL OR terrace_sqm > 0),
  garden_sqm NUMERIC CHECK (garden_sqm IS NULL OR garden_sqm > 0),
  garden_orientation TEXT CHECK (garden_orientation IN ('north', 'south', 'east', 'west')),
  
  -- Building Features (booleans)
  elevator BOOLEAN DEFAULT false,
  cellar BOOLEAN DEFAULT false,
  attic BOOLEAN DEFAULT false,
  
  -- Policies (for rentals)
  pet_friendly BOOLEAN,
  smoking_allowed BOOLEAN,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT rent_requires_monthly CHECK (
    (listing_type = 'sale' AND rent_monthly IS NULL) OR 
    (listing_type = 'rent' AND rent_monthly IS NOT NULL)
  ),
  CONSTRAINT bedrooms_lte_rooms CHECK (bedrooms IS NULL OR rooms IS NULL OR bedrooms <= rooms),
  CONSTRAINT renovation_after_build CHECK (renovation_year IS NULL OR year_built IS NULL OR renovation_year >= year_built)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Primary search indexes
CREATE INDEX property_listings_type_idx ON public.property_listings(property_type_id);
CREATE INDEX property_listings_listing_type_idx ON public.property_listings(listing_type);
CREATE INDEX property_listings_postcode_idx ON public.property_listings(postcode);
CREATE INDEX property_listings_municipality_idx ON public.property_listings(municipality);

-- Filter indexes
CREATE INDEX property_listings_rooms_idx ON public.property_listings(rooms) WHERE rooms IS NOT NULL;
CREATE INDEX property_listings_bedrooms_idx ON public.property_listings(bedrooms) WHERE bedrooms IS NOT NULL;
CREATE INDEX property_listings_area_idx ON public.property_listings(area_sqm);
CREATE INDEX property_listings_epc_idx ON public.property_listings(epc_rating) WHERE epc_rating IS NOT NULL;

-- Composite indexes for common search patterns
CREATE INDEX property_listings_rental_search_idx 
ON public.property_listings(listing_type, bedrooms, rent_monthly, epc_rating, postcode)
WHERE listing_type = 'rent' AND rent_monthly IS NOT NULL;

CREATE INDEX property_listings_sale_search_idx 
ON public.property_listings(listing_type, property_type_id, area_sqm, rooms, postcode)
WHERE listing_type = 'sale';

-- Active listings only (join with adverts table)
CREATE INDEX property_listings_active_idx ON public.property_listings(listing_type, postcode)
WHERE advert_id IN (
  SELECT id FROM public.adverts WHERE status = 'active' AND moderation_status = 'approved'
);

-- =============================================================================
-- VALIDATION FUNCTIONS
-- =============================================================================

-- Validate EPC certificate number format
CREATE OR REPLACE FUNCTION validate_epc_cert_number(cert_number TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Format: YYYYMMDD-NNNNNNN-NN
  RETURN cert_number ~ '^[0-9]{8}-[0-9]{7}-[0-9]{2}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Validate property listing data
CREATE OR REPLACE FUNCTION validate_property_listing(
  p_area_sqm NUMERIC,
  p_rooms INT,
  p_bedrooms INT,
  p_listing_type TEXT,
  p_rent_monthly NUMERIC,
  p_deposit_months NUMERIC
) RETURNS BOOLEAN AS $$
BEGIN
  -- Bedrooms should not exceed rooms
  IF p_bedrooms IS NOT NULL AND p_rooms IS NOT NULL AND p_bedrooms > p_rooms THEN
    RAISE WARNING 'Bedrooms (%) cannot exceed total rooms (%)', p_bedrooms, p_rooms;
    RETURN FALSE;
  END IF;
  
  -- Area vs rooms sanity check (rough estimate: min 8m² per room)
  IF p_area_sqm IS NOT NULL AND p_rooms IS NOT NULL AND p_area_sqm < (p_rooms * 8) THEN
    RAISE WARNING 'Area (% m²) seems too small for % rooms', p_area_sqm, p_rooms;
    RETURN FALSE;
  END IF;
  
  -- Rental must have monthly rent
  IF p_listing_type = 'rent' AND p_rent_monthly IS NULL THEN
    RAISE WARNING 'Rental listing must have monthly rent specified';
    RETURN FALSE;
  END IF;
  
  -- Deposit cannot exceed 3 months (Belgium law)
  IF p_deposit_months IS NOT NULL AND p_deposit_months > 3 THEN
    RAISE WARNING 'Security deposit (% months) exceeds Belgium legal maximum of 3 months', p_deposit_months;
    RETURN FALSE;
  END IF;
  
  -- Price sanity for rentals (very rough check: €10-30/m² typical)
  IF p_listing_type = 'rent' AND p_rent_monthly IS NOT NULL AND p_area_sqm IS NOT NULL THEN
    IF (p_rent_monthly / p_area_sqm) > 50 THEN
      RAISE WARNING 'Rental price per m² (€% / % m² = €%/m²) unusually high', 
        p_rent_monthly, p_area_sqm, ROUND(p_rent_monthly / p_area_sqm, 2);
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_property_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_listings_updated_at
BEFORE UPDATE ON public.property_listings
FOR EACH ROW
EXECUTE FUNCTION update_property_listings_updated_at();

-- Validate before insert/update
CREATE OR REPLACE FUNCTION validate_property_listing_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate EPC certificate format if provided
  IF NEW.epc_cert_number IS NOT NULL AND NOT validate_epc_cert_number(NEW.epc_cert_number) THEN
    RAISE EXCEPTION 'Invalid EPC certificate number format. Expected: YYYYMMDD-NNNNNNN-NN';
  END IF;
  
  -- Run comprehensive validation
  PERFORM validate_property_listing(
    NEW.area_sqm,
    NEW.rooms,
    NEW.bedrooms,
    NEW.listing_type,
    NEW.rent_monthly,
    NEW.deposit_months
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_listings_validate
BEFORE INSERT OR UPDATE ON public.property_listings
FOR EACH ROW
EXECUTE FUNCTION validate_property_listing_trigger();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.property_listings ENABLE ROW LEVEL SECURITY;

-- Users can view approved listings + their own
CREATE POLICY "users_view_property_listings"
ON public.property_listings FOR SELECT
USING (
  advert_id IN (
    SELECT id FROM public.adverts 
    WHERE auth.uid() = user_id 
    OR (status = 'active' AND moderation_status = 'approved')
  )
);

-- Users can insert their own property listings
CREATE POLICY "users_insert_property_listings"
ON public.property_listings FOR INSERT
WITH CHECK (
  advert_id IN (SELECT id FROM public.adverts WHERE auth.uid() = user_id)
);

-- Users can update their own draft/rejected listings
CREATE POLICY "users_update_property_listings"
ON public.property_listings FOR UPDATE
USING (
  advert_id IN (
    SELECT id FROM public.adverts 
    WHERE auth.uid() = user_id 
    AND status IN ('draft', 'rejected')
  )
);

-- Users can delete their own draft listings
CREATE POLICY "users_delete_property_listings"
ON public.property_listings FOR DELETE
USING (
  advert_id IN (
    SELECT id FROM public.adverts 
    WHERE auth.uid() = user_id 
    AND status = 'draft'
  )
);

-- =============================================================================
-- HELPER VIEWS (Optional, for easier querying)
-- =============================================================================

-- View for public property search (hides sensitive fields)
CREATE OR REPLACE VIEW public.property_listings_public AS
SELECT 
  pl.advert_id,
  pl.property_type_id,
  pl.listing_type,
  pl.area_sqm,
  pl.land_area_sqm,
  pl.rooms,
  pl.bedrooms,
  pl.bathrooms,
  pl.year_built,
  pl.floor,
  pl.epc_rating,
  pl.epc_kwh_per_sqm_year,
  pl.heating_type,
  pl.double_glazing,
  pl.rent_monthly,
  pl.rent_charges_monthly,
  pl.syndic_cost_monthly,
  pl.deposit_months,
  pl.available_from,
  pl.furnished,
  -- Location (postcode first 2 digits + municipality only for privacy)
  LEFT(pl.postcode, 2) || 'XX' AS postcode_area,
  pl.municipality,
  pl.parking_spaces,
  pl.terrace_sqm,
  pl.garden_sqm,
  pl.elevator,
  pl.pet_friendly,
  pl.created_at
FROM public.property_listings pl
WHERE pl.advert_id IN (
  SELECT id FROM public.adverts 
  WHERE status = 'active' AND moderation_status = 'approved'
);

-- =============================================================================
-- COMMENTS (Documentation)
-- =============================================================================

COMMENT ON TABLE public.property_listings IS 
  'Specialized table for real estate listings (both sale and rent). 
   See docs/catalog/categories/real-estate.md for complete specification.';

COMMENT ON COLUMN public.property_listings.cadastral_reference IS 
  'Cadastral reference (HIDDEN from public). Format: DIV/SEC/PARCEL/SUBPARCEL. 
   Only visible to property owner and verified buyers.';

COMMENT ON COLUMN public.property_listings.epc_cert_number IS 
  'Belgium EPC certificate number. Format: YYYYMMDD-NNNNNNN-NN. 
   Validated via trigger.';

COMMENT ON COLUMN public.property_listings.deposit_months IS 
  'Security deposit in months rent. Belgium law: maximum 3 months. 
   Enforced via CHECK constraint.';

COMMENT ON COLUMN public.property_listings.postcode IS 
  '4-digit Belgian postcode. Format: [1-9][0-9]{3}. 
   Validated via CHECK constraint.';

COMMENT ON VIEW public.property_listings_public IS 
  'Public view of property listings with sensitive fields hidden. 
   Shows postcode area (first 2 digits) instead of full postcode for privacy.';

-- =============================================================================
-- STATISTICS (for query planner)
-- =============================================================================

-- Update statistics after initial data load
ANALYZE public.property_listings;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (commented out)
-- =============================================================================

/*
-- To rollback this migration:

DROP VIEW IF EXISTS public.property_listings_public;

DROP TRIGGER IF EXISTS property_listings_validate ON public.property_listings;
DROP TRIGGER IF EXISTS property_listings_updated_at ON public.property_listings;

DROP FUNCTION IF EXISTS validate_property_listing_trigger();
DROP FUNCTION IF EXISTS update_property_listings_updated_at();
DROP FUNCTION IF EXISTS validate_property_listing(NUMERIC, INT, INT, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS validate_epc_cert_number(TEXT);

DROP POLICY IF EXISTS "users_delete_property_listings" ON public.property_listings;
DROP POLICY IF EXISTS "users_update_property_listings" ON public.property_listings;
DROP POLICY IF EXISTS "users_insert_property_listings" ON public.property_listings;
DROP POLICY IF EXISTS "users_view_property_listings" ON public.property_listings;

DROP INDEX IF EXISTS property_listings_active_idx;
DROP INDEX IF EXISTS property_listings_sale_search_idx;
DROP INDEX IF EXISTS property_listings_rental_search_idx;
DROP INDEX IF EXISTS property_listings_epc_idx;
DROP INDEX IF EXISTS property_listings_area_idx;
DROP INDEX IF EXISTS property_listings_bedrooms_idx;
DROP INDEX IF EXISTS property_listings_rooms_idx;
DROP INDEX IF EXISTS property_listings_municipality_idx;
DROP INDEX IF EXISTS property_listings_postcode_idx;
DROP INDEX IF EXISTS property_listings_listing_type_idx;
DROP INDEX IF EXISTS property_listings_type_idx;

DROP TABLE IF EXISTS public.property_listings CASCADE;
*/

