# AI Enrichment Architecture for LyVoX Catalog

## Overview

AI enrichment adds value to adverts through automated generation of titles, descriptions, tags, quality checks, and fraud detection. This document outlines the architecture, prompt templates, and moderation rules for catalog-specific AI enrichment.

## Architecture

### High-Level Flow

```
User Creates Advert
  ↓
Basic Validation (Zod)
  ↓
Save to DB (status: draft)
  ↓
[ASYNC] AI Enrichment Queue
  ↓
AI Processing (OpenAI GPT-4)
  ├─ Title Generation/Enhancement
  ├─ Description Enhancement
  ├─ Tag Extraction
  ├─ Quality Score
  ├─ Fraud Detection
  └─ Category-Specific Checks
  ↓
Update Advert (ai_suggestions)
  ↓
[OPTIONAL] Auto-Apply if high confidence
  ↓
Moderation Queue
```

### Components

1. **AI Enrichment Worker** (`packages/ai/worker.ts`)
   - Listens to Supabase realtime for new adverts
   - Queues enrichment tasks
   - Handles rate limiting and retries

2. **AI Prompt Service** (`packages/ai/prompts/`)
   - Category-specific prompt templates
   - Context builders
   - Response parsers

3. **AI Moderation Service** (`packages/ai/moderation/`)
   - Content policy checks
   - Belgium-specific legal compliance
   - Spam/fraud detection

4. **Quality Scoring** (`packages/ai/scoring/`)
   - Photo quality assessment
   - Completeness scoring
   - Pricing outlier detection

---

## Title Generation

### Prompt Template (Real Estate)

```
You are an expert real estate copywriter in Belgium. Generate a compelling title for this property listing.

CONTEXT:
- Property Type: {property_type}
- Location: {municipality}, {postcode}
- Area: {area_sqm}m²
- Rooms: {rooms}
- Bedrooms: {bedrooms}
- EPC: {epc_rating}
- Listing Type: {listing_type}
- Price: €{price}

REQUIREMENTS:
- Maximum 80 characters
- Include key selling points
- Use Belgium-appropriate language (NL/FR/EN based on user preference)
- Avoid superlatives unless justified
- Format: "[Type] [Rooms] • [Area]m² • [Location]"

USER'S ORIGINAL TITLE (may be empty): "{user_title}"

OUTPUT FORMAT (JSON):
{
  "title": "...",
  "confidence": 0.0-1.0,
  "reasoning": "why this title"
}
```

### Prompt Template (Electronics)

```
You are an expert electronics product specialist. Generate a clear, searchable title for this device listing.

CONTEXT:
- Device Type: {device_type}
- Brand: {brand}
- Model: {model}
- Storage: {storage_gb}GB
- Memory: {memory_gb}GB RAM
- Condition: {condition}
- Year: {release_year}

REQUIREMENTS:
- Maximum 100 characters
- Include brand, model, key specs
- Mention condition if not "new"
- Use standard abbreviations (GB, RAM, etc.)
- Format: "[Brand] [Model] [Storage] [Condition]"

USER'S ORIGINAL TITLE: "{user_title}"

OUTPUT FORMAT (JSON):
{
  "title": "...",
  "confidence": 0.0-1.0,
  "reasoning": "why this title"
}
```

### Prompt Template (Jobs)

```
You are an expert HR copywriter. Generate a professional job title.

CONTEXT:
- Job Category: {job_category}
- Employment Type: {employment_type}
- Company: {company_name}
- Location: {location}
- Remote: {remote_option}
- Experience: {experience_years_min}+ years

REQUIREMENTS:
- Maximum 80 characters
- Use standard job title terminology
- Include seniority level if applicable
- Mention remote if full_remote
- Format: "[Job Title] ([Type]) - [Company/Location]"

USER'S ORIGINAL TITLE: "{user_title}"

OUTPUT FORMAT (JSON):
{
  "title": "...",
  "confidence": 0.0-1.0,
  "reasoning": "why this title"
}
```

---

## Description Enhancement

### Prompt Template (Generic)

```
You are a professional copywriter specializing in classifieds. Enhance this advert description.

ORIGINAL DESCRIPTION:
"{user_description}"

CATEGORY: {category}
SPECIFICS: {json_specifics}

REQUIREMENTS:
- Expand on key features missing from original
- Add Belgium-specific context if relevant (e.g., transport links for real estate)
- Maintain user's tone and language
- Maximum 2000 characters
- Use paragraphs for readability
- Include call-to-action at end

AVOID:
- Superlatives without basis
- Misleading claims
- Legal disclaimers (handled separately)
- Contact information (in separate fields)

OUTPUT FORMAT (JSON):
{
  "enhanced_description": "...",
  "added_sections": ["feature1", "feature2"],
  "confidence": 0.0-1.0,
  "warnings": ["potential issue if any"]
}
```

