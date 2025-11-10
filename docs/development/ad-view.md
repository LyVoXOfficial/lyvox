# Страница просмотра объявления

## MVP Scope

### Структура страницы

| Секция              | Компонент       | Описание                                 |
| ------------------- | --------------- | ---------------------------------------- |
| Hero                | `AdvertGallery` | Галерея изображений с lightbox           |
| Основная информация | -               | Заголовок, цена, локация, дата           |
| Описание            | -               | Markdown support, line breaks            |
| Характеристики      | `AdvertDetails` | Таблица атрибутов из `ad_item_specifics` |
| Продавец            | `SellerCard`    | Профиль, trust score, верификации        |
| Похожие             | -               | Блок похожих объявлений                  |
| Действия            | -               | Пожаловаться, Поделиться, В избранное    |

## URL Schema

**Формат:**

```
/ad/[id]/[slug]
```

**Пример:**

```
/ad/550e8400-e29b-41d4-a716-446655440000/bmw-535d-touring-2008
```

**Генерация slug:**

```typescript
function generateSlug(title: string): string {
  return transliterate(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100); // Max length
}
```

## Components

| Компонент      | Путь                                         | Описание                |
| -------------- | -------------------------------------------- | ----------------------- |
| AdvertPage     | `apps/web/src/app/ad/[id]/page.tsx`          | SSR страница объявления |
| AdvertGallery  | `apps/web/src/components/AdvertGallery.tsx`  | Галерея с lightbox      |
| AdvertDetails  | `apps/web/src/components/AdvertDetails.tsx`  | Таблица характеристик   |
| SellerCard     | `apps/web/src/components/SellerCard.tsx`     | Карточка продавца       |
| ReportDialog   | `apps/web/src/components/ReportDialog.tsx`   | Модалка жалобы          |
| SimilarAdverts | `apps/web/src/components/SimilarAdverts.tsx` | Похожие объявления      |

## AdvertGallery

**Требования:**

- Минимум 1 фото, максимум 12
- Fullscreen lightbox при клике
- Swipe gestures (mobile)
- Thumbnail navigation
- Zoom (pinch-to-zoom на mobile)

**Implementation:**

```typescript
// Использовать библиотеку типа react-image-gallery или photo-swipe
import ImageGallery from "react-image-gallery";

const images = media.map((m) => ({
  original: m.url,
  thumbnail: m.url,
}));
```

## Форматирование цены

**По локали:**

```typescript
function formatPrice(price: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

// Примеры:
// EUR, nl: "4.900 €"
// EUR, fr: "4 900 €"
// RUB, ru: "4 900 ₽"
```

## Контакт

**Защита от ботов:**

- Кнопка "Показать телефон" требует авторизации
- Или использование CAPTCHA для гостей
- Rate limiting на запросы контакта

**API:**

```typescript
POST / api / adverts / [id] / request - contact;
// Логирует запрос, возвращает телефон если разрешено
```

## Карта локации

**Условия показа:**

- Если `location_id` заполнен (есть PostGIS `point`)
- Отображение маркера на карте
- Интеграция: Mapbox или Google Maps

**Implementation:**

```typescript
{advert.location_id && (
  <MapboxMap
    center={[lng, lat]}
    zoom={12}
    marker={{ lng, lat, label: advert.location }}
  />
)}
```

## Похожие объявления

**Критерии:**

- Та же категория
- Похожий ценовой диапазон (±20%)
- Исключить объявления того же продавца

**Query:**

```sql
SELECT * FROM public.adverts
WHERE category_id = $1
  AND price BETWEEN $2 * 0.8 AND $2 * 1.2
  AND user_id != $3
  AND status = 'active'
ORDER BY created_at DESC
LIMIT 6;
```

## Социальные шаринги

**Платформы:**

