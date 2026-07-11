# Real Estate (Nedvizhimost / Immobilier)

> **Category**: Real Estate  
> **Database Strategy**: Specialized Tables (Tier 1)  
> **Priority**: High  
> **Last Updated**: 2025-11-05

## Overview

Real estate listings for the Belgian market, supporting both **sales** and **rentals** of residential and commercial properties. This category requires specialized tables due to complex structured data, Belgium-specific energy certifications (EPC/PEB), legal requirements, and high query volume.

### Target Audience

- **Sellers**: Private individuals, real estate agencies, property developers
- **Renters/Landlords**: Long-term rentals (no short-term/Airbnb)
- **Buyers**: Individuals and investors seeking Belgian properties
- **Tenants**: Searching for residential or commercial rentals

### Use Cases

1. **Sale**: Apartments, houses, land, commercial property, parking/garages
2. **Rent**: Residential and commercial long-term leases
3. **Browse**: Filter by location, price, size, energy rating, features
4. **Compare**: Side-by-side property comparison
5. **Alerts**: Notify users of new listings matching criteria

### Belgium-Specific Considerations

- **EPC (Energy Performance Certificate)**: Mandatory for all listings
- **PEB/EPB Number**: Must be displayed and validated
- **Rental Deposit**: Max 2-3 months (legal limit)
- **Syndic Costs**: Co-ownership fees (must be disclosed)
- **Cadastral Reference**: Stored but hidden from public (privacy)
- **Three Regions**: Brussels, Flanders, Wallonia (different regulations)

---

## Subcategory Tree

```
Real Estate/
├── Sale
│   ├── Apartments (Appartementen / Appartements)
│   ├── Houses (Huizen / Maisons)
│   │   ├── Single Family
│   │   ├── Semi-Detached
│   │   ├── Row House
│   │   ├── Villa
│   │   └── Cottage
│   ├── Rooms (Kamers / Chambres)
│   ├── Land (Grond / Terrain)
│   │   ├── Residential Plot
│   │   ├── Agricultural Land
│   │   └── Commercial Land
│   ├── Commercial Property (Commercieel / Commercial)
│   │   ├── Office Space
│   │   ├── Retail Space
│   │   ├── Industrial
│   │   └── Mixed Use
│   └── Garages & Parking (Garages / Garages)
│       ├── Garage
│       ├── Carport
│       └── Parking Space
│
└── Rent
    ├── Apartment Rentals
    ├── House Rentals
    ├── Room Rentals (Kot for students)
    └── Commercial Rentals
```

---

## Fields

### Base Fields (Inherited from Universal Advert Model)

All fields from `adverts` table:
- `title`, `description`, `price`, `currency` (EUR), `status`, `location`, etc.

**Note**: For rentals, `price` = monthly rent

### Specialized Fields (property_listings table)

