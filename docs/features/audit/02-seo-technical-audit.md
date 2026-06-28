# LyVoX — SEO / технический аудит

Дата: 2026-06-27 · Аудитор: SEO/технический · Источник: live (`_live-capture-notes.md`) + аудит кода `C:\LyvoxMarketPlace`
Стек: Next.js 16 (App Router), Supabase, i18n NL/FR/EN/DE/RU. Прод-домен: `www.lyvox.be`.

Все находки подтверждены по коду. Пути файлов абсолютные. Поля/теги/ключи — на английском.

---

## 0. TL;DR — приоритеты

| # | P | Находка | Файл |
|---|---|---------|------|
| 1 | **P0** | `metadataBase` не задан → относительные OG (`/lyvox.svg`) не резолвятся в абсолютные | `apps/web/src/app/layout.tsx` |
| 2 | **P0** | `NEXT_PUBLIC_SITE_URL="https://www.lyvox.be/"` с trailing slash → canonical `//ad/` | `.env*`, `ad/[id]/page.tsx:32`, `seo/catalog/common.ts:48` |
| 3 | **P0** | og:image на home = SVG (соц-сети не рендерят SVG) | `apps/web/src/app/layout.tsx:66-79` |
| 4 | **P0** | og:image на `/ad/*` = подписанный Supabase-URL с истекающим токеном | `ad/[id]/page.tsx:270`, `loadAdvertData` (`signMediaUrls`) |
| 5 | **P0** | Нет `sitemap.ts`, `robots.ts`, `robots.txt`, `sitemap.xml` | `apps/web/src/app/*`, `apps/web/public/*` (пусто) |
| 6 | **P1** | Одинаковый title `LyVoX` на home/discover/search/category (нет per-page `generateMetadata`) | `app/page.tsx`, `search/page.tsx`, `c/[...path]/page.tsx`, `discover/page.tsx` |
| 7 | **P1** | Canonical отсутствует на home/search/discover/category | те же файлы |
| 8 | **P1** | Meta description генерик/одинаков на всех страницах | i18n `app.description` |
| 9 | **P1** | hreflang через `?lang=`, нет `x-default`, нет per-page alternates | `layout.tsx:36-42` |
| 10 | **P1** | Search/Discover индексируемы, хотя должны быть `noindex` | `search/page.tsx`, `discover/page.tsx` |
| 11 | **P1** | Нет WebSite+SearchAction; Organization JSON-LD неполный (logo=favicon.ico) | `app/page.tsx:268-275` |
| 12 | **P1** | JSON-LD Product: `seller` = заглушка «LyVoX seller»; нет priceValidUntil/hasMerchantReturnPolicy | `ad/[id]/page.tsx:518-544` |
| 13 | **P2** | Сырые `<img>` в карточках каталога/деки/поиска → CWV (LCP/CLS) | `ad-card.tsx:91`, `SwipeCard.tsx:47`, `SearchBar.tsx` |
| 14 | **P2** | og:locale=ru при cookie; нет `openGraph.url`/`siteName` в root | `layout.tsx:61-74` |
| 15 | **P2** | Нет `manifest.ts` (PWA/иконки) | `apps/web/src/app/*` |
| 16 | **P2** | Дублирующий canonical-хелпер `generateCanonicalUrl()` не используется (тот же баг) | `seo/catalog/common.ts:48-54` |

> Прим.: обнаружены ДВА middleware — `apps/web/middleware.ts` (i18n+session) и `apps/web/src/middleware.ts` (route-protection). В Next.js активен ровно один (корень проекта приложения). Это **не SEO-баг**, но требует проверки командой — один из них может не выполняться.

---

## 1. Метаданные (title / description / canonical / robots)

### 1.1. Текущее состояние

| Страница | title | description | canonical | generateMetadata |
|----------|-------|-------------|-----------|------------------|
| Home `/` | `LyVoX` (root) | generic (root) | **нет** | нет (наследует root) |
| Search `/search` | `LyVoX` (root) | generic | **нет** | **нет** (`"use client"`!) |
| Discover `/discover` | `LyVoX` (root) | generic | **нет** | нет |
| Category `/c/*` | `LyVoX` (root) | generic | **нет** | нет |
| Ad `/ad/:id` | title объявления (ОК) | description (ОК, truncate 160) | `//ad/...` (баг) | да |