- WhatsApp: `https://wa.me/?text={encoded_url}`
- Facebook: `https://www.facebook.com/sharer/sharer.php?u={url}`
- Twitter: `https://twitter.com/intent/tweet?text={title}&url={url}`
- Копировать ссылку: Clipboard API

## SEO

### JSON-LD Schema

**Для транспортных средств:**

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
  "mileageFromOdometer": {
    "@type": "QuantitativeValue",
    "value": 248000,
    "unitCode": "KM"
  },
  "price": 4900,
  "priceCurrency": "EUR",
  "offers": {
    "@type": "Offer",
    "availability": "https://schema.org/InStock",
    "url": "https://lyvox.be/ad/..."
  },
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Geel",
    "addressCountry": "BE"
  },
  "image": ["https://lyvox.be/images/..."],
  "seller": {
    "@type": "Person",
    "name": "Display Name"
  }
}
```

### OpenGraph Tags

```html
<meta property="og:type" content="product" />
<meta property="og:title" content="BMW 535d Touring 2008 - €4900" />
<meta property="og:description" content="Diesel, Automatic, 248 000 km, Geel" />
<meta property="og:image" content="https://lyvox.be/images/ad1234-1.jpg" />
<meta property="og:price:amount" content="4900" />
<meta property="og:price:currency" content="EUR" />
```

## Чек-лист MVP

- [ ] Галерея: минимум 1 фото, max 12, fullscreen lightbox, swipe gestures
- [ ] Цена: форматирование по локали (EUR: 4.900 €, руб: 4 900 ₽)
- [ ] Контакт: кнопка "Показать телефон" (защита от ботов, требует auth или captcha)
- [ ] Карта локации (опционально, если `location_id` заполнен)
- [ ] Блок похожих объявлений (same category, similar price range)
- [ ] Социальные шаринги (WhatsApp, Facebook, Twitter, копировать ссылку)
- [ ] Breadcrumbs: Home > Category > Subcategory > Ad Title
- [ ] JSON-LD Schema для SEO
- [ ] OpenGraph tags
- [ ] hreflang alternates

## TODO for developers

1. **Создать компонент AdvertGallery**
   - [x] Интеграция библиотеки (react-image-gallery или photo-swipe)
   - [x] Lightbox функциональность
   - [x] Swipe gestures для mobile
   - [x] Thumbnail navigation
   - [x] Zoom функциональность

2. **Реализовать SSR страницу объявления**
   - [ ] Загрузка данных через `supabaseServer()`
   - [ ] Генерация slug из title (или использовать существующий)
   - [ ] 404 если объявление не найдено или не активно
   - [ ] SEO metadata generation

3. **Создать компонент AdvertDetails**
   - [ ] Парсинг `ad_item_specifics.specifics` (JSON)
   - [ ] Таблица характеристик
   - [ ] Локализация названий полей

4. **Создать компонент SellerCard**
   - [ ] Отображение профиля продавца
   - [ ] Trust score badge
   - [ ] Верификации (email/phone)
   - [ ] Ссылка на другие объявления продавца

5. **Реализовать блок похожих объявлений**
   - [ ] Query для поиска похожих
   - [ ] Компонент `SimilarAdverts.tsx`
   - [ ] Grid layout с карточками

6. **Добавить социальные шаринги**
   - [ ] Кнопки шаринга (WhatsApp, Facebook, Twitter)
   - [ ] "Копировать ссылку" через Clipboard API
   - [ ] Toast уведомление при копировании

7. **Реализовать SEO элементы**
   - [ ] JSON-LD Schema генерация
   - [ ] OpenGraph tags
   - [ ] Canonical URL
   - [ ] hreflang alternates

8. **Добавить карту локации**
   - [ ] Интеграция Mapbox или Google Maps
   - [ ] Отображение маркера
   - [ ] Показ только если `location_id` заполнен

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [user-profile.md](./user-profile.md) • [database-schema.md](./database-schema.md) • [security-compliance.md](./security-compliance.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)
