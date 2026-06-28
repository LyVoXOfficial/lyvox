# SEO-ревью PRD LyVoX (роль: старший технический SEO)

Дата: 2026-06-28 · Ревьюер: SEO (маркетплейсы, многоязычность, локальный SEO BE NL/FR)
Зона ревью: PRD 33, 42, 62, 57, 31, 32 + сквозные SEO-требования.
База: `features/audit/02-seo-technical-audit.md` (учтены все находки P0/P1/P2).
Прод-домен: `www.lyvox.be`. Стек: Next.js 16 (App Router), Supabase, i18n NL/FR/EN/DE/RU.

Поля/теги/атрибуты/схемы — английский. Остальное — русский.

> **Главный системный вывод ревью:** PRD написаны с упоминанием SEO одной-двумя строками («hreflang», «OG»), но **SEO не встроен в acceptance-критерии**. Ни один из 6 PRD сегодня нельзя подписать со стороны SEO без дополнения раздела «SEO by design» (метаданные per-locale, JSON-LD per категория, вклад в sitemap, индексируемость, перелинковка). Отдельно: в коде **уже есть** per-category JSON-LD генераторы (`lib/seo/catalog/property|job|electronics`), но они **нигде не импортируются** (мёртвый код) — PRD 62 обязан это зафиксировать как requirement, а не «новую разработку с нуля».

---

## 0. Сквозные SEO-требования (cross-cutting) — вписать в каждый PRD

Эти требования общие; в каждом PRD ниже даю дельту. Они должны стать частью DoD соответствующих фич.

### 0.1 Базовый SEO-фундамент (предусловие для всех)
Все PRD зоны зависят от фундамента из аудита 02 (P0). Без него любой per-PRD SEO бессмыслен:
- `metadataBase` в `layout.tsx`; хелпер `getSiteUrl()`/`absoluteUrl()` (нормализация trailing slash → фикс `//ad/`).
- `app/robots.ts` + `app/sitemap.ts` (динамический); pre-launch `noindex`.
- og:image PNG 1200×630 (не SVG, не подписанный Supabase-URL).
**SEO-вердикт:** до закрытия P0 из аудита 02 ни один PRD-DoD не считается выполненным.

### 0.2 Шаблон метаданных (per-page + per-locale)
- `title.template = "%s · LyVoX"`; per-page `title` — смысловая часть на языке страницы.
- `description` — уникальный per-страница, per-locale, с бельгийскими ключами (см. 0.3).
- `canonical` — абсолютный, через `absoluteUrl(pathname)`, **на каждой индексируемой странице** (не только `/ad`).
- `alternates.languages` per-page (не только root) + `x-default`; домен `www` через `getSiteUrl()`.
- hreflang-теги: `nl-BE`, `fr-BE`, `en`, `de-DE`, `ru` + `x-default` → EN.

### 0.3 Бельгийские ключевые слова NL/FR (локальный SEO)
Зашить в i18n как переиспользуемые токены для title/description/H1 шаблонов (категории, объявления):
- **NL:** `tweedehands`, `te koop`, `kopen`, `verkopen`, `gratis`, `in België`, `betrouwbare verkopers`, `met garantie`, `lokaal`, `occasie` (часто ищут в Vlaanderen).
- **FR:** `occasion`, `à vendre`, `acheter`, `vendre`, `gratuit`, `en Belgique`, `vendeurs vérifiés`, `de confiance`, `pas cher`, `seconde main`.
- City/region-токены: `Antwerpen/Anvers`, `Gent/Gand`, `Brussel/Bruxelles`, `Liège/Luik`, `Charleroi`, `Brugge/Bruges` — для location-aware заголовков объявлений/категорий.

### 0.4 JSON-LD per категория (главное для rich results)
Каждое индексируемое объявление обязано отдавать **корректный тип schema.org по своей категории** (таблица в §8), а не «Car иначе Product». Использовать существующие генераторы `lib/seo/catalog/*` (доделать недостающие: vehicle, fashion, pets, home, services, giveaway).