Корень: `apps/web/src/app/layout.tsx` задаёт единый `title`/`description` из i18n (`messages.app.title`/`app.description`). Дочерние страницы (кроме `/ad`) **не переопределяют metadata** → дубли title/description по всему сайту — Google схлопнет их и понизит релевантность.

`search/page.tsx` объявлен как `"use client"` — экспорт `generateMetadata` из клиентского компонента невозможен. Чтобы добавить metadata, нужно вынести клиентскую логику в дочерний компонент, а сам `page.tsx` сделать серверным с `generateMetadata`.

### 1.2. Рекомендация — title-шаблон (per-page + per-locale)

Ввести шаблон через root `title.template` и per-page `title.default`/absolute:

```ts
// apps/web/src/app/layout.tsx (фрагмент generateMetadata)
const SITE_NAME = "LyVoX";
return {
  metadataBase: new URL(getSiteUrl()),         // см. §2.1
  title: {
    default: messages?.app?.title ?? SITE_NAME, // home
    template: `%s · ${SITE_NAME}`,              // дочерние: "BMW in België · LyVoX"
  },
  ...
};
```

Дочерние страницы задают только смысловую часть (`%s` подставит ` · LyVoX`):

| Страница | title (пример NL) | title (FR) | title (EN) |
|----------|-------------------|-----------|-----------|
| Home | `LyVoX — Kopen en verkopen met vertrouwen in België` | `LyVoX — Acheter et vendre en confiance en Belgique` | `LyVoX — Buy & sell with trust in Belgium` |
| Category transport | `Auto's & transport in België` | `Voitures & transport en Belgique` | `Cars & transport in Belgium` |
| Ad | `{title}` (как сейчас) | `{title}` | `{title}` |

Бельгийские ключи для NL/FR (вписать в i18n category-name/desc):
- NL: `tweedehands`, `te koop`, `kopen`, `verkopen`, `gratis`, `auto's`, `in België`, `betrouwbare verkopers`.
- FR: `occasion`, `à vendre`, `acheter`, `vendre`, `gratuit`, `voitures`, `en Belgique`, `vendeurs vérifiés`.

### 1.3. Description

Заменить generic `app.description` на per-page:
- Home (NL): `Koop en verkoop veilig op LyVoX — geverifieerde verkopers, moderatie tegen oplichting, lokaal in België.`
- Category: `{categoryName} kopen en verkopen in België. Geverifieerde verkopers, veilige chat, lokaal.`
- Ad: уже ОК (`truncateDescription(description, 160)`).

### 1.4. robots meta

- **Pre-launch:** если каталог пуст (4 тестовых объявления), временно поставить site-wide `noindex` через root metadata `robots: { index: false }` ИЛИ через `robots.ts` (`disallow: "/"`), чтобы Google не проиндексировал «тестовый» сайт. Снять при запуске с реальным контентом.
- **Постоянно `noindex`** (даже после запуска):
  - `/search` (бесконечные параметрические комбинации — краулер-ловушка),
  - `/discover` (персонализированный, пустой для краулера),
  - `/login`, `/register`, `/post`, `/profile/*`, `/chat/*`, `/admin/*`, `/api/*`.
- **Индексировать:** `/`, `/c/*` (категории), `/ad/:id/:slug` (объявления), legal-страницы.

```ts
// пример: search/page.tsx (после выноса клиентской части)
export const metadata: Metadata = { robots: { index: false, follow: true } };
```

### 1.5. Canonical fix (двойной слеш) — КОРЕНЬ

Причина: `NEXT_PUBLIC_SITE_URL="https://www.lyvox.be/"` (trailing slash) + конкатенация `${BASE_URL}/ad/...`.
Лучшее решение — нормализовать baseURL в одном хелпере и использовать его везде (вместо инлайн-конкатенации в `ad/[id]/page.tsx` и дубль-хелпера `generateCanonicalUrl`):

```ts
// apps/web/src/lib/seo/siteUrl.ts  (новый файл)
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://www.lyvox.be";
  return raw.replace(/\/+$/, ""); // срезать все завершающие слеши
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
```