| Field Name | Type | Required | Validation | Description | i18n Key |
|------------|------|----------|------------|-------------|----------|
| **Classification** |
| `property_type_id` | UUID | ✅ | FK to property_types | Type of property | `real_estate.type` |
| `listing_type` | TEXT | ✅ | 'sale' \| 'rent' | Sale or rental | `real_estate.listing_type` |
| **Dimensions** |
| `area_sqm` | NUMERIC | ✅ | > 0, max 10000 | Living area in m² | `real_estate.area` |
| `land_area_sqm` | NUMERIC | ⚠️ | > 0 (for houses/land) | Total land plot size | `real_estate.land_area` |
| `rooms` | INT | ⚠️ | 0-20 | Total rooms (excl. kitchen/bath) | `real_estate.rooms` |
| `bedrooms` | INT | ⚠️ | 0-15 | Number of bedrooms | `real_estate.bedrooms` |
| `bathrooms` | NUMERIC | ⚠️ | 0-10, allow .5 | Bathrooms (1.5 = 1 full + 1 half) | `real_estate.bathrooms` |
| **Building Info** |
| `year_built` | INT | ⚠️ | 1800 - current year | Original construction year | `real_estate.year_built` |
| `renovation_year` | INT | ❌ | year_built - current | Last major renovation | `real_estate.renovation_year` |
| `floor` | INT | ⚠️ | -3 to 150 | Floor number (neg. = basement) | `real_estate.floor` |
| `total_floors` | INT | ❌ | > 0 | Total floors in building | `real_estate.total_floors` |
| `elevator` | BOOLEAN | ❌ | - | Elevator available | `real_estate.elevator` |
| **Energy & Compliance** |
| `epc_rating` | TEXT | ✅ (for active) | A++ to G | EPC rating | `real_estate.epc_rating` |
| `epc_cert_number` | TEXT | ✅ (for active) | Format: YYYYMMDD-NNNNNNN-NN | Official EPC cert number | `real_estate.epc_cert` |
| `epc_kwh_per_sqm_year` | INT | ❌ | > 0 | Primary energy consumption | `real_estate.epc_consumption` |
| `peb_url` | TEXT | ❌ | Valid URL | Link to official PEB/EPB | `real_estate.peb_url` |
| **Heating & Utilities** |
| `heating_type` | TEXT[] | ⚠️ | gas, electric, oil, heat_pump, solar, wood, district | Heating systems | `real_estate.heating_type` |
| `water_heater_type` | TEXT | ❌ | instant, tank, solar | Water heater type | `real_estate.water_heater` |
| `double_glazing` | BOOLEAN | ❌ | - | Double glazing windows | `real_estate.double_glazing` |
| **Rental-Specific** (NULL if for sale) |
| `rent_monthly` | NUMERIC | ✅ (if rent) | > 0 | Monthly rent excluding charges | `real_estate.rent_monthly` |
| `rent_charges_monthly` | NUMERIC | ❌ | ≥ 0 | Monthly charges (water, heating) | `real_estate.rent_charges` |
| `syndic_cost_monthly` | NUMERIC | ❌ | ≥ 0 | Co-ownership fees | `real_estate.syndic_cost` |
| `deposit_months` | NUMERIC | ❌ | 0-3 (BE law) | Security deposit in months | `real_estate.deposit` |
| `lease_duration_months` | INT | ❌ | 1-120 | Lease duration | `real_estate.lease_duration` |
| `available_from` | DATE | ❌ | ≥ today | Availability date | `real_estate.available_from` |
| `furnished` | TEXT | ❌ | unfurnished, semi, fully | Furnishing status | `real_estate.furnished` |
| **Sale-Specific** (Hidden from public) |
| `cadastral_reference` | TEXT | ❌ | Format: DIV/SEC/PARCEL | Cadastral ID (HIDDEN) | `real_estate.cadastral_ref` |
| `land_registry_number` | TEXT | ❌ | - | Land registry # (HIDDEN) | `real_estate.registry_num` |
| `notary_name` | TEXT | ❌ | Max 200 chars | Notary handling sale | `real_estate.notary` |
| **Location Details** |
| `postcode` | TEXT | ✅ | 4 digits (BE) | Belgian postcode | `real_estate.postcode` |
| `municipality` | TEXT | ✅ | From BE cities list | Municipality name | `real_estate.municipality` |
| `neighborhood` | TEXT | ❌ | Max 100 chars | Neighborhood/district | `real_estate.neighborhood` |
| **Parking** |
| `parking_spaces` | INT | ❌ | 0-10 | Number of parking spots | `real_estate.parking_spaces` |
| `parking_type` | TEXT[] | ❌ | garage, carport, street, underground | Parking types | `real_estate.parking_type` |
| **Outdoor Space** |
| `terrace_sqm` | NUMERIC | ❌ | > 0 | Terrace area | `real_estate.terrace` |
| `garden_sqm` | NUMERIC | ❌ | > 0 | Garden area | `real_estate.garden` |
| `garden_orientation` | TEXT | ❌ | north, south, east, west | Garden facing direction | `real_estate.garden_orientation` |
| **Features (booleans)** |
| `cellar` | BOOLEAN | ❌ | - | Has cellar | `real_estate.cellar` |
| `attic` | BOOLEAN | ❌ | - | Has attic | `real_estate.attic` |
| **Policies** |
| `pet_friendly` | BOOLEAN | ❌ | - | Pets allowed (rentals) | `real_estate.pet_friendly` |
| `smoking_allowed` | BOOLEAN | ❌ | - | Smoking allowed | `real_estate.smoking` |

### Additional JSONB Fields (ad_item_specifics.specifics)

Flexible fields stored as JSON:

```json
{
  "features": [
    "alarm_system",
    "video_intercom",
    "security_door",
    "solar_panels",
    "rainwater_collection",
    "home_automation"
  ],
  
  "nearby": {
    "public_transport": {
      "metro": "500m",
      "tram": "200m",
      "bus": "100m",
      "train_station": "1.5km"
    },
    "schools": ["primary_school_300m", "high_school_1km"],
    "shops": ["supermarket_400m", "pharmacy_200m"],
    "parks": ["parc_cinquantenaire_800m"]
  },
  
  "renovation_details": {
    "roof": "2020",
    "windows": "2018",
    "kitchen": "2022",
    "bathroom": "2019",
    "electrical": "2020",
    "plumbing": "2015"
  },
  
  "appliances": [
    "oven",
    "dishwasher",
    "washing_machine",
    "dryer"
  ],
  
  "condition_notes": "Recently renovated, excellent condition",
  
  "charges_included": ["water", "heating"], // For rentals
  
  "registration_allowed": true, // Domiciliation for rentals
  
  "zoning": "residential", // For land: residential, agricultural, commercial, mixed
  
  "building_permit": true, // For land plots
  
  "soil_certificate": "2024-03-15" // For land/houses (Belgium requirement)
}
```

---

## JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["property_type_id", "listing_type", "area_sqm", "postcode", "municipality"],
  "properties": {
    "property_type_id": {
      "type": "string",
      "format": "uuid",
      "description": "FK to property_types table"
    },
    "listing_type": {
      "type": "string",
      "enum": ["sale", "rent"]
    },
    "area_sqm": {
      "type": "number",
      "minimum": 1,
      "maximum": 10000
    },
    "rooms": {
      "type": "integer",
      "minimum": 0,
      "maximum": 20
    },
    "bedrooms": {
      "type": "integer",
      "minimum": 0,
      "maximum": 15
    },
    "bathrooms": {
      "type": "number",
      "minimum": 0,
      "maximum": 10,
      "multipleOf": 0.5
    },
    "epc_rating": {
      "type": "string",
      "enum": ["A++", "A+", "A", "B", "C", "D", "E", "F", "G"]
    },
    "epc_cert_number": {
      "type": "string",
      "pattern": "^[0-9]{8}-[0-9]{7}-[0-9]{2}$"
    },
    "heating_type": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["gas", "electric", "oil", "heat_pump", "solar", "wood", "district"]
      },
      "minItems": 1
    },
    "rent_monthly": {
      "type": "number",
      "minimum": 1,
      "description": "Required if listing_type is 'rent'"
    },
    "deposit_months": {
      "type": "number",
      "minimum": 0,
      "maximum": 3,
      "description": "Belgium law: max 3 months deposit"
    },
    "postcode": {
      "type": "string",
      "pattern": "^[1-9][0-9]{3}$",
      "description": "4-digit Belgian postcode"
    },
    "furnished": {
      "type": "string",
      "enum": ["unfurnished", "semi_furnished", "fully_furnished"]
    }
  },
  "allOf": [
    {
      "if": {
        "properties": { "listing_type": { "const": "rent" } }
      },
      "then": {
        "required": ["rent_monthly"]
      }
    },
    {
      "if": {
        "properties": { "listing_type": { "const": "sale" } }
      },
      "then": {
        "properties": {
          "rent_monthly": { "type": "null" },
          "deposit_months": { "type": "null" }
        }
      }
    }
  ]
}
```

---

## Create/Edit Form (UI/UX)

### Step-by-Step Form Flow

Real estate listings extend the base PostForm with **category-specific Step 4**.

#### Step 1: Select Category (Base)
- User selects: Real Estate → Sale or Rent → Property Type

#### Step 2: Property Type & Basics
**Fields**:
- Property Type (dropdown: apartment, house, land, etc.)
- Listing Type (radio: Sale / Rent) — pre-selected from category
- Living Area (m²) — number input with validation
- Land Area (m²) — conditional, show only for houses/land
- Rooms — number input (0-20)
- Bedrooms — number input (0-15)
- Bathrooms — number input with .5 increments (1, 1.5, 2, etc.)

**Help Text**:
- "Living area = habitable space excluding balconies/terraces"
- "Rooms = living room + bedrooms + office (exclude kitchen/bathroom)"

**Validation**:
- Bedrooms ≤ Rooms
- Area must be reasonable (min 10m² for apartments, min 30m² for houses)

#### Step 3: Location
**Fields**:
- Postcode (autocomplete with BE postcodes)
- Municipality (auto-filled from postcode, editable)
- Neighborhood (optional text input)
- Show on map (checkbox — if unchecked, only show city)

**Map Integration**:
- Display map marker with ±500m radius (privacy)
- Auto-populate from postcode if geo not provided

#### Step 4: Energy & Building Details
**Fields**:
- EPC Rating (dropdown: A++ to G) **REQUIRED**
- EPC Certificate Number (text input, format validated) **REQUIRED**
- Primary Energy Consumption (kWh/m²/year) — optional number
- Link to PEB/EPB (optional URL)
- Year Built (1800 - current year)
- Renovation Year (optional, > year_built)
- Floor (number, allow negative for basement) — hide for houses
- Total Floors — hide for houses
- Elevator (checkbox) — conditional, show only for apartments

**Help Text**:
- "EPC certificate is mandatory in Belgium. Format: YYYYMMDD-NNNNNNN-NN"
- Link to official EPC lookup: https://www.energiesparen.be

**Validation**:
- EPC number format must match regex
- Renovation year must be ≥ year built
- Warn if year_built > 100 years ago (likely typo)

#### Step 5: Heating & Utilities
**Fields**:
- Heating Type (multi-select: gas, electric, heat pump, solar, oil, wood, district)
- Water Heater (select: instant, tank, solar)
- Double Glazing (checkbox)

#### Step 6: Rental-Specific (Show Only If listing_type = 'rent')
**Fields**:
- Monthly Rent (EUR) **REQUIRED**
- Monthly Charges (EUR) — water, heating, etc.
- Syndic/Co-ownership Fees (EUR/month)
- Security Deposit (in months, max 3) — default: 2
- Lease Duration (months) — optional
- Available From (date picker, default: today)
- Furnished (radio: Unfurnished / Semi-Furnished / Fully Furnished)
- Pet-Friendly (checkbox)
- Smoking Allowed (checkbox)
- Registration Allowed (checkbox) — "domiciliation"

**Help Text**:
- "Belgian law: security deposit max 3 months rent"
- "Charges = costs like water, heating, elevator, etc."
- "Syndic = monthly co-ownership fees"

#### Step 7: Sale-Specific (Show Only If listing_type = 'sale')
**Fields**:
- Asking Price (EUR) **REQUIRED** (from base advert model)
- Price Negotiable (checkbox)
- Notary Name (optional text) — only visible to serious inquiries
- Cadastral Reference (optional, HIDDEN from public)

**Help Text**:
- "Cadastral reference is stored securely and not shown publicly"

#### Step 8: Parking & Outdoor
**Fields**:
- Parking Spaces (number, 0-10)
- Parking Type (multi-select: garage, carport, street, underground)
- Terrace (m²)
- Garden (m²)
- Garden Orientation (select: North, South, East, West)

#### Step 9: Features & Amenities
**Checkboxes** (stored in JSONB):
- Cellar
- Attic
- Alarm System
- Video Intercom
- Security Door
- Solar Panels
- Rainwater Collection
- Home Automation

**Appliances** (for rentals, multi-select):
- Oven, Dishwasher, Washing Machine, Dryer, Refrigerator

#### Step 10: Nearby & Transport (Optional)
**Text inputs with autocomplete**:
- Metro Station (distance)
- Tram Stop (distance)
- Bus Stop (distance)
- Train Station (distance)
- Schools Nearby
- Shops Nearby
- Parks Nearby

**Auto-suggest** using location API based on postcode

#### Step 11: Description & Photos (Base)
- Description (rich text, min 50 words for real estate)
- Upload photos (min 3, max 20)
- First photo = main property image

**Photo Requirements**:
- Min 3 photos for active listing
- Recommended: exterior, living room, kitchen, bedrooms, bathroom
- Avoid photos with people

#### Step 12: Contact & Publish (Base)
- Contact preferences
- Phone (if verified)
- Preview & Publish

---

## Search & Filters

### Primary Filters

| Filter | Type | Options | Default |
|--------|------|---------|---------|
| **Listing Type** | Radio | Sale, Rent | All |
| **Property Type** | Multi-select | Apartment, House, Land, Commercial, Garage | All |
| **Price Range** | Slider | €0 - €2,000,000 (sale) <br> €0 - €5,000/month (rent) | No limit |
| **Location** | Autocomplete | Postcode or Municipality | None |
| **Radius** | Slider | 0 - 50 km (from location) | 10 km |
| **Rooms** | Min-Max | 0 - 10+ | No limit |
| **Bedrooms** | Min-Max | 0 - 5+ | No limit |
| **Area (m²)** | Min-Max | 0 - 500+ | No limit |
| **EPC Rating** | Multi-select | A++, A+, A, B, C, D, E, F, G | All |

### Secondary Filters (Expandable)

| Filter | Type | Options |
|--------|------|---------|
| **Bathrooms** | Min-Max | 0 - 3+ |
| **Floor** | Min-Max | -1 (basement) - 20+ |
| **Year Built** | Min-Max | 1800 - 2025 |
| **Parking** | Checkbox | Has parking |
| **Elevator** | Checkbox | Has elevator |
| **Terrace** | Checkbox | Has terrace |
| **Garden** | Checkbox | Has garden |
| **Furnished** | Multi-select | Unfurnished, Semi, Fully (rentals only) |
| **Pet-Friendly** | Checkbox | Pets allowed (rentals only) |
| **Features** | Multi-checkbox | Cellar, Attic, Alarm, Solar Panels, etc. |

### Sort Options

- **Relevance** (if search query)
- **Date: Newest First** (default)
- **Date: Oldest First**
- **Price: Lowest First**
- **Price: Highest First**
- **Area: Largest First**
- **Area: Smallest First**
- **Distance: Nearest First** (if location filter applied)

### Sample Queries

**SQL** (via `search_adverts` function or direct):
```sql
-- Find 2BR apartments in Brussels, rent ≤ €1,500, EPC B or better
SELECT 
  a.*,
  pl.*,
  pt.name_en as property_type