### 0.5 Вклад в sitemap
Каждая фича, создающая индексируемый URL (объявление, категория, KB-страница), описывает свой **вклад в `sitemap.ts`**: какие URL, `lastmod`, `changefreq`, `priority`, и условие включения (только `status=active`/`indexable`).

### 0.6 URL-структура с ЧПУ (SEO-friendly)
- Объявление: `/ad/{id}/{slug}` — slug из заголовка (✓ есть `generateSlug`); canonical обязателен (баг двойного слеша из аудита).
- Категория: `/c/{path}` (ЧПУ из category path — ✓ kebab-case в slug категорий).
- **Несоответствие slug → 301** на канонический slug (если id совпал, а slug устарел/изменён). Зафиксировать в PRD 31/62.
- Решить (среднесрочно): path-based locale `/nl/…`, `/fr/…` вместо `?lang=` (PRD 42).

### 0.7 Core Web Vitals (ранжирование)
- `next/image` для всех карточек выдачи/деки/каталога (LCP/CLS). Требует **публичных** media-URL (не подписанных) — пересечение с PRD 31/57/62.
- SSR первого экрана выдачи/каталога (LCP), а не клиентские спиннеры.

---

## 1. PRD 33 — Поиск, фильтры, сортировки

### 1.1 SEO-пробелы
- **Индексируемость не определена.** PRD не говорит, что `/search` должен быть `noindex`. Параметрический поиск (категория × цена × локация × состояние × сортировка) = **бесконечная краулер-ловушка** + дубль-контент. Аудит 02 требует `noindex,follow` для `/search`. PRD молчит → риск, что разработчик оставит индексируемым.
- **`search/page.tsx` — `"use client"`** (подтверждено в коде): `generateMetadata`/`robots` из клиентского компонента невозможны. PRD не упоминает необходимость server/client split, без которого `noindex` физически не выставить.
- **Нет канонизации фасетов.** Не описано, как схлопывать `?sort=`, `?page=` — каноникал должен указывать на «чистую» версию или на категорию.
- **Пагинация (§4 «пагинация/бесконечная лента») без SEO-правил.** Не сказано про rel-канонизацию страниц пагинации, про индексируемость `?page=N`. Для маркетплейса важно: листинг-страницы категории (НЕ search) могут быть индексируемы с самокононикалами на каждую страницу.
- **Раздел §10 «hreflang выдачи»** — пустая декларация: на `noindex`-странице hreflang бессмыслен; противоречие.
- **`SearchAction` (WebSite JSON-LD)** — PRD 33 владеет поиском, но не упоминает, что home должна отдавать `SearchAction` с `urlTemplate` `/search?q={search_term_string}` (sitelinks searchbox). Это его зона ответственности.

### 1.2 Что добавить в PRD (SEO by design)
- Явно: `/search` и `/discover` → `robots: noindex, follow`; убрать из sitemap; в `robots.ts` `disallow: /search`.
- Acceptance: `search/page.tsx` разбит на серверный `page.tsx` (с `export const metadata = { robots:{ index:false }}`) + клиентский дочерний компонент.
- Различить **search (noindex)** vs **категорийные листинги `/c/*` (index, владеет PRD 32)** — поиск не должен порождать индексируемые URL.
- Описать вклад в WebSite+SearchAction (или явно делегировать в фундамент/home-PRD с пометкой «owner: search»).
- Внутренняя перелинковка из zero-result/empty-state на популярные категории (`/c/*`) — это и UX, и SEO-вес.

### 1.3 Вердикт: ⛔ (нет sign-off)
Причина: индексируемость не специфицирована (риск краулер-ловушки), client-component блокирует `noindex`. Блокер до запуска.

---

## 2. PRD 42 — i18n / локализация (hreflang/SEO)