Заменить в `ad/[id]/page.tsx`:
```ts
// было: const canonical = `${BASE_URL}/ad/${advertData.advert.id}/${slug}`;
const canonical = absoluteUrl(`/ad/${advertData.advert.id}/${slug}`);
```
И исправить `seo/catalog/common.ts:48-54` (`generateCanonicalUrl`) через `absoluteUrl`, либо удалить как мёртвый код.
Дополнительно: задать `metadataBase` (§2.1) — тогда даже относительный canonical резолвится корректно.

---

## 2. Open Graph / Twitter

### 2.1. metadataBase — P0

В `layout.tsx` **нет `metadataBase`**. Без него Next.js не превращает относительные пути (`/lyvox.svg`, `/og/...`) в абсолютные URL → соц-сети получают битые относительные OG/canonical, плюс build-warning. Добавить:
```ts
metadataBase: new URL(getSiteUrl()),
```

### 2.2. og:image home — SVG → стабильный PNG 1200×630 — P0

Сейчас (`layout.tsx:66-79`): `images: [{ url: "/lyvox.svg", 1024×1024 }]` + twitter `images: ["/lyvox.svg"]`. Соц-сети (FB/LinkedIn/WhatsApp/X) **не рендерят SVG**. Нужно:
1. Положить статический `apps/web/public/og/default-1200x630.png` (брендовый, 1200×630).
2. В root metadata:
```ts
openGraph: {
  type: "website",
  siteName: "LyVoX",
  url: getSiteUrl(),
  locale: ogLocale(locale),           // см. §3.3
  images: [{ url: "/og/default-1200x630.png", width: 1200, height: 630, alt: "LyVoX" }],
},
twitter: { card: "summary_large_image", images: ["/og/default-1200x630.png"] },
```
(Опционально позже — динамический `opengraph-image.tsx` через `next/og`.)

### 2.3. og:image `/ad/*` — подписанный URL → публичный PNG — P0

Сейчас `ad/[id]/page.tsx:270` берёт `primaryImage.url`, который в `loadAdvertData` пропущен через `signMediaUrls` → подписанный Supabase-URL с истекающим токеном. После экспирации превью отвалится; краулер закэширует битую картинку.
Исправление: для OG/JSON-LD использовать **публичный** storage-URL (bucket `storage/v1/object/public/...`), а подписанные — только для приватной галереи в UI.
```ts
// для OG: построить публичный URL из media path, не signedUrl
const ogImage = primaryImage ? publicMediaUrl(primaryImage.path) : "/og/default-1200x630.png";
```
Если объявления хранятся в публичном бакете — достаточно отдать сырой public URL. Если в приватном — нужен либо публичный превью-вариант, либо OG fallback на дефолтный PNG.

### 2.4. Прочее OG — P2

- Root OG не задаёт `url` и `siteName` → добавить.
- `og:locale=ru` появляется при cookie `locale=ru`; для BE дефолт лучше `nl_BE`/`fr_BE` (см. §3).

---

## 3. hreflang / i18n SEO

### 3.1. Текущее

`layout.tsx:36-42` задаёт `alternates.languages` через query-параметр `?lang=xx`:
```
en → https://lyvox.be/?lang=en   (без www, hardcoded домен!)
```
Проблемы:
- Домен hardcoded `https://lyvox.be` (без `www`) — расходится с прод `www.lyvox.be` → mismatch canonical/hreflang.
- Локализация только query-параметром на home; **на дочерних страницах alternates отсутствуют** (наследуется только root).
- **Нет `x-default`**.
- Query-based i18n (`?lang=`) — слабее path-based (`/nl/`, `/fr/`) для SEO; Google хуже различает версии.

### 3.2. Рекомендация

Краткосрочно (без рефакторинга роутинга) — сделать alternates per-page и добавить x-default, через хелпер, привязанный к текущему пути:
```ts
function buildAlternates(pathname: string) {
  const langs = ["en","nl","fr","de","ru"] as const;
  const languages = Object.fromEntries(
    langs.map((l) => [hreflangTag(l), absoluteUrl(`${pathname}?lang=${l}`)]),
  );
  return {
    canonical: absoluteUrl(pathname),
    languages: { ...languages, "x-default": absoluteUrl(pathname) },
  };
}
// hreflangTag: en→en, nl→nl-BE, fr→fr-BE, de→de-DE, ru→ru
```
Использовать `www`-домен через `getSiteUrl()` (НЕ hardcoded `lyvox.be`).

