# Fashion & Personal Items (Lichnye Veshchi)

> **Category**: Fashion  
> **Database Strategy**: JSONB + Dictionaries (Tier 2)  
> **Priority**: High  
> **Last Updated**: 2025-11-05

## Overview

Fashion marketplace for clothing, shoes, and accessories across all genders and ages. Uses JSONB with shared dictionary tables for sizing standards (EU/UK/US conversions), brands, and materials.

### Belgium-Specific Considerations

- **EU Sizing**: Primary sizing standard
- **Multi-language**: Size labels vary (NL: Maat, FR: Taille, EN: Size)
- **Sustainability**: Growing secondhand market
- **Returns**: Consumer rights for online purchases (14-day cooling-off period)

## Subcategories

```
Fashion/
├── Women's Fashion
│   ├── Outerwear (Coats, Jackets)
│   ├── Dresses & Skirts
│   ├── Blouses & Shirts
│   ├── Pants & Shorts
│   ├── Sweaters & Hoodies
│   ├── T-Shirts & Tops
│   ├── Sportswear
│   ├── Homewear & Loungewear
│   ├── Underwear & Lingerie
│   ├── Swimwear
│   ├── Shoes
│   ├── Bags & Accessories
│   └── Hats & Headwear
├── Men's Fashion
│   ├── Outerwear
│   ├── Suits & Blazers
│   ├── Shirts
│   ├── Pants & Shorts
│   ├── Sweaters & Hoodies
│   ├── T-Shirts & Polos
│   ├── Sportswear
│   ├── Homewear
│   ├── Underwear
│   ├── Shoes
│   ├── Accessories (Ties, Belts, Wallets)
│   └── Hats & Caps
└── Kids' Fashion
    ├── Newborn (0-24 months)
    ├── Toddler (2-4 years)
    ├── Kids (5-12 years)
    ├── Teens (13+ years)
    └── All clothing types per age group
```

## Fields (JSONB)

### Common Fashion Fields

```json
{
  "category_type": "fashion",
  "fashion_category": "women" | "men" | "kids" | "unisex",
  
  // Item Type
  "item_type": "dress" | "pants" | "shirt" | "shoes" | "jacket" | "accessories",
  "subcategory": "evening_dress" | "jeans" | "sneakers" | "leather_jacket",
  
  // Brand
  "brand_id": "uuid", // FK to fashion_brands
  "brand": "Zara",
  
  // Size (with conversions)
  "size_system": "EU" | "UK" | "US" | "universal",
  "size_eu": "38",
  "size_uk": "10",
  "size_us": "6",
  "size_label": "M", // XS, S, M, L, XL, XXL
  "size_numeric": "38", // For numeric sizes
  
  // Age Group (for kids)
  "age_group": "newborn" | "toddler" | "kids" | "teens" | "adult",
  "age_range": "5-7 years" | "8-10 years",
  
  // Gender
  "gender": "women" | "men" | "unisex" | "girls" | "boys",
  
  // Style & Design
  "style": "casual" | "formal" | "business" | "sport" | "evening" | "vintage",
  "color": "blue",
  "color_family": "blue", // Standardized for filtering
  "color_hex": "#4A90E2",
  "pattern": "solid" | "striped" | "floral" | "checkered" | "polka_dot",
  "season": "summer" | "winter" | "spring_fall" | "all_season",
  "occasion": ["casual", "work", "party", "sport"],
  
  // Materials
  "material_primary": "cotton",
  "material_composition": {
    "cotton": 95,
    "elastane": 5
  },
  "material_details": ["organic_cotton", "sustainable"],
  
  // Measurements (actual item, in cm)
  "measurements": {
    "length_cm": 95,      // Dress length, pants length
    "chest_cm": 88,       // Bust/chest circumference
    "waist_cm": 72,
    "hips_cm": 96,
    "shoulder_cm": 38,    // Shoulder width
    "sleeve_cm": 60,      // Sleeve length
    "inseam_cm": 75,      // Pants inseam
    "shoe_length_cm": 25  // For shoes
  },
  
  // Fit & Cut
  "fit": "slim" | "regular" | "oversized" | "loose" | "tailored",
  "rise": "low" | "mid" | "high", // For pants
  "neckline": "crew" | "v-neck" | "turtleneck" | "off_shoulder", // For tops
  
  // Condition
  "condition_grade": "new_with_tags" | "new_without_tags" | "like_new" | "excellent" | "good" | "fair",
  "has_tags": true,
  "has_defects": false,
  "defects_description": "",
  "wear_signs": [], // ["pilling", "fading", "minor_stains"]
  
  // Care
  "care_instructions": ["machine_wash_30", "do_not_bleach", "iron_low", "dry_clean"],
  
  // Purchase Info
  "original_price": 49.99,
  "purchase_year": 2024,
  "purchase_season": "Spring 2024",
  "times_worn": "5-10",
  
  // Special Features
  "features": ["pockets", "zip", "buttons", "hood", "adjustable_straps"],
  
  // Sustainability
  "sustainable": false,
  "eco_labels": [], // ["GOTS", "Fair Trade", "Organic"]
  
  // Designer/Limited
  "designer": false,
  "limited_edition": false,
  "collaboration": ""
}
```

### Shoes-Specific Fields

