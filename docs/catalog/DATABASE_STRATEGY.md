# LyVoX Database Strategy: Hybrid Approach

> **Version**: 1.0  
> **Last Updated**: 2025-11-05  
> **Relates To**: [CATALOG_MASTER.md](./CATALOG_MASTER.md)

## Executive Summary

LyVoX uses a **hybrid database architecture** for catalog data, balancing flexibility with structure. This document explains when to use specialized tables versus JSONB storage, with concrete examples and decision criteria.

---

## Table of Contents

1. [Architectural Philosophy](#architectural-philosophy)
2. [Three-Tier Classification](#three-tier-classification)
3. [Category Analysis Matrix](#category-analysis-matrix)
4. [Specialized Tables Pattern](#specialized-tables-pattern)
5. [JSONB + Dictionaries Pattern](#jsonb--dictionaries-pattern)
6. [Pure JSONB Pattern](#pure-jsonb-pattern)
7. [Migration Strategy](#migration-strategy)
8. [Performance Considerations](#performance-considerations)
9. [Evolution Path](#evolution-path)

---

## Architectural Philosophy

### Core Principles

1. **Start Simple, Evolve Complexity**: Begin with JSONB, migrate to specialized tables when justified
2. **Query Patterns Drive Design**: Frequent joins/filters → specialized; flexible data → JSONB
3. **Maintainability Matters**: Specialized tables are harder to change, use sparingly
4. **Belgium-First**: Optimize for Belgian market needs, not theoretical scaling

### Why Hybrid?

**Pure Specialized Tables**:
- ❌ Too rigid for rapid iteration
- ❌ Schema changes require migrations
- ❌ Over-engineering for simple categories

**Pure JSONB**:
- ❌ Weak typing, runtime errors
- ❌ Poor query performance for complex filters
- ❌ No foreign key constraints

**Hybrid** (Best of Both):
- ✅ Structure where needed (vehicles, real estate)
- ✅ Flexibility where beneficial (fashion, pets)
- ✅ Efficient queries on key dimensions
- ✅ Easy to add new fields via JSONB
- ✅ TypeScript types for both approaches

---

## Three-Tier Classification

### Tier 1: Complex Categories (Specialized Tables)

**Criteria**:
- ≥20 structured fields
- Frequent join requirements
- Complex relationships (many-to-many)
- High query volume on specific fields
- Need for foreign key constraints
- Dedicated search/filter UI

**Examples**: Vehicles, Real Estate, Jobs

**Database Pattern**:
```sql
-- Dedicated tables with foreign keys
CREATE TABLE category_main (
  advert_id UUID PRIMARY KEY REFERENCES adverts(id),
  field1 TYPE CONSTRAINTS,
  field2 TYPE CONSTRAINTS,
  -- ... many fields
  FOREIGN KEY (related_id) REFERENCES category_lookup(id)
);

CREATE TABLE category_lookup (
  id UUID PRIMARY KEY,
  name_nl TEXT,
  name_fr TEXT,
  -- ... i18n columns
);
```

### Tier 2: Medium Categories (JSONB + Dictionaries)

**Criteria**:
- 6-20 fields
- Some structure + some flexibility
- Shared dictionaries (brands, sizes)
- Moderate query volume
- Some filters, not extensive

**Examples**: Electronics, Fashion, Baby & Kids

**Database Pattern**:
```sql
-- Shared dictionary tables
CREATE TABLE device_brands (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT,
  country TEXT
);

-- Data stored in JSONB
-- (ad_item_specifics.specifics)
{
  "brand_id": "uuid-reference",
  "model": "iPhone 13 Pro",
  "storage": "256GB",
  // ... flexible fields
}
```

### Tier 3: Simple Categories (Pure JSONB)

**Criteria**:
- 0-5 structured fields
- Highly variable data
- Low query volume
- Minimal filtering needs
- Rapid iteration required

**Examples**: Free/Giveaway, Lost & Found, General Services

**Database Pattern**:
```sql
-- Everything in ad_item_specifics.specifics
{
  "pickup_location": "Brussels Central Station",
  "available_until": "2025-12-31",
  "reason_giving": "moving_abroad",
  // ... any fields
}
```

---

## Category Analysis Matrix

Complete breakdown of all categories by tier and database strategy.

| Category | Subcategories | Tier | Approach | Special Tables | Dictionaries | Priority |
|----------|---------------|------|----------|----------------|--------------|----------|
| **Transport** |
| Cars | New, Used | **1** | Specialized | `vehicle_makes`, `vehicle_models`, `vehicle_generations`, `vehicle_insights` | ✅ Fuel types, transmissions, body types | ✅ **Done** |
| Motorcycles | All types | **2** | JSONB + Shared vehicle tables | Reuse vehicle tables | ✅ Bike types | High |
| Trucks & Buses | Commercial | **2** | JSONB + Shared vehicle tables | Reuse vehicle tables | ✅ Vehicle types | Medium |
| Parts & Accessories | All parts | **3** | Pure JSONB | — | — | Low |
| **Real Estate** |
| Sale | Apartments, Houses, Land | **1** | Specialized | `property_types`, `property_features`, `epc_ratings`, `property_listings` | ✅ EPC, property types | **High** |
| Rent | Apartments, Houses, Commercial | **1** | Specialized | Same as Sale + rental fields | ✅ Rental types | **High** |
| **Fashion & Personal** |
| Women's Fashion | 13 subcategories | **2** | JSONB + Dicts | `fashion_brands`, `clothing_sizes` | ✅ Sizes (EU/UK/US), materials | **High** |
| Men's Fashion | 12 subcategories | **2** | JSONB + Dicts | Same as Women's | ✅ Sizes, materials | **High** |
| Kids' Fashion | 11 subcategories | **2** | JSONB + Dicts | Same + age groups | ✅ Kids sizes | **High** |
| **Electronics** |
| Phones & Tablets | 5 subcategories | **2** | JSONB + Dicts | `device_brands`, `device_models` | ✅ Brands, storage options | **High** |
| Computers | 7 subcategories | **2** | JSONB + Dicts | Same as Phones | ✅ Brands, components | **High** |
| Photo & Video | 4 subcategories | **2** | JSONB + Dicts | `camera_brands` | ✅ Camera types | Medium |
| TV & Audio | 3 subcategories | **2** | JSONB + Dicts | `electronics_brands` | ✅ Brands | Medium |
| Appliances | 4 subcategories | **3** | Pure JSONB | — | — | Low |
| **Home, Hobbies & Kids** |
| Furniture | Various | **3** | Pure JSONB | — | Optional: furniture types | Medium |
| Garden | Various | **3** | Pure JSONB | — | — | Low |
| Baby & Kids | 7 subcategories | **2** | JSONB + Safety | `safety_standards` | ✅ Safety certs (EN71, ECE R129) | **High** |
| Sports | Various | **3** | Pure JSONB | — | Optional: sport types | Low |
| Books & Media | Various | **3** | Pure JSONB | — | — | Low |
| Tickets & Events | All | **2** | JSONB + Event types | `event_types`, `venues` | ✅ Event categories | Medium |
| **Services & Business** |
| Services | 9 subcategories | **3** | Pure JSONB | — | Optional: service types | Medium |
| Service Requests | 3 subcategories | **3** | Pure JSONB | — | — | Low |
| **Pets** |
| Domestic Pets | 5 subcategories | **2** | JSONB + Legal | `pet_species_legal` (Belgium) | ✅ Legal species, breeds | Medium |
| Pet Supplies | 3 subcategories | **3** | Pure JSONB | — | — | Low |
| **Jobs & Career** |
| Vacancies | 3 employment types | **1** | Specialized | `job_categories`, `job_contract_types`, `cp_codes`, `job_listings` | ✅ Belgium CP codes, contract types | **High** |
| Resumes | 3 types | **1** | Specialized | Same as Vacancies | ✅ Skills, education | Medium |
| **Special** |
| Free & Giveaway | 2 subcategories | **3** | Pure JSONB | — | — | Low |
| Lost & Found | 2 subcategories | **3** | Pure JSONB | — | — | Low |

### Summary Statistics

- **Tier 1 (Specialized)**: 4 categories (Vehicles, Real Estate, Jobs x2)
- **Tier 2 (JSONB + Dicts)**: 10 categories (Fashion x3, Electronics x4, Baby/Kids, Pets, Tickets)
- **Tier 3 (Pure JSONB)**: ~15 categories (Everything else)

**Total**: ~29 category groups across 9 main categories

---

## Specialized Tables Pattern

### When to Use

✅ **Use Specialized Tables If**:
- Category has ≥20 structured fields
- Requires foreign key relationships (e.g., vehicle make → model → generation)
- High-volume queries with complex filters (e.g., "BMW 3 Series 2015-2020 with <100k km")
- Need for joins in search results
- Data integrity is critical (e.g., VIN validation, EPC certificate numbers)
- Category-specific admin tools (e.g., bulk import vehicle models)

### Example: Vehicles (Reference Implementation)

Already implemented. See: `supabase/migrations/20251026193200_vehicle_catalog.sql`

**Structure**:
```
vehicle_makes (brands)
  ├─ id, slug, name_en, country, segment_class
  └─ vehicle_models
       ├─ id, make_id, slug, name_en, years_available[]
       ├─ reliability_score, popularity_score
       └─ vehicle_generations
            ├─ id, model_id, code, start_year, end_year
            ├─ body_types[], fuel_types[], transmission_types[]
            └─ summary

vehicle_insights (per model)
  ├─ pros[], cons[], inspection_tips[]
  ├─ notable_features[], engine_examples[]
  └─ common_issues_by_engine

vehicle_make_i18n, vehicle_model_i18n, vehicle_generation_i18n
  └─ Translations for NL, FR, EN, RU, DE
```

**Linking to Adverts**:
```sql
CREATE TABLE vehicle_listings (
  advert_id UUID PRIMARY KEY REFERENCES adverts(id) ON DELETE CASCADE,
  
  -- Foreign keys to catalog
  make_id UUID REFERENCES vehicle_makes(id),
  model_id UUID REFERENCES vehicle_models(id),
  generation_id UUID REFERENCES vehicle_generations(id),
  
  -- Instance-specific fields
  year INT NOT NULL,
  mileage INT,
  vin TEXT,
  engine_volume NUMERIC,
  power_hp INT,
  fuel_type TEXT,
  transmission TEXT,
  drive_type TEXT,
  body_type TEXT,
  doors INT,
  color TEXT,
  color_code TEXT,
  interior_color TEXT,
  
  -- Condition fields
  customs_cleared BOOLEAN,
  under_warranty BOOLEAN,
  warranty_until DATE,
  owners_count INT,
  service_history BOOLEAN,
  accident_history BOOLEAN,
  
  -- Additional JSONB for flexible fields
  options JSONB DEFAULT '[]', -- ["abs", "cruise_control", ...]
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX vehicle_listings_make_idx ON vehicle_listings(make_id);
CREATE INDEX vehicle_listings_model_idx ON vehicle_listings(model_id);
CREATE INDEX vehicle_listings_year_idx ON vehicle_listings(year);
CREATE INDEX vehicle_listings_price_idx ON vehicle_listings((
  SELECT price FROM adverts WHERE id = vehicle_listings.advert_id
));

-- Composite index for common filter combinations
CREATE INDEX vehicle_listings_search_idx 
ON vehicle_listings(make_id, model_id, year, fuel_type, transmission)
WHERE advert_id IN (
  SELECT id FROM adverts WHERE status = 'active' AND moderation_status = 'approved'
);
```

**RLS Policies** (Standard Template):
```sql
ALTER TABLE vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_listings ENABLE ROW LEVEL SECURITY;

-- Public read-only for catalog tables (for dropdowns)
CREATE POLICY "public_read_vehicle_makes" ON vehicle_makes FOR SELECT USING (true);
CREATE POLICY "public_read_vehicle_models" ON vehicle_models FOR SELECT USING (true);
CREATE POLICY "public_read_vehicle_generations" ON vehicle_generations FOR SELECT USING (true);

-- Listing policies follow advert policies
CREATE POLICY "users_view_vehicle_listings" ON vehicle_listings FOR SELECT
USING (
  advert_id IN (
    SELECT id FROM adverts 
    WHERE auth.uid() = user_id 
    OR (status = 'active' AND moderation_status = 'approved')
  )
);

CREATE POLICY "users_insert_vehicle_listings" ON vehicle_listings FOR INSERT
WITH CHECK (
  advert_id IN (SELECT id FROM adverts WHERE auth.uid() = user_id)
);

CREATE POLICY "users_update_vehicle_listings" ON vehicle_listings FOR UPDATE
USING (
  advert_id IN (SELECT id FROM adverts WHERE auth.uid() = user_id AND status IN ('draft', 'rejected'))
);
```

### Example: Real Estate (To Be Implemented)

**Structure** (similar to vehicles):
```sql
-- Property types (shared)
CREATE TABLE property_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL, -- 'residential', 'commercial', 'land'
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true
);

-- EPC ratings (Belgium-specific)
CREATE TABLE epc_ratings (
  code TEXT PRIMARY KEY, -- 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'
  label TEXT NOT NULL,
  color TEXT NOT NULL, -- For UI badges
  max_kwh_per_sqm_year INT, -- NULL for G (unlimited)
  description_nl TEXT,
  description_fr TEXT,
  description_en TEXT
);

-- Property features (checkboxes)
CREATE TABLE property_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL, -- 'amenity', 'safety', 'comfort'
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT,
  icon TEXT
);

-- Main property listings table
CREATE TABLE property_listings (
  advert_id UUID PRIMARY KEY REFERENCES adverts(id) ON DELETE CASCADE,
  
  -- Core structured fields
  property_type_id UUID REFERENCES property_types(id),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  
  area_sqm NUMERIC NOT NULL CHECK (area_sqm > 0),
  rooms INT CHECK (rooms >= 0),
  bedrooms INT CHECK (bedrooms >= 0),
  bathrooms NUMERIC CHECK (bathrooms >= 0), -- 1.5 = 1 full + 1 half
  
  -- Building info
  year_built INT CHECK (year_built >= 1800 AND year_built <= EXTRACT(YEAR FROM NOW())),
  renovation_year INT,
  floor INT, -- NULL for houses, negative for basement
  total_floors INT,
  
  -- Energy & compliance (Belgium-specific)
  epc_rating TEXT REFERENCES epc_ratings(code),
  epc_cert_number TEXT, -- Format: YYYYMMDD-NNNNNNN-NN
  epc_kwh_per_sqm_year INT,
  peb_url TEXT, -- Link to official PEB/EPB certificate
  
  -- Heating & utilities
  heating_type TEXT[], -- ['gas', 'electric', 'solar', 'heat_pump']
  water_heater_type TEXT,
  double_glazing BOOLEAN,
  
  -- Rental-specific fields (NULL if for sale)
  rent_monthly NUMERIC CHECK (listing_type = 'sale' OR rent_monthly > 0),
  rent_charges_monthly NUMERIC, -- Includes water, heating, etc.
  syndic_cost_monthly NUMERIC, -- Co-ownership fees
  deposit_months NUMERIC CHECK (deposit_months <= 3), -- Belgium law: max 3 months
  lease_duration_months INT,
  available_from DATE,
  furnished TEXT, -- 'unfurnished', 'semi_furnished', 'fully_furnished'
  
  -- Sale-specific fields (NULL if rental)
  cadastral_reference TEXT, -- HIDDEN from public, format: DIV/SEC/PARCEL/SUBPARCEL
  land_registry_number TEXT, -- HIDDEN
  notary_name TEXT,
  
  -- Location details (in addition to adverts.location)
  postcode TEXT NOT NULL,
  municipality TEXT NOT NULL,
  neighborhood TEXT,
  
  -- Parking
  parking_spaces INT DEFAULT 0,
  parking_type TEXT[], -- ['garage', 'carport', 'street', 'underground']
  
  -- Outdoor space
  terrace_sqm NUMERIC,
  garden_sqm NUMERIC,
  garden_orientation TEXT, -- 'north', 'south', 'east', 'west'
  
  -- Building features (boolean flags)
  elevator BOOLEAN DEFAULT false,
  cellar BOOLEAN DEFAULT false,
  attic BOOLEAN DEFAULT false,
  
  -- Policies
  pet_friendly BOOLEAN,
  smoking_allowed BOOLEAN,
  
  -- Additional flexible data stored in ad_item_specifics.specifics:
  -- features[] (elevator, alarm, video_intercom, etc.)
  -- nearby[] (schools, transport, shops, etc.)
  -- renovation_details
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for search performance
CREATE INDEX property_listings_type_idx ON property_listings(property_type_id);
CREATE INDEX property_listings_listing_type_idx ON property_listings(listing_type);
CREATE INDEX property_listings_area_idx ON property_listings(area_sqm);
CREATE INDEX property_listings_rooms_idx ON property_listings(rooms);
CREATE INDEX property_listings_epc_idx ON property_listings(epc_rating);
CREATE INDEX property_listings_postcode_idx ON property_listings(postcode);

-- Composite index for common search queries
CREATE INDEX property_listings_search_idx 
ON property_listings(listing_type, property_type_id, rooms, area_sqm, epc_rating)
WHERE advert_id IN (
  SELECT id FROM adverts WHERE status = 'active' AND moderation_status = 'approved'
);

-- GiST index for geo queries (if using PostGIS)
CREATE INDEX property_listings_geo_idx ON property_listings 
USING GIST ((SELECT point FROM locations WHERE id = (
  SELECT location_id FROM adverts WHERE id = property_listings.advert_id
)));
```

**Benefits** (Real Estate):
- Foreign key to `property_types` ensures valid types
- `epc_rating` FK ensures only valid Belgium EPC ratings
- Check constraints enforce data integrity (e.g., deposit ≤ 3 months)
- Separate fields for sale vs rent (NULL when not applicable)
- Efficient queries: "Show me 2BR apartments in Brussels, EPC B or better, under €1,500/month"
- Cadastral info stored but HIDDEN from public (privacy)

### Example: Jobs (To Be Implemented)

**Structure**:
```sql
-- Belgium CP codes (Paritair Comité)
CREATE TABLE cp_codes (
  code TEXT PRIMARY KEY, -- 'CP 100', 'CP 200', 'CP 218.00'
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT,
  sector TEXT, -- 'hospitality', 'manufacturing', 'services'
  is_active BOOLEAN DEFAULT true
);

-- Job contract types (Belgium-specific)
CREATE TABLE job_contract_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'CDI', 'CDD', 'INTERIM', 'FREELANCE'
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT,
  description_nl TEXT,
  description_fr TEXT,
  description_en TEXT
);

-- Job categories/sectors
CREATE TABLE job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES job_categories(id),
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT
);

-- Job listings
CREATE TABLE job_listings (
  advert_id UUID PRIMARY KEY REFERENCES adverts(id) ON DELETE CASCADE,
  
  -- Classification
  job_category_id UUID REFERENCES job_categories(id),
  cp_code TEXT REFERENCES cp_codes(code),
  
  -- Employment details
  contract_type_id UUID REFERENCES job_contract_types(id),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'freelance', 'internship')),
  
  -- Schedule
  hours_per_week NUMERIC CHECK (hours_per_week > 0 AND hours_per_week <= 80),
  shift_work BOOLEAN DEFAULT false,
  weekend_work BOOLEAN DEFAULT false,
  night_shifts BOOLEAN DEFAULT false,
  flexible_hours BOOLEAN DEFAULT false,
  remote_option TEXT CHECK (remote_option IN ('none', 'hybrid', 'full_remote')),
  
  -- Compensation
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT DEFAULT 'EUR',
  salary_period TEXT CHECK (salary_period IN ('hour', 'month', 'year')),
  salary_type TEXT CHECK (salary_type IN ('gross', 'net')),
  salary_negotiable BOOLEAN DEFAULT false,
  
  -- Benefits (stored as array or JSONB)
  benefits TEXT[], -- ['meal_vouchers', 'company_car', 'insurance', 'bonus']
  
  -- Requirements
  experience_years_min INT CHECK (experience_years_min >= 0),
  education_level TEXT, -- 'none', 'high_school', 'bachelor', 'master', 'phd'
  languages_required TEXT[], -- ['nl', 'fr', 'en']
  languages_preferred TEXT[],
  driving_license_required BOOLEAN DEFAULT false,
  license_types TEXT[], -- ['B', 'C', 'CE']
  
  -- Legal
  work_permit_required BOOLEAN DEFAULT false, -- For non-EU citizens
  work_permit_sponsored BOOLEAN DEFAULT false, -- Employer will sponsor
  
  -- Company info
  company_name TEXT,
  company_size TEXT, -- 'startup', 'small', 'medium', 'large', 'enterprise'
  industry TEXT,
  
  -- Application
  application_deadline DATE,
  start_date DATE,
  contact_email TEXT,
  contact_phone TEXT,
  application_url TEXT,
  
  -- Additional JSONB in ad_item_specifics.specifics:
  -- responsibilities[]
  -- required_skills[]
  -- preferred_skills[]
  -- team_info
  -- company_culture
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX job_listings_category_idx ON job_listings(job_category_id);
CREATE INDEX job_listings_cp_code_idx ON job_listings(cp_code);
CREATE INDEX job_listings_contract_type_idx ON job_listings(contract_type_id);
CREATE INDEX job_listings_employment_type_idx ON job_listings(employment_type);
CREATE INDEX job_listings_salary_idx ON job_listings(salary_min, salary_max);
CREATE INDEX job_listings_remote_idx ON job_listings(remote_option);
```

**Benefits** (Jobs):
- Belgium-specific CP codes for legal compliance
- Salary validation (don't allow impossible ranges)
- Language requirements tracking (critical for Belgium)
- Remote/hybrid options (post-COVID market need)
- Work permit info (legal requirement to disclose)

---

## JSONB + Dictionaries Pattern

### When to Use

✅ **Use JSONB + Dictionaries If**:
- Category has 6-20 fields
- Some fields are standardized (brand, size, color) → use dictionaries
- Other fields are flexible or category-specific
- Moderate query volume
- Share dictionaries across categories (e.g., `device_brands` for phones, tablets, laptops)

### Example: Electronics

**Dictionary Tables**:
```sql
-- Shared across phones, tablets, laptops, etc.
CREATE TABLE device_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT,
  logo_url TEXT,
  website TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Optional: Pre-populate models for autocomplete
CREATE TABLE device_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES device_brands(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL, -- 'phone', 'tablet', 'laptop', etc.
  release_year INT,
  discontinued BOOLEAN DEFAULT false,
  
  UNIQUE(brand_id, slug)
);

-- Storage options (standardized)
CREATE TABLE storage_options (
  value TEXT PRIMARY KEY, -- '16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'
  sort_order INT,
  obsolete BOOLEAN DEFAULT false -- '16GB' is obsolete for phones
);
```

**Data in JSONB** (ad_item_specifics.specifics):
```json
{
  "category_type": "phone",
  
  // References to dictionaries
  "brand_id": "uuid-of-apple",
  "brand": "Apple", // Denormalized for display
  "model_id": "uuid-of-iphone-13-pro", // Optional
  "model": "iPhone 13 Pro",
  
  // Standardized enums
  "storage": "256GB",
  "memory_ram": "6GB",
  "color": "graphite",
  
  // Phone-specific
  "screen_size": "6.1 inch",
  "battery_health": "95%",
  "imei": "HIDDEN_UNTIL_CONTACT", // Masked
  "factory_unlocked": true,
  "carrier_locked": false,
  "original_box": true,
  "accessories": ["charger", "cable", "earphones"],
  
  // Condition details
  "scratches": "minor_on_back",
  "screen_condition": "perfect",
  "camera_functional": true,
  "buttons_functional": true,
  
  // Warranty
  "warranty": true,
  "warranty_until": "2025-12-31",
  "apple_care": false,
  
  // Additional notes
  "notes": "Barely used, upgraded to newer model"
}
```

**Benefits**:
- `device_brands` table enables efficient autocomplete and brand filtering
- Standardized storage/RAM values prevent typos ("256gb" vs "256 GB" vs "256GB")
- JSONB flexibility allows phone-specific fields (IMEI, carrier lock) vs laptop fields (CPU, GPU)
- Easy to add new fields without migration (e.g., "5G_capable")

**Search Queries**:
```sql
-- Find phones by brand, storage, price
SELECT 
  a.*,
  ais.specifics->>'model' as model,
  ais.specifics->>'storage' as storage,
  db.name as brand_name
FROM adverts a
JOIN ad_item_specifics ais ON a.id = ais.advert_id
LEFT JOIN device_brands db ON (ais.specifics->>'brand_id')::uuid = db.id
WHERE a.category_id = 'electronics-phones-category-uuid'
  AND (ais.specifics->>'brand_id')::uuid = 'apple-uuid' -- Brand filter
  AND ais.specifics->>'storage' = '256GB' -- Storage filter
  AND a.price BETWEEN 500 AND 800
  AND a.status = 'active'
ORDER BY a.created_at DESC;

-- Create GIN index for JSONB queries
CREATE INDEX ad_item_specifics_brand_idx 
ON ad_item_specifics USING gin ((specifics->'brand_id'));

CREATE INDEX ad_item_specifics_storage_idx 
ON ad_item_specifics USING gin ((specifics->'storage'));
```

### Example: Fashion

**Dictionary Tables**:
```sql
-- Shared across all fashion categories
CREATE TABLE fashion_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT,
  segment TEXT, -- 'luxury', 'premium', 'mid_range', 'budget'
  logo_url TEXT
);

-- Size mappings (EU, UK, US conversions)
CREATE TABLE clothing_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'women_tops', 'men_pants', 'kids_general', 'shoes_women', etc.
  size_eu TEXT,
  size_uk TEXT,
  size_us TEXT,
  size_label TEXT, -- 'XS', 'S', 'M', 'L', 'XL'
  numeric_size TEXT, -- '34', '36', '38', etc.
  
  -- Optional measurements for reference
  chest_cm_min INT,
  chest_cm_max INT,
  waist_cm_min INT,
  waist_cm_max INT,
  
  UNIQUE(category, size_eu)
);

-- Materials (for search filters)
CREATE TABLE materials (
  slug TEXT PRIMARY KEY,
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category TEXT -- 'natural', 'synthetic', 'mixed'
);
```

**Data in JSONB**:
```json
{
  "category_type": "women_dress",
  
  // Brand (reference + denormalized)
  "brand_id": "uuid-of-zara",
  "brand": "Zara",
  
  // Sizing (primary size + conversions)
  "size_eu": "38",
  "size_uk": "10",
  "size_us": "6",
  "size_label": "M",
  
  // Gender & age (for filtering)
  "gender": "women",
  "age_group": "adult",
  
  // Style details
  "type": "dress",
  "style": "casual",
  "color": "blue",
  "color_hex": "#4A90E2",
  "pattern": "floral",
  "season": "summer",
  "occasion": ["casual", "office"],
  
  // Materials
  "material_primary": "cotton",
  "material_composition": {
    "cotton": 95,
    "elastane": 5
  },
  
  // Measurements (actual item)
  "measurements": {
    "length_cm": 95,
    "bust_cm": 88,
    "waist_cm": 72,
    "hips_cm": 96
  },
  
  // Condition & care
  "condition_details": "Worn twice, like new",
  "has_tags": false,
  "has_defects": false,
  "care_instructions": ["machine_wash_30", "do_not_bleach", "iron_low"],
  
  // Original purchase
  "original_price": 49.99,
  "purchase_year": 2024
}
```

**Benefits**:
- `fashion_brands` enables brand filtering and autocomplete
- `clothing_sizes` provides size conversions (critical for international buyers)
- JSONB flexibility handles diverse clothing types (dresses, pants, shoes all have different fields)
- Color, material, season filters work directly on JSONB fields

---

## Pure JSONB Pattern

### When to Use

✅ **Use Pure JSONB If**:
- Category has 0-5 structured fields
- Highly variable data (no standard fields)
- Low query volume
- Minimal filter requirements
- Rapid iteration/experimentation

### Example: Free & Giveaway

```json
{
  "category_type": "free_giveaway",
  
  "item_type": "furniture",
  "item_name": "IKEA bookshelf",
  
  "condition": "used_good",
  "reason_giving": "moving_abroad",
  
  "pickup_required": true,
  "pickup_location": "Brussels, Ixelles",
  "pickup_instructions": "Ground floor, no elevator",
  
  "available_until": "2025-12-15",
  "flexible_pickup_times": true,
  "preferred_times": ["weekday_evenings", "weekend_mornings"],
  
  "dimensions": {
    "height_cm": 180,
    "width_cm": 80,
    "depth_cm": 30
  },
  
  "weight_approx_kg": 25,
  "needs_disassembly": true,
  "can_help_load": false,
  
  "notes": "Good condition, just a few minor scratches. Must be picked up by Dec 15."
}
```

**Benefits**:
- Extreme flexibility (any fields allowed)
- No migrations needed to add fields
- Perfect for experimental or niche categories

**Drawbacks**:
- No type safety at DB level
- Queries harder to optimize
- No autocomplete/validation from dictionaries

**When It Makes Sense**:
- "Free" category: highly variable items, few users filter beyond location
- "Lost & Found": unique descriptions per item
- "Services" (generic): too diverse to structure

---

## Migration Strategy

### Naming Convention

```
YYYYMMDD_<category>_<purpose>.sql

Examples:
20251106_real_estate_catalog.sql
20251106_electronics_dictionaries.sql
20251107_jobs_catalog.sql
20251108_fashion_dictionaries.sql
20251110_catalog_validation_functions.sql
```

### Migration Template: Specialized Tables

```sql
-- File: YYYYMMDD_<category>_catalog.sql
-- Purpose: Create specialized tables for <Category> category

-- 1. Dictionary/Lookup Tables (if any)
CREATE TABLE <category>_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name_nl TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_de TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Main Category Table
CREATE TABLE <category>_listings (
  advert_id UUID PRIMARY KEY REFERENCES adverts(id) ON DELETE CASCADE,
  
  -- Foreign keys to dictionaries
  type_id UUID REFERENCES <category>_types(id),
  
  -- Structured fields
  field1 TYPE CONSTRAINTS,
  field2 TYPE CONSTRAINTS,
  -- ...
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX <category>_listings_type_idx ON <category>_listings(type_id);
CREATE INDEX <category>_listings_field1_idx ON <category>_listings(field1);
-- ... more indexes for filterable fields

-- Composite index for common queries
CREATE INDEX <category>_listings_search_idx 
ON <category>_listings(type_id, field1, field2)
WHERE advert_id IN (
  SELECT id FROM adverts WHERE status = 'active' AND moderation_status = 'approved'
);

-- 4. RLS Policies
ALTER TABLE <category>_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE <category>_listings ENABLE ROW LEVEL SECURITY;

-- Public read for dictionaries
CREATE POLICY "public_read_<category>_types" 
ON <category>_types FOR SELECT USING (true);

-- Listings follow advert policies
CREATE POLICY "users_view_<category>_listings" 
ON <category>_listings FOR SELECT
USING (
  advert_id IN (
    SELECT id FROM adverts 
    WHERE auth.uid() = user_id 
    OR (status = 'active' AND moderation_status = 'approved')
  )
);

CREATE POLICY "users_insert_<category>_listings" 
ON <category>_listings FOR INSERT
WITH CHECK (
  advert_id IN (SELECT id FROM adverts WHERE auth.uid() = user_id)
);

CREATE POLICY "users_update_<category>_listings" 
ON <category>_listings FOR UPDATE
USING (
  advert_id IN (SELECT id FROM adverts WHERE auth.uid() = user_id AND status IN ('draft', 'rejected'))
);

-- 5. Validation Functions (optional)
CREATE OR REPLACE FUNCTION validate_<category>_listing(
  param1 TYPE,
  param2 TYPE
) RETURNS BOOLEAN AS $$
BEGIN
  -- Custom validation logic
  IF param1 > param2 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 6. Triggers (optional, for auto-updating timestamps)
CREATE OR REPLACE FUNCTION update_<category>_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER <category>_listings_updated_at
BEFORE UPDATE ON <category>_listings
FOR EACH ROW
EXECUTE FUNCTION update_<category>_updated_at();

-- 7. Comments (documentation)
COMMENT ON TABLE <category>_listings IS 'Specialized table for <Category> category listings. See docs/catalog/categories/<category>.md';
COMMENT ON COLUMN <category>_listings.field1 IS 'Description of field1, validation rules, etc.';
```

### Migration Order

1. **First**: Common dictionaries used across categories
   - `20251106_catalog_dictionaries.sql` (colors, materials, conditions)
   
2. **Then**: Category-specific migrations by priority
   - ✅ Vehicles (already done)
   - `20251107_real_estate_catalog.sql` (High priority)
   - `20251107_jobs_catalog.sql` (High priority)
   - `20251108_electronics_dictionaries.sql` (High priority)
   - `20251108_fashion_dictionaries.sql` (High priority)
   - `20251109_baby_kids_safety_standards.sql` (High priority)
   - `20251110_pets_legal_species.sql` (Medium priority)
   - ... continue as needed
   
3. **Finally**: Cross-cutting features
   - `20251115_catalog_validation_functions.sql` (All validation functions)
   - `20251115_catalog_search_indexes.sql` (Additional search optimizations)

### Rollback Strategy

Every migration should include a rollback at the end:

```sql
-- Rollback instructions (commented out, for reference):
/*
-- To rollback this migration:

DROP TRIGGER IF EXISTS <category>_listings_updated_at ON <category>_listings;
DROP FUNCTION IF EXISTS update_<category>_updated_at();
DROP FUNCTION IF EXISTS validate_<category>_listing(TYPE, TYPE);

DROP POLICY IF EXISTS "users_update_<category>_listings" ON <category>_listings;
DROP POLICY IF EXISTS "users_insert_<category>_listings" ON <category>_listings;
DROP POLICY IF EXISTS "users_view_<category>_listings" ON <category>_listings;
DROP POLICY IF EXISTS "public_read_<category>_types" ON <category>_types;

DROP INDEX IF EXISTS <category>_listings_search_idx;
DROP INDEX IF EXISTS <category>_listings_field1_idx;
DROP INDEX IF EXISTS <category>_listings_type_idx;

DROP TABLE IF EXISTS <category>_listings CASCADE;
DROP TABLE IF EXISTS <category>_types CASCADE;
*/
```

---

## Performance Considerations

### JSONB Performance

**Pros**:
- Flexible schema
- No ALTER TABLE needed
- Fast writes

**Cons**:
- Slower queries on unindexed fields
- No built-in constraints
- Larger storage size

**Optimization**:
```sql
-- GIN index for existence checks
CREATE INDEX ad_item_specifics_gin_idx 
ON ad_item_specifics USING gin (specifics);

-- Partial GIN indexes for specific keys
CREATE INDEX ad_item_specifics_brand_idx 
ON ad_item_specifics USING gin ((specifics->'brand_id'))
WHERE specifics->>'brand_id' IS NOT NULL;

-- Expression indexes for common queries
CREATE INDEX ad_item_specifics_price_per_sqm_idx 
ON ad_item_specifics (
  (specifics->>'price')::numeric / NULLIF((specifics->>'area_sqm')::numeric, 0)
)
WHERE specifics->>'listing_type' = 'rent';
```

### Specialized Tables Performance

**Pros**:
- Fast queries with proper indexes
- Type safety & constraints
- Efficient joins
- Query planner optimizations

**Cons**:
- Schema changes require migrations
- More complex to maintain
- Can't add fields without ALTER TABLE

**Optimization**:
```sql
-- Composite indexes for common filter combinations
CREATE INDEX CONCURRENTLY property_listings_search_combo_idx 
ON property_listings(listing_type, property_type_id, rooms, epc_rating)
INCLUDE (area_sqm, rent_monthly)
WHERE advert_id IN (
  SELECT id FROM adverts WHERE status = 'active' AND moderation_status = 'approved'
);

-- Partial indexes for subset queries
CREATE INDEX CONCURRENTLY property_listings_rental_idx 
ON property_listings(rent_monthly, rooms, area_sqm)
WHERE listing_type = 'rent' AND rent_monthly IS NOT NULL;

-- Always use CONCURRENTLY in production to avoid locks
```

### Query Patterns

**Good** (indexed fields):
```sql
-- Uses index efficiently
SELECT * FROM property_listings
WHERE listing_type = 'rent'
  AND rooms >= 2
  AND area_sqm BETWEEN 80 AND 120
  AND epc_rating IN ('A', 'B', 'C');
```

**Bad** (full table scan):
```sql
-- No index, scans all rows
SELECT * FROM property_listings
WHERE LOWER(municipality) LIKE '%brussels%';

-- Better: Use indexed field with enum
SELECT * FROM property_listings
WHERE municipality = 'Brussels'; -- Exact match, indexed
```

**JSONB Good**:
```sql
-- Uses GIN index
SELECT * FROM ad_item_specifics
WHERE specifics @> '{"brand_id": "apple-uuid"}';
```

**JSONB Bad**:
```sql
-- Can't use index efficiently
SELECT * FROM ad_item_specifics
WHERE specifics->>'brand' ILIKE '%apple%'; -- Full scan
```

### Storage Comparison

| Approach | Storage Overhead | Index Size | Query Speed | Schema Flexibility |
|----------|------------------|------------|-------------|-------------------|
| Specialized Tables | Low | Medium | Fast | Low |
| JSONB + Dicts | Medium | Medium-High | Medium | High |
| Pure JSONB | Medium-High | High | Slow-Medium | Very High |

**Recommendation**:
- < 10,000 listings: Any approach works
- 10,000 - 100,000: Use specialized for high-query categories
- > 100,000: Specialized tables strongly recommended for main categories

---

## Evolution Path

### Phase 1: MVP (Current + 3 months)

**Focus**: High-priority specialized categories + common dictionaries

- ✅ Vehicles (done)
- Real Estate (sale & rent)
- Jobs & Resumes
- Electronics dictionaries (brands, models)
- Fashion dictionaries (brands, sizes)
- Baby safety standards
- Common dictionaries (colors, materials, conditions)

**Outcome**: 80% of listings covered with appropriate structure

### Phase 2: Expansion (3-6 months)

**Focus**: Medium-priority JSONB categories + refinements

- Pets (legal species list)
- Tickets & Events (venues, event types)
- Sports & Hobbies
- Furniture & Home
- Optimize JSONB indexes based on query patterns

**Outcome**: All major categories have defined patterns

### Phase 3: Optimization (6-12 months)

**Focus**: Performance tuning + advanced features

- Analyze slow queries → add specialized indexes
- Consider promoting high-volume JSONB categories to specialized tables
- Implement materialized views for complex aggregations
- Add full-text search (tsvector) for JSONB fields
- AI-powered field normalization

**Outcome**: <200ms response time for 95% of searches

### Upgrade Path: JSONB → Specialized

**When to upgrade**:
- Category exceeds 50,000 listings
- Query performance degrades (>500ms consistently)
- Need for complex joins or aggregations
- User complaints about slow search

**How to migrate**:
```sql
-- 1. Create new specialized table
CREATE TABLE <category>_listings (...);

-- 2. Migrate data from JSONB
INSERT INTO <category>_listings (
  advert_id,
  field1,
  field2
  -- ...
)
SELECT 
  advert_id,
  (specifics->>'field1')::TYPE,
  (specifics->>'field2')::TYPE
FROM ad_item_specifics
WHERE advert_id IN (
  SELECT id FROM adverts WHERE category_id = '<category-uuid>'
);

-- 3. Update application code to use new table
-- (Deploy new API endpoints)

-- 4. Clean up old JSONB data (after validation)
DELETE FROM ad_item_specifics
WHERE advert_id IN (
  SELECT advert_id FROM <category>_listings
);
```

### Downgrade Path: Specialized → JSONB

**When to downgrade** (rare):
- Category has very low volume (<1,000 listings)
- Fields change too frequently
- Maintenance burden outweighs benefits

**How**:
```sql
-- 1. Export specialized data to JSONB
INSERT INTO ad_item_specifics (advert_id, specifics)
SELECT 
  advert_id,
  jsonb_build_object(
    'field1', field1,
    'field2', field2
    -- ... all fields
  )
FROM <category>_listings
ON CONFLICT (advert_id) DO UPDATE
SET specifics = EXCLUDED.specifics;

-- 2. Drop specialized table (after validation)
DROP TABLE <category>_listings CASCADE;
```

---

## Summary & Decision Matrix

### Quick Reference

| Category Complexity | Listing Volume | Query Frequency | **Recommended Approach** |
|---------------------|----------------|-----------------|--------------------------|
| High (≥20 fields) | Any | High | **Specialized Tables** |
| High (≥20 fields) | Low (<5k) | Low | JSONB + Dicts (defer specialized) |
| Medium (6-20 fields) | High (>50k) | High | JSONB + Dicts → plan upgrade |
| Medium (6-20 fields) | Medium | Medium | **JSONB + Dicts** |
| Low (0-5 fields) | Any | Any | **Pure JSONB** |

### Key Takeaways

1. **Start Simple**: Default to JSONB unless strong justification for specialized
2. **Measure First**: Use JSONB, add indexes, profile queries → only then specialize
3. **Belgium-First**: Optimize for Belgian market (EPC, CP codes, postcodes)
4. **Consistency**: Follow existing patterns (vehicles for specialized, electronics for JSONB+dicts)
5. **Document Everything**: Each table/field needs clear documentation

### Next Steps

1. Review [CATALOG_MASTER.md](./CATALOG_MASTER.md) for full taxonomy
2. Create category specification documents (see [categories/](./categories/))
3. Implement Phase 1 migrations (real estate, jobs, dictionaries)
4. Build API endpoints following patterns
5. Extend PostForm with category-specific components
6. Monitor query performance → adjust strategy as needed

---

**End of DATABASE_STRATEGY.md**

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](../development/MASTER_CHECKLIST.md)
**Catalog:** [CATALOG_MASTER.md](./CATALOG_MASTER.md) • [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) • [CATALOG_IMPLEMENTATION_STATUS.md](./CATALOG_IMPLEMENTATION_STATUS.md) • [categories/real-estate.md](./categories/real-estate.md)