---

## Tag Extraction

### Prompt Template

```
Extract relevant search tags from this advert.

TITLE: "{title}"
DESCRIPTION: "{description}"
CATEGORY: {category}
SPECIFICS: {json_specifics}

REQUIREMENTS:
- Extract 5-15 tags
- Include:
  * Condition/Quality indicators
  * Key features
  * Brand/Model (if applicable)
  * Location attributes (for real estate)
  * Material/Color (for fashion/home)
- Use standardized terms (e.g., "bluetooth" not "blue tooth")
- Belgium-relevant tags (e.g., "epc_a", "cp200", "brussels")
- Language: match user's language preference

OUTPUT FORMAT (JSON):
{
  "tags": ["tag1", "tag2", ...],
  "confidence": 0.0-1.0
}
```

---

## Quality Scoring

### Photo Quality Check (Vision API)

```
Analyze these product/property photos for quality.

CATEGORY: {category}
NUMBER_OF_PHOTOS: {count}
PHOTO_URLS: {urls}

CRITERIA:
1. Resolution (min 800x600)
2. Lighting quality
3. Framing/composition
4. Focus/sharpness
5. Background clutter
6. Watermarks (not allowed)
7. Graphic overlays (discouraged)
8. NSFW content (auto-reject)

CATEGORY-SPECIFIC:
- Real Estate: Show multiple rooms, exterior, EPC certificate
- Electronics: Show device, accessories, condition details (scratches)
- Vehicles: Multiple angles, interior, dashboard, VIN (if visible)
- Fashion: On model/mannequin preferred, show material/texture

OUTPUT FORMAT (JSON):
{
  "overall_score": 0-100,
  "photo_scores": [
    {"index": 0, "score": 0-100, "issues": ["issue1"], "suggestions": ["..."]},
    ...
  ],
  "missing_shots": ["exterior", "EPC certificate"],
  "violations": ["watermark detected"],
  "approval_recommended": true/false
}
```

---

## Fraud Detection

### Content Analysis

```
Analyze this advert for potential fraud indicators.

TITLE: "{title}"
DESCRIPTION: "{description}"
PRICE: {price}
CATEGORY: {category}
USER_ACCOUNT_AGE: {days}
USER_PREVIOUS_ADVERTS: {count}

RED FLAGS TO CHECK:
1. Price significantly below market (>50% lower)
2. Urgency language ("act now", "limited time", "must sell today")
3. Unusual payment requests (Western Union, gift cards, crypto)
4. Poor grammar/spelling (possible scam)
5. Stock photos detected (reverse image search)
6. Contact info in description (policy violation)
7. External links (policy violation)
8. Duplicate content (copy-paste from other sites)

BELGIUM-SPECIFIC:
- VAT number validation (if claiming business)
- Address verification (if pickup location)
- Phone number format (Belgian)

OUTPUT FORMAT (JSON):
{
  "risk_score": 0-100, // 0=safe, 100=definite fraud
  "flags": [
    {"type": "price_outlier", "severity": "high", "details": "..."},
    {"type": "urgency_language", "severity": "medium", "details": "..."}
  ],
  "recommended_action": "approve" | "flag_for_review" | "reject",
  "reasoning": "..."
}
```

---

## Category-Specific Moderation Rules

### Real Estate

**Auto-Reject If:**

- Missing EPC rating (required by Belgium law for sale/rent)
- Price > €10M without verification
- Postcode outside Belgium (1000-9999)
- Photos show identifiable people without consent

**Flag For Review If:**

- EPC rating G with no explanation
- Deposit > 3 months rent (illegal in Belgium)
- Very low price (<€300/month rent in Brussels)
- No municipality specified

**AI Enhancements:**

- Suggest EPC rating based on photos (if certificate visible)
- Estimate transport accessibility from postcode
- Suggest similar properties for pricing reference

### Electronics

**Auto-Reject If:**

- IMEI blacklisted (check via API if provided)
- Photos show stolen device indicators (iCloud locked)
- Price > €5000 for consumer electronics without receipt mention

**Flag For Review If:**

- Brand new device at 50%+ discount
- Multiple identical listings from same user
- Serial number format invalid

**AI Enhancements:**

- Suggest model year based on model name
- Estimate battery health from age (if not provided)
- Recommend accessories to include for complete listing

### Jobs

**Auto-Reject If:**

- No contact method (email/phone/URL)
- Salary below Belgium minimum wage (€1,800/month gross)
- Pyramid scheme keywords ("recruit friends", "unlimited income")
- Application fee requested (illegal in Belgium)

**Flag For Review If:**

- Very high salary for entry-level role
- No company name provided
- Work-from-home with no clear job duties
- CP code doesn't match job category