Среднесрочно (рекомендуется) — перейти на **path-based locale** (`/nl/...`, `/fr/...`) через middleware + `[locale]` segment. Это даёт чистые per-locale URL, корректные canonical/hreflang и индексируемость каждой языковой версии.

### 3.3. Дефолтная локаль для BE

`middleware.ts:6` `defaultLocale = "en"`. Для Бельгии нейтральнее запускать с `nl`/`fr` по `Accept-Language`/гео (NL и FR — официальные языки BE; EN — только фолбэк). Рекомендация: `x-default` → EN, но при отсутствии cookie резолвить `nl-BE`/`fr-BE` из `Accept-Language` (уже частично есть), а гео-BE → `nl` по умолчанию.
`ogLocale`: en→`en_US`, nl→`nl_BE`, fr→`fr_BE`, de→`de_DE`, ru→`ru_RU`.

---

## 4. Discoverability — sitemap / robots / manifest

Подтверждено: `apps/web/src/app/{sitemap,robots,manifest}.ts` отсутствуют; `apps/web/public/` пуст (нет `robots.txt`/`sitemap.xml`). middleware уже исключает `robots.txt`/`sitemap.xml` из matcher — значит инфраструктура ждёт эти файлы.

### 4.1. `app/robots.ts` — P0

```ts
// apps/web/src/app/robots.ts
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  // PRE-LAUNCH: пока каталог тестовый — закрыть весь сайт:
  // return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/", "/admin/", "/profile/", "/chat/",
          "/login", "/register", "/post", "/discover", "/search",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
```

### 4.2. `app/sitemap.ts` (динамический) — P0