### 2.1 SEO-пробелы
- **hreflang только декларирован, не специфицирован.** §4 «hreflang + per-locale OG/alternateLocale», DoD «hreflang/OG alternates на месте» — без деталей. Аудит 02 нашёл: домен hardcoded `lyvox.be` (без www) → mismatch с `www.lyvox.be`; **нет `x-default`**; alternates только на home, не per-page; `?lang=` слабее path-based.
- **Не зафиксирован формат тегов.** Должно быть `nl-BE`/`fr-BE` (региональные!), а не `nl`/`fr`. Для BE это критично: одни и те же языки в NL/FR странах — регион различает.
- **`og:locale` некорректен.** Аудит: `og:locale=ru` при cookie; нет маппинга `nl→nl_BE`, `fr→fr_BE`. PRD 42 — владелец этого маппинга, но не описывает.
- **defaultLocale=en для BE** — для локального SEO нейтральнее резолвить `nl-BE`/`fr-BE` по `Accept-Language`/гео; PRD это не решает.
- **Дубль-контент при `?lang=`.** Без корректного canonical+hreflang 5 языковых версий одного URL = риск каннибализации. PRD не описывает связку canonical↔hreflang.
- **Локализация slug/URL.** Не решено: один slug на всех языках или per-locale? Для NL/FR SEO лучше локализованные slug категорий (`/c/voitures` vs `/c/auto-s`) — но это большое решение, минимум — зафиксировать как открытый вопрос с рекомендацией.

### 2.2 Что добавить в PRD (SEO by design)
- Хелпер `buildAlternates(pathname)`: per-page languages + `x-default`, домен через `getSiteUrl()` (www), теги `nl-BE/fr-BE/en/de-DE/ru`.
- Маппинг `ogLocale`: `en→en_US, nl→nl_BE, fr→fr_BE, de→de_DE, ru→ru_RU` + `alternateLocale` со всеми остальными.
- Acceptance-тест: на любой индексируемой странице — N hreflang + x-default + self-canonical, все на www-домене (e2e-проверка из §11 усилить: «hreflang присутствует» → «hreflang корректен: www, region-tags, x-default, reciprocal»).
- Бельгийские ключевые токены (0.3) как часть i18n-словаря для SEO-шаблонов (это зона CONTENT+SEO).
- Решение по path-based locale: рекомендация перейти на `/{locale}/` сегмент (среднесрочно) — даёт чистые per-locale индексируемые URL; на старте — минимум корректный `?lang=` + canonical/hreflang.

### 2.3 Вердикт: 🔄 (доработка до sign-off)
Причина: инфраструктура есть, но hreflang-спецификация неполна (region-tags, x-default, www, reciprocity, og:locale-маппинг). Не блокер запуска, но обязательно к доработке.

---

## 3. PRD 62 — Карточки товара по категориям (структурированные данные!)

> Это **ключевой PRD для rich results**. Сейчас раздел SEO в нём отсутствует как класс — §9 упоминает только a11y/i18n. Между тем именно здесь решается, выйдут ли карточки в Google rich results (Vehicle, Product, RealEstate, JobPosting).

