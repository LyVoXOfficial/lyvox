# PRD: Карточки товара по категориям + базы знаний (knowledge base)

> **Статус кода:** 🟡 ЧАСТИЧНО — F7/F13 foundations wired to detail page: key-specs strip ✅, document badges ✅, F13 `CatalogGroupTabs` readonly renderer ✅, KB disclaimer ✅, ambiguous-generation CTA (bug #1996) ✅; non-transport KB tables (electronics/pets/fashion) §13 follow-up
> **⛔ Ревью-вердикт (2026-06-28): БЛОКЕР по DEV + DATA + SEO.** Баг 1996 ЖИВ в коде: `determineGeneration()` (`ad/[id]/page.tsx:1212–1248`) использует `.find()` → молчаливо берёт первого кандидата при overlap (E34 1988–1996 ∩ E39 1995–2003 на year=1996). `generation_id` нигде не хранится в нормализованной колонке (лежит в `specifics` JSONB, без FK). Раскладка вкладок нереализуема текущим `FieldGroup` (хардкодит `<h3>`-секции, нет layout-метаданных). Раздел structured data (JSON-LD per категория) отсутствует как класс, готовые генераторы `lib/seo/catalog/*` не подключены. См. финальный раздел «Ревью-требования и sign-off».
> **Категория:** Есть (углубление [[32-category-catalogs]] и карточки [[31-listing-creation]])
> **Приоритет:** P1
> **Зависит от:** [[32-category-catalogs]], [[31-listing-creation]], [[42-i18n-localization]], [[17-image-verification]]
> **Последнее обновление:** 2026-06-29

Поля/таблицы/ключи — английский. Остальное — русский.

---

## 1. Зачем это
- **Проблема.** Карточка товара сейчас показывает все атрибуты «в один список». У богатых категорий (транспорт, недвижимость) это простыня; у простых (мода) — наоборот пусто. Нужна **единая, user-friendly раскладка**, адаптивная под сложность категории, и **корректная база знаний** на категорию (как «инфо о модели» для авто), без бага неверного сопоставления.
- **Исход.** Для каждой категории — понятная карточка: сканируемая «шапка» + детали, разложенные по логике (вкладки для сложных, секции для простых). База знаний автоподтягивает проверенную инфу о модели/породе/районе и т.п., а сопоставление **никогда не угадывает молча** при неоднозначности (переходные годы и т.п.).
- **KPI:** время до контакта/покупки с карточки; доля карточек с заполненными ключевыми атрибутами; доля неверно сопоставленных KB-записей → ~0; вовлечённость в KB-блок.

## 2. Текущее состояние (As-is) — на чём строим
- **Гибкая схема полей:** `catalog_fields` (`field_key, label_i18n_key, field_type, domain, is_required, unit, min/max, pattern, group_key, sort, metadata`). Поля уже сгруппированы по `group_key` (напр. `furniture_dimensions`, `auto_parts_spec`, `pets_health`, `services_pricing`).
- **Рендер:** `components/catalog/DynamicFieldRenderer.tsx` + `FieldGroup` (сейчас группы = секции с `<h3>`, **не вкладки**). Есть категорийные компоненты (`ElectronicsFields`, `FashionFields`, …).
- **Авто-KB:** `vehicle_generations` (`start_year`, `end_year` nullable) → `vehicle_generation_insights` (`pros, cons, inspection_tips, common_issues, reliability_score`) + i18n. Привязка к **поколению** (точнее, чем к модели) — правильно.
- **Категории-домены (slug):** `transport`, `electronics`, `property` (недвижимость), `jobs` (работа), `fashion`/личные вещи, `dlya-doma-hobbi-i-detey` (дом/хобби/дети), `uslugi-i-biznes` (услуги), `zhivotnye` (животные), `osobye-kategorii` (особые/отдать даром).

---

## 3. Универсальный паттерн карточки (для всех категорий)

Карточка = **«Шапка-сводка» (всегда одинаковая структура) + «Детали» (раскладка зависит от сложности категории)**.

### 3.1 Шапка-сводка (above the fold, во всех категориях)
1. **Галерея** (фото/видео, тач-таргеты миниатюр ≥48px).
2. **Заголовок + цена** (или «Бесплатно»/«Договорная»/«З/п от–до» для работы).
3. **Key-specs strip** — 3–6 самых важных атрибутов категории в виде чипов (то, по чему решают «смотреть дальше»). Пример авто: `2008 · 180 000 км · Дизель · АКПП · Gent`. Пример электроники: `iPhone 13 · 128 ГБ · Б/у · АКБ 89%`.
4. **Trust/seller-панель** (эталон с текущей карточки): продавец скрыт до верификации, бейджи, «Написать», «Безопасная сделка», «Пожаловаться».
5. **Бейджи доверия/документов** по категории (Verified, Car-Pass, EPC, Recupel, Микрочип/родословная и т.п.).

### 3.2 Детали — правило раскладки «вкладки vs секции»
Решение принимается **по числу групп атрибутов и объёму контента**, чтобы было user-friendly:

- **Вкладки (Tabs)** — для «тяжёлых» категорий (≥4 групп атрибутов или есть KB-блок + история/документы). Вкладки: **Обзор · Характеристики · Состояние и история · Об этой модели (KB) · Продавец/Безопасность**.
- **Секции в один скролл (с аккордеоном на мобайле)** — для «лёгких» категорий (≤3 группы). Группы из `group_key` рендерятся как сворачиваемые секции; первая раскрыта.
- **Мобайл:** вкладки → горизонтальный сегмент-контрол (свайпаемый) либо аккордеон; секции → аккордеон. Никогда не прятать ключевое в неочевидную вкладку — key-specs всегда в шапке.

Технически: добавить в `catalog_fields.metadata` (или в отдельную конфиг-таблицу `catalog_groups`) поля `display: 'tab'|'section'`, `tab_key`, `tab_order`, `icon`, `collapsed_by_default`. `DynamicFieldRenderer` читает это и рендерит вкладки или секции единообразно.

### 3.3 Решение по категориям (рекомендация)

| Категория | Раскладка | Почему |
|---|---|---|
| Транспорт (авто/мото) | **Вкладки** | Много групп: тех.хар-ки, состояние/история (Car-Pass, ДТП, пробег), опции, KB-поколение |
| Недвижимость | **Вкладки** | Параметры объекта, энергетика (EPC/PEB), расходы, локация/район (KB), документы |
| Электроника | **Вкладки** (лёгкие) | Спеки + состояние/АКБ + KB-модель + комплект; но групп умеренно |
| Мода / личные вещи | **Секции** | Мало полей: размер/бренд/состояние/материал |
| Дом/хобби/дети | **Секции** | Мебель: габариты+материал; детские: безопасность — 2–3 группы |
| Животные | **Секции** | Порода/здоровье/характер — но с обязательным compliance-блоком (BE) |
| Услуги | **Секции** | Объём/цена/локация/опыт — короткий список, нет «товара» |
| Работа | **Секции** | Описание/условия/требования — текст, не атрибуты |
| Особые (даром) | **Секции (минимум)** | Состояние/самовывоз/до какого числа |

---

## 4. Поля по категориям (что должно быть)

Источник — существующие `catalog_fields` (✓ есть) + предложенные дополнения (➕). Группы = будущие вкладки/секции.

### 4.1 Транспорт — автомобили (вкладки)
- **Обзор (key-specs):** make, model, **generation**, year, mileage(km), fuel/engine type, transmission, drive type, power(hp/kW), body, color, condition(not_damaged/damaged/salvage).
- **Характеристики:** displacement(cc), doors, seats, steering_wheel, ➕emissions/euro_norm, ➕CO₂, ➕consumption.
- **Состояние и история:** ➕Car-Pass (km history) — обязателен в BE при продаже; ➕accident/damage, ➕owners_count, ➕service_history, ➕inspection_valid_until (technische keuring).
- **Опции:** vehicle_options (comfort/safety/multimedia/exterior) — чипы.
- **Об этой модели (KB):** generation insights (pros/cons/common_issues/inspection_tips/reliability) — см. §5.
- **Подкатегория «Запчасти/шины»:** auto_part_type, condition, season, tire diameter_inch/width_mm/bolt_pattern (✓).

### 4.2 Недвижимость (вкладки)
- **Обзор:** listing_type(sale/rent), property_type, area_m², rooms, bedrooms, ➕bathrooms, price (+ ➕charges/month для аренды), municipality/postcode, available_from.
- **Характеристики:** floor/total_floors, ➕year_built, furnished, ➕heating_type, ➕outdoor(terrace/garden/parking).
- **Энергетика:** EPC/PEB rating (✓ epc-ratings) + ➕energy_kwh; пояснение шкалы (KB).
- **Локация/район (KB):** ➕средняя €/m², транспорт, школы (лёгкая интеграция позже).
- **Документы/compliance:** EPC обязателен в объявлении (BE), ➕для аренды — тип договора.

### 4.3 Электроника (вкладки, лёгкие)
- **Обзор:** device_type, brand, model (KB), storage, condition, ➕year/release.
- **Характеристики:** RAM, screen_size, color, ➕connectivity; для телефонов IMEI(✓ валидатор), ➕battery_health(%), ➕dual_sim.
- **Состояние:** ➕warranty(remaining), ➕accessories_included(box/charger), ➕defects.
- **Об этой модели (KB):** официальные спеки/год выпуска/типичная б/у-цена/что проверять (см. §5).
- **Recupel/EPR** бейдж для профи-продавцов ([[15-recupel-dac7-compliance]]).

### 4.4 Мода / личные вещи (секции)
- product_category(clothing/shoes/accessories), gender, age_group, brand (KB), **size** (+ ➕size system EU/UK/US — конвертер из KB), color, material, condition. ➕для премиум-брендов — «как проверить подлинность» (KB).

### 4.5 Дом / хобби / дети (секции)
- **Мебель:** furniture_material, style, condition, dimensions L×W×H(cm), brand, color (✓).
- **Детские товары:** baby_product_category, age_group, condition, brand, color, material, quantity, **safety_certified**, expiration_date (✓) — блок безопасности обязателен ([[15-recupel-dac7-compliance]]/GPSR).

### 4.6 Животные (секции + обязательный compliance-блок BE)
- pet_breed (KB-порода), gender, age_months, weight, vaccinated, sterilized, **microchip**, pedigree, character (✓).
- ➕**BE-compliance:** идентификация/регистрация (для собак — чип+регистрация обязательны), ➕продавец-разрешение для разведения; предупреждение о правилах. KB-породы с health watch-outs.

### 4.7 Услуги (секции)
- service_scope, rate_type, rate_amount, location_type, area, experience_years, license, available_from (✓). KB нет («товара» нет) → блок «что проверить перед наймом» (generic tips) + лицензия/страховка как trust-сигнал.

### 4.8 Работа (секции)
- job_category (CP-code ✓), contract_type, ➕salary_range, ➕schedule(full/part/temp), ➕remote, ➕experience_required, location. KB лёгкий: пояснение CP-кода/сектора.

### 4.9 Особые / отдать даром (секции-минимум)
- giveaway_reason, condition, pickup, available_until, requirements (✓). KB нет.

---

## 5. Базы знаний по категориям (knowledge base)

Идея: у KB-категории есть **справочная сущность** (reference entity), к которой привязаны курируемые «инсайты», и карточка показывает их в блоке/вкладке «Об этой модели». Везде один паттерн данных и UI.

| Категория | Reference entity | Что в KB (инсайты) | Что питает на карточке | Статус |
|---|---|---|---|---|
| Транспорт | `vehicle_generations` | pros, cons, common_issues, inspection_tips, reliability | Вкладка «Об этой модели»; чек-лист осмотра | ✓ есть (`vehicle_generation_insights`) |
| Электроника | `device_models` | release_year, official_specs, typical_used_price, known_issues, what_to_check | Вкладка «О модели»; «справедливая цена» ([[52-ai-fair-price]]) | ➕ расширить device_models |
| Мода | `fashion_brands` (✓) + size charts | size_conversion(EU/UK/US), authenticity_tips, care | Конвертер размеров; «как проверить подлинность» | ➕ size/authenticity |
| Животные | `pet_breeds` (➕) | temperament, adult_size, lifespan, care, health_watchouts, **BE legal notes** | Блок «О породе» + предупреждения | ➕ новая KB |
| Недвижимость | `municipalities`/EPC | avg €/m², EPC scale explainer, mobility/schools | Блок «Район» + пояснение EPC | ➕ лёгкая, позже |
| Дом/мебель | `furniture_brands` (➕) | material care, brand notes | Подсказки ухода | ➕ опционально |
| Работа | CP-codes (✓) | sector norms, typical salary range | Пояснение CP/сектора | ➕ лёгкая |
| Услуги | — | generic «что проверить» | Блок советов | нет product-KB |
| Особые | — | — | — | нет |

Общая модель данных KB (унификация): `kb_entities(domain, entity_type, ref_id, ...)` + `kb_insights(entity_ref, pros[], cons[], watchouts[], tips[], facts jsonb)` + `kb_insights_i18n`. Для транспорта переиспользуем существующие таблицы; новые категории кладём в общую KB-схему, чтобы UI-блок был один.

**Принцип контента KB:** курируемые данные (не машинный перевод имён собственных), помечать «справочно», источник/дату; не выдавать как гарантию (юр-аккуратность). i18n NL/FR/EN приоритет.

---

## 6. Логика сопоставления с KB (фикс бага 1996) — ГЛАВНОЕ

**Симптом.** Для BMW 5 Series год 1996 подтянулось не то поколение: 1996 попадает в диапазоны **E34 (1988–1996)** и **E39 (1995–2003)** одновременно (переходные годы). Сопоставление по точному году выбрало одно молча.

**Корень.** Reference-сущности имеют **диапазоны** (`start_year`/`end_year`, `end_year` NULL = в производстве). Точечный год может матчить 0, 1 или **несколько** сущностей. Авто-выбор при множественном совпадении = ошибка.

**Правило сопоставления (range-aware, ambiguity-safe) — общее для всех KB-категорий:**
1. Найти все кандидаты, чей диапазон содержит выбранное значение: `start <= year AND (end IS NULL OR year <= end)`.
2. **Ровно 1 кандидат** → авто-выбор, показать его и дать «изменить».
3. **>1 кандидат (overlap/переходный год)** → **НЕ выбирать молча.** Показать чузер: «Этот год выпускался в двух поколениях — уточните: E34 (1988–1996) / E39 (1995–2003)» с краткими отличиями (кузов/фото), чтобы пользователь выбрал верное.
4. **0 кандидатов** (год вне известных диапазонов / редкая модель) → предложить ближайшие по году + опцию «поколение неизвестно» (без ложной привязки).
5. **Хранить выбранное `generation_id` явно** на объявлении. Никогда не ре-деривить KB из года на лету (иначе баг вернётся при правках данных).
6. Поколения в подсказке сортировать по `start_year`; при пересечении подсвечивать перекрытие.

**Псевдокод:**
```
candidates = generations(model_id).where(start<=year && (end==null || year<=end))
if candidates.length == 1: listing.generation_id = candidates[0].id   // + UI "изменить"
elif candidates.length > 1: askUserToChoose(candidates)               // overlap → выбор
else: suggestNearest(year) || markUnknown()
```

**Обобщение на другие категории:** тот же приём для любых «годо-/диапазонных» справочников — device_models (год релиза/ревизии), property (нормы по году постройки), fashion (год коллекции). Где справочник без диапазонов (порода, бренд) — простое exact-match по ключу, но всё равно с подтверждением и возможностью «нет в списке».

**Дополнительно:** автокомплит make/model/generation должен показывать **поколение с годами** в подписи (E39 (1995–2003)), чтобы пользователь видел, что выбирает; не сворачивать год в один селект без поколения.

---

## 7. Данные / API (что менять)
- `catalog_fields.metadata` или новая `catalog_groups(domain, group_key, display, tab_key, tab_order, icon, collapsed)` — конфиг раскладки (вкладки/секции) без хардкода в компонентах.
- KB: переиспользовать `vehicle_generation_insights`; ввести общую `kb_insights(+i18n)` для новых категорий (electronics/pets/fashion).
- Матчинг: вынести в серверный хелпер `resolveGeneration(modelId, year)` (и общий `resolveReference`) — возвращает `{status:'unique'|'ambiguous'|'none', candidates[]}`; использовать в форме подачи и при бэкфилле.
- `/api/catalog/*`: эндпойнт подсказок поколений по модели с годами; эндпойнт KB-инсайтов по `generation_id`/`reference_id`.
- На объявлении хранить явный `generation_id`/`reference_id` (не только year).

## 8. UX-состояния
- KB-блок: есть данные / нет данных (скрыть аккуратно) / «поколение не выбрано» (предложить уточнить).
- Чузер неоднозначности: понятные отличия кандидатов (годы, кузов, фото-силуэт).
- Карточка без части атрибутов: не показывать пустые группы/вкладки.

## 9. i18n / a11y / комплаенс
- Все лейблы через `label_i18n_key`; KB-инсайты i18n (NL/FR/EN приоритет; имена собственные — curated).
- Вкладки/аккордеоны доступны с клавиатуры; ARIA-tabs; key-specs читаемы скринридером.
- Документные бейджи: Car-Pass (транспорт), EPC/PEB (недвижимость), safety (детские/GPSR), микрочип/регистрация (животные, BE).

## 10. Тестирование
- Unit: `resolveGeneration` на overlap (1996 BMW 5: ожидаем `ambiguous` с E34+E39), на unique, на none.
- Component: рендер вкладок vs секций по конфигу; пустые группы скрыты; мобильный аккордеон.
- e2e: подача авто с переходным годом → чузер поколения → на карточке верный KB; электроника с моделью → KB-блок.

## 11. План внедрения (Rollout)
- **Шаг 1 (фикс бага):** `resolveGeneration` range-aware + чузер неоднозначности + хранить `generation_id`; автокомплит с годами. (S–M)
- **Шаг 2 (раскладка):** конфиг `catalog_groups` + вкладки/секции в `DynamicFieldRenderer`; применить к транспорт/недвижимость (вкладки) и моде/дому (секции). (M)
- **Шаг 3 (KB-расширение):** общая `kb_insights`; наполнить electronics (device_models) и pets (breeds, +BE-compliance). (M)
- **Шаг 4:** недвижимость-локация, fashion size/authenticity, jobs/CP — по мере данных. (M)

## 12. Открытые вопросы
- Источники KB-контента (курировать вручную / лицензировать / частично авто) по категориям.
- Глубина локационной KB для недвижимости на старте.
- Где порог «вкладки vs секции» (предложено: ≥4 группы или наличие KB/истории → вкладки).

## 13. Definition of Done
- [ ] `resolveGeneration`/`resolveReference` range-aware; overlap → выбор пользователя; `generation_id` хранится явно; 1996-кейс покрыт тестом.
- [ ] Конфиг раскладки (вкладки/секции) управляет рендером без хардкода; транспорт/недвижимость — вкладки, мода/дом — секции.
- [ ] Key-specs strip и trust-шапка во всех категориях; пустые группы скрыты.
- [ ] KB-блок «Об этой модели/породе/районе» работает минимум для транспорта и электроники; контент i18n и помечен «справочно».
- [ ] Документные бейджи/блоки по категориям (Car-Pass/EPC/safety/микрочип).
- [ ] a11y вкладок/аккордеонов; тесты §10 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

> Самый технически и данным насыщенный PRD зоны. Получил **⛔ от трёх дисциплин (DEV, DATA, SEO)** — это центральный блокер карточек и rich-results-стратегии. Применить также сквозные F-требования: F7 (нормализация `generation_id`), F12 (per-category JSON-LD), F13 (конфиг раскладки + ARIA-tabs рендерер).

### DEV
- **Баг 1996 структурно неустраним без миграции (F7).** Добавить нормализованную колонку: `ALTER TABLE` (vehicle-specifics или `adverts`) `ADD COLUMN generation_id uuid REFERENCES vehicle_generations(id)`. Для общих категорий — generic `reference_id`/`reference_type`. **Никогда не ре-деривить поколение из года** — иначе баг возвращается.
- **Серверный хелпер `resolveGeneration(modelId, year)` → `{status:'unique'|'ambiguous'|'none', candidates}`** (range-aware: `start_year <= year AND (end_year IS NULL OR year <= end_year)`); 1 кандидат → авто, >1 → chooser, 0 → nearest/unknown. Жить в `lib/catalog/`, использоваться и в форме, и в бэкфилле. Псевдокод в PRD корректен — реализовать как описано.
- **Бэкфилл-стратегия существующих объявлений (нет в PRD):** прогнать все legacy-adverts через resolver; `unique` → проставить `generation_id`; `ambiguous`/`none` → `generation_id NULL` + флаг `kb_needs_review=true` (не угадывать ретроактивно).
- **Конфиг раскладки + переписать рендерер (F13).** Таблица `catalog_groups(domain, group_key, display 'tab'|'section', tab_key, tab_order, icon, collapsed_by_default, label_i18n_key)`; расширить `FieldDefinition` layout-полями; переписать `FieldGroup` → `TabbedRenderer`/`SectionRenderer` (текущий хардкодит `<h3>`).
- **KB DDL:** `kb_entities(id, domain, entity_type, ref_id, …)`, `kb_insights(entity_ref, pros[], cons[], watchouts[], tips[], facts jsonb)`, `kb_insights_i18n(insight_id, locale, …)`; для транспорта — view/адаптер над `vehicle_generation_insights`, чтобы UI-блок один.
- **API:** `GET /api/catalog/generations?model_id=&year=` → кандидаты с годами; `GET /api/catalog/kb?generation_id=` (или `?reference_id=`) → инсайты (i18n по locale).
- **Тесты:** overlap (1996 BMW 5 → ambiguous E34+E39), unique, none; рендер tabs vs sections по конфигу; пустые группы скрыты; ARIA-tabs клавиатура; e2e подача авто переходного года → chooser → карточка верный KB; бэкфилл existing → ambiguous помечен. → F7, F13.

### DATA
- **Баг 1996 — корень в коде, а не только в PRD (⛔ блокер).** `determineGeneration()` (`.find()`) даёт молчаливый первый кандидат. Источник истины = явный `generation_id`; fallback-by-year — **только** для legacy без `generation_id`, и при ambiguous обязан показывать «уточните», а не угадывать.
- **`generation_id` в JSONB без FK/валидации** → можно записать поколение чужой модели, KB подтянет мусор. Нормализовать в колонку + FK + CHECK/триггер «принадлежит `model_id`». → F7.
- **Развести семантику `end_year=NULL`** (перегружена: «в производстве» vs «неизвестно»). Добавить `production_status check in ('in_production','ended','unknown')` (или соглашение `end_year=NULL AND in_production=true`). Range-matching по открытому диапазону применять **только** к `in_production=true`; `unknown` — кандидат «под вопросом», не молчаливый матч.
- **Один канон годов.** `vehicle_models.years_available int[]` дублирует диапазоны `vehicle_generations` → риск рассинхрона. Канон — диапазоны поколений; массив на модели — производный кэш.
- **Унифицированная KB-схема для не-транспорта** (`device_models`, `pet_breeds`, `fashion`, общие `kb_entities/kb_insights/_i18n`) — сейчас в схеме нет ни одной таблицы; все KB-обещания §5 на бумаге. Провенанс KB обязателен: `source`, `source_date`, «справочно».
- **Обобщённый `resolveReference`** — один контракт для всех диапазонных справочников (generations, device-revisions, property-build-year, fashion-collections). SQL-ядро одинаковое (см. data-review §1.2). → F7.
- **Метрики качества справочников (добавить в §10):** `kb_coverage_rate`, `kb_ambiguity_rate` (это и есть измерение KPI «неверно сопоставленных → 0»), `kb_orphan_rate`, `range_overlap_count` per model.
- **События качества матчинга:** `kb_resolve {model_id, year, status, candidate_count}` (#11) и `kb_ambiguity_resolved {chosen_generation_id}` (#12) — обязательны для проверки фикса 1996. → F6.

### SEO
- **Добавить отсутствующий раздел «Structured data (schema.org) по категориям» (F12).** Это центральный PRD для rich results, а раздел JSON-LD отсутствует как класс. Вставить таблицу «категория → schema.org @type → обязательные/рекомендуемые поля → источник из catalog_fields» (готова в seo-review §8).
- **Подключить мёртвые генераторы.** `lib/seo/catalog/property.ts` (RealEstateListing), `job.ts` (JobPosting), `electronics.ts` (Product) — 0 импортов. Ad-страница (`ad/[id]/page.tsx:518–544`) отдаёт инлайн `Car`/`Product` с заглушкой `"LyVoX seller"`. Requirement: `getCatalogJsonLd(domain, data, locale)` выбирает генератор по `domain`; дописать недостающие (vehicle/fashion/pets/home/services/giveaway). → F12.
- **Маппинг полей карточки → schema.org (явно в PRD):** `mileage→mileageFromOdometer{QuantitativeValue}`, `fuel→fuelType`, `transmission→vehicleTransmission`, `power→vehicleEngine.enginePower`, `year→vehicleModelDate/productionDate`, `euro_norm→emissionsCO2/additionalProperty`, `EPC→energyEfficiency*/additionalProperty`, `salary→baseSalary{MonetaryAmount}`, `employment→employmentType`.
- **`condition`-enum:** `new→NewCondition`, `used→UsedCondition`, `refurbished→RefurbishedCondition`, `damaged→DamagedCondition` (сейчас хардкод `UsedCondition`).
- **`seller`-заглушка «LyVoX seller»** → реальное имя продавца (`Person`/`Organization` по seller_type). `offers` дополнить `priceValidUntil`, `itemCondition` внутри offer, опц. `hasMerchantReturnPolicy`/`shippingDetails` (escrow/доставка).
- **Вкладки — в SSR-HTML, не conditional unmount.** JSON-LD строится из данных (не из DOM); весь контент вкладок присутствует в HTML (CSS-hide), иначе Google не увидит скрытый текст.
- **Изображения JSON-LD — публичные URL**, не подписанные Supabase (истекающий токен → битая закэшированная картинка).
- **KB-блок:** опц. `FAQPage` из pros/cons/issues (rich result) или `additionalProperty`; помечать «справочно».
- **Acceptance:** JSON-LD валиден в Rich Results Test для каждой категории; каждое `active` объявление → URL в sitemap. → F12.

### UX
- **Раскладка фиксируется per-category (конфиг `catalog_groups`), не по числу заполненных групп конкретного объявления** — иначе у одного авто вкладки, у другого секции (ломает обучаемость). Пустые группы скрываются внутри стабильного типа раскладки.
- **Фиксированный приоритет/порядок key-specs per-category** (авто: год → пробег → топливо → КПП → кузов → город), не в случайном порядке полей. 3–6 чипов.
- **Видимый KB-дисклеймер** с датой/источником: «Справочно. База знаний LyVoX, обновлено {дата}. Общие сведения о модели, не гарантия по конкретному товару» — не мелким серым (юр-риск и подрыв доверия при несовпадении).
- **Чузер неоднозначности — смягчить трение:** наглядные различия (силуэт/фото кузова), дефолтный предвыбор по году (первый/последний год → подсветка вероятного), «Не знаю / нет в списке» всегда доступно. Не блокировать подачу намертво.
- **Пустой KB-блок при невыбранном поколении** — не пустота, а CTA «Уточнить поколение, чтобы показать инфо о модели и чек-лист осмотра» (возврат к чузеру).
- **Actionable чек-лист осмотра** (авто) + пояснение EPC-шкалы у бейджа (недвижимость) — анти-тревожный инструмент.
- **a11y:** ARIA Tabs pattern (`role=tablist/tab/tabpanel`, стрелки ←/→, Home/End, `aria-selected`); аккордеон (`aria-expanded/controls`, Enter/Space); key-specs как список пар «ключ: значение»; галерея — alt + клавиатура + миниатюры ≥48px; чузер — модальный диалог (фокус-trap, Esc); документные бейджи текст+иконка (не только цвет), тултип с клавиатуры; KB-дисклеймер в потоке скринридера (не `aria-hidden`). Контраст ≥4.5:1 на градиентах галереи. → F13.

**Вердикт:** ⛔ — пока баг 1996 не закрыт в коде (F7: `generation_id` + `resolveGeneration` + chooser + бэкфилл), не подключены per-category JSON-LD (F12) и не переписан рендерер раскладки под конфиг+ARIA-tabs (F13), PRD не sign-off-able. После закрытия трёх F-фундаментов → 🔄 (готов к стройке).