```json
{
  "item_type": "shoes",
  "shoe_type": "sneakers" | "boots" | "sandals" | "heels" | "flats" | "loafers",
  
  // Size
  "shoe_size_eu": "39",
  "shoe_size_uk": "6",
  "shoe_size_us": "8",
  "shoe_width": "standard" | "narrow" | "wide",
  
  // Materials
  "upper_material": "leather" | "synthetic" | "canvas" | "suede",
  "sole_material": "rubber" | "leather" | "synthetic",
  "lining_material": "textile" | "leather",
  
  // Features
  "heel_height_cm": 8,
  "platform_height_cm": 2,
  "waterproof": false,
  "non_slip": true,
  
  // Condition
  "sole_condition": "excellent" | "good" | "worn",
  "upper_condition": "excellent" | "good" | "fair",
  "insole_condition": "clean" | "slightly_worn" | "worn",
  
  // Box & Accessories
  "original_box": true,
  "dust_bag": true,
  "extra_laces": false
}
```

### Bags & Accessories Fields

```json
{
  "item_type": "bag" | "belt" | "scarf" | "jewelry" | "watch" | "sunglasses",
  
  // Bags
  "bag_type": "handbag" | "backpack" | "tote" | "crossbody" | "clutch" | "suitcase",
  "bag_size": "small" | "medium" | "large",
  "dimensions": {
    "height_cm": 30,
    "width_cm": 40,
    "depth_cm": 15
  },
  "capacity_liters": 20,
  "closure_type": "zip" | "magnetic" | "buckle" | "drawstring",
  "strap_type": "leather" | "chain" | "adjustable" | "detachable",
  "compartments": 3,
  "laptop_compartment": false,
  
  // Material
  "material": "leather" | "vegan_leather" | "canvas" | "nylon" | "suede",
  "hardware_color": "gold" | "silver" | "black" | "rose_gold",
  
  // Designer Info
  "designer_bag": true,
  "authentication_available": true,
  "serial_number": "HIDDEN",
  
  // Condition
  "exterior_condition": "excellent",
  "interior_condition": "good",
  "hardware_condition": "excellent",
  "scratches": "minor",
  "stains": "none"
}
```

## Size Conversion Tables (Dictionaries)

### Women's Clothing

| EU | UK | US | Label |
|----|----|----|-------|
| 32 | 4 | 0 | XXS |
| 34 | 6 | 2 | XS |
| 36 | 8 | 4 | S |
| 38 | 10 | 6 | M |
| 40 | 12 | 8 | M |
| 42 | 14 | 10 | L |
| 44 | 16 | 12 | L |
| 46 | 18 | 14 | XL |
| 48 | 20 | 16 | XXL |

### Men's Clothing

| EU | UK | US | Label |
|----|----|----|-------|
| 44 | 34 | 34 | XS |
| 46 | 36 | 36 | S |
| 48 | 38 | 38 | M |
| 50 | 40 | 40 | L |
| 52 | 42 | 42 | XL |
| 54 | 44 | 44 | XXL |

### Kids' Sizes (by age)

| Age | Height (cm) | Label |
|-----|-------------|-------|
| 0-3 months | 56-62 | 62 |
| 3-6 months | 62-68 | 68 |
| 6-12 months | 68-80 | 80 |
| 1-2 years | 80-92 | 92 |
| 2-3 years | 92-98 | 98 |
| 3-4 years | 98-104 | 104 |
| 5-6 years | 110-116 | 116 |
| 7-8 years | 122-128 | 128 |
| 9-10 years | 134-140 | 140 |
| 11-12 years | 146-152 | 152 |
| 13-14 years | 158-164 | 164 |

## Moderation Checklist

- ✅ **Photos**: Require actual item photos (flat lay or worn)
  - No stock photos from brand websites
  - Show brand tags/labels for authenticity
  - Show any defects clearly
- ✅ **Size Accuracy**: Cross-check size label vs measurements
  - Flag if measurements don't match claimed size
- ✅ **Counterfeit Detection**: Flag luxury brands with suspicious pricing
  - Designer bags <50% market price → require authentication
  - Keywords: "inspired by", "style of", "AAA quality"
- ✅ **Condition Honesty**: Photos must match condition description
  - Reject "like new" if photos show significant wear
- ✅ **Prohibited Items**:
  - Counterfeit designer goods
  - Used underwear/swimwear (hygiene)
  - Items with offensive prints/messages

## SEO

**Title Template**:
```
{Brand} {Item Type} - Size {Size}, {Color} | LyVoX
Zara Floral Dress - Size M, Blue | LyVoX
```

**Schema.org**: `Product` + `ClothingSize`

## Example

```json
{
  "title": "Zara Floral Summer Dress - Size M (EU 38)",
  "description": "Beautiful floral summer dress from Zara. Worn twice, excellent condition. Perfect for casual outings or garden parties. Length just below the knee.",
  
  "fashion_category": "women",
  "item_type": "dress",
  "subcategory": "summer_dress",
  
  "brand": "Zara",
  "size_eu": "38",
  "size_label": "M",
  "gender": "women",
  
  "style": "casual",
  "color": "blue",
  "pattern": "floral",
  "season": "summer",
  
  "material_primary": "cotton",
  "material_composition": {
    "cotton": 95,
    "elastane": 5
  },
  
  "measurements": {
    "length_cm": 95,
    "chest_cm": 88,
    "waist_cm": 72
  },
  
  "condition_grade": "excellent",
  "has_tags": false,
  "times_worn": "2",
  
  "original_price": 49.99,
  "price": 20,
  
  "care_instructions": ["machine_wash_30", "iron_low"]
}
```

---

**End of fashion.md**

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](../../development/MASTER_CHECKLIST.md)
**Catalog:** [CATALOG_MASTER.md](../CATALOG_MASTER.md) • [categories/real-estate.md](./real-estate.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../CATALOG_IMPLEMENTATION_STATUS.md) • [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)