### 3.1 SEO-пробелы (критично)
- **Нет раздела structured data.** PRD детально описывает раскладку (вкладки/секции), KB, фикс бага сопоставления — но **ни слова про JSON-LD per категория**. При этом богатые поля карточки (mileage, fuel, EPC, salary) — это ровно те данные, что нужны для rich results, и они описаны, но не маппятся в schema.org.
- **Код: генераторы есть, но мертвы.** `lib/seo/catalog/property.ts` (RealEstateListing), `job.ts` (JobPosting), `electronics.ts` (Product) — **0 импортов** в приложении. Ad-страница (`ad/[id]/page.tsx:518-544`) отдаёт инлайн `Car`/`Product` с заглушкой `"LyVoX seller"`. Транспорт/недвижимость/работа **не получают свой schema.org-тип**, хотя инфраструктура написана. PRD 62 обязан зафиксировать «подключить per-category JSON-LD к ad-странице по domain объявления».
- **Маппинг полей карточки → schema.org нигде не описан.** Карточка показывает `mileage/fuel/transmission/euro_norm/CO₂` — но JSON-LD `Car` их не отдаёт (нет `mileageFromOdometer`, `fuelType`, `vehicleTransmission`, `vehicleEngine`). Аналогично недвижимость (EPC → `energyEfficiencyScaleMin/Max`/`PropertyValue`), работа (salary → `baseSalary`).
- **KB-блок без structured data.** «Об этой модели/породе/районе» — потенциально `FAQPage`/`Article`-разметка (rich result), но KB не размечается. Минимум — pros/cons/common_issues можно дать как `FAQPage` или как `additionalProperty`.
- **Дубль/конфликт JSON-LD при вкладках.** Вкладочная раскладка (контент в скрытых вкладках) — нужно явно: JSON-LD строится из данных (не из DOM), весь контент вкладок доступен в HTML (не lazy-mount), иначе Google не увидит скрытый текст. Зафиксировать: вкладки рендерятся в DOM (CSS-hide), не conditional unmount.
- **`itemCondition` мапится грубо.** Сейчас хардкод `UsedCondition`; PRD имеет `condition(not_damaged/damaged/salvage/new/used)` — нужен явный маппинг в `schema.org` enum (`NewCondition/UsedCondition/RefurbishedCondition/DamagedCondition`).
- **`seller`-заглушка** «LyVoX seller» → rich-results warning + вводит в заблуждение. Должно браться реальное имя продавца (или `Person`/`Organization` по seller_type из PRD 31/40).
- **`offers` неполны:** нет `priceValidUntil`, `itemCondition` внутри offer, `hasMerchantReturnPolicy`/`shippingDetails` (для escrow/доставки — PRD 10/12). Без них — Google Merchant warnings.
- **Изображения JSON-LD — подписанные URL** (истекающий токен) → закэшируется битая картинка. Нужны публичные.

### 3.2 Что добавить в PRD (SEO by design)
Добавить новый раздел «§X Structured data (schema.org) по категориям»:
- Таблица «категория → schema.org type → обязательные/рекомендуемые поля → источник из catalog_fields» (готовая таблица — в §8 этого ревью; вставить в PRD 62).
- Requirement: `ad/[id]/page.tsx` выбирает генератор JSON-LD по `domain` объявления (`getCatalogJsonLd(domain, data, locale)`), реюзая `lib/seo/catalog/*`; дописать недостающие генераторы: `vehicle` (Car/Vehicle с авто-полями), `fashion` (Product+`size/color/material`), `pets` (Product или кастом), `home` (Product), `services` (Service), `giveaway` (Product+`price:0`).
- Маппинг полей (явно в PRD): `mileage→mileageFromOdometer{QuantitativeValue}`, `fuel→fuelType`, `transmission→vehicleTransmission`, `power→vehicleEngine.enginePower`, `year→vehicleModelDate/productionDate`, `euro_norm→emissionsCO2`/`additionalProperty`, `EPC→additionalProperty или energyEfficiency*`, `salary→baseSalary{MonetaryAmount}`, `employment→employmentType`.
- `condition`-маппинг enum; `seller`-маппинг (реальное имя + Person/Organization).
- KB-блок: опционально `FAQPage` из pros/cons/issues (rich result) — или `additionalProperty`; пометить «справочно» (не вводить в заблуждение).
- Acceptance: контент всех вкладок присутствует в SSR-HTML (не unmount); JSON-LD валиден в Rich Results Test для каждой категории.
- Вклад в sitemap: каждое `active` объявление → URL (owner PRD 62/31 совместно).

### 3.3 Вердикт: ⛔ (нет sign-off)
Причина: отсутствует раздел structured data при том, что это центральный PRD для rich results; существующие per-category генераторы не подключены. Блокер для rich-results-стратегии.

---

## 4. PRD 57 — Шаринг в соцсети/мессенджеры

### 4.1 SEO-пробелы
- **OG-инфраструктура «есть» — но битая** (по аудиту 02): og:image на home = SVG (соцсети не рендерят), на `/ad/*` = подписанный Supabase-URL с истекающим токеном. PRD 57 опирается на «SEO/OG есть, переиспользуем» (§2) — это **ложная предпосылка**: переиспользовать нечего, OG надо чинить (P0).
- **Per-locale OG не специфицирован.** §4/§10 «OG per-locale (NL/FR/EN)» — декларация без деталей (`og:locale`, `og:locale:alternate`, локализованные `og:title`/`og:description`).
- **Нет требований к share-картинке.** «фото/цена/заголовок» — но если генерировать динамический OG (`opengraph-image.tsx`/`next/og`), нужны: размер 1200×630, кириллица/спец-символы в шрифте, fallback при отсутствии фото, кэш. Не описано.
- **Snapchat/Pinterest/Telegram** не учтены (Telegram популярен в RU-диаспоре BE; Pinterest для fashion/home — SEO-трафик).
- **UTM/ref не должны попадать в canonical** — при шаринге `?utm=`/`?ref=` Google не должен индексировать параметрические дубли. PRD упоминает UTM (§5), но не связку с canonical (self-canonical без параметров).

