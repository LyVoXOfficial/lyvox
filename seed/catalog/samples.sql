-- Seed Data: Sample Catalog Adverts
-- Purpose: Realistic sample adverts for testing and demo purposes
-- Note: These are example adverts. Replace user_id with actual test users.

-- Prerequisites: 
-- 1. Run all catalog migrations first
-- 2. Run dictionary seeds (brands, property types, etc.)
-- 3. Create test users and get their UUIDs
-- 4. Update category_id references to match your categories table

-- ============================================================================
-- REAL ESTATE SAMPLES
-- ============================================================================

-- Sample 1: Apartment for Rent in Brussels
INSERT INTO public.adverts (
  user_id,
  category_id,
  title,
  description,
  price,
  currency,
  location,
  status,
  moderation_status
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid, -- Replace with test user ID
  (SELECT id FROM public.categories WHERE slug = 'real-estate-rent' LIMIT 1),
  'Modern 2BR Apartment • 85m² • Brussels Central',
  'Prachtig gerenoveerd appartement in het hart van Brussel. Direct naast metrostation Rogier.

🏠 KENMERKEN:
- Volledig gerenoveerd in 2023
- Ruime woonkamer met veel lichtinval
- Open moderne keuken (IKEA)
- 2 grote slaapkamers
- Recent badkamer met douche
- Wasmachine/droger inbegrepen

📍 LOCATIE:
- 2 min lopen naar metro Rogier
- Supermarkten, restaurants, winkels op loopafstand
- 15 min naar Brussels Airport met trein

💶 HUUR:
- €1,250/maand + €150 kosten
- Waarborg: 2 maanden
- Beschikbaar vanaf: 1 december 2025

✅ EPC: B (130 kWh/m²/jaar)
✅ Huisdieren: Welkom (kleine honden/katten)
✅ Gemeubileerd optie beschikbaar (+€200/maand)

Interesse? Contacteer me voor bezichtiging!',
  1250,
  'EUR',
  'Brussels, 1000',
  'active',
  'approved'
);

-- Link to property_listings table
INSERT INTO public.property_listings (
  advert_id,
  property_type_id,
  listing_type,
  area_sqm,
  rooms,
  bedrooms,
  bathrooms,
  year_built,
  renovation_year,
  floor,
  total_floors,
  epc_rating,
  epc_kwh_per_sqm_year,
  heating_type,
  double_glazing,
  rent_monthly,
  rent_charges_monthly,
  deposit_months,
  available_from,
  furnished,
  postcode,
  municipality,
  parking_spaces,
  elevator,
  pet_friendly
) VALUES (
  (SELECT id FROM public.adverts WHERE title LIKE 'Modern 2BR Apartment%' LIMIT 1),
  (SELECT id FROM public.property_types WHERE slug = 'apartment' LIMIT 1),
  'rent',
  85,
  3,
  2,
  1,
  1985,
  2023,
  4,
  6,
  'B',
  130,
  ARRAY['gas', 'district'],
  true,
  1250,
  150,
  2,
  '2025-12-01',
  'unfurnished',
  '1000',
  'Brussels',
  0,
  true,
  true
);

-- Sample 2: House for Sale in Ghent
INSERT INTO public.adverts (
  user_id,
  category_id,
  title,
  description,
  price,
  currency,
  location,
  status,
  moderation_status
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM public.categories WHERE slug = 'real-estate-sale' LIMIT 1),
  'Charming Townhouse • 4BR • 180m² • Ghent',
  'Te koop: Karaktervolle rijwoning met tuin in rustige buurt van Gent.

🏡 WONING:
- Grondoppervlakte: 180m²
- Perceeloppervlakte: 250m² (incl. tuin)
- 4 slaapkamers + bureau
- 2 badkamers (1 en-suite)
- Ruime living met originele elementen
- Moderne keuken met toestellen
- Zonnige zuidgerichte tuin (70m²)
- Garage + carport

🔧 TECHNISCH:
- EPC: C (180 kWh/m²/jaar)
- Dakisolatie vernieuwd 2020
- Cv-ketel (2019)
- Dubbele beglazing volledig
- Zonnepanelen (12 stuks)

📍 Gent-Zuid, rustige straat
🚲 5 min fietsen naar centrum
🚗 Snelle verbinding E40/E17

💰 Vraagprijs: €485,000 (onderhandelbaar)
📅 Onmiddellijk vrij

Perfect voor gezin! Bezichtiging op afspraak.',
  485000,
  'EUR',
  'Ghent, 9000',
  'active',
  'approved'
);

