# Home, Kids, Pets & Miscellaneous Categories

> **Last Updated**: 2025-11-05  
> **Note**: This document covers multiple simpler categories using JSONB + dictionaries or pure JSONB approaches.

---

## Home & Kids (Dom, Hobbi, Deti)

**Database Strategy**: JSONB + Safety Standards (Tier 2/3)  
**Priority**: High (for baby/kids due to safety requirements)

### Subcategories

```
Home, Hobbies & Kids/
├── Home & Garden
│   ├── Furniture
│   ├── Textiles & Carpets
│   ├── Kitchen & Dining
│   ├── Lighting
│   ├── Decor
│   ├── Garden Tools & Equipment
│   └── Plants
├── Baby & Kids (Special: Safety Standards)
│   ├── Strollers & Car Seats (ECE R129/i-Size)
│   ├── Toys & Games (EN 71, CE marking)
│   ├── Feeding Equipment
│   ├── Children's Furniture
│   ├── Baby Clothing
│   ├── Hygiene & Care
│   └── Maternity Items
└── Hobbies & Recreation
    ├── Sports Equipment
    ├── Books & Magazines
    ├── Musical Instruments
    ├── Collectibles
    ├── Board Games
    ├── Camping & Outdoor
    └── Tickets & Events
```

### Baby & Kids Safety Standards (Belgium/EU)

**Critical Fields**:

```json
{
  "category_type": "baby_kids",
  "item_type": "stroller" | "car_seat" | "toy" | "furniture" | "clothing",
  
  // Safety Certifications (REQUIRED)
  "safety_standards": [
    "CE", // EU conformity mark (mandatory)
    "EN71", // Toy safety
    "ECE_R129", // i-Size car seat standard
    "EN1888", // Stroller standard
    "EN716" // Cot/crib standard
  ],
  
  "ce_marking": true, // REQUIRED for toys
  "certification_documents": true,
  
  // Age Appropriateness
  "age_range_min_months": 0,
  "age_range_max_months": 36,
  "age_label": "0-3 years",
  "choking_hazard_warning": false, // Auto-set if <3 years + small parts
  
  // Car Seat Specific (ECE R129 / i-Size)
  "car_seat_standard": "ECE_R129" | "ECE_R44_04", // R44/04 being phased out
  "isize_compatible": true,
  "weight_range_kg": {
    "min": 0,
    "max": 18
  },
  "height_range_cm": {
    "min": 40,
    "max": 105
  },
  "isofix": true,
  "rearward_facing": true,
  "crash_test_rating": "Good", // If available
  
  // Stroller Specific
  "stroller_type": "travel_system" | "umbrella" | "jogger" | "double",
  "max_weight_kg": 15,
  "safety_harness": "5_point",
  "brake_type": "foot" | "hand",
  "suspension": true,
  
  // General Safety
  "recalls": [], // Check against Belgium/EU recall database
  "known_safety_issues": [],
  
  // Hygiene (Important for Belgium market)
  "washable": true,
  "cleanable": true,
  "hygiene_note": "All fabric parts machine washable at 30°C",
  
  // Condition
  "condition": "new" | "like_new" | "good",
  "expiry_date": null, // For items with expiration (formula, diapers)
  
  // Documentation
  "manual_included": true,
  "assembly_required": true,
  "warranty_remaining": "6 months"
}
```

**Moderation - Baby/Kids**:
- ✅ **CE Marking**: REQUIRED for toys (reject if missing)
- ✅ **Car Seats**: Must show standard compliance (ECE R129 or R44/04)
- ✅ **Age Warnings**: Auto-add choking hazard warnings for <3 years + small parts
- ✅ **Recalls**: Cross-check against EU recall database
- ✅ **Hygiene**: Used items must be cleanable
- ✅ **Expiry**: Flag if selling expired formula, diapers, medications
- ❌ **Prohibited**: Non-compliant car seats, recalled items, counterfeits

---

## Pets (Zhivotnye)

**Database Strategy**: JSONB + Legal Species (Tier 2)  
**Priority**: Medium

### Subcategories

```
Pets/
├── Domestic Pets
│   ├── Dogs
│   ├── Cats
│   ├── Small Animals (Rabbits, Guinea Pigs, Hamsters)
│   ├── Birds
│   └── Aquarium Fish
└── Pet Supplies
    ├── Food & Treats
    ├── Accessories (Collars, Leashes, Beds)
    ├── Cages & Enclosures
    └── Toys
```