### 4.2 Что добавить в PRD (SEO by design)
- Предусловие: исправить og:image (PNG 1200×630 для home; публичный media-URL/fallback для `/ad/*`) — отметить зависимость от фундамента (аудит 02 P0).
- Per-locale OG: `og:locale` = текущая (`nl_BE`...), `og:locale:alternate` = остальные; локализованные title/description (переиспользовать generateMetadata из PRD 42).
- (Опц.) `opengraph-image.tsx` через `next/og`: 1200×630, шрифт с кириллицей, fallback-PNG, заголовок+цена+1 фото.
- canonical всегда без UTM/ref; ref-атрибуция через cookie/JS, не через индексируемый URL.
- Twitter `summary_large_image`; теги для WhatsApp (читает OG), Telegram (читает OG), Pinterest (`product` Rich Pins — пересечение с Product JSON-LD из PRD 62).

### 4.3 Вердикт: 🔄 (доработка до sign-off)
Причина: P2-фича, но опирается на ложную предпосылку «OG готов». После фикса фундамента и добавления per-locale OG-спеки — подписываемо. Не блокер запуска (P2).

---

## 5. PRD 31 — Создание объявления (SEO-поля)

### 5.1 SEO-пробелы
- **Нет SEO-полей в форме.** PRD описывает 8 шагов (заголовок/описание/цена/категория/медиа), но **не вводит SEO-критичные требования к контенту**: title-объявления — это `<title>`/`<h1>`/og:title/JSON-LD `name`; description — meta description (truncate 160) и JSON-LD `description`. Эти поля надо валидировать с SEO-углом.
- **Заголовок без качества для SEO.** Нет min/max длины (для `<title>` ~60 симв.), нет подсказки включать «бренд+модель+ключевая характеристика» (то, что ищут). Авто-генерация slug из заголовка (✓ `generateSlug`), но мусорный заголовок → мусорный slug/URL.
- **Описание без минимума.** Нет требования минимальной длины/уникальности — тонкий контент (thin content) хуже индексируется. Нет анти-дубль (копипаст одинаковых описаний по многим объявлениям = дубль-контент).
- **Категорийные поля = источник JSON-LD, но связь не зафиксирована.** Mileage/fuel/EPC/salary, вводимые здесь, питают rich results (PRD 62). PRD 31 не отмечает, что эти поля SEO-критичны (их полнота → rich results eligibility).
- **Медиа: публичность для SEO.** PRD говорит «signed storage» — но для og:image/JSON-LD/`next/image` нужны **публичные** превью-URL (аудит 02 §2.3/§6). PRD не различает приватные (галерея) и публичные (OG/индекс) media-URL.
- **Slug-стабильность.** При редактировании заголовка slug меняется → старый URL должен 301-редиректить на новый (canonical уже на id). Не описано.
- **Локаль объявления.** На каком языке объявление? Для hreflang/`inLanguage` JSON-LD нужно знать locale контента. Не фиксируется при создании.

### 5.2 Что добавить в PRD (SEO by design)
- Валидация заголовка: 10–70 симв., подсказка «бренд + модель + ключ. характеристика»; запрет CAPS/эмодзи-спама (и для SEO, и для модерации).
- Описание: минимум ~120 симв.; анти-дубль-чек (одинаковый текст по N объявлениям продавца → предупреждение); поддержка ключевых слов (NL/FR) — подсказки в UI.
- Пометить категорийные поля как «влияют на видимость в Google» (мягкий стимул заполнять) — рост rich-results-eligibility.
- Media pipeline: явно — публичный превью-вариант для OG/JSON-LD/`next/image`; приватные signed — только UI-галерея.
- Сохранять `content_locale` объявления (для `inLanguage`/hreflang/OG).
- Slug 301: при смене заголовка — старый slug → новый (301), canonical на id.
- Вклад в sitemap при публикации (`status=active` → добавляется; снятие → удаляется).