INSERT INTO public.property_listings (
  advert_id,
  property_type_id,
  listing_type,
  area_sqm,
  land_area_sqm,
  rooms,
  bedrooms,
  bathrooms,
  year_built,
  renovation_year,
  epc_rating,
  epc_kwh_per_sqm_year,
  heating_type,
  double_glazing,
  postcode,
  municipality,
  parking_spaces,
  parking_type,
  garden_sqm,
  garden_orientation,
  cellar
) VALUES (
  (SELECT id FROM public.adverts WHERE title LIKE 'Charming Townhouse%' LIMIT 1),
  (SELECT id FROM public.property_types WHERE slug = 'townhouse' LIMIT 1),
  'sale',
  180,
  250,
  6,
  4,
  2,
  1975,
  2020,
  'C',
  180,
  ARRAY['gas', 'solar'],
  true,
  '9000',
  'Gent',
  2,
  ARRAY['garage', 'carport'],
  70,
  'south',
  true
);

-- ============================================================================
-- ELECTRONICS SAMPLES
-- ============================================================================

-- Sample 3: iPhone for Sale
INSERT INTO public.adverts (
  user_id,
  category_id,
  title,
  description,
  price,
  currency,
  location,
  status,
  moderation_status
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  (SELECT id FROM public.categories WHERE slug = 'electronics-phones-tablets' LIMIT 1),
  'Apple iPhone 13 • 128GB • Midnight • Like New',
  '🍎 iPhone 13 in perfecte staat! Gebruikt voor 6 maanden, altijd met hoesje en screenprotector.

📱 SPECS:
- Model: iPhone 13
- Kleur: Midnight (zwart)
- Opslag: 128GB
- Batterij gezondheid: 94%
- iOS 18.1 (nieuwste versie)
- Simlock: Unlocked (alle operators)

✅ INBEGREPEN:
- Originele doos
- Originele Apple Lightning kabel
- Apple 20W lader
- Siliconen hoesje (Apple)
- Screenprotector (geplaatst)

🔒 GARANTIE:
- Apple garantie tot maart 2026
- Aankoopbewijs beschikbaar
- IMEI: vrij (check mogelijk)

💯 STAAT:
- Geen krassen op scherm
- Minimale gebruikssporen op achterkant
- Alle functies 100% werkend
- Face ID, camera, speakers perfect

📍 Afhalen in Antwerpen of verzending mogelijk (DPD, €8)
💰 Prijs: €560 (nieuwprijs was €909)
💳 Betaling: cash of Bancontact

Interesse? Stuur bericht!',
  560,
  'EUR',
  'Antwerp, 2000',
  'active',
  'approved'
);

-- Store specifics in ad_item_specifics (JSONB)
INSERT INTO public.ad_item_specifics (
  advert_id,
  specifics
) VALUES (
  (SELECT id FROM public.adverts WHERE title LIKE 'Apple iPhone 13%' LIMIT 1),
  '{
    "device_type": "phone",
    "brand": "Apple",
    "model": "iPhone 13",
    "release_year": 2021,
    "memory_gb": 6,
    "storage_gb": 128,
    "screen_size_inch": 6.1,
    "condition": "like_new",
    "battery_condition": "excellent",
    "factory_locked": false,
    "icloud_locked": false,
    "sim_lock_carrier": "unlocked",
    "original_box": true,
    "original_charger": true,
    "accessories_included": ["case", "screen_protector", "cable", "charger"],
    "purchase_receipt": true,
    "warranty_until": "2026-03-15",
    "manufacturer_warranty": true,
    "delivery_options": ["pickup_only", "shipping_national"]
  }'::jsonb
);

-- Sample 4: Laptop for Sale
INSERT INTO public.adverts (
  user_id,
  category_id,
  title,
  description,
  price,
  currency,
  location,
  status,
  moderation_status
) VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  (SELECT id FROM public.categories WHERE slug = 'electronics-computers' LIMIT 1),
  'Dell XPS 15 • i7-12700H • 32GB RAM • 1TB SSD • RTX 3050Ti',
  '💻 Krachtige Dell XPS 15 laptop in uitstekende staat!

Gekocht in januari 2023, weinig gebruikt (vooral thuiswerk).
Ideaal voor professioneel werk, foto/video editing, gaming.

🚀 SPECIFICATIES:
- Processor: Intel Core i7-12700H (14-core)
- RAM: 32GB DDR5
- Opslag: 1TB NVMe SSD
- GPU: NVIDIA RTX 3050 Ti (4GB)
- Scherm: 15.6" FHD+ (1920x1200) IPS
- OS: Windows 11 Pro (genuine licentie)
- Batterij: 86Wh (6-8u autonomie)

