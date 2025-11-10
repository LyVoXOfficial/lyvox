# SEO / Sitemap / OpenGraph

## Current State

См. также: `../domains/seo.md`

Базовая SEO структура уже документирована. Этот документ дополняет деталями реализации.

## Metadata (per page)

### Implementation

**Helper функция:**
```typescript
// apps/web/src/lib/seo/generateMetadata.ts
export async function generateMetadata({
  title,
  description,
  locale,
  image,
  url
}: MetadataParams): Promise<Metadata> {
  return {
    title: `${title} - LyVoX`,
    description,
    alternates: {
      languages: {
        nl: `https://lyvox.be/nl${url}`,
        fr: `https://lyvox.be/fr${url}`,
        en: `https://lyvox.be/en${url}`,
        ru: `https://lyvox.be/ru${url}`,
        'x-default': `https://lyvox.be${url}`
      }
    },
    openGraph: {
      type: 'website',
      title,
      description,
      images: [{ url: image }],
      locale,
      alternateLocale: ['nl_BE', 'fr_BE', 'en_US', 'ru_RU'],
      url: `https://lyvox.be${url}`
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image]
    }
  };
}
```

### Per Page Metadata

**Главная страница:**
```typescript
export const metadata = {
  title: 'LyVoX - Marketplace Belgium',
  description: 'Buy and sell in Belgium. Free classifieds for cars, electronics, real estate and more.',
  // ...
};
```

**Страница объявления:**
```typescript
export async function generateMetadata({ params }: Props) {
  const advert = await getAdvert(params.id);
  return generateMetadata({
    title: advert.title,
    description: advert.description?.slice(0, 160),
    image: advert.media[0]?.url,
    url: `/ad/${advert.id}/${advert.slug}`,
    locale: getLocale()
  });
}
```

## Sitemap

**Файл:** `apps/web/src/app/sitemap.ts`

**Генерация:**
```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://lyvox.be';
  const locales = ['nl', 'fr', 'en', 'ru'];
  
  // Статические страницы
  const staticPages = [
    { url: '/', priority: 1.0 },
    { url: '/about', priority: 0.8 },
    // ...
  ].flatMap(page => 
    locales.map(locale => ({
      url: `${baseUrl}/${locale}${page.url}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: page.priority,
      alternates: {
        languages: Object.fromEntries(
          locales.map(l => [l, `${baseUrl}/${l}${page.url}`])
        )
      }
    }))
  );
  
  // Категории
  const categories = await getCategories();
  const categoryPages = categories.flatMap(cat =>
    locales.map(locale => ({
      url: `${baseUrl}/${locale}/c/${cat.path}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7
    }))
  );
  
  // Объявления (только active, последние 10k)
  const adverts = await getActiveAdverts(10000);
  const advertPages = adverts.flatMap(ad =>
    locales.map(locale => ({
      url: `${baseUrl}/${locale}/ad/${ad.id}/${ad.slug}`,
      lastModified: ad.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.6
    }))
  );
  
  return [...staticPages, ...categoryPages, ...advertPages];
}
```

## Robots.txt

**Файл:** `apps/web/public/robots.txt`

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /(protected)/

# AI crawlers
User-agent: ChatGPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /

Sitemap: https://lyvox.be/sitemap.xml
```

## JSON-LD Schema

**Helper функция:**
```typescript
// apps/web/src/lib/seo/generateJsonLd.ts
export function generateProductSchema(advert: Advert): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: advert.title,
    description: advert.description,
    image: advert.media.map(m => m.url),
    offers: {
      '@type': 'Offer',
      price: advert.price,
      priceCurrency: advert.currency || 'EUR',
      availability: advert.status === 'active' 
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `https://lyvox.be/ad/${advert.id}/${advert.slug}`
    },
    seller: {
      '@type': 'Person',
      name: advert.seller.display_name
    }
  };
  
  // Для транспортных средств
  if (advert.category.path.startsWith('transport/')) {
    schema['@type'] = 'Car';
    schema.brand = { '@type': 'Brand', name: advert.specifics.make };
    schema.model = advert.specifics.model;
    // ... остальные поля
  }
  
  return JSON.stringify(schema);
}
```

**Использование в странице:**
```typescript
export default function AdvertPage({ params }: Props) {
  const advert = await getAdvert(params.id);
  const jsonLd = generateProductSchema(advert);
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      {/* ... */}
    </>
  );
}
```

## AI Discovery Feed

**Endpoint:** `/api/public/feed/vehicles`

**Response:**
```json
{
  "type": "Feed",
  "version": "1.0",
  "updated": "2025-01-01T00:00:00Z",
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
      "model": "535d",
      "year": 2008,
      "mileage": 248000
    }
  ]
}
```

**Реализация:**
```typescript
// apps/web/src/app/api/public/feed/vehicles/route.ts
export async function GET() {
  const adverts = await getActiveVehicleAdverts();
  
  return Response.json({
    type: 'Feed',
    version: '1.0',
    updated: new Date().toISOString(),
    items: adverts.map(ad => ({
      id: ad.id,
      url: `https://lyvox.be/ad/${ad.id}/${ad.slug}`,
      title: ad.title,
      price: ad.price,
      currency: ad.currency,
      location: ad.location,
      category: 'cars',
      brand: ad.specifics.make,
      model: ad.specifics.model,
      year: ad.specifics.year,
      mileage: ad.specifics.mileage
    }))
  });
}
```

## Чек-лист MVP

- [ ] Metadata на всех страницах
- [ ] OpenGraph tags
- [ ] JSON-LD Schema для объявлений
- [ ] Sitemap.xml с hreflang
- [ ] Robots.txt
- [ ] AI discovery feeds
- [ ] Structured data валидация (Google Rich Results Test)

## TODO for developers

1. **Создать helper функции**
   - [ ] `generateMetadata.ts` - генерация metadata
   - [ ] `generateJsonLd.ts` - генерация JSON-LD
   - [ ] Тестирование на всех типах страниц

2. **Реализовать sitemap.ts**
   - [ ] Генерация статических страниц
   - [ ] Генерация категорий
   - [ ] Генерация объявлений (только active)
   - [ ] hreflang для каждой страницы

3. **Создать robots.txt**
   - [ ] Правила для разных user-agents
   - [ ] Disallow для admin/api/protected
   - [ ] Sitemap ссылка

4. **Добавить JSON-LD на страницы**
   - [ ] Organization schema на homepage
   - [ ] Product/Car schema на страницах объявлений
   - [ ] BreadcrumbList для навигации

5. **Реализовать AI discovery feeds**
   - [ ] `/api/public/feed/vehicles` endpoint
   - [ ] `/api/public/feed/all` endpoint (опционально)
   - [ ] Форматирование данных

6. **Валидация**
   - [ ] Google Rich Results Test
   - [ ] Schema.org Validator
   - [ ] OpenGraph Debugger
   - [ ] Исправление ошибок

7. **Оптимизация**
   - [ ] Кэширование sitemap (revalidate 3600s)
   - [ ] Лимит на количество объявлений в sitemap (10k)
   - [ ] Индексация только актуальных объявлений

---

## 🔗 Related Docs

**Domains:** [seo.md](../domains/seo.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md) • [FINAL_COMPLETION_REPORT.md](../catalog/FINAL_COMPLETION_REPORT.md) • [IMPLEMENTATION_SUMMARY.md](../catalog/IMPLEMENTATION_SUMMARY.md)