FROM adverts a
JOIN property_listings pl ON a.id = pl.advert_id
JOIN property_types pt ON pl.property_type_id = pt.id
WHERE a.status = 'active'
  AND a.moderation_status = 'approved'
  AND pl.listing_type = 'rent'
  AND pl.bedrooms >= 2
  AND pl.postcode LIKE '10%' -- Brussels postcodes
  AND pl.rent_monthly <= 1500
  AND pl.epc_rating IN ('A++', 'A+', 'A', 'B')
ORDER BY a.created_at DESC
LIMIT 24;
```

**TypeScript** (API query):
```typescript
const filters = {
  listing_type: 'rent',
  bedrooms_min: 2,
  postcode_prefix: '10',
  rent_max: 1500,
  epc_ratings: ['A++', 'A+', 'A', 'B'],
  page: 1,
  per_page: 24,
};

const { data } = await supabase.rpc('search_real_estate', filters);
```

### Indexes for Performance

```sql
-- Composite index for common rental searches
CREATE INDEX property_listings_rental_search_idx 
ON property_listings(listing_type, bedrooms, rent_monthly, epc_rating, postcode)
WHERE listing_type = 'rent' AND rent_monthly IS NOT NULL;

-- Composite index for sale searches
CREATE INDEX property_listings_sale_search_idx 
ON property_listings(listing_type, property_type_id, area_sqm, postcode)
WHERE listing_type = 'sale';

