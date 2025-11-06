-- Migration: Catalog Dictionaries
-- Purpose: Create shared dictionary tables for catalog system
-- Date: 2025-11-05
-- Dependencies: None (foundational)

-- =============================================================================
-- 1. DEVICE BRANDS (Electronics)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.device_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT, -- Country of origin
  logo_url TEXT,
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX device_brands_slug_idx ON public.device_brands(slug);
CREATE INDEX device_brands_active_idx ON public.device_brands(is_active) WHERE is_active = true;

-- =============================================================================
-- 2. FASHION BRANDS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fashion_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT,
  segment TEXT, -- 'luxury', 'premium', 'mid_range', 'budget'
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX fashion_brands_slug_idx ON public.fashion_brands(slug);
CREATE INDEX fashion_brands_segment_idx ON public.fashion_brands(segment);

-- =============================================================================
-- 3. CLOTHING SIZES (with EU/UK/US conversions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.clothing_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'women_tops', 'men_pants', 'kids_general', 'shoes_women', etc.
  size_eu TEXT,
  size_uk TEXT,
  size_us TEXT,
  size_label TEXT, -- 'XS', 'S', 'M', 'L', 'XL'
  numeric_size TEXT, -- '34', '36', '38'
  
  -- Optional measurements for reference (in cm)
  chest_cm_min INT,
  chest_cm_max INT,
  waist_cm_min INT,
  waist_cm_max INT,
  hips_cm_min INT,
  hips_cm_max INT,
  
  UNIQUE(category, size_eu)
);

CREATE INDEX clothing_sizes_category_idx ON public.clothing_sizes(category);