### 5.3 Вердикт: 🔄 (доработка до sign-off)
Причина: P0-фича, работает, но SEO-поля/валидации/публичность медиа/locale контента не встроены. Объявления — главный индексируемый контент маркетплейса; без этих правил качество индексации страдает. Доработка обязательна.

---

## 6. PRD 32 — Категорийные каталоги

### 6.1 SEO-пробелы
- **Категорийные страницы `/c/*` — главный SEO-актив маркетплейса** (под «BMW te koop», «appartement te huur Gent»), но PRD не описывает их SEO: нет per-category `generateMetadata`, нет `<h1>`-шаблона, нет canonical, нет BreadcrumbList JSON-LD, нет `CollectionPage`/`ItemList`. Аудит 02: `/c/*` сейчас наследует root `title=LyVoX` (дубли).
- **Нет per-category/per-locale метаданных** с бельгийскими ключами (0.3). Это самый «вкусный» органический трафик (категория × город × язык).
- **Пагинация листинга категории** не описана с SEO-стороны (индексируемость `?page=N`, self-canonical на странице, `ItemList` с позициями).
- **Локализованные словари ↔ hreflang.** §10 упоминает hreflang, но связь «локализованное имя категории → локализованный title/H1 → hreflang между языковыми версиями категории» не специфицирована.
- **Перелинковка.** Дерево категорий (`/api/categories/tree`) — отличный источник внутренних ссылок (родитель↔дети, related). PRD не описывает SEO-перелинковку (хлебные крошки, «похожие категории», «популярное в категории»).
- **Facet-страницы.** Комбинации категория+атрибут (напр. `/c/transport?fuel=diesel`) — потенциально ценные landing-страницы ИЛИ дубль-ловушка. Стратегия не определена (какие фасеты индексировать как ЧПУ-лендинги, какие — `noindex`).

### 6.2 Что добавить в PRD (SEO by design)
- `generateMetadata` per `/c/*`: title `{CategoryName} {BE-ключ} in België · LyVoX` per-locale; уникальный description; self-canonical; alternates/hreflang.
- `<h1>` = локализованное имя категории (одно H1).
- JSON-LD: `BreadcrumbList` (данные уже строятся в `buildCategoryBreadcrumbs`) + `CollectionPage`/`ItemList` первых N объявлений.
- Пагинация: `?page=N` индексируемы с self-canonical (не canonical на стр.1); `ItemList` с `position`.
- SEO-перелинковка: хлебные крошки, дочерние категории, «популярные подкатегории/города».
- Facet-стратегия: выбрать whitelisting ценных фасетов (бренд/топливо/город) как индексируемых лендингов с уникальными метаданными; остальное — `noindex`. Зафиксировать как решение (на старте — все фасеты `noindex`, индексируем только `/c/{path}`).
- Вклад в sitemap: все активные категории (`is_active`) с `lastmod`.

### 6.3 Вердикт: ⛔ (нет sign-off)
Причина: категорийные страницы — ядро органического трафика маркетплейса, а их SEO в PRD полностью отсутствует (наследуют дубль-title). Блокер для органической стратегии.

---

## 7. Сводная таблица вердиктов

| PRD | Область | SEO-вердикт | Главный блокер |
|---|---|---|---|
| 33 — Поиск | Search/filters | ⛔ | Индексируемость не задана (`noindex` `/search`), client-component блокирует metadata |
| 42 — i18n | hreflang/SEO | 🔄 | hreflang неполн: region-tags, x-default, www, reciprocity, og:locale-маппинг |
| 62 — Карточки по категориям | structured data | ⛔ | Нет раздела JSON-LD per категория; готовые генераторы не подключены |
| 57 — Шаринг | OG | 🔄 | Ложная предпосылка «OG готов»; per-locale OG не специфицирован (P2) |
| 31 — Создание объявления | SEO-поля | 🔄 | Нет SEO-валидаций title/description, публичности медиа, content_locale, slug-301 |
| 32 — Каталоги | категорийные стр. | ⛔ | SEO `/c/*` отсутствует (метаданные/H1/BreadcrumbList/ItemList/перелинковка) |