-- GiST index for geo-radius queries
CREATE INDEX property_listings_geo_idx 
ON property_listings USING GIST ((
  SELECT point FROM locations 
  WHERE id = (SELECT location_id FROM adverts WHERE id = property_listings.advert_id)
));
```

---

## Moderation & Policies

### Moderation Checklist

In addition to [base checklist](../CATALOG_MASTER.md#moderation-checklist-generic), check:

- ✅ **EPC Certificate**: Valid format and reasonable consumption value
  - Flag if cert number format invalid
  - Flag if claimed A++ but high kWh/m²/year
- ✅ **Price Reasonableness**: Compare to market averages
  - Sale: €2,000 - €5,000/m² typical in Brussels
  - Rent: €10 - €20/m²/month typical
  - Flag if >3σ deviation
- ✅ **Photos**: Minimum 3 photos, show actual property
  - Reject stock photos or photos of other properties
  - Require exterior, interior shots
- ✅ **Dimensions**: Area vs rooms must make sense
  - 1BR apartment: min ~35m²
  - 2BR apartment: min ~60m²
  - Flag if area/rooms ratio suspicious
- ✅ **Rental Deposit**: Must be ≤ 3 months (Belgium law)
- ✅ **Description**: Min 50 words for real estate
  - Reject "For more info contact me"
  - Require details about property condition, location, nearby amenities
- ✅ **Location**: Postcode must be valid Belgium postcode
  - Cross-check postcode vs municipality
- ✅ **Discrimination**: No discriminatory language
  - Reject: "No foreigners", "Only Christians", "No children", etc.
  - Allowed: "No pets", "No smoking"
- ✅ **Scam Indicators**:
  - Price too good to be true (<50% market rate)
  - Request for advance payment before viewing
  - Seller "out of country, send money"
  - No EPC certificate "will provide later"

### Auto-Flags (Trigger Manual Review)

- Rent/sale price >3σ from category mean for that postcode
- Missing EPC certificate for active listing
- EPC number format invalid
- Cadastral reference provided but postcode mismatch
- Multiple listings from same user in short time (>5 properties in 1 week)
- Deposit > 3 months
- Rental listing with "short-term only" (Airbnb-style, not allowed)

### Prohibited

❌ **Always Reject**:
- Short-term vacation rentals (use Airbnb/Booking.com)
- Listings without EPC certificate (illegal in Belgium)
- Discriminatory language (race, religion, nationality, family status)
- Fake photos (stock images, other properties)
- Spam/duplicate listings

### RLS Policies

```sql
-- Users can view approved listings + their own
CREATE POLICY "users_view_property_listings"
ON property_listings FOR SELECT
USING (
  advert_id IN (
    SELECT id FROM adverts 
    WHERE auth.uid() = user_id 
    OR (status = 'active' AND moderation_status = 'approved')
  )
);