### Belgium Legal Pet Requirements

**Allowed Without Special Permit**:
- Dogs, Cats (registration & chip required)
- Rabbits, Guinea Pigs, Hamsters, Gerbils
- Domestic birds (non-endangered)
- Aquarium fish (non-invasive species)

**Restricted** (requires permit/documentation):
- Exotic reptiles (snakes, lizards)
- Ferrets
- Specific dog breeds (breed-specific legislation)

**Prohibited**:
- Endangered species
- Wild animals
- Invasive species

**Fields**:

```json
{
  "category_type": "pet",
  "pet_type": "dog" | "cat" | "rabbit" | "bird" | "fish" | "supplies",
  
  // Animal Details (if pet, not supplies)
  "species": "dog",
  "breed": "Labrador Retriever",
  "age_years": 2,
  "age_months": 6,
  "gender": "male" | "female",
  "neutered": true,
  
  // Health & Documentation
  "vaccinated": true,
  "vaccination_record": true,
  "microchipped": true,
  "microchip_number": "HIDDEN", // Show only to serious buyers
  "registered": true, // Belgium dog/cat registry
  "pedigree": true,
  "pedigree_papers": true,
  "health_certificate": true,
  "vet_checked": true,
  "last_vet_visit": "2025-10-15",
  
  // Behavior & Temperament
  "temperament": ["friendly", "energetic", "good_with_kids"],
  "trained": "house_trained" | "basic_commands" | "advanced",
  "good_with_kids": true,
  "good_with_dogs": true,
  "good_with_cats": false,
  
  // Adoption Conditions
  "adoption_fee": 200, // Or "Free to good home"
  "rehoming_reason": "moving_abroad",
  "trial_period": false,
  "home_check": false,
  "references_required": false,
  
  // Pet Supplies
  "supply_type": "food" | "toy" | "bed" | "cage" | "collar",
  "brand": "Royal Canin",
  "size": "Medium",
  "new_unopened": true
}
```

**Moderation - Pets**:
- ✅ **Legal Species**: Verify against Belgium allowed list
- ✅ **Documentation**: Encourage vaccination/microchip proof
- ✅ **Prohibited Breeds**: Flag breed-specific legislation breeds
- ✅ **Puppy Mills**: Flag multiple litters, suspiciously low prices, no vac records
- ✅ **Welfare**: Flag inhumane conditions (photos), abusive rehoming fees
- ❌ **Prohibited**: Exotic/wild animals without permits, endangered species

---

## Transport Parts & Accessories

**Database Strategy**: Pure JSONB (Tier 3)  
**Priority**: Low-Medium

```json
{
  "category_type": "vehicle_parts",
  "part_type": "tires" | "rims" | "audio" | "navigation" | "accessories",
  
  // Vehicle Compatibility
  "compatible_makes": ["BMW", "Mercedes", "Audi"],
  "compatible_models": ["3 Series", "C Class", "A4"],
  "compatible_years": [2015, 2016, 2017, 2018, 2019, 2020],
  "universal_fit": false,
  
  // Tires Specific
  "tire_size": "205/55 R16",
  "tire_brand": "Michelin",
  "tire_model": "Pilot Sport 4",
  "season": "summer" | "winter" | "all_season",
  "tread_depth_mm": 6.5,
  "dot_code": "3220", // Manufacturing week/year
  "quantity": 4,
  
  // Part Condition
  "condition": "new" | "used" | "refurbished",
  "oem": true, // Original Equipment Manufacturer
  "aftermarket": false,
  "warranty": "2 years",
  
  // Identification
  "part_number": "ABC123456",
  "serial_number": "XYZ789"
}
```

---

## Services

**Database Strategy**: Pure JSONB (Tier 3)  
**Priority**: Medium