-- =============================================================================
-- 4. MATERIALS (for fashion, furniture, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.materials (
  slug TEXT PRIMARY KEY,
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT,
  category TEXT, -- 'natural', 'synthetic', 'mixed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. COLORS (standardized for search)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.colors (
  slug TEXT PRIMARY KEY, -- 'black', 'white', 'blue', 'red'
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT,
  hex_code TEXT, -- '#000000', '#FFFFFF'
  color_family TEXT, -- 'dark', 'light', 'warm', 'cool'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. PROPERTY TYPES (Real Estate)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL, -- 'residential', 'commercial', 'land'
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX property_types_category_idx ON public.property_types(category);

-- =============================================================================
-- 7. EPC RATINGS (Belgium Energy Performance Certificates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.epc_ratings (
  code TEXT PRIMARY KEY, -- 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'
  label TEXT NOT NULL,
  color TEXT NOT NULL, -- Hex color for UI badges
  max_kwh_per_sqm_year INT, -- NULL for G (unlimited)
  sort_order INT NOT NULL,
  description_nl TEXT,
  description_fr TEXT,
  description_en TEXT
);

-- Insert EPC ratings
INSERT INTO public.epc_ratings (code, label, color, max_kwh_per_sqm_year, sort_order, description_en) VALUES
  ('A++', 'A++', '#00A651', 0, 1, 'Best energy performance'),
  ('A+', 'A+', '#4CB748', 45, 2, 'Excellent energy performance'),
  ('A', 'A', '#8CC63F', 95, 3, 'Very good energy performance'),
  ('B', 'B', '#FFF200', 150, 4, 'Good energy performance'),
  ('C', 'C', '#F9B233', 210, 5, 'Average energy performance'),
  ('D', 'D', '#F58220', 270, 6, 'Below average energy performance'),
  ('E', 'E', '#ED6B22', 345, 7, 'Poor energy performance'),
  ('F', 'F', '#E31E24', 510, 8, 'Very poor energy performance'),
  ('G', 'G', '#A4191E', NULL, 9, 'Worst energy performance')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 8. CP CODES (Belgium Joint Labor Committee Codes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cp_codes (
  code TEXT PRIMARY KEY, -- 'CP 100', 'CP 200', 'CP 218'
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT,
  sector TEXT, -- 'hospitality', 'manufacturing', 'services', etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common CP codes
INSERT INTO public.cp_codes (code, name_nl, name_fr, name_en, sector) VALUES
  ('CP 100', 'Hulp aan personen', 'Aide aux personnes', 'Personal assistance', 'services'),
  ('CP 200', 'Aanvullende diensten', 'Services auxiliaires', 'Auxiliary services', 'services'),
  ('CP 202', 'Metaal', 'Métal', 'Metal', 'manufacturing'),
  ('CP 218', 'Horeca', 'Horeca', 'Hospitality (Horeca)', 'hospitality'),
  ('CP 220', 'Voedingsnijverheid', 'Industrie alimentaire', 'Food industry', 'manufacturing'),
  ('CP 302', 'Hotels', 'Hôtels', 'Hotels', 'hospitality'),
  ('CP 317', 'Bewakingsdiensten', 'Services de sécurité', 'Security services', 'services'),
  ('CP 330', 'Gezondheidszorg', 'Soins de santé', 'Healthcare', 'healthcare')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 9. JOB CONTRACT TYPES (Belgium)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_contract_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'CDI', 'CDD', 'INTERIM', 'FREELANCE'
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT,
  description_nl TEXT,
  description_fr TEXT,
  description_en TEXT,
  sort_order INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert contract types
INSERT INTO public.job_contract_types (code, name_nl, name_fr, name_en, description_en, sort_order) VALUES
  ('CDI', 'Onbepaalde duur', 'Durée indéterminée', 'Permanent contract', 'Open-ended employment contract', 1),
  ('CDD', 'Bepaalde duur', 'Durée déterminée', 'Fixed-term contract', 'Temporary employment contract with end date', 2),
  ('INTERIM', 'Uitzendarbeid', 'Travail intérimaire', 'Temporary work', 'Temporary work via agency', 3),
  ('FREELANCE', 'Zelfstandige', 'Indépendant', 'Self-employed', 'Independent contractor/freelancer', 4),
  ('STAGE', 'Stage', 'Stage', 'Internship', 'Student or training position', 5)
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 10. JOB CATEGORIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES public.job_categories(id) ON DELETE SET NULL,
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX job_categories_parent_idx ON public.job_categories(parent_id);

-- =============================================================================
-- 11. SAFETY STANDARDS (Baby & Kids Products)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.safety_standards (
  code TEXT PRIMARY KEY, -- 'CE', 'EN71', 'ECE_R129', 'EN1888'
  name TEXT NOT NULL,
  description_nl TEXT,
  description_fr TEXT,
  description_en TEXT,
  applies_to TEXT[], -- ['toys', 'car_seats', 'strollers', 'furniture']
  required_for TEXT[], -- Categories where this is mandatory
  authority TEXT, -- 'EU', 'Belgium', 'ISO'
  url TEXT, -- Link to standard documentation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert safety standards
INSERT INTO public.safety_standards (code, name, description_en, applies_to, required_for, authority) VALUES
  ('CE', 'CE Marking', 'EU conformity mark required for toys and children products', 
   ARRAY['toys', 'electronics', 'furniture'], ARRAY['toys'], 'EU'),
  ('EN71', 'EN 71 Toy Safety', 'European toy safety standard with multiple parts', 
   ARRAY['toys'], ARRAY['toys'], 'EU'),
  ('ECE_R129', 'ECE R129 (i-Size)', 'Current EU car seat safety standard', 
   ARRAY['car_seats'], ARRAY['car_seats'], 'EU'),
  ('ECE_R44_04', 'ECE R44/04', 'Previous EU car seat standard (being phased out)', 
   ARRAY['car_seats'], ARRAY['car_seats'], 'EU'),
  ('EN1888', 'EN 1888', 'Stroller and pushchair safety standard', 
   ARRAY['strollers'], ARRAY['strollers'], 'EU'),
  ('EN716', 'EN 716', 'Cot and crib safety standard', 
   ARRAY['furniture'], ARRAY['cribs'], 'EU')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- 12. PET SPECIES LEGAL (Belgium)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.pet_species_legal (
  species TEXT PRIMARY KEY,
  common_name_nl TEXT NOT NULL,
  common_name_fr TEXT NOT NULL,
  common_name_en TEXT NOT NULL,
  category TEXT NOT NULL, -- 'mammal', 'bird', 'reptile', 'fish', 'other'
  legal_status TEXT NOT NULL, -- 'allowed', 'permit_required', 'prohibited'
  registration_required BOOLEAN DEFAULT false,
  microchip_required BOOLEAN DEFAULT false,
  breed_restrictions BOOLEAN DEFAULT false, -- Some dog breeds have restrictions
  notes_nl TEXT,
  notes_fr TEXT,
  notes_en TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common pet species
INSERT INTO public.pet_species_legal (species, common_name_nl, common_name_fr, common_name_en, category, legal_status, registration_required, microchip_required) VALUES
  ('dog', 'Hond', 'Chien', 'Dog', 'mammal', 'allowed', true, true),
  ('cat', 'Kat', 'Chat', 'Cat', 'mammal', 'allowed', false, false),
  ('rabbit', 'Konijn', 'Lapin', 'Rabbit', 'mammal', 'allowed', false, false),
  ('guinea_pig', 'Cavia', 'Cochon d''Inde', 'Guinea Pig', 'mammal', 'allowed', false, false),
  ('hamster', 'Hamster', 'Hamster', 'Hamster', 'mammal', 'allowed', false, false),
  ('gerbil', 'Gerbil', 'Gerbille', 'Gerbil', 'mammal', 'allowed', false, false),
  ('ferret', 'Fret', 'Furet', 'Ferret', 'mammal', 'permit_required', false, false),
  ('parrot', 'Papegaai', 'Perroquet', 'Parrot', 'bird', 'allowed', false, false),
  ('canary', 'Kanarie', 'Canari', 'Canary', 'bird', 'allowed', false, false),
  ('goldfish', 'Goudvis', 'Poisson rouge', 'Goldfish', 'fish', 'allowed', false, false)
ON CONFLICT (species) DO NOTHING;

-- =============================================================================
-- RLS POLICIES (All tables public read-only)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.device_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fashion_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clothing_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epc_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_contract_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_species_legal ENABLE ROW LEVEL SECURITY;

-- Public read policies (for dropdowns, autocomplete, etc.)
CREATE POLICY "public_read_device_brands" ON public.device_brands FOR SELECT USING (true);
CREATE POLICY "public_read_fashion_brands" ON public.fashion_brands FOR SELECT USING (true);
CREATE POLICY "public_read_clothing_sizes" ON public.clothing_sizes FOR SELECT USING (true);
CREATE POLICY "public_read_materials" ON public.materials FOR SELECT USING (true);
CREATE POLICY "public_read_colors" ON public.colors FOR SELECT USING (true);
CREATE POLICY "public_read_property_types" ON public.property_types FOR SELECT USING (true);
CREATE POLICY "public_read_epc_ratings" ON public.epc_ratings FOR SELECT USING (true);
CREATE POLICY "public_read_cp_codes" ON public.cp_codes FOR SELECT USING (true);
CREATE POLICY "public_read_job_contract_types" ON public.job_contract_types FOR SELECT USING (true);
CREATE POLICY "public_read_job_categories" ON public.job_categories FOR SELECT USING (true);
CREATE POLICY "public_read_safety_standards" ON public.safety_standards FOR SELECT USING (true);
CREATE POLICY "public_read_pet_species_legal" ON public.pet_species_legal FOR SELECT USING (true);

-- =============================================================================
-- COMMENTS (Documentation)
-- =============================================================================

COMMENT ON TABLE public.device_brands IS 'Shared brand dictionary for electronics (phones, laptops, tablets, etc.)';
COMMENT ON TABLE public.fashion_brands IS 'Brand dictionary for clothing, shoes, and fashion accessories';
COMMENT ON TABLE public.clothing_sizes IS 'Size conversion table (EU/UK/US) for clothing and shoes';
COMMENT ON TABLE public.materials IS 'Material dictionary with i18n support for fashion and furniture';
COMMENT ON TABLE public.colors IS 'Standardized color palette with hex codes for consistent filtering';
COMMENT ON TABLE public.property_types IS 'Property type dictionary for real estate (apartments, houses, land, etc.)';
COMMENT ON TABLE public.epc_ratings IS 'Belgium Energy Performance Certificate ratings (A++ to G)';
COMMENT ON TABLE public.cp_codes IS 'Belgium CP codes (Paritair Comité / Commission Paritaire) for job sectors';
COMMENT ON TABLE public.job_contract_types IS 'Belgium employment contract types (CDI, CDD, Interim, etc.)';
COMMENT ON TABLE public.job_categories IS 'Hierarchical job category taxonomy';
COMMENT ON TABLE public.safety_standards IS 'EU/Belgium safety standards for baby and kids products';
COMMENT ON TABLE public.pet_species_legal IS 'Legal status of pet species in Belgium (allowed, permit required, prohibited)';

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (commented out)
-- =============================================================================

/*
-- To rollback this migration:

DROP POLICY IF EXISTS "public_read_pet_species_legal" ON public.pet_species_legal;
DROP POLICY IF EXISTS "public_read_safety_standards" ON public.safety_standards;
DROP POLICY IF EXISTS "public_read_job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "public_read_job_contract_types" ON public.job_contract_types;
DROP POLICY IF EXISTS "public_read_cp_codes" ON public.cp_codes;
DROP POLICY IF EXISTS "public_read_epc_ratings" ON public.epc_ratings;
DROP POLICY IF EXISTS "public_read_property_types" ON public.property_types;
DROP POLICY IF EXISTS "public_read_colors" ON public.colors;
DROP POLICY IF EXISTS "public_read_materials" ON public.materials;
DROP POLICY IF EXISTS "public_read_clothing_sizes" ON public.clothing_sizes;
DROP POLICY IF EXISTS "public_read_fashion_brands" ON public.fashion_brands;
DROP POLICY IF EXISTS "public_read_device_brands" ON public.device_brands;

DROP TABLE IF EXISTS public.pet_species_legal CASCADE;
DROP TABLE IF EXISTS public.safety_standards CASCADE;
DROP TABLE IF EXISTS public.job_categories CASCADE;
DROP TABLE IF EXISTS public.job_contract_types CASCADE;
DROP TABLE IF EXISTS public.cp_codes CASCADE;
DROP TABLE IF EXISTS public.epc_ratings CASCADE;
DROP TABLE IF EXISTS public.property_types CASCADE;
DROP TABLE IF EXISTS public.colors CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.clothing_sizes CASCADE;
DROP TABLE IF EXISTS public.fashion_brands CASCADE;
DROP TABLE IF EXISTS public.device_brands CASCADE;
*/