**AI Enhancements:**

- Suggest CP code based on job category
- Recommend Belgium-standard benefits
- Check salary against market rates

### Fashion

**Auto-Reject If:**

- Counterfeit indicators ("AAA replica", "inspired by")
- NSFW photos (intimate apparel must be on mannequin)
- Brand name misspelled (likely fake)

**Flag For Review If:**

- Designer item at very low price
- No size information
- Stock photos from brand website

**AI Enhancements:**

- Detect brand from photos
- Suggest size conversions (EU/UK/US)
- Recommend material/care information

---

## Implementation

### Phase 1: Basic Enrichment (MVP)

- Title suggestions (all categories)
- Tag extraction
- Basic photo quality check
- Price outlier detection

### Phase 2: Advanced Enrichment

- Description enhancement
- Fraud detection
- Category-specific checks
- Image recognition (brand/model detection)

### Phase 3: Full AI Integration

- Automatic translations (5 languages)
- Voice-to-text for descriptions
- Photo background removal
- Smart pricing recommendations
- Duplicate detection

---

## API Integration

### OpenAI Configuration

```typescript
// packages/ai/config.ts
export const AI_CONFIG = {
  provider: "openai",
  model: "gpt-4o", // GPT-4 Omni for best results
  temperature: 0.7, // Balanced creativity/accuracy
  max_tokens: 2000,
  vision_model: "gpt-4o", // For image analysis
  rate_limit: {
    requests_per_minute: 50,
    tokens_per_minute: 100000,
  },
  fallback: {
    model: "gpt-3.5-turbo", // If rate limited
    max_tokens: 1000,
  },
};
```

### Cost Estimation

- **Title Generation**: ~500 tokens → $0.005 per advert
- **Description Enhancement**: ~2000 tokens → $0.02 per advert
- **Photo Analysis**: ~1000 tokens per photo → $0.01 per photo
- **Fraud Detection**: ~1000 tokens → $0.01 per advert

**Estimated Cost**: €0.05-0.10 per fully enriched advert

### Rate Limiting Strategy

1. Queue-based processing (Supabase Edge Functions + Postgres queue)
2. Priority tiers:
   - **High**: Paid users, business accounts
   - **Medium**: Verified users
   - **Low**: New users (anti-spam)
3. Batch processing during off-peak hours
4. Caching for common enrichments (e.g., brand info)

---

## Privacy & Compliance

### Data Handling

- **Personal Data**: Never sent to AI (names, emails, phone numbers)
- **Photos**: Analyzed but not stored by AI provider
- **GDPR**: User consent required for AI enrichment
- **Opt-Out**: Users can disable AI suggestions

### Belgium-Specific Compliance

- All AI-generated content labeled as "AI-suggested"
- Human review required for legal/medical categories
- Compliance with DSA (Digital Services Act)
- Anti-discrimination checks for housing/jobs

---

## Monitoring & Metrics

### Key Metrics

- **Enrichment Rate**: % of adverts enriched
- **Acceptance Rate**: % of AI suggestions accepted by users
- **Quality Score**: Average advert quality pre/post enrichment
- **Time to Publish**: Reduction in time from draft to published
- **False Positive Rate**: Incorrect fraud/policy flags

### Success Criteria

- 80%+ enrichment acceptance rate
- <5% false positive fraud detection
- 30%+ increase in advert views (enriched vs non-enriched)
- 50%+ reduction in manual moderation time

---

## Future Enhancements

1. **Multilingual Auto-Translation**: Detect language, auto-translate to NL/FR/EN
2. **Price Prediction Model**: ML model trained on historical sales
3. **Similar Listings**: Semantic search for related adverts
4. **Auto-Categorization**: Suggest subcategory from title/description
5. **Smart Recommendations**: "Your advert would get 2x more views with better photos"
6. **Voice Input**: Record description, AI transcribes & enhances
7. **AR Integration**: Upload room photo, AI places furniture (for home goods)

---

## References

- **OpenAI Best Practices**: https://platform.openai.com/docs/guides/prompt-engineering
- **Belgium EPC Standards**: https://www.energiesparen.be/epc
- **GDPR Compliance**: https://gdpr.eu/
- **DSA Guidelines**: https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package

---

**Last Updated**: 2025-11-05  
**Version**: 1.0  
**Owner**: AI Enrichment Team

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](../development/MASTER_CHECKLIST.md)
**Catalog:** [CATALOG_MASTER.md](./CATALOG_MASTER.md) • [FINAL_COMPLETION_REPORT.md](./FINAL_COMPLETION_REPORT.md) • [CATALOG_IMPLEMENTATION_STATUS.md](./CATALOG_IMPLEMENTATION_STATUS.md) • [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