```json
{
  "category_type": "service",
  "service_type": "repair" | "construction" | "cleaning" | "beauty" | "education" | "transport",
  
  // Provider Info
  "business_name": "HandyMan Services Brussels",
  "licensed": true,
  "insured": true,
  "insurance_type": "professional_liability",
  "certifications": ["ISO9001", "VCA"],
  "years_experience": 10,
  
  // Pricing
  "pricing_model": "fixed" | "hourly" | "per_project" | "quote_based",
  "price_per_hour": 45,
  "minimum_charge": 90,
  "call_out_fee": 20,
  "free_quote": true,
  
  // Service Area
  "service_areas": ["Brussels", "Flemish Brabant"],
  "service_radius_km": 30,
  "mobile_service": true, // Comes to customer
  "on_site": false, // Customer comes to provider
  
  // Availability
  "available_days": ["mon", "tue", "wed", "thu", "fri"],
  "emergency_service": false,
  "weekends": false,
  "evenings": true,
  
  // Languages
  "languages": ["nl", "fr", "en"],
  
  // Portfolio
  "portfolio_url": "https://...",
  "references_available": true,
  "reviews_external": "Google: 4.8/5 (120 reviews)"
}
```

---

## Free / Giveaway

**Database Strategy**: Pure JSONB (Tier 3)  
**Priority**: Low

```json
{
  "category_type": "free_giveaway",
  "item_type": "furniture" | "electronics" | "books" | "clothing" | "toys" | "other",
  "item_name": "IKEA Bookshelf - Billy",
  
  "condition": "good" | "fair" | "for_parts",
  "reason_giving": "moving" | "upgrading" | "decluttering" | "broken",
  
  // Pickup
  "pickup_only": true,
  "pickup_location_area": "Brussels, Ixelles",
  "pickup_instructions": "Ground floor, easy access",
  "available_until": "2025-12-15",
  "flexible_times": true,
  "preferred_times": ["weekday_evenings", "saturday_morning"],
  
  // Item Details
  "dimensions": {
    "height_cm": 180,
    "width_cm": 80,
    "depth_cm": 30
  },
  "weight_approx_kg": 25,
  "disassembly_required": true,
  "can_help_load": false,
  "requires_van": true,
  
  "notes": "Good condition, just a few scratches. Must be picked up by Dec 15, moving abroad."
}
```

---

## Lost & Found

**Database Strategy**: Pure JSONB (Tier 3)  
**Priority**: Low

```json
{
  "category_type": "lost_found",
  "type": "lost" | "found",
  
  // Item Details
  "item_type": "phone" | "wallet" | "keys" | "jewelry" | "pet" | "documents" | "other",
  "item_description": "Black leather wallet",
  "distinctive_features": ["Silver zipper", "RFID blocking"],
  
  // Location & Time
  "location_lost_found": "Brussels, near Gare Centrale",
  "location_specific": "On tram 4, seat near the door",
  "date_lost_found": "2025-11-04",
  "time_approximate": "around 18:30",
  
  // Contact & Reward
  "reward_offered": 50, // EUR
  "no_questions_asked": true,
  
  // For Pets (Lost/Found)
  "pet_name": "Max",
  "pet_species": "dog",
  "pet_breed": "Beagle",
  "microchipped": true,
  "distinctive_marks": ["White patch on chest"],
  
  // Privacy
  "proof_of_ownership_required": true // Ask for details to verify
}
```

**Moderation - Lost & Found**:
- ✅ **Legitimacy**: Verify photos match description
- ✅ **Privacy**: Ensure no sensitive documents shown in photos (ID numbers, etc.)
- ✅ **Scams**: Flag if "reward" seems like bait for scam

---

## Summary Table

| Category | Strategy | Priority | Special Requirements |
|----------|----------|----------|---------------------|
| **Home & Garden** | JSONB | Medium | Basic condition/dimensions |
| **Baby & Kids** | JSONB + Safety Dict | **High** | CE marking, EN standards, age warnings |
| **Hobbies** | JSONB | Low | Minimal structure |
| **Pets** | JSONB + Legal Species | Medium | Belgium species laws, health docs |
| **Vehicle Parts** | JSONB | Low-Medium | Compatibility info |
| **Services** | JSONB | Medium | Licensing, insurance, service area |
| **Free/Giveaway** | Pure JSONB | Low | Pickup logistics |
| **Lost & Found** | Pure JSONB | Low | Privacy protection |

---

**End of home-kids-pets-misc.md**

---

## 🔗 Related Docs

**Catalog:** [AI_ENRICHMENT.md](../AI_ENRICHMENT.md) • [CATALOG_MASTER.md](../CATALOG_MASTER.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../CATALOG_IMPLEMENTATION_STATUS.md) • [FINAL_COMPLETION_REPORT.md](../FINAL_COMPLETION_REPORT.md)
**Core:** [API_REFERENCE.md](../../API_REFERENCE.md)
