# LyVoX Catalog Master Guide

> **Version**: 1.0  
> **Last Updated**: 2025-11-05  
> **Audience**: Developers, Product Team, Content Managers

## Purpose

This document defines the complete catalog architecture for LyVoX marketplace (Belgium). It establishes the foundation for all category specifications, database schemas, API contracts, UI patterns, moderation rules, SEO strategies, and AI enrichment.

---

## Table of Contents

1. [Complete Taxonomy](#complete-taxonomy)
2. [Universal Advert Model](#universal-advert-model)
3. [Field Inheritance Model](#field-inheritance-model)
4. [Belgium-Specific Standards](#belgium-specific-standards)
5. [Moderation Framework](#moderation-framework)
6. [SEO Principles](#seo-principles)
7. [AI Enrichment Strategy](#ai-enrichment-strategy)
8. [Search Architecture](#search-architecture)
9. [Data Validation Rules](#data-validation-rules)
10. [Pricing & Currency](#pricing--currency)
11. [Delivery & Fulfillment](#delivery--fulfillment)
12. [Reference Dictionaries](#reference-dictionaries)
13. [Implementation Patterns](#implementation-patterns)

---

## Complete Taxonomy

LyVoX supports a 3-level category hierarchy optimized for the Belgian marketplace. All categories support 5 languages: **NL**, **FR**, **EN**, **RU**, **DE**.

### Level 1: Main Categories (9 total)

```
1. 🚗 Transport (Транспорт)
2. 🏠 Real Estate (Недвижимость)
3. 👔 Fashion & Personal Items (Личные вещи)
4. 📱 Electronics & Appliances (Электроника и техника)
5. 🏡 Home, Hobbies & Kids (Для дома, хобби и детей)
6. 💼 Services & Business (Услуги и бизнес)
7. 🐾 Pets (Животные)
8. 💼 Jobs & Career (Работа и карьера)
9. ✨ Special Categories (Особые категории)
```

### Complete Hierarchy

#### 1. Transport

```
Transport/
├── Cars (Легковые автомобили) [SPECIALIZED]
│   ├── New Cars
│   └── Used Cars
├── Motorcycles & Special Transport
│   ├── Motorcycles, Scooters, Mopeds
│   ├── Trucks & Buses
│   ├── Special Equipment
│   └── Water Transport (boats, yachts)
└── Parts & Accessories
    ├── Tires, Rims & Wheels
    ├── Auto Chemistry & Oils
    ├── Audio, Video & Navigation
    ├── Roof Racks & Tow Bars
    └── Accessories (covers, mats, etc.)
```

**Database Strategy**: Specialized tables (`vehicle_makes`, `vehicle_models`, `vehicle_generations`)

#### 2. Real Estate

```
Real Estate/
├── Sale [SPECIALIZED]
│   ├── Apartments
│   ├── Rooms
│   ├── Houses, Villas, Cottages
│   ├── Land
│   ├── Commercial Property
│   └── Garages & Parking
└── Rent [SPECIALIZED]
    ├── Apartment Rentals
    ├── House Rentals
    └── Commercial Rentals
```

**Database Strategy**: Specialized tables (`property_types`, `epc_ratings`, `property_features`)

#### 3. Fashion & Personal Items

```
Fashion/
├── Women's Fashion [JSONB + DICTS]
│   ├── Outerwear
│   ├── Dresses & Skirts
│   ├── Blouses & Shirts
│   ├── Pants & Shorts
│   ├── Sweaters & Hoodies
│   ├── T-Shirts & Tops
│   ├── Sportswear
│   ├── Homewear
│   ├── Underwear
│   ├── Swimwear
│   ├── Shoes
│   ├── Accessories (bags, belts, scarves)
│   └── Hats
├── Men's Fashion [JSONB + DICTS]
│   ├── Outerwear
│   ├── Jackets & Suits
│   ├── Shirts
│   ├── Pants & Shorts
│   ├── Sweaters & Hoodies
│   ├── T-Shirts & Tank Tops
│   ├── Sportswear
│   ├── Homewear
│   ├── Underwear
│   ├── Shoes
│   ├── Accessories (ties, belts, wallets)
│   └── Hats
└── Kids' Fashion [JSONB + DICTS]
    ├── Newborn Clothes
    ├── Outerwear
    ├── Overalls & Bodysuits
    ├── Dresses & Skirts
    ├── Pants & Shorts
    ├── T-Shirts
    ├── Sweaters & Hoodies
    ├── Sportswear
    ├── Shoes
    ├── Accessories
    └── Hats
```

**Database Strategy**: JSONB with dictionary tables for sizes, brands, materials

#### 4. Electronics & Appliances

```
Electronics/
├── Phones & Tablets [JSONB + DICTS]
│   ├── Mobile Phones
│   ├── Tablets
│   ├── Smart Watches & Bands
│   ├── Headphones & Earbuds
│   └── Accessories (cases, chargers)
├── Computers & Office [JSONB + DICTS]
│   ├── Laptops
│   ├── Computers & All-in-Ones
│   ├── Components
│   ├── Gaming Consoles & Accessories
│   ├── Office Equipment (printers, MFPs)
│   ├── Network Equipment
│   └── Software
├── Photo & Video [JSONB + DICTS]
│   ├── Cameras
│   ├── Video Cameras
│   ├── Lenses
│   └── Action Cameras
├── TV, Audio & Video [JSONB + DICTS]
│   ├── TVs
│   ├── Audio Equipment
│   └── Media Players
└── Home Appliances [JSONB]
    ├── Kitchen Appliances
    ├── Home Appliances
    ├── Climate Control
    └── Beauty & Health Appliances
```

**Database Strategy**: JSONB with brand/model dictionaries for main categories

#### 5. Home, Hobbies & Kids

```
Home & Hobbies/
├── Home & Garden [JSONB]
│   ├── Furniture
│   ├── Textiles & Carpets
│   ├── Dishes & Kitchen Utensils
│   ├── Lighting
│   ├── Interior & Decor
│   ├── Garden
│   └── Household Goods
├── Baby & Kids [JSONB + SAFETY]
│   ├── Toys & Games
│   ├── Strollers
│   ├── Car Seats
│   ├── Feeding Items
│   ├── Children's Furniture
│   ├── Items for Moms
│   └── Hygiene & Care
└── Hobbies & Recreation [JSONB]
    ├── Sports Goods
    ├── Books & Magazines
    ├── Musical Instruments
    ├── Collectibles
    ├── Board Games
    ├── Tourism & Fishing
    └── Tickets
```

**Database Strategy**: JSONB with safety standards dictionary for baby/kids

#### 6. Services & Business

```
Services & Business/
├── Services [JSONB]
│   ├── Repair & Construction
│   ├── Finishing Work
│   ├── Transportation
│   ├── Beauty & Health
│   ├── Equipment Repair
│   ├── Education & Courses
│   ├── Cleaning
│   ├── Pet Care
│   └── Event Planning
└── Service Requests [JSONB]
    ├── Looking for a Specialist
    ├── Looking for Education
    └── Looking for Transportation
```

**Database Strategy**: JSONB with certification/license types

#### 7. Pets

```
Pets/
├── Domestic Pets [JSONB + LEGAL]
│   ├── Dogs
│   ├── Cats
│   ├── Rodents
│   ├── Birds
│   └── Aquariums
└── Pet Supplies [JSONB]
    ├── Food & Treats
    ├── Carriers & Cages
    └── Toys & Accessories
```

**Database Strategy**: JSONB with Belgium-legal species list

#### 8. Jobs & Career

```
Jobs/
├── Vacancies [SPECIALIZED]
│   ├── Full-Time
│   ├── Part-Time
│   └── Temporary/Side Jobs
└── Resumes [SPECIALIZED]
    ├── Specialists
    ├── Manual Labor
    └── Students & Interns
```

**Database Strategy**: Specialized tables (`job_categories`, `job_contract_types` with Belgium CP codes)

#### 9. Special Categories

```
Special/
├── Free & Giveaway [JSONB]
│   ├── Free
│   └── For Exchange
└── Lost & Found [JSONB]
    ├── Looking for Item
    └── Offering Exchange
```

**Database Strategy**: Pure JSONB

### Naming Conventions

- **Slugs**: lowercase, hyphenated, URL-safe
  - Example: `transport/legkovye-avtomobili` → `/c/transport/legkovye-avtomobili`
- **i18n Keys**: `category.<slug>.name`, `category.<slug>.description`
- **Path Field**: Full hierarchical path stored in `categories.path`
  - Example: `transport/legkovye-avtomobili/used-cars`

---

## Universal Advert Model

All adverts inherit these **base fields**, regardless of category.

### Core Fields (Required for All)

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | UUID | ✅ Auto | Primary key | UUID v4 |
| `user_id` | UUID | ✅ | Seller ID | FK to auth.users |
| `category_id` | UUID | ✅ | Category | FK to categories |
| `title` | TEXT | ✅ | Listing title | 3-200 chars |
| `description` | TEXT | ⚠️ Draft OK | Full description | Max 10,000 chars |
| `price` | NUMERIC | ⚠️ Optional | Price in EUR | ≥ 0, max 999,999,999 |
| `currency` | TEXT | ✅ | Currency code | EUR (default), USD, GBP, RUB |
| `condition` | TEXT | ⚠️ Optional | Item condition | new, used, for_parts |
| `status` | TEXT | ✅ | Advert status | draft, active, archived |
| `created_at` | TIMESTAMPTZ | ✅ Auto | Creation timestamp | Now() |
| `updated_at` | TIMESTAMPTZ | ✅ Auto | Last update | Now() |
| `expires_at` | TIMESTAMPTZ | ⚠️ Optional | Expiration date | Default: created_at + 90 days |

### Location Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `location_id` | UUID | ⚠️ Optional | FK to locations table |
| `location` | TEXT | ⚠️ Optional | Freetext location (if no geo) |

**Note**: Either `location_id` (with geo point) or `location` text should be provided for active listings.

### Media Fields

Stored in separate `media` table:

| Field | Type | Description |
|-------|------|-------------|
| `advert_id` | UUID | FK to adverts |
| `url` | TEXT | Image URL (Supabase Storage) |
| `type` | TEXT | image, video |
| `sort` | INT | Display order (0-indexed) |
| `alt_text` | TEXT | Accessibility description |

**Requirements**:
- Minimum: 1 image for active listings
- Maximum: 20 images per advert
- Formats: JPEG, PNG, WebP
- Max size: 10MB per image
- Recommended: 1200x800px minimum

### Moderation Fields

| Field | Type | Description | Who Sets |
|-------|------|-------------|----------|
| `moderation_status` | TEXT | pending_review, approved, rejected, flagged | System/Moderator |
| `moderation_note` | TEXT | Internal note for moderators | Moderator |
| `moderation_at` | TIMESTAMPTZ | Last moderation action timestamp | System |
| `moderator_id` | UUID | FK to profiles (moderator) | System |

### Trust & Metrics Fields

| Field | Type | Description |
|-------|------|-------------|
| `trust_score_snapshot` | INT | Seller's trust score at publish time |
| `views_count` | INT | Total views counter |
| `favorites_count` | INT | Times favorited |
| `messages_count` | INT | Inquiries received |
| `phone_reveals_count` | INT | Phone number reveals |

### Contact Preferences

Stored in `ad_item_specifics.specifics` JSONB:

```json
{
  "contact_pref": ["message", "phone", "email"],
  "delivery_options": ["pickup", "shipping", "delivery"],
  "seller_type": "private" // or "business"
}
```

---

## Field Inheritance Model

Categories extend the Universal Advert Model with **category-specific fields** stored in:

1. **Specialized tables** (for complex categories)
2. **`ad_item_specifics.specifics` JSONB** (for simpler categories)

### Specialized Table Pattern (e.g., Vehicles)

```sql
-- Separate table links to advert
CREATE TABLE vehicle_listings (
  advert_id UUID PRIMARY KEY REFERENCES adverts(id) ON DELETE CASCADE,
  make_id UUID REFERENCES vehicle_makes(id),
  model_id UUID REFERENCES vehicle_models(id),
  generation_id UUID REFERENCES vehicle_generations(id),
  year INT NOT NULL,
  mileage INT,
  engine_volume NUMERIC,
  fuel_type TEXT,
  transmission TEXT,
  drive_type TEXT,
  body_type TEXT,
  doors INT,
  color TEXT,
  vin TEXT,
  -- ... more vehicle-specific fields
);
```

**When to use**: Categories with ≥15 structured fields, need for joins, complex queries

### JSONB Pattern (e.g., Electronics, Fashion)

```sql
-- Store in existing ad_item_specifics table
CREATE TABLE ad_item_specifics (
  advert_id UUID PRIMARY KEY REFERENCES adverts(id),
  specifics JSONB NOT NULL DEFAULT '{}'
);

-- Example for phone listing
{
  "brand": "Apple",
  "model": "iPhone 13 Pro",
  "memory_ram": "6GB",
  "storage": "256GB",
  "battery_health": "95%",
  "imei": "hidden_until_reveal",
  "factory_unlocked": true,
  "warranty_until": "2025-12-31",
  "accessories": ["charger", "original_box", "earphones"],
  "condition_notes": "Minor scratches on back"
}
```

**When to use**: Categories with flexible fields, fewer joins needed, rapid iteration

### Hybrid Pattern (e.g., Real Estate)

```sql
-- Core structured data in specialized table
CREATE TABLE property_listings (
  advert_id UUID PRIMARY KEY REFERENCES adverts(id),
  property_type_id UUID REFERENCES property_types(id),
  area_sqm NUMERIC NOT NULL,
  rooms INT,
  bedrooms INT,
  bathrooms NUMERIC, -- 1.5, 2.0, etc.
  epc_rating TEXT, -- A++, A+, A, B, C, D, E, F, G
  year_built INT,
  floor INT,
  -- ... core fields
);

-- Additional flexible data in JSONB
-- (stored in ad_item_specifics.specifics)
{
  "terrace_sqm": 15,
  "garden_sqm": 50,
  "parking_spaces": 2,
  "elevator": true,
  "pet_friendly": true,
  "furnished": "semi",
  "heating": ["gas", "solar"],
  "energy_cert_number": "20240512-0001234-00",
  "syndic_cost_monthly": 120,
  "features": ["double_glazing", "alarm", "video_intercom"]
}
```

---

## Belgium-Specific Standards

### Units of Measure

| Measurement | Unit | Format |
|-------------|------|--------|
| Distance | Kilometers (km) | Whole numbers |
| Area | Square meters (m²) | Decimal (2 places) |
| Volume (engine) | Liters (L) | Decimal (1-2 places) |
| Weight | Kilograms (kg) | Whole/decimal |
| Temperature | Celsius (°C) | Whole numbers |
| Fuel efficiency | L/100km | Decimal (1 place) |

### Currency

- **Primary**: EUR (€)
- **Supported**: USD ($), GBP (£), RUB (₽)
- **Display**: Always show currency symbol
- **Format**: `€1.234,56` (Belgian/EU format with space for thousands)

### Address & Location

**Postcode Format**: `NNNN` (4 digits)
- Brussels: 1000-1299
- Flanders: Variable
- Wallonia: Variable

**Validation**: Must match valid Belgian postcode list

**Regions**:
- Brussels-Capital Region (Région de Bruxelles-Capitale / Brussels Hoofdstedelijk Gewest)
- Flemish Region (Vlaams Gewest)
- Walloon Region (Région wallonne)

**Privacy**: Never display exact addresses publicly. Show:
- City/municipality
- Postcode (first 2 digits for sensitive categories)
- Map marker with ±500m radius

### Real Estate Specific (Belgium)

**EPC (Energy Performance Certificate) Ratings**:
- Scale: A++ (best) to G (worst)
- Required for all property sales/rentals
- Certificate number format: `YYYYMMDD-NNNNNNN-NN`

**PEB/EPB** (Performance Énergétique des Bâtiments):
- Mandatory display in listings
- Include: rating, primary energy consumption (kWh/m²/year)

**Rental Regulations**:
- Security deposit: Max 2-3 months rent
- Landlord registration required
- Mention of "syndic" costs (co-ownership fees)

**Cadastral Reference**: Format `DIVISION/SECTION/PARCEL/SUBPARCEL`
- Example: `46013A0123/00A000`
- **Privacy**: Never display publicly, store for verification only

### Jobs Specific (Belgium)

**CP Codes** (Paritair Comité / Commission Paritaire):
- Belgium's joint labor committee codes
- Example: CP 200 (auxiliary services), CP 218 (horeca)
- Format: `CP XXX.XX`
- Required for job postings by Belgian employers

**Salary Display**:
- Must specify: Gross (brut) or Net
- Include: Annual/monthly/hourly
- Format: `€2.500 brut/mois` or `€18/heure net`

**Contract Types**:
- CDI (Contrat à Durée Indéterminée) - Permanent
- CDD (Contrat à Durée Déterminée) - Fixed-term
- Intérim - Temporary via agency
- Freelance / Indépendant

**Work Permits**:
- Flag if work permit required for non-EU citizens
- Mention if employer sponsors permits

### Safety Standards (Baby & Kids)

**EU/Belgium Standards**:
- **CE marking**: Required for toys
- **EN 71**: European toy safety standard
- **ECE R129 (i-Size)**: Car seat standard (replaces R44/04)
- **EN 1888**: Stroller standard
- **EN 716**: Cot safety standard

**Prohibited**:
- Toys with small parts for <3 years (choking hazard)
- Non-compliant car seats
- Recalled products (maintain blacklist)

### Pets (Belgium Legal)

**Allowed Species** (no license required):
- Dogs, Cats
- Rabbits, Guinea Pigs, Hamsters
- Birds (non-endangered)
- Fish (non-invasive)

**Restricted/Prohibited**:
- Exotic animals (snakes, reptiles) - require permit
- Endangered species
- Aggressive dog breeds (breed-specific legislation)

**Requirements**:
- Dog registration chip (mandatory)
- Vaccination records
- Breed restrictions in some municipalities

### GDPR & DSA Compliance

**Data Retention**:
- Active listings: Until archived + 90 days
- Archived listings: 1 year
- User data: Retained until account deletion + legal minimum
- Logs: 1 year

**Right to Erasure**:
- User can request data deletion
- Listings anonymized (user data removed)
- Compliance within 30 days

**DSA (Digital Services Act)**:
- Content moderation transparency
- Report mechanism for illegal content
- Seller identity verification for business accounts
- Clear terms of service

**Cookie Consent**:
- Essential: Analytics, security
- Marketing: Opt-in required
- Third-party: Explicit consent

---

## Moderation Framework

### Listing Statuses

| Status | Description | User Actions | Moderator Actions |
|--------|-------------|--------------|-------------------|
| `draft` | Work in progress | Edit, Delete | View only |
| `pending_review` | Submitted, awaiting moderation | View only | Approve, Reject, Flag |
| `approved` | Published, visible to all | Edit (→ pending), Archive | Flag, Archive |
| `rejected` | Rejected by moderator | Edit & Resubmit, Delete | Update note |
| `flagged` | Flagged for review | Contact support | Review, Approve, Reject |
| `archived` | Removed from listings | View, Duplicate | View only |

### Auto-Moderation Rules

**Instant Approval** (no manual review):
- Verified user (email + phone) ✅
- Trust score ≥ 50
- No forbidden keywords
- Price within category range
- All required fields filled

**Manual Review Required**:
- New user (trust score < 20)
- Suspicious keywords detected
- Price outlier (3σ from category mean)
- Multiple listings in short time (>5 in 1 hour)
- Previous rejections in last 30 days

**Auto-Rejection**:
- Prohibited keywords (profanity, hate speech)
- Missing required fields for active status
- Duplicate listing (same title/description/price)
- Blacklisted phone/email/IP

### Moderation Roles

| Role | Permissions | RLS Policy |
|------|-------------|------------|
| `user` | Create/edit own listings | Own adverts + public approved |
| `verified_user` | + Auto-approval eligible | Own adverts + public approved |
| `business` | + Bulk uploads, analytics | Own adverts + public approved |
| `moderator` | Review queue, approve/reject | All pending/flagged adverts |
| `admin` | All moderation + user management | All adverts, all statuses |

### RLS Policy Matrix

```sql
-- Users can view their own adverts (any status) + public approved ones
CREATE POLICY "users_view_own_and_approved"
ON adverts FOR SELECT
USING (
  auth.uid() = user_id 
  OR (status = 'active' AND moderation_status = 'approved')
);

-- Users can insert their own adverts
CREATE POLICY "users_insert_own"
ON adverts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own draft/rejected adverts
CREATE POLICY "users_update_own_drafts"
ON adverts FOR UPDATE
USING (auth.uid() = user_id AND status IN ('draft', 'rejected'));

-- Moderators can view all pending/flagged
CREATE POLICY "moderators_view_queue"
ON adverts FOR SELECT
USING (is_moderator(auth.uid()) AND moderation_status IN ('pending_review', 'flagged'));

-- Moderators can update moderation fields
CREATE POLICY "moderators_update_moderation"
ON adverts FOR UPDATE
USING (is_moderator(auth.uid()))
WITH CHECK (is_moderator(auth.uid()));
```

### Moderation Checklist (Generic)

For all listings, moderators check:

- ✅ Title is descriptive and accurate
- ✅ Description provides sufficient detail
- ✅ Price is reasonable for category
- ✅ Images are clear and relevant
- ✅ Contact information is legitimate
- ✅ No prohibited content (weapons, illegal items, discriminatory language)
- ✅ Category is correct
- ✅ Location is plausible

**Category-Specific Checklists**: See individual category docs

### Prohibited Content (Global)

❌ **Always Reject**:
- Weapons, explosives, ammunition
- Illegal drugs or paraphernalia
- Stolen goods
- Counterfeit items
- Adult content / explicit material
- Hate speech, discrimination
- Pyramid schemes, MLM
- Human trafficking, illegal services
- Endangered species
- Prescription medication without license

⚠️ **Flag for Review**:
- High-value items (>€10,000)
- Electronics without IMEI/serial
- Vehicles without VIN
- Real estate without EPC
- Job postings with unrealistic salaries
- Pets without vaccination proof

### Reporting & Appeals

**User Reports**:
- Reason categories: Spam, Scam, Inappropriate, Wrong Category, Other
- Report stored in `reports` table
- Auto-flag after 3 unique reports

**Seller Appeals**:
- Can appeal rejection within 14 days
- Appeal triggers manual moderator review
- Moderator must provide detailed reasoning

### Audit Logging

All moderation actions logged in `moderation_logs`:

```sql
CREATE TABLE moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advert_id UUID REFERENCES adverts(id),
  moderator_id UUID REFERENCES profiles(id),
  action TEXT, -- 'approve', 'reject', 'flag', 'unflag'
  reason TEXT,
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## SEO Principles

### URL Structure

**Categories**:
```
/{locale}/c/{category_path}
/en/c/transport/legkovye-avtomobili
/nl/c/transport/legkovye-avtomobili
```

**Listings**:
```
/{locale}/ad/{id}/{slug}
/en/ad/123e4567-e89b-12d3-a456-426614174000/bmw-3-series-2018
```

**Canonical**: Always point to default locale (EN) as canonical
```html
<link rel="canonical" href="https://lyvox.be/en/ad/123.../bmw-3-series-2018" />
```

### Title Templates

**Listing Page** (max 60 chars):
```
{Brand} {Model} {Year} - {Price} | LyVoX
BMW 3 Series 2018 - €15,900 | LyVoX

{Type} in {City} - {Key Feature} | LyVoX
Apartment in Brussels - 2BR, 85m² | LyVoX
```

**Category Page**:
```
{Category Name} in Belgium | LyVoX Marketplace
Used Cars in Belgium | LyVoX Marketplace
```

### Description Templates

**Listing Meta Description** (max 160 chars):
```
{Title}. {Condition}. {Location}. {Key specs}. Contact seller on LyVoX Belgium.
BMW 3 Series 2018. Excellent condition. Brussels. 120,000 km, Diesel, Manual. Contact seller on LyVoX Belgium.
```

**Category Meta Description**:
```
Browse {count} {category} listings in Belgium. Buy, sell, and discover great deals on LyVoX marketplace. All 5 languages supported.
```

### Open Graph Tags

```html
<meta property="og:title" content="{Listing Title}" />
<meta property="og:description" content="{First 200 chars of description}" />
<meta property="og:image" content="{First image URL}" />
<meta property="og:type" content="product" />
<meta property="og:url" content="{Canonical URL}" />
<meta property="og:site_name" content="LyVoX" />
<meta property="og:locale" content="en_BE" />
<meta property="og:locale:alternate" content="nl_BE" />
<meta property="og:locale:alternate" content="fr_BE" />
```

### hreflang Tags

```html
<link rel="alternate" hreflang="en" href="https://lyvox.be/en/ad/..." />
<link rel="alternate" hreflang="nl" href="https://lyvox.be/nl/ad/..." />
<link rel="alternate" hreflang="fr" href="https://lyvox.be/fr/ad/..." />
<link rel="alternate" hreflang="ru" href="https://lyvox.be/ru/ad/..." />
<link rel="alternate" hreflang="de" href="https://lyvox.be/de/ad/..." />
<link rel="alternate" hreflang="x-default" href="https://lyvox.be/en/ad/..." />
```

### Schema.org Structured Data

**Product** (for listings):
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "BMW 3 Series 2018",
  "description": "...",
  "image": ["url1", "url2"],
  "offers": {
    "@type": "Offer",
    "price": "15900",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Person",
      "name": "Seller Name"
    }
  },
  "category": "Vehicles > Cars"
}
```

**JobPosting** (for job listings):
```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Software Developer",
  "description": "...",
  "datePosted": "2025-01-15",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "Company Name"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Brussels",
      "addressCountry": "BE"
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "EUR",
    "value": {
      "@type": "QuantitativeValue",
      "value": 3500,
      "unitText": "MONTH"
    }
  }
}
```

**BreadcrumbList**:
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://lyvox.be"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Transport",
      "item": "https://lyvox.be/c/transport"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Cars",
      "item": "https://lyvox.be/c/transport/legkovye-avtomobili"
    }
  ]
}
```

### Slug Generation

**Rules**:
- Lowercase only
- Replace spaces with hyphens
- Remove special characters (keep only a-z, 0-9, hyphen)
- Transliterate non-ASCII (ë → e, ñ → n)
- Max 100 characters
- Remove leading/trailing hyphens
- Collapse multiple hyphens into one

**Example**:
```
"BMW 3-Series 2018 — Excellent!" 
→ "bmw-3-series-2018-excellent"
```

### Sitemap

- **Static pages**: Always included
- **Category pages**: All active categories
- **Listings**: Only `active` with `approved` moderation status
- **Update frequency**: Weekly for listings, monthly for categories
- **Priority**: 
  - Homepage: 1.0
  - Category pages: 0.8
  - Listings: 0.6
  - Static pages: 0.5

---

## AI Enrichment Strategy

> **Status**: Design phase. Implementation pending OpenAI API key.

### Core AI Functions

#### 1. Title Enhancement

**Input**: Category, raw title, key specs
**Output**: Optimized SEO-friendly title

**Prompt Template** (Vehicles):
```
You are an expert at writing classified ad titles for Belgian marketplace.

Category: Used Cars
Raw title: "BMW good condition"
Specs: Make=BMW, Model=3 Series, Year=2018, Mileage=120000, Fuel=Diesel

Generate a concise, informative title (max 80 chars) that includes:
- Brand and model
- Year
- Key selling points (mileage, fuel type)
- Appeal to buyers

Output format: Just the title, no quotes or explanation.
```

**Expected Output**: `BMW 3 Series 2018 - 120K km, Diesel, Excellent Condition`

#### 2. Description Expansion

**Input**: Category, title, brief description, specs
**Output**: Rich 200-500 word description

**Prompt Template** (Real Estate):
```
You are writing a property listing description for a Belgian real estate marketplace.
Languages: NL, FR, EN, RU, DE (user selected: {locale})

Property: Apartment in Brussels
Specs: 2BR, 85m², Floor 4, EPC B, €1,200/month

Brief description: "Nice apartment in Brussels center"

Expand into a compelling 200-300 word description that:
- Highlights key features
- Mentions location benefits
- Describes condition
- Includes practical details (transport, amenities)
- Is honest and factual (no exaggeration)

Write in {locale}. Use Belgian terminology.
```

#### 3. Tag/Keyword Extraction

**Input**: Title, description, category
**Output**: Array of relevant keywords (max 15)

**Purpose**: Improve search relevance, auto-suggest tags

**Example Output**: 
```json
["bmw", "3-series", "diesel", "manual", "brussels", "used-car", "sedan", "2018", "low-mileage", "service-history"]
```

#### 4. Image Quality Check

**Input**: Image URL
**Output**: Quality score (0-100), issues detected

**Checks**:
- Blurriness score
- Brightness/exposure
- Subject detection (is product visible?)
- Inappropriate content detection
- Resolution adequacy

**Action**:
- Score < 50: Warn user, suggest retake
- Inappropriate content detected: Auto-flag for moderation

#### 5. Duplicate Detection

**Input**: New listing (title, description, price, location)
**Output**: Similar listings (with confidence score)

**Algorithm**:
- Embedding-based similarity (OpenAI embeddings)
- Filter by category
- Threshold: 85% similarity = likely duplicate

**Action**:
- Warn user: "Similar listing exists"
- Moderator review if posted anyway

#### 6. Field Normalization

**Input**: User-entered text field (e.g., "Color: dark blue metallic")
**Output**: Standardized value from dictionary (e.g., `color: "blue_metallic"`)

**Use Cases**:
- Color names → standard color codes
- Brand variations ("BMW", "B.M.W.", "Bmw") → "BMW"
- Sizes ("L", "Large", "42 EU") → standardized format

### AI Integration Points

| Stage | Function | Trigger | User Experience |
|-------|----------|---------|-----------------|
| **Draft Creation** | Title suggestion | User types title | Real-time suggestion below input |
| **Description** | Auto-expand | User writes < 50 words | "Enhance" button appears |
| **Image Upload** | Quality check | Image uploaded | Warning if low quality |
| **Pre-Submit** | Tag generation | User clicks "Preview" | Auto-populate tags field |
| **Submit** | Duplicate detection | User clicks "Publish" | Warning modal if duplicates found |
| **Moderation** | Content analysis | Enters moderation queue | Auto-score, flag suspicious content |
| **Search** | Query enhancement | User searches | Better results via embeddings |

### AI Moderation Rules (Category-Specific)

#### Vehicles
- **Salvage Detection**: Keywords like "salvage", "rebuilt title", "water damage"
- **Stolen Indicators**: "no papers", "lost title", suspicious VIN
- **Price Red Flags**: Market value deviation >50%

#### Real Estate
- **Illegal Sublet**: Keywords "short-term only", "no registration"
- **EPC Fraud**: Claims A++ rating but photos show old windows, no insulation
- **Discrimination**: "no children", "only EU citizens", "Christians only"

#### Electronics
- **IMEI Blacklist**: Cross-check IMEI against stolen device databases
- **Counterfeit Risk**: "AAA replica", "1:1 copy", brand mismatch
- **Activation Lock**: "iCloud locked", "Google locked"

#### Jobs
- **Scam Indicators**: "No experience required", "Earn €5,000/week from home"
- **Salary Outliers**: Claims 3σ above market rate for role
- **Illegal Work**: "No contract", "cash only", "under the table"

#### Pets
- **Illegal Species**: Cross-check breed against Belgium prohibited list
- **Puppy Mills**: Multiple litters, no vaccination records, suspiciously low prices
- **Health Issues**: Undisclosed health problems in description/photos

### AI Ethics & Privacy

- **Transparency**: Users informed when AI is used
- **Opt-out**: Users can disable suggestions (but not moderation checks)
- **Data Privacy**: No personal data sent to OpenAI (only listing content)
- **Human Oversight**: AI assists, doesn't replace human moderators
- **Bias Monitoring**: Regular audits for discriminatory patterns

---

## Search Architecture

### Full-Text Search

**PostgreSQL Function**: `search_adverts()`

**Indexed Fields**:
- `title` (weight: A)
- `description` (weight: B)
- `category.name_*` (weight: C)

**Configuration**:
```sql
CREATE INDEX adverts_search_idx ON adverts 
USING gin(to_tsvector('simple', title || ' ' || COALESCE(description, '')));
```

**Languages**: Multi-language support via `simple` dictionary (no stemming) to support all 5 languages equally.

### Common Filters (All Categories)

| Filter | Type | Input | Query |
|--------|------|-------|-------|
| **Category** | Select | category_id | WHERE category_id = ? OR category_id IN (descendants) |
| **Price Range** | Slider | min, max | WHERE price BETWEEN ? AND ? |
| **Location** | Autocomplete | city, postcode | WHERE location ~* ? OR location_id IN (...) |
| **Radius** | Slider | km | WHERE ST_DWithin(location_geo, point, radius) |
| **Condition** | Checkbox | new, used, parts | WHERE condition = ANY(?) |
| **Date Posted** | Select | 1d, 7d, 30d, all | WHERE created_at > NOW() - INTERVAL '?' |
| **Seller Type** | Radio | private, business | WHERE specifics->>'seller_type' = ? |
| **With Photos** | Checkbox | boolean | WHERE EXISTS (SELECT 1 FROM media WHERE advert_id = adverts.id) |

### Category-Specific Filters

#### Vehicles
- Make (autocomplete)
- Model (dependent on make)
- Year Range (slider)
- Mileage Range (slider)
- Fuel Type (multi-select)
- Transmission (multi-select)
- Body Type (multi-select)
- Drive Type (2WD, 4WD, AWD)

#### Real Estate
- Property Type (apartment, house, land)
- Rooms (min-max)
- Bedrooms (min-max)
- Bathrooms (min-max)
- Area Range (m², slider)
- EPC Rating (A++ to G)
- Floor (min-max)
- Features (elevator, terrace, garden, parking - checkboxes)

#### Electronics
- Brand (autocomplete)
- Device Type (phone, tablet, laptop, etc.)
- Condition (new, like new, good, fair, for parts)
- Memory/RAM (multi-select)
- Storage (multi-select)
- Battery Health (>90%, 80-90%, <80%)

#### Fashion
- Gender (men, women, unisex, kids)
- Size (EU, UK, US - dependent on gender/type)
- Brand (autocomplete)
- Material (cotton, polyester, leather, etc.)
- Color (multi-select)
- Season (summer, winter, all-season)

#### Jobs
- Contract Type (CDI, CDD, Intérim, Freelance)
- Employment Type (Full-time, Part-time, Remote)
- Salary Range (slider, specify gross/net)
- CP Code (if known)
- Language Requirements (NL, FR, EN - checkboxes)
- Work Permit Sponsored (checkbox)

### Sorting Options

**Default**: Relevance (if search query) or Date (newest first)

**Options**:
- Relevance (search query present)
- Date: Newest First
- Date: Oldest First
- Price: Lowest First
- Price: Highest First
- Distance: Nearest First (if location provided)

### Pagination & Performance

- **Results per page**: 24 (desktop), 12 (mobile)
- **Max results**: 10,000 (pagination stops here)
- **Load time target**: <300ms for search
- **Caching**: Category counts cached (refresh hourly)

### Faceted Search

**Aggregations returned with search results**:
```json
{
  "results": [...],
  "facets": {
    "condition": {
      "new": 45,
      "used": 230,
      "for_parts": 12
    },
    "price_ranges": {
      "0-1000": 89,
      "1000-5000": 120,
      "5000-10000": 45,
      "10000+": 33
    },
    "seller_type": {
      "private": 245,
      "business": 42
    }
  },
  "total_count": 287
}
```

**Purpose**: Show users available options and counts without extra queries

---

## Data Validation Rules

### Field Validation

#### Title
- **Min**: 3 characters
- **Max**: 200 characters
- **Regex**: Allow letters, numbers, spaces, basic punctuation (.,!?'-/)
- **Forbidden**: URLs, email addresses, phone numbers (use contact fields instead)
- **Language Check**: Must contain at least 50% chars from selected locale's alphabet

#### Description
- **Min**: 10 characters (for active listings)
- **Max**: 10,000 characters
- **Formatting**: Plain text + basic markdown (bold, italic, lists, line breaks)
- **Forbidden**: 
  - HTML tags (auto-stripped)
  - JavaScript (auto-stripped)
  - External links (except whitelisted domains)
  - Contact info in first 200 chars (encourage using contact form)

#### Price
- **Min**: 0 (free listings allowed)
- **Max**: 999,999,999
- **Decimals**: 2 places max
- **Special**: NULL allowed (e.g., "Price on request" for real estate)
- **Validation**: Flag if price is outlier (>3σ from category mean)

#### Location
- **Postcode**: Must match Belgium postcode format (4 digits)
- **City**: Autocomplete from Belgium cities list
- **Geo Point**: Optional, auto-resolved from postcode if not provided
- **Privacy**: Full address hidden, only city + postcode shown

#### Images
- **Min**: 1 image for active listings
- **Max**: 20 images per listing
- **Format**: JPEG, PNG, WebP (GIF for animations, SVG forbidden)
- **Size**: Max 10MB per image
- **Dimensions**: Min 400x300px, Recommended 1200x800px
- **Validation**: 
  - Check EXIF for GPS data → strip for privacy
  - Detect inappropriate content (AI or user reports)
  - Compress if >2MB (auto-optimize)

### Category-Specific Validation

#### Vehicles
- **Year**: 1950 - (current year + 1)
- **Mileage**: 0 - 999,999 km
- **VIN**: 17 characters (optional, validated against checksum)
- **Engine Volume**: 0.1 - 10.0 L
- **Power**: 1 - 1500 HP

**Custom Validation**:
```sql
CREATE OR REPLACE FUNCTION validate_vehicle_listing(
  year INT,
  mileage INT,
  price NUMERIC
) RETURNS BOOLEAN AS $$
BEGIN
  -- Year vs mileage sanity check
  IF year >= EXTRACT(YEAR FROM NOW()) - 2 AND mileage > 100000 THEN
    RETURN FALSE; -- New car with high mileage suspicious
  END IF;
  
  -- Price range check (rough estimates)
  IF year < 2000 AND price > 30000 THEN
    RETURN FALSE; -- Old car overpriced
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

#### Real Estate
- **Area**: 10 - 10,000 m² (residential)
- **Rooms**: 0 - 20
- **Bedrooms**: 0 - 15
- **Bathrooms**: 0 - 10 (decimal: 1.5 = 1 full + 1 half)
- **Floor**: -3 - 150
- **EPC Rating**: Must be one of: A++, A+, A, B, C, D, E, F, G
- **EPC Number**: Format validation: `YYYYMMDD-NNNNNNN-NN`
- **Year Built**: 1800 - (current year)

**Custom Validation**:
```sql
CREATE OR REPLACE FUNCTION validate_property_listing(
  area_sqm NUMERIC,
  rooms INT,
  bedrooms INT,
  price NUMERIC,
  listing_type TEXT -- 'sale' or 'rent'
) RETURNS BOOLEAN AS $$
BEGIN
  -- Rooms vs bedrooms sanity
  IF bedrooms > rooms THEN
    RETURN FALSE;
  END IF;
  
  -- Area vs rooms rough check
  IF area_sqm < (rooms * 8) THEN
    RETURN FALSE; -- Too small for claimed rooms
  END IF;
  
  -- Price sanity for rentals (per m²)
  IF listing_type = 'rent' AND (price / area_sqm) > 30 THEN
    RAISE WARNING 'Rental price per m² unusually high';
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

#### Electronics
- **Year**: 2000 - (current year + 1)
- **Battery Health**: 0 - 100%
- **Storage**: Enum from list (16GB, 32GB, 64GB, 128GB, 256GB, 512GB, 1TB, 2TB, 4TB)
- **Memory RAM**: Enum from list (1GB, 2GB, 3GB, 4GB, 6GB, 8GB, 12GB, 16GB, 32GB, 64GB)
- **IMEI**: 15-17 digits (if phone/tablet)

**IMEI Validation** (Luhn algorithm):
```sql
CREATE OR REPLACE FUNCTION validate_imei(imei TEXT) RETURNS BOOLEAN AS $$
DECLARE
  digit INT;
  sum INT := 0;
  i INT;
  doubled INT;
BEGIN
  -- Remove spaces/dashes
  imei := REGEXP_REPLACE(imei, '[^0-9]', '', 'g');
  
  -- Must be 15 digits
  IF LENGTH(imei) != 15 THEN
    RETURN FALSE;
  END IF;
  
  -- Luhn check
  FOR i IN 1..14 LOOP
    digit := SUBSTRING(imei, i, 1)::INT;
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
  
  RETURN (sum * 9) % 10 = SUBSTRING(imei, 15, 1)::INT;
END;
$$ LANGUAGE plpgsql;
```

#### Jobs
- **Salary**: 0 - 1,000,000 EUR
- **CP Code**: Format `CP XXX` or `CP XXX.XX`
- **Contract Type**: Must be in Belgium-valid list
- **Work Hours**: 0 - 80 hours/week

**Belgium Postcode Validation**:
```sql
CREATE OR REPLACE FUNCTION validate_belgian_postcode(postcode TEXT) RETURNS BOOLEAN AS $$
BEGIN
  -- Must be exactly 4 digits
  RETURN postcode ~ '^[1-9][0-9]{3}$';
END;
$$ LANGUAGE plpgsql;
```

---

## Pricing & Currency

### Supported Currencies

| Code | Symbol | Primary |
|------|--------|---------|
| EUR | € | ✅ Default |
| USD | $ | Supported |
| GBP | £ | Supported |
| RUB | ₽ | Supported |

### Display Formats

**Belgium/EU Format** (space as thousands separator, comma as decimal):
- `€1 234,56`
- `€15 900,00`

**Formatting Function**:
```typescript
function formatPrice(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-BE' : locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Examples:
formatPrice(15900, 'EUR', 'nl'); // "€ 15.900"
formatPrice(15900, 'EUR', 'fr'); // "15 900 €"
formatPrice(15900, 'EUR', 'en'); // "€15,900"
```

### Price Ranges by Category

**Guides for validation/flagging**:

| Category | Typical Range | Flag Above |
|----------|---------------|------------|
| Vehicles (Used) | €1,000 - €50,000 | €100,000 |
| Real Estate (Sale) | €100,000 - €500,000 | €2,000,000 |
| Real Estate (Rent/month) | €500 - €2,000 | €5,000 |
| Electronics (Phones) | €100 - €1,200 | €2,000 |
| Fashion (Item) | €5 - €200 | €500 |
| Baby Equipment | €20 - €500 | €1,000 |
| Jobs (Monthly Gross) | €1,800 - €5,000 | €10,000 |

### Pricing Options

- **Fixed Price**: Standard, show price
- **Negotiable**: Show price + "Negotiable" badge
- **Contact for Price**: NULL price, show "Price on request"
- **Free**: Price = 0, show "Free" badge
- **Exchange**: Special category, no price field

### Price History (Future Feature)

Track price changes for analytics and buyer trust:
```sql
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advert_id UUID REFERENCES adverts(id),
  old_price NUMERIC,
  new_price NUMERIC,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Delivery & Fulfillment

### Delivery Options

Stored in `ad_item_specifics.specifics->delivery_options`:

```json
{
  "delivery_options": ["pickup", "shipping", "delivery"],
  "shipping_cost": 15.00,
  "shipping_zones": ["BE", "EU"],
  "delivery_radius_km": 50,
  "delivery_cost_per_km": 0.50
}
```

**Options**:

| Option | Description | Applies To |
|--------|-------------|------------|
| `pickup` | Buyer collects in person | All categories |
| `shipping` | Seller ships via courier | Small items (electronics, fashion, etc.) |
| `delivery` | Seller delivers | Large items (furniture, appliances) |
| `digital` | Digital delivery (e-tickets, software) | Digital goods |

### Shipping Costs

**Belgium**:
- Small package (<2kg): €5-10
- Medium package (2-30kg): €10-20
- Large package (>30kg): €20-50
- Furniture: Quote required

**EU**: Add 50-100% to Belgium rates

**International**: Not supported (Belgium + EU only)

### Pickup Locations

- **Private Sellers**: Meet at public location (safety)
  - Suggest: Train stations, shopping centers, police stations
  - Never show exact home address until buyer commits
- **Business Sellers**: Show business address

### Safety Guidelines

**For Buyers**:
- Meet in public, well-lit areas
- Bring a friend
- Inspect item before payment
- Prefer cash or instant bank transfer (Payconiq, Bancontact)
- Avoid wire transfers to unknown sellers

**For Sellers**:
- Meet in public areas
- Don't invite strangers to home
- Verify buyer identity for high-value items
- Don't ship before payment received

---

## Reference Dictionaries

Location: `packages/dicts/`

### Common Dictionaries

#### `conditions.ts`
```typescript
export const CONDITION_VALUES = {
  new: { nl: 'Nieuw', fr: 'Neuf', en: 'New', ru: 'Новый', de: 'Neu' },
  like_new: { nl: 'Als nieuw', fr: 'Comme neuf', en: 'Like New', ru: 'Как новый', de: 'Wie neu' },
  excellent: { nl: 'Uitstekend', fr: 'Excellent', en: 'Excellent', ru: 'Отличное', de: 'Ausgezeichnet' },
  good: { nl: 'Goed', fr: 'Bon', en: 'Good', ru: 'Хорошее', de: 'Gut' },
  fair: { nl: 'Redelijk', fr: 'Passable', en: 'Fair', ru: 'Удовлетворительное', de: 'Akzeptabel' },
  for_parts: { nl: 'Voor onderdelen', fr: 'Pour pièces', en: 'For Parts', ru: 'На запчасти', de: 'Für Ersatzteile' }
};
```

#### `colors.ts`
```typescript
export const COLOR_VALUES = {
  black: { nl: 'Zwart', fr: 'Noir', en: 'Black', ru: 'Черный', de: 'Schwarz', hex: '#000000' },
  white: { nl: 'Wit', fr: 'Blanc', en: 'White', ru: 'Белый', de: 'Weiß', hex: '#FFFFFF' },
  silver: { nl: 'Zilver', fr: 'Argent', en: 'Silver', ru: 'Серебристый', de: 'Silber', hex: '#C0C0C0' },
  gray: { nl: 'Grijs', fr: 'Gris', en: 'Gray', ru: 'Серый', de: 'Grau', hex: '#808080' },
  red: { nl: 'Rood', fr: 'Rouge', en: 'Red', ru: 'Красный', de: 'Rot', hex: '#FF0000' },
  blue: { nl: 'Blauw', fr: 'Bleu', en: 'Blue', ru: 'Синий', de: 'Blau', hex: '#0000FF' },
  // ... more colors
};
```

#### `materials.ts`
```typescript
export const MATERIAL_VALUES = {
  cotton: { nl: 'Katoen', fr: 'Coton', en: 'Cotton', ru: 'Хлопок', de: 'Baumwolle' },
  polyester: { nl: 'Polyester', fr: 'Polyester', en: 'Polyester', ru: 'Полиэстер', de: 'Polyester' },
  leather: { nl: 'Leer', fr: 'Cuir', en: 'Leather', ru: 'Кожа', de: 'Leder' },
  // ... more materials
};
```

#### `sizes.ts`
```typescript
export const CLOTHING_SIZES_EU = {
  women: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '34', '36', '38', '40', '42', '44', '46'],
  men: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '44', '46', '48', '50', '52', '54', '56'],
  kids: ['80', '86', '92', '98', '104', '110', '116', '122', '128', '134', '140', '146', '152', '158', '164']
};

export const SHOE_SIZES_EU = {
  women: ['35', '36', '37', '38', '39', '40', '41', '42'],
  men: ['39', '40', '41', '42', '43', '44', '45', '46', '47', '48']
};
```

### Belgium-Specific Dictionaries

#### `belgium/cities.ts`
```typescript
export const BELGIUM_CITIES = [
  { postcode: '1000', name_nl: 'Brussel', name_fr: 'Bruxelles', name_en: 'Brussels', region: 'brussels' },
  { postcode: '2000', name_nl: 'Antwerpen', name_fr: 'Anvers', name_en: 'Antwerp', region: 'flanders' },
  { postcode: '9000', name_nl: 'Gent', name_fr: 'Gand', name_en: 'Ghent', region: 'flanders' },
  // ... ~600 entries
];
```

#### `belgium/epc.ts`
```typescript
export const EPC_RATINGS = [
  { code: 'A++', label: 'A++', color: '#00A651', max_kwh: 0 },
  { code: 'A+', label: 'A+', color: '#4CB748', max_kwh: 45 },
  { code: 'A', label: 'A', color: '#8CC63F', max_kwh: 95 },
  { code: 'B', label: 'B', color: '#FFF200', max_kwh: 150 },
  { code: 'C', label: 'C', color: '#F9B233', max_kwh: 210 },
  { code: 'D', label: 'D', color: '#F58220', max_kwh: 270 },
  { code: 'E', label: 'E', color: '#ED6B22', max_kwh: 345 },
  { code: 'F', label: 'F', color: '#E31E24', max_kwh: 510 },
  { code: 'G', label: 'G', color: '#A4191E', max_kwh: null }, // No upper limit
];
```

#### `belgium/cp_codes.ts`
```typescript
export const CP_CODES = [
  { code: 'CP 100', name_nl: 'Hulp aan personen', name_fr: 'Aide aux personnes', name_en: 'Personal assistance' },
  { code: 'CP 200', name_nl: 'Aanvullende diensten', name_fr: 'Services auxiliaires', name_en: 'Auxiliary services' },
  { code: 'CP 202', name_nl: 'Metaal', name_fr: 'Métal', name_en: 'Metal' },
  { code: 'CP 218', name_nl: 'Horeca', name_fr: 'Horeca', name_en: 'Hospitality' },
  // ... ~100 codes
];
```

#### `belgium/postcodes.ts`
```typescript
export const POSTCODE_RANGES = {
  brussels: { min: 1000, max: 1299 },
  flanders: [
    { min: 1500, max: 1999 }, // Flemish Brabant
    { min: 2000, max: 2999 }, // Antwerp
    { min: 3000, max: 3999 }, // Flemish Brabant & Limburg
    { min: 8000, max: 8999 }, // West Flanders
    { min: 9000, max: 9999 }, // East Flanders
  ],
  wallonia: [
    { min: 1300, max: 1499 }, // Walloon Brabant
    { min: 4000, max: 4999 }, // Liège
    { min: 5000, max: 5999 }, // Namur
    { min: 6000, max: 6999 }, // Hainaut & Luxembourg
    { min: 7000, max: 7999 }, // Hainaut
  ],
};

export function validateBelgianPostcode(postcode: string): boolean {
  const num = parseInt(postcode, 10);
  return num >= 1000 && num <= 9999;
}

export function getRegionFromPostcode(postcode: string): 'brussels' | 'flanders' | 'wallonia' | null {
  const num = parseInt(postcode, 10);
  if (num >= 1000 && num <= 1299) return 'brussels';
  // ... logic for other regions
  return null;
}
```

### Safety & Standards

#### `safety_standards.ts`
```typescript
export const EU_SAFETY_STANDARDS = {
  toys: {
    CE: { name: 'CE Marking', description: 'EU conformity mark', required: true },
    EN71: { name: 'EN 71', description: 'Toy safety standard', parts: ['1', '2', '3'] },
  },
  car_seats: {
    ECE_R44_04: { name: 'ECE R44/04', description: 'Car seat standard (old)', valid_until: '2025-09-01' },
    ECE_R129: { name: 'ECE R129 (i-Size)', description: 'Car seat standard (current)', required_from: '2013-07-01' },
  },
  strollers: {
    EN1888: { name: 'EN 1888', description: 'Stroller safety standard' },
  },
  // ... more
};
```

---

## Implementation Patterns

### Database Pattern Decision Tree

```
How many structured fields does this category have?

├─ 0-5 fields
│  └─ Use: Pure JSONB in ad_item_specifics
│     Example: Free/Giveaway, Lost & Found
│
├─ 6-10 fields
│  └─ Use: JSONB + Dictionary Tables
│     Example: Fashion, Pets, Sports
│
├─ 11-20 fields
│  └─ Use: JSONB + Multiple Dictionary Tables
│     Example: Electronics, Home & Garden
│
└─ 20+ fields OR complex relationships (many-to-many)
   └─ Use: Specialized Tables (like Vehicles pattern)
      Example: Vehicles, Real Estate, Jobs
```

### Migration Naming Convention

```
YYYYMMDD_<category>_<what>.sql

Examples:
20251106_real_estate_catalog.sql
20251106_electronics_dictionaries.sql
20251107_jobs_catalog.sql
20251107_catalog_validation_functions.sql
```

### RLS Template

Copy this for every specialized table:

```sql
-- Enable RLS
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- Policy: Public read-only (for dropdowns, autocomplete, etc.)
CREATE POLICY "<table_name>_public_read"
ON <table_name> FOR SELECT
USING (true);

-- Policy: Only service_role can write (via admin scripts)
-- (service_role bypasses RLS, so this is more for documentation)
CREATE POLICY "<table_name>_admin_write"
ON <table_name> FOR ALL
USING (is_admin(auth.uid()));
```

### API Endpoint Template

```typescript
// apps/web/src/app/api/catalog/<category>/<endpoint>/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { z } from 'zod';

// Validation schema
const querySchema = z.object({
  locale: z.enum(['nl', 'fr', 'en', 'ru', 'de']).default('en'),
  // ... other params
});

export async function GET(request: NextRequest) {
  try {
    // Parse and validate query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { locale, ...filters } = querySchema.parse(searchParams);

    // Get Supabase client
    const supabase = await supabaseServer();

    // Query database
    const { data, error } = await supabase
      .from('<table_name>')
      .select('*')
      // ... apply filters

    if (error) throw error;

    // Return localized data
    return NextResponse.json({
      ok: true,
      data: data.map(item => ({
        ...item,
        name: item[`name_${locale}`] || item.name_en || item.name_ru,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });

  } catch (error: any) {
    console.error('[API Error]:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        ok: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: error.message,
    }, { status: 500 });
  }
}

// Set runtime for edge if no database queries needed
// export const runtime = 'edge';
```

### Component Pattern (Category Fields)

```typescript
// apps/web/src/components/catalog/<Category>Fields.tsx

import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type CategoryFieldsProps = {
  formData: Record<string, any>;
  onChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
};

export function CategoryFields({ formData, onChange, errors }: CategoryFieldsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="field1">{t('catalog.category.field1')}</Label>
        <Input
          id="field1"
          value={formData.field1 || ''}
          onChange={(e) => onChange('field1', e.target.value)}
        />
        {errors?.field1 && <p className="text-red-500 text-sm">{errors.field1}</p>}
      </div>

      {/* More fields... */}
    </div>
  );
}
```

### Validation Pattern (Zod Schema)

```typescript
// apps/web/src/lib/validations/catalog/<category>.ts

import { z } from 'zod';

export const categorySpecificsSchema = z.object({
  field1: z.string().min(1, 'Field 1 is required'),
  field2: z.number().min(0).max(100).optional(),
  field3: z.enum(['option1', 'option2', 'option3']),
  // ... more fields
}).refine((data) => {
  // Custom validation logic
  if (data.field1 === 'special' && !data.field2) {
    return false;
  }
  return true;
}, {
  message: 'Field 2 is required when Field 1 is "special"',
  path: ['field2'],
});

export type CategorySpecifics = z.infer<typeof categorySpecificsSchema>;
```

---

## Document Maintenance

**Owners**: Product Team, Tech Lead  
**Review Cycle**: Quarterly or after major features  
**Changelog**: Track in Git history

### Related Documents

- [DATABASE_STRATEGY.md](./DATABASE_STRATEGY.md) - Hybrid approach details
- [Category Specifications](./categories/) - Individual category docs
- [docs/development/categories.md](../development/categories.md) - Original MVP design
- [docs/domains/adverts.md](../domains/adverts.md) - Adverts domain logic

### Contributing

When adding new categories:

1. Review this CATALOG_MASTER.md
2. Create category spec doc following template
3. Design database schema (specialized vs JSONB)
4. Create migration + RLS policies
5. Implement API endpoints
6. Build UI components
7. Add validation rules
8. Update i18n strings
9. Write tests
10. Update MASTER_CHECKLIST.md

---

**End of CATALOG_MASTER.md**

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](../development/MASTER_CHECKLIST.md) • [deep-audit-20251108.md](../development/deep-audit-20251108.md)
**Catalog:** [FINAL_COMPLETION_REPORT.md](./FINAL_COMPLETION_REPORT.md) • [CATALOG_IMPLEMENTATION_STATUS.md](./CATALOG_IMPLEMENTATION_STATUS.md) • [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
