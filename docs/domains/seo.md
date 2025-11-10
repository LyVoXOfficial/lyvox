last_sync: 2025-10-28

# Next-Gen SEO & AI Discovery for LyVoX

related: i18n.md, adverts.md, vehicles.md, PROMPT_MAIN.md

---

## 1. Overview

LyVoX uses a hybrid SEO approach that combines:
- Classic HTML metadata (title, description, canonical)
- Multilingual hreflang structure
- Semantic JSON-LD for all adverts
- OpenGraph / Twitter cards for sharing
- AI discovery feeds for ChatGPT, Perplexity, and other LLM crawlers

This ensures visibility across search, chat assistants, and AI-based aggregators.

---

## 2. Structured Data Layer (Schema.org)

Each advert dynamically embeds a JSON-LD block describing the item type.

### Vehicle Example

```json
{
  "@context": "https://schema.org",
  "@type": "Car",
  "name": "BMW 535d Touring",
  "brand": { "@type": "Brand", "name": "BMW" },
  "model": "535d",
  "bodyType": "Station Wagon",
  "vehicleTransmission": "Automatic",
  "fuelType": "Diesel",
  "mileageFromOdometer": { "@type": "QuantitativeValue", "value": 248000, "unitCode": "KM" },
  "price": 4900,
  "priceCurrency": "EUR",
  "offers": {
    "@type": "Offer",
    "availability": "https://schema.org/InStock",
    "url": "https://lyvox.be/ad/bmw-535d-2008"
  },
  "address": { "@type": "PostalAddress", "addressLocality": "Geel", "addressCountry": "BE" },
  "image": ["https://lyvox.be/images/ad1234-1.jpg"],
  "seller": { "@type": "Person", "name": "Elvijs Valtas" }
}
```

### Generic Offer Example

For other categories (real estate, electronics, services):
- Use `@type: Product` or `@type: Offer`
- Include `price`, `availability`, `brand`, `category`, `image`, `url`

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "iPhone 13 128GB",
  "brand": { "@type": "Brand", "name": "Apple" },
  "category": "smartphones",
  "image": ["https://lyvox.be/images/ad5678-1.jpg"],
  "offers": {
    "@type": "Offer",
    "price": 499,
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock",
    "url": "https://lyvox.be/ad/iphone-13-128"
  }
}
```

---

## 3. Organization Schema

Add to the home page (`/`):

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "LyVoX",
  "url": "https://lyvox.be",
  "logo": "https://lyvox.be/logo.png",
  "sameAs": [
    "https://www.facebook.com/lyvox",
    "https://www.instagram.com/lyvox",
    "https://www.linkedin.com/company/lyvox"
  ]
}
```

This improves brand authority and AI indexing trust.

---

## 4. SEO Metadata Integration (SSR)

Within `apps/web/src/app/layout.tsx` → `generateMetadata()`:
- Inject `<html lang>` and `<meta httpEquiv="content-language">`
- Add `<link rel="alternate" hreflang="en|nl|fr|ru" href="...">`
- Add canonical URL for each page
- Use localized title and description via i18n dictionaries
- Extend OpenGraph / Twitter metadata

Example (TypeScript):

```ts
export const generateMetadata = async () => {
  const locale = /* detect from cookie */ "en";
  const t = (k: string) => k; // placeholder, use i18n
  return {
    title: t("meta.home.title"),
    description: t("meta.home.description"),
    alternates: {
      languages: {
        en: "https://lyvox.be/?lang=en",
        nl: "https://lyvox.be/?lang=nl",
        fr: "https://lyvox.be/?lang=fr",
        ru: "https://lyvox.be/?lang=ru",
      },
    },
    openGraph: {
      type: "website",
      locale,
      alternateLocale: ["en_US", "nl_BE", "fr_BE", "ru_RU"],
    },
    twitter: {
      card: "summary_large_image",
    },
  };
};
```

---

## 5. AI Discovery Feed

Expose machine-readable JSON feeds for public data aggregators.

- Endpoint: `/api/public/feed/vehicles`

```json
{
  "type": "Feed",
  "version": "1.0",
  "items": [
    {
      "id": "ad-1234",
      "url": "https://lyvox.be/ad/bmw-535d-2008",
      "title": "BMW 535d Touring 2008",
      "price": 4900,
      "currency": "EUR",
      "location": "Geel",
      "category": "cars",
      "brand": "BMW",
      "model": "535d"
    }
  ]
}
```

This enables ChatGPT / Perplexity / Gemini Search to understand LyVoX listings as structured entities.

---

## 6. robots.txt — AI Crawlers Access

```
User-agent: ChatGPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /
```

Optional: add `/ai/schema.json` to describe feed endpoints.

---

## 7. Sitemap with hreflang

Include language alternates inside `app/sitemap.ts`:

```xml
<url>
  <loc>https://lyvox.be/ad/bmw-535d-2008</loc>
  <xhtml:link rel="alternate" hreflang="nl" href="https://lyvox.be/?lang=nl"/>
  <xhtml:link rel="alternate" hreflang="fr" href="https://lyvox.be/?lang=fr"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://lyvox.be/?lang=en"/>
  <xhtml:link rel="alternate" hreflang="ru" href="https://lyvox.be/?lang=ru"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://lyvox.be/"/>
  
</url>
```

---

## 8. AI Preview Integration (OG / Twitter)

```html
<meta property="og:type" content="product" />
<meta property="og:title" content="BMW 535d Touring 2008 - €4900" />
<meta property="og:description" content="Diesel, Automatic, 248 000 km, Geel" />
<meta property="og:image" content="https://lyvox.be/images/ad1234-1.jpg" />
<meta name="twitter:card" content="summary_large_image" />
```

---

## 9. Next-Gen SEO Benefits

- Google rich snippets for listings
- ChatGPT / Grok / Perplexity can recommend LyVoX listings directly in chat results
- Cross-language discoverability (nl-BE / fr-BE / en / ru)
- Structured data ready for future AI Search APIs

---

## 10. TODO

- Implement JSON-LD generator per advert type
- Add AI Discovery feed endpoints
- Add sitemap.xml + hreflang alternates
- Extend robots.txt with AI bots
- Add Organization schema to homepage
- QA test via Google Rich Results & Schema.org Validator

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](../development/MASTER_CHECKLIST.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md) • [FINAL_COMPLETION_REPORT.md](../catalog/FINAL_COMPLETION_REPORT.md) • [IMPLEMENTATION_SUMMARY.md](../catalog/IMPLEMENTATION_SUMMARY.md)