Легенда: ✅ sign-off · 🔄 доработка до sign-off · ⛔ нет sign-off (блокер).

**Итог по зоне:** 0 PRD с ✅. Три ⛔ (33, 62, 32) — прямые блокеры органической стратегии. Три 🔄 (42, 57, 31) — доработка. Все шесть зависят от закрытия P0-фундамента из аудита 02.

---

## 8. Таблица schema.org по категориям (для PRD 62 — rich results)

Маппинг `category domain → schema.org @type → поля`. Источник полей — `catalog_fields` (PRD 32/62). Цель — eligibility в Google Rich Results.

| Категория (domain) | schema.org @type | Обязательные поля (Google) | Рекомендуемые поля (rich) | Источник полей (catalog) | Статус кода |
|---|---|---|---|---|---|
| **Транспорт — авто** (`transport`) | `Car` (subtype of `Vehicle`/`Product`) | `name`, `image`, `offers{price,priceCurrency,availability,itemCondition}` | `brand`, `model`, `vehicleModelDate`/`productionDate`(year), `mileageFromOdometer{QuantitativeValue km}`, `fuelType`, `vehicleTransmission`, `vehicleEngine{enginePower}`, `numberOfDoors`, `bodyType`, `color`, `emissionsCO2`, `vehicleInteriorColor`, `itemCondition` | make/model/generation/year/mileage/fuel/transmission/power/body/doors/color/euro_norm/CO₂ | инлайн `Car` (неполн., заглушка seller) |
| **Транспорт — запчасти/шины** | `Product` | `name`, `image`, `offers{...}` | `brand`, `category`, `isAccessoryOrSparePartFor{Car}`, `size`(tire), `condition` | auto_part_type/season/tire dims | нет |
| **Недвижимость** (`property`) | `RealEstateListing` (+ `about: Apartment`/`House`/`SingleFamilyResidence`) | `name`, `image`, `url`, `datePosted` | `offers/priceSpecification{UnitPriceSpecification €/m² или цена}`, `floorSize{QuantitativeValue m²}`, `numberOfRooms`, `numberOfBedrooms`, `numberOfBathroomsTotal`, `address{PostalAddress}`, `yearBuilt`, EPC→`additionalProperty`/`energyEfficiency*`, `availableFrom` | listing_type/property_type/area/rooms/bedrooms/bathrooms/EPC/postcode/available_from | `property.ts` есть, **не подключён** |
| **Работа** (`jobs`) | `JobPosting` | `title`, `description`, `datePosted`, `hiringOrganization`, `jobLocation{Place}` | `baseSalary{MonetaryAmount/QuantitativeValue}`, `employmentType`(FULL_TIME…), `validThrough`, `experienceRequirements`, `educationRequirements`, `industry`(CP-code) | job_category(CP)/contract_type/salary/schedule/location/experience | `job.ts` есть, **не подключён** |
| **Электроника** (`electronics`) | `Product` | `name`, `image`, `offers{...}` | `brand`, `model`/`mpn`, `gtin`(если есть), `category`, `additionalProperty`(storage/RAM/screen/battery_health), `itemCondition` | device_type/brand/model/storage/RAM/screen/battery | `electronics.ts` есть, **не подключён** |
| **Мода / личные вещи** (`fashion`) | `Product` | `name`, `image`, `offers{...}` | `brand`, `size`, `color`, `material`, `category`(clothing/shoes/accessories), `audience{gender,suggestedAge}`, `itemCondition` | product_category/gender/age/brand/size/color/material | нет |
| **Дом/хобби/дети** (`dlya-doma...`) | `Product` | `name`, `image`, `offers{...}` | `brand`, `material`, `width/height/depth{QuantitativeValue}`(furniture), `color`, `audience`(baby), `itemCondition` | furniture dims/material/style; baby category/safety | нет |
| **Животные** (`zhivotnye`) | `Product` (нет нативного pet-type) | `name`, `image`, `offers{...}` | `additionalProperty`(breed/age/gender/microchip/vaccinated/pedigree), `description` | pet_breed/gender/age/weight/microchip/pedigree | нет |
| **Услуги** (`uslugi-i-biznes`) | `Service` (или `Offer`) | `name`, `provider`, `areaServed` | `serviceType`, `offers{priceSpecification rate}`, `availableChannel`, `areaServed{City}` | service_scope/rate/location/experience | нет |
| **Особые / даром** (`osobye-kategorii`) | `Product` | `name`, `image`, `offers{price:0,priceCurrency,availability}` | `itemCondition`, `availabilityEnds`(available_until) | giveaway_reason/condition/pickup/available_until | нет |