✨ TOETSENBORD:
- Backlit keyboard (Nederlands)
- Groot precision touchpad
- Vingerafdrukscanner

🔌 AANSLUITINGEN:
- 2x Thunderbolt 4 / USB-C
- 1x USB-A 3.2
- SD kaartlezer
- 3.5mm jack
- HDMI 2.1

📦 INBEGREPEN:
- Laptop
- 130W USB-C lader
- Originele doos + documentatie
- Dell Premium Active Pen
- Beschermhoes (neoprene)

⭐ STAAT: 9/10
- Minimale gebruikssporen onderkant
- Scherm perfect (geen pixels)
- Toetsenbord als nieuw
- Geen functionele issues

🛡️ Dell garantie tot januari 2026

💰 €1,650 (nieuwprijs was €2,499)
📍 Leuven - bezichtiging welkom
🚚 Verzending mogelijk (verzekerd)',
  1650,
  'EUR',
  'Leuven, 3000',
  'active',
  'approved'
);

INSERT INTO public.ad_item_specifics (
  advert_id,
  specifics
) VALUES (
  (SELECT id FROM public.adverts WHERE title LIKE 'Dell XPS 15%' LIMIT 1),
  '{
    "device_type": "laptop",
    "brand": "Dell",
    "model": "XPS 15 9520",
    "release_year": 2022,
    "memory_gb": 32,
    "storage_gb": 1024,
    "processor": "Intel Core i7-12700H",
    "graphics_card": "NVIDIA GeForce RTX 3050 Ti",
    "screen_size_inch": 15.6,
    "resolution": "1920x1200",
    "condition": "like_new",
    "original_box": true,
    "original_charger": true,
    "accessories_included": ["stylus", "case"],
    "purchase_receipt": true,
    "warranty_until": "2026-01-15",
    "manufacturer_warranty": true,
    "delivery_options": ["pickup_only", "shipping_national"]
  }'::jsonb
);

-- ============================================================================
-- JOBS SAMPLES
-- ============================================================================

-- Sample 5: Full-Time Developer Job
INSERT INTO public.adverts (
  user_id,
  category_id,
  title,
  description,
  price,
  currency,
  location,
  status,
  moderation_status
) VALUES (
  '00000000-0000-0000-0000-000000000003'::uuid,
  (SELECT id FROM public.categories WHERE slug = 'jobs-vacancies-full-time' LIMIT 1),
  'Senior Full-Stack Developer (React/Node.js) - TechStart Brussels',
  '🚀 Join our growing tech startup in Brussels!

TechStart is looking for a passionate Senior Full-Stack Developer to help build our next-generation SaaS platform.

💼 THE ROLE:
We need someone who can work across the full stack - from designing beautiful UIs to building robust APIs. You will be a key member of our engineering team (currently 8 developers) and contribute to architectural decisions.

🛠️ TECH STACK:
- Frontend: React, TypeScript, Next.js, TailwindCSS
- Backend: Node.js, Express, PostgreSQL, Redis
- Infrastructure: AWS, Docker, GitHub Actions
- Tools: Figma, Linear, Slack

✅ REQUIREMENTS:
- 5+ years experience in web development
- Strong TypeScript skills (both FE & BE)
- Experience with React and Node.js
- PostgreSQL or similar SQL database
- RESTful API design
- Git workflow & code review experience
- Good communication skills (NL or EN required)

🌟 NICE TO HAVE:
- Experience with Next.js
- GraphQL knowledge
- AWS/cloud experience
- Startup experience
- Knowledge of French

💰 COMPENSATION:
- Salary: €60,000 - €75,000 gross/year (based on experience)
- 100% health insurance (DKV)
- Meal vouchers (€8/day)
- Public transport pass (100%)
- Company laptop (MacBook Pro)
- Annual training budget (€1,500)
- Stock options

📍 WORK SETUP:
- Location: Brussels (near Gare Centrale)
- Hybrid: 2 days/week in office, 3 days remote
- Flexible hours (core hours: 10:00-16:00)
- 32 vacation days/year

🎯 PROCESS:
1. Phone screening (30 min)
2. Technical challenge (take-home, 2-3h)
3. On-site interview with team (2h)
4. Offer within 1 week

Ready to make an impact? Apply now!

📧 careers@techstart.be
🌐 www.techstart.be/jobs',
  NULL, -- No price for job listings
  'EUR',
  'Brussels, 1000',
  'active',
  'approved'
);