-- Users can insert their own
CREATE POLICY "users_insert_property_listings"
ON property_listings FOR INSERT
WITH CHECK (
  advert_id IN (SELECT id FROM adverts WHERE auth.uid() = user_id)
);

-- Users can update their drafts/rejected
CREATE POLICY "users_update_property_listings"
ON property_listings FOR UPDATE
USING (
  advert_id IN (
    SELECT id FROM adverts 
    WHERE auth.uid() = user_id 
    AND status IN ('draft', 'rejected')
  )
);

-- Cadastral reference is HIDDEN from public queries
-- (implement via view or API filtering, not RLS)
```

---

## SEO

### Title Templates

**Sale**:
```
{Property Type} in {Municipality} - {Bedrooms}BR, {Area}m² | LyVoX
Apartment in Brussels - 2BR, 85m² | LyVoX
```

**Rent**:
```
{Property Type} for Rent in {Municipality} - €{Rent}/month | LyVoX
House for Rent in Ghent - €1,200/month | LyVoX
```

**Max Length**: 60 characters

### Description Templates

**Sale** (max 160 chars):
```
{Property Type} for sale in {Municipality}. {Bedrooms}BR, {Area}m², EPC {Rating}. {Year Built}. {Key Feature}. Contact seller on LyVoX Belgium.

Apartment for sale in Brussels. 2BR, 85m², EPC B. Built 2005. Terrace & parking. Contact seller on LyVoX Belgium.
```

**Rent**:
```
{Property Type} for rent in {Municipality}. {Bedrooms}BR, {Area}m², €{Rent}/month. EPC {Rating}. {Furnished} furnished. Available {Date}.

Apartment for rent in Antwerp. 1BR, 55m², €850/month. EPC C. Fully furnished. Available from 2025-12-01.
```

### Schema.org Markup

**Type**: `RealEstateListing` + `Apartment` or `House`

```json
{
  "@context": "https://schema.org",
  "@type": "RealEstateListing",
  "name": "Apartment for sale in Brussels - 2BR, 85m²",
  "description": "Beautiful 2-bedroom apartment in the heart of Brussels...",
  "url": "https://lyvox.be/en/ad/123.../apartment-brussels-2br",
  "image": ["url1", "url2", "url3"],
  
  "offers": {
    "@type": "Offer",
    "price": "295000",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Person",
      "name": "Seller Name"
    }
  },
  
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Brussels",
    "addressRegion": "Brussels-Capital Region",
    "postalCode": "1000",
    "addressCountry": "BE"
  },
  
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "50.8503",
    "longitude": "4.3517"
  },
  
  "floorSize": {
    "@type": "QuantitativeValue",
    "value": 85,
    "unitCode": "MTK"
  },
  
  "numberOfRooms": 3,
  "numberOfBedrooms": 2,
  "numberOfBathroomsTotal": 1,
  
  "yearBuilt": 2005,
  
  "additionalProperty": [
    {
      "@type": "PropertyValue",
      "name": "EPC Rating",
      "value": "B"
    },
    {
      "@type": "PropertyValue",
      "name": "Elevator",
      "value": "Yes"
    },
    {
      "@type": "PropertyValue",
      "name": "Parking",
      "value": "1 space"
    }
  ]
}
```

### hreflang

```html
<link rel="alternate" hreflang="nl" href="https://lyvox.be/nl/ad/.../appartement-brussel-2-slaapkamers" />
<link rel="alternate" hreflang="fr" href="https://lyvox.be/fr/ad/.../appartement-bruxelles-2-chambres" />
<link rel="alternate" hreflang="en" href="https://lyvox.be/en/ad/.../apartment-brussels-2-bedrooms" />
<link rel="alternate" hreflang="de" href="https://lyvox.be/de/ad/.../wohnung-brüssel-2-schlafzimmer" />
<link rel="alternate" hreflang="ru" href="https://lyvox.be/ru/ad/.../kvartira-brussel-2-spalni" />
<link rel="alternate" hreflang="x-default" href="https://lyvox.be/en/ad/.../apartment-brussels-2-bedrooms" />
```

---

## AI Enrichment

### Title Optimization

**Input**: Raw title, key specs
**Prompt**:
```
You are writing a real estate listing title for the Belgian market.