```ts
// apps/web/src/app/sitemap.ts
import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/siteUrl";
import { generateSlug } from "@/lib/seo/catalog/common";
import { supabaseService } from "@/lib/supabaseService";

export const revalidate = 3600; // пересборка раз в час

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const svc = await supabaseService();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`,            changeFrequency: "daily",  priority: 1.0 },
    { url: `${base}/c`,           changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/legal/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Категории
  const { data: cats } = await svc
    .from("categories")
    .select("path, updated_at")
    .eq("is_active", true);
  const categoryRoutes: MetadataRoute.Sitemap = (cats ?? []).map((c) => ({
    url: `${base}/c/${c.path}`,
    lastModified: c.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Активные объявления (пагинация при большом объёме — sitemap index)
  const { data: ads } = await svc
    .from("adverts")
    .select("id, title, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50000); // лимит одного sitemap-файла
  const adRoutes: MetadataRoute.Sitemap = (ads ?? []).map((a) => ({
    url: `${base}/ad/${a.id}/${generateSlug(a.title)}`,
    lastModified: a.created_at ?? undefined,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...adRoutes];
}
```
При >50k URL — перейти на sitemap index (`generateSitemaps`).

### 4.3. `app/manifest.ts` — P2

```ts
// apps/web/src/app/manifest.ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LyVoX",
    short_name: "LyVoX",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#11bdf9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```
(Нужны PNG-иконки в `public/icons/`; сейчас иконки — только SVG.)

---

## 5. Structured data (JSON-LD)

### 5.1. `/ad/*` — есть, но неполно (P1)

`ad/[id]/page.tsx:512-544` отдаёт **BreadcrumbList** (полный, ОК) и **Product/Car** с `offers`. Что доработать:
- `seller` = заглушка `{ "@type": "Organization", name: "LyVoX seller" }` — заменить на реальное имя продавца или убрать (иначе вводит в заблуждение / rich-results warning).
- `image` использует подписанные URL (см. §2.3) — для JSON-LD дать публичные.
- В `offers` добавить: `priceValidUntil`, `url` (уже есть), `itemCondition` (есть на Product-уровне — перенести/продублировать в offer), и для valid Product добавить либо `aggregateRating`/`review`, либо опустить (иначе Google merchant warning).
- Для авто (`@type: Car`) — добавить `vehicleModelDate`, `mileageFromOdometer`, `vehicleTransmission` из specifics (улучшает rich-results для авто).

### 5.2. Home — добавить WebSite + SearchAction (P1)

Сейчас (`app/page.tsx:268-275`) только **Organization** (logo=`favicon.ico` — лучше PNG). Добавить:
```ts
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "LyVoX",
  url: getSiteUrl(),
  inLanguage: ["nl-BE","fr-BE","en","de","ru"],
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${getSiteUrl()}/search?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};
const organizationJsonLd = {
  "@context": "https://schema.org", "@type": "Organization",
  name: "LyVoX", url: getSiteUrl(),
  logo: `${getSiteUrl()}/og/logo-512.png`,  // PNG, не favicon.ico
};
```
Категории `/c/*` — добавить **BreadcrumbList** (данные для крошек уже строятся в `buildCategoryBreadcrumbs`).

---

## 6. Производительность / Core Web Vitals (влияние на SEO)

| Находка | Файл | Влияние |
|---------|------|---------|
| Сырой `<img>` в карточке каталога | `apps/web/src/components/ad-card.tsx:91` | Нет AVIF/WebP/srcset/lazy → LCP↑, CLS (нет width/height) |
| Сырой `<img>` в карточке деки | `apps/web/src/components/discover/SwipeCard.tsx:47` | то же |
| Сырой `<img>` в SearchBar (превью) | `apps/web/src/components/SearchBar.tsx:297/428/552` | минорно (мелкие превью) |
| Медленная загрузка каталога/фильтров | home, `/search` | Спиннеры до first paint результатов; зависимость от загрузки схемы фильтров |

`next.config.ts` уже корректно настроен под `next/image` (avif/webp, deviceSizes, remotePatterns на supabase public). Проблема — карточки **не используют** `next/image`.

Рекомендации:
- Заменить `<img>` на `next/image` в `ad-card.tsx` и `SwipeCard.tsx` (с `width`/`height` или `fill` + `sizes`, `loading="lazy"` для below-the-fold, `priority` для первого ряда LCP).
- ВАЖНО: `next/image` работает только с **публичными** URL (remotePatterns = supabase public). Подписанные URL с токеном через оптимизатор не пройдут → ещё один довод за публичные media-URL (§2.3).
- Кэшировать схему категорий/фильтров (сейчас «Загрузка категорий…» виден на home и `/search`).
- Home: рассмотреть серверный рендер первого ряда витрины (LCP) вместо клиентских спиннеров.

---

## 7. Технические заметки (не SEO-критично, к проверке)

- **Два middleware:** `apps/web/middleware.ts` (i18n+session) и `apps/web/src/middleware.ts` (route-protection). Next.js использует ровно один. Проверить, какой активен — иначе либо i18n, либо защита роутов не выполняется.
- **CSP в Report-Only** (`next.config.ts:73`) — не блокирует. Промоутить до `Content-Security-Policy` после валидации (вне SEO-скоупа, см. security-аудит).
- **Дубль canonical-логики:** инлайн в `ad/[id]/page.tsx` + `generateCanonicalUrl()` в `common.ts` — свести к одному `absoluteUrl()`.

---

## 8. План внедрения (по приоритету)

**P0 (до индексации / запуска):**
1. Создать `lib/seo/siteUrl.ts` (`getSiteUrl`/`absoluteUrl`), задать `metadataBase` в `layout.tsx`.
2. Исправить canonical `/ad/*` через `absoluteUrl` (убрать `//ad/`).
3. Заменить og:image: статический PNG 1200×630 для home; публичный media-URL (или fallback PNG) для `/ad/*`.
4. Добавить `app/robots.ts` + `app/sitemap.ts` (динамический). На pre-launch — `noindex`/`disallow: /` пока каталог тестовый.

**P1:**
5. Per-page `generateMetadata` для home/category (title-шаблон `%s · LyVoX`, локализованные description с BE-ключами).
6. `noindex` для `/search`, `/discover` (вынести `search/page.tsx` в server+client split).
7. Per-page alternates + `x-default`, домен через `getSiteUrl()` (убрать hardcoded `lyvox.be`).
8. WebSite+SearchAction на home; доработать Product JSON-LD (seller, публичные image, offer-поля); BreadcrumbList на `/c/*`.

**P2:**
9. `next/image` в `ad-card.tsx`/`SwipeCard.tsx` (CWV).
10. `app/manifest.ts` + PNG-иконки.
11. Удалить дубль `generateCanonicalUrl`; разобраться с двумя middleware.
12. Среднесрочно: path-based locale (`/nl/`, `/fr/`).