Сквозные поля для всех типов: `@id`/`url`=canonical, `inLanguage`=content_locale, `seller`=реальное имя (Person/Organization по seller_type), `image`=публичные URL, `offers.priceValidUntil`, `offers.itemCondition`, опц. `offers.hasMerchantReturnPolicy`/`shippingDetails` (escrow/доставка). `itemCondition`-enum: `new→NewCondition`, `used→UsedCondition`, `refurbished→RefurbishedCondition`, `damaged→DamagedCondition`.

KB-блок (опц. rich result): pros/cons/common_issues → `FAQPage` (`Question`/`Answer`), помечать «справочно» (не гарантия).

---

## 9. Приоритизация SEO-доработок по PRD (для бэклога)

**P0 (блокеры органики, до индексации):**
1. Фундамент аудита 02 (metadataBase, robots/sitemap, og:image, canonical-фикс) — предусловие всех.
2. PRD 32: `generateMetadata`+H1+BreadcrumbList+canonical+hreflang для `/c/*` (per-locale, BE-ключи).
3. PRD 62: подключить per-category JSON-LD (реюз `lib/seo/catalog/*` по domain) + дописать недостающие типы + маппинг полей; вкладки в SSR-HTML.
4. PRD 33: `noindex` `/search` (server/client split); disallow в robots; не в sitemap.

**P1 (к запуску):**
5. PRD 42: hreflang per-page + x-default + region-tags + www + og:locale-маппинг.
6. PRD 31: SEO-валидации title/description, content_locale, публичные media-URL, slug-301, вклад в sitemap.
7. PRD 62: реальный seller, offer-поля (priceValidUntil/itemCondition), публичные image в JSON-LD.

**P2:**
8. PRD 57: per-locale OG + (опц.) `opengraph-image.tsx`; canonical без UTM.
9. Среднесрочно (PRD 42/32): path-based locale `/{locale}/`; facet-лендинги whitelisting.

---

## 10. Что вписать обратно в каждый PRD (action items для авторов)

- **33:** §4/§8 — пункт «indexability: /search noindex,follow; server/client split»; §5 — канонизация фасетов; владение WebSite+SearchAction; §14 DoD +3 пункта.
- **42:** §4 — детальная hreflang-спека (теги/x-default/reciprocity/www); §5 — canonical↔hreflang; §6 — ogLocale-маппинг; §14 DoD «hreflang корректен» (не «присутствует»).
- **62:** новый раздел «Structured data per категория» (таблица §8 этого ревью); requirement подключения `lib/seo/catalog/*`; вкладки в SSR; маппинг полей; §13 DoD +structured-data-пункты.
- **57:** §2 убрать «OG готов» → «OG требует фикса (аудит 02)»; §4/§7 — per-locale OG-спека; §5 — canonical без UTM; §14 DoD.
- **31:** §4 — SEO-валидации title/description, content_locale; §6 — публичный media-вариант; §5 — slug-301; §14 DoD.
- **32:** новый под-раздел SEO `/c/*` (метаданные/H1/BreadcrumbList/ItemList/пагинация/перелинковка/facet-стратегия); §14 DoD.
```