Property: {property_type} in {municipality}
Specs: {bedrooms}BR, {area}m², EPC {epc_rating}, {key_features}
Listing: {listing_type}

Generate a concise title (max 70 chars) that includes:
- Property type
- Location (municipality)
- Key specs (bedrooms, area)
- One standout feature if space allows

Output: Just the title, no quotes.
```

**Example Output**: `Modern 2BR Apartment in Ixelles - 85m², EPC A, Terrace`

### Description Expansion

**Prompt**:
```
You are writing a property listing description for Belgium (language: {locale}).

Property: {property_type} for {listing_type}
Location: {municipality}, {neighborhood}
Specs: {bedrooms}BR, {bathrooms} bath, {area}m², EPC {epc_rating}
Price: €{price_or_rent}
Features: {features_list}

Brief description: "{user_description}"

Expand into a compelling 150-250 word description that:
- Highlights location benefits (transport, schools, shops)
- Describes property features and condition
- Mentions energy efficiency and modern amenities
- Is factual and honest (no exaggeration)
- Ends with call-to-action

Write in {locale}. Use Belgian terminology.
```

### Auto-Validation

**EPC Certificate Check**:
- Cross-reference EPC number format
- Check if consumption matches rating (A++ should be <45 kWh/m²/year)
- Warn if mismatch detected

**Price Sanity Check**:
- Compare to market rates (€/m²) for that postcode
- Flag if >50% below or >200% above average
- AI prompt: "Is this price realistic for {property_type} in {municipality}, {area}m²?"

### Image Analysis

**AI Checks**:
- Detect if photos are stock images (reject)
- Check if photos show interior vs exterior (require both)
- Identify property features from photos (automatic tagging)
- Blurriness/quality score (warn if low)

### Duplicate Detection

- Embedding-based similarity on description + specs
- Same address + similar price → likely duplicate
- Warn seller before posting

---

## Examples

### Example 1: Apartment for Sale (Brussels)

```json
{
  "advert_id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Modern 2BR Apartment in Ixelles - 85m², EPC B",
  "description": "Beautiful 2-bedroom apartment in the heart of Ixelles, one of Brussels' most vibrant neighborhoods. This 85m² property features a spacious living room with large windows, modern kitchen, two comfortable bedrooms, and a renovated bathroom. Recent double glazing and gas heating ensure comfort and energy efficiency (EPC rating B). Located on the 3rd floor with elevator, close to EU Quarter, shops, restaurants, and public transport (metro Schuman 400m). Ideal for professionals or small families. Available immediately.",
  
  "property_listing": {
    "property_type_id": "apt-uuid",
    "listing_type": "sale",
    "area_sqm": 85,
    "rooms": 3,
    "bedrooms": 2,
    "bathrooms": 1,
    "year_built": 1998,
    "renovation_year": 2020,
    "floor": 3,
    "total_floors": 6,
    "elevator": true,
    
    "epc_rating": "B",
    "epc_cert_number": "20240315-1234567-01",
    "epc_kwh_per_sqm_year": 145,
    
    "heating_type": ["gas"],
    "double_glazing": true,
    
    "postcode": "1050",
    "municipality": "Ixelles",
    "neighborhood": "EU Quarter",
    
    "parking_spaces": 0,
    "terrace_sqm": 0,
    "garden_sqm": 0
  },
  
  "price": 295000,
  "currency": "EUR",
  "condition": "excellent",
  
  "specifics": {
    "features": ["double_glazing", "elevator", "cellar"],
    "nearby": {
      "metro": "Schuman - 400m",
      "shops": "Supermarket - 200m",
      "schools": "European School - 800m"
    },
    "renovation_details": {
      "windows": "2020",
      "bathroom": "2019"
    }
  },
  
  "images": [
    "https://.../exterior.jpg",
    "https://.../living-room.jpg",
    "https://.../kitchen.jpg",
    "https://.../bedroom1.jpg",
    "https://.../bathroom.jpg"
  ],
  
  "status": "active",
  "moderation_status": "approved"
}
```

### Example 2: House for Rent (Ghent)

```json
{
  "advert_id": "223e4567-e89b-12d3-a456-426614174001",
  "title": "Spacious 3BR House in Ghent - €1,350/month",
  "description": "Charming 3-bedroom house for rent in Ghent, near city center. 120m² living space with 50m² garden. Ground floor: living room, dining area, fully equipped kitchen. First floor: 3 bedrooms, bathroom with bath and shower. Gas heating, EPC rating C. Quiet residential area, 10 min bike ride to Gent-Sint-Pieters station. Available from January 1st. Pets negotiable.",
  
  "property_listing": {
    "property_type_id": "house-uuid",
    "listing_type": "rent",
    "area_sqm": 120,
    "land_area_sqm": 150,
    "rooms": 4,
    "bedrooms": 3,
    "bathrooms": 1,
    "year_built": 1985,
    "renovation_year": 2018,
    
    "epc_rating": "C",
    "epc_cert_number": "20230820-9876543-02",
    "epc_kwh_per_sqm_year": 205,
    
    "heating_type": ["gas"],
    "double_glazing": true,
    
    "rent_monthly": 1350,
    "rent_charges_monthly": 50,
    "syndic_cost_monthly": 0,
    "deposit_months": 2,
    "lease_duration_months": 36,
    "available_from": "2025-01-01",
    "furnished": "unfurnished",
    
    "postcode": "9000",
    "municipality": "Gent",
    "neighborhood": "Sint-Amandsberg",
    
    "parking_spaces": 1,
    "parking_type": ["street"],
    "terrace_sqm": 0,
    "garden_sqm": 50,
    "garden_orientation": "south",
    
    "pet_friendly": true,
    "smoking_allowed": false
  },
  
  "price": null,
  "currency": "EUR",
  
  "specifics": {
    "features": ["garden", "cellar", "bike_storage"],
    "nearby": {
      "train_station": "Gent-Sint-Pieters - 2km",
      "tram": "300m",
      "shops": "Aldi - 500m"
    },
    "appliances": ["oven", "dishwasher"],
    "charges_included": ["water"],
    "registration_allowed": true
  },
  
  "images": [
    "https://.../house-exterior.jpg",
    "https://.../living-room.jpg",
    "https://.../kitchen.jpg",
    "https://.../bedroom1.jpg",
    "https://.../bedroom2.jpg",
    "https://.../bedroom3.jpg",
    "https://.../bathroom.jpg",
    "https://.../garden.jpg"
  ],
  
  "status": "active",
  "moderation_status": "approved"
}
```

### Example 3: Land for Sale (Wallonia)

```json
{
  "advert_id": "323e4567-e89b-12d3-a456-426614174002",
  "title": "Building Plot in Namur - 800m², Residential Zoning",
  "description": "Prime building plot for sale in Namur. 800m² of land with residential zoning and all utilities available (water, electricity, sewage). Building permit approved for single-family home. Quiet area, 5 min drive to Namur center. Soil certificate available. Ideal for families looking to build their dream home.",
  
  "property_listing": {
    "property_type_id": "land-uuid",
    "listing_type": "sale",
    "area_sqm": 0,
    "land_area_sqm": 800,
    "rooms": null,
    "bedrooms": null,
    "bathrooms": null,
    
    "epc_rating": null,
    "epc_cert_number": null,
    
    "postcode": "5000",
    "municipality": "Namur",
    "neighborhood": "Jambes"
  },
  
  "price": 125000,
  "currency": "EUR",
  
  "specifics": {
    "zoning": "residential",
    "building_permit": true,
    "soil_certificate": "2024-11-01",
    "utilities_available": ["water", "electricity", "sewage"],
    "max_building_height": "9m",
    "max_building_coverage": "40%"
  },
  
  "images": [
    "https://.../land-overview.jpg",
    "https://.../cadastral-map.jpg",
    "https://.../street-view.jpg"
  ],
  
  "status": "active",
  "moderation_status": "approved"
}
```

---

## Related Documents

- [CATALOG_MASTER.md](../CATALOG_MASTER.md) - Universal advert model
- [DATABASE_STRATEGY.md](../DATABASE_STRATEGY.md) - Hybrid approach details
- [Belgium EPC Standards](https://www.energiesparen.be) - Official EPC info
- [Rental Laws Belgium](https://www.belgium.be/en/housing/renting) - Legal requirements

---

**End of real-estate.md**

---

## 🔗 Related Docs

**Development:** [Production master](../../MASTER_PRODUCTION_TZ.md)
**Catalog:** [CATALOG_MASTER.md](../CATALOG_MASTER.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../CATALOG_IMPLEMENTATION_STATUS.md) • [FINAL_COMPLETION_REPORT.md](../FINAL_COMPLETION_REPORT.md) • [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)