INSERT INTO public.job_listings (
  advert_id,
  job_category,
  cp_code,
  contract_type,
  employment_type,
  hours_per_week,
  remote_option,
  salary_min,
  salary_max,
  salary_currency,
  salary_period,
  salary_type,
  benefits,
  experience_years_min,
  education_level,
  languages_required,
  company_name,
  company_size,
  industry,
  start_date,
  contact_email
) VALUES (
  (SELECT id FROM public.adverts WHERE title LIKE 'Senior Full-Stack Developer%' LIMIT 1),
  (SELECT slug FROM public.job_categories WHERE slug = 'it_tech' LIMIT 1),
  'PC218.01',
  (SELECT slug FROM public.job_contract_types WHERE slug = 'cdi' LIMIT 1),
  'full_time',
  40,
  'hybrid',
  60000,
  75000,
  'EUR',
  'year',
  'gross',
  ARRAY['meal_vouchers', 'insurance', 'transport', 'training_budget', 'stock_options'],
  5,
  'bachelor',
  ARRAY['en'],
  'TechStart',
  'startup',
  'Technology',
  '2025-12-01',
  'careers@techstart.be'
);

-- ============================================================================
-- FASHION SAMPLES
-- ============================================================================

-- Sample 6: Designer Jacket
INSERT INTO public.adverts (
  user_id,
  category_id,
  title,
  description,
  price,
  currency,
  location,
  status,
  moderation_status
) VALUES (
  '00000000-0000-0000-0000-000000000004'::uuid,
  (SELECT id FROM public.categories WHERE slug = 'fashion-women' LIMIT 1),
  'Moncler Dames Winterjas • Maat S/36 • Zwart • Als Nieuw',
  '🧥 Prachtige Moncler winterjas voor dames!

Gekocht vorig jaar bij de Inno, 2x gedragen. Helaas niet mijn stijl.
100% authentiek, met labels en bonnetje.

👗 DETAILS:
- Merk: Moncler (Franse luxe merk)
- Model: Quilted Down Jacket
- Kleur: Mat zwart
- Maat: S (36 EU / 8 UK / 4 US)
- Materiaal: 100% nylon met echte donzen vulling
- Ritssluiting + drukknopen
- Afneembare capuchon (met bont)
- 2 zijzakken met rits

📏 MATEN:
- Schouders: 38 cm
- Borstwijdte: 46 cm
- Lengte: 66 cm
- Mouwen: 62 cm

💯 STAAT: 9.5/10
- Als nieuw gedragen
- Geen vlekken, scheuren of beschadigingen
- Alle ritsen werken perfect
- Labels nog intact
- Originele Moncler tag aanwezig

📦 INBEGREPEN:
- Jas
- Afneembaar bontkraag
- Stoffen opbergtas (Moncler)
- Originele tags
- Aankoopbon (nov 2023, €1,450)

🔥 Perfect voor koude Belgische winters!
🧼 Professioneel gereinigd
💧 Water-resistant finish

💰 €850 (netto 40% korting)
📍 Brussel - passen mogelijk
📫 Verzending: Bpost verzekerd (€12)

Serieuze kopers alleen! Geen ruil.',
  850,
  'EUR',
  'Brussels, 1050',
  'active',
  'approved'
);

INSERT INTO public.ad_item_specifics (
  advert_id,
  specifics
) VALUES (
  (SELECT id FROM public.adverts WHERE title LIKE 'Moncler Dames%' LIMIT 1),
  '{
    "gender": "women",
    "age_category": "adults",
    "clothing_type": "jacket",
    "size_eu": "36",
    "size_be": "36",
    "size_uk": "8",
    "size_us": "4",
    "size_label": "S",
    "chest_bust_cm": 92,
    "brand": "Moncler",
    "color": "black",
    "material": "100% Nylon with Down filling",
    "season": "autumn_winter",
    "condition": "like_new",
    "original_tags": true,
    "designer": true,
    "delivery_options": ["pickup_only", "shipping_national"]
  }'::jsonb
);

-- Note: Add more sample adverts for other categories (Pets, Sports, Services, etc.)
-- following the same pattern. Each category should have 2-3 realistic examples.

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================

/*
TO USE THESE SAMPLES:

1. Create test user accounts and note their UUIDs
2. Update all user_id references in this file
3. Verify category_id lookups match your categories table
4. Run: psql -h <host> -U <user> -d <database> -f seed/catalog/samples.sql
5. Upload sample photos to match the adverts (use Supabase Storage)
6. Link photos via media table

FOR PRODUCTION:
- Remove or disable these samples
- Use real user-generated content only
*/

