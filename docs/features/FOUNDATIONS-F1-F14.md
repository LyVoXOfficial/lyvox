> [!WARNING]
> **Историческая декомпозиция инженерных тикетов.** Статусы, порядок запуска и оценки ниже больше не являются рабочим планом. Использовать требования из этого файла можно только тогда, когда на них ссылается актуальный [`docs/MASTER_PRODUCTION_TZ.md`](../MASTER_PRODUCTION_TZ.md), и только после проверки по текущему коду.

# LyVoX — Фундаменты F1–F14 (инженерные тикеты)

Дата: 2026-06-28 · Источник: [reviews/README.md](reviews/README.md) §1. Это сквозные предпосылки — каждая чинит сразу несколько PRD. Порядок ≈ по разблокировке и риску. Оценка: S (≤2 дн), M (3–7 дн), L (>1 нед / внешние).

Легенда зависимостей: «Разблокирует» — какие PRD нельзя закрыть без этого тикета.

---

### F1 — Журнал идемпотентности вебхуков `webhook_events`
- **Зачем:** билинг сейчас идемпотентен «по эффекту» (статус строки `purchases`), без журнала `event.id` → риск двойного payout/refund в escrow.
- **Скоуп:** таблица `webhook_events(provider, event_id pk, type, received_at, processed_at, payload jsonb)`; обработчик вебхука: `INSERT … ON CONFLICT (event_id) DO NOTHING` → если конфликт, выходить; иначе обрабатывать в транзакции. Применить к Stripe (billing + Connect).
- **Acceptance:** повторная доставка одного `event.id` не создаёт второй денежной операции (тест: двойной вебхук). 
- **Разблокирует:** 10, 13, 39. **Усилие:** S. **Дисциплины:** DEV, SEC.

### F2 — Server-side authorization денежных переходов
- **Зачем:** нет проверки, что оплачено == `deals.amount` и что payout уходит только verified-KYC продавцу сделки → манипуляция суммой/получателем.
- **Скоуп:** при создании checkout — сумма из сервера (не из клиента); при payout — получатель = `deals.seller_id` с подтверждённым KYC (Stripe Connect account verified); сверка `paid_amount == deals.amount` до release; запрет release при KYC≠verified.
- **Acceptance:** подмена суммы/получателя на клиенте не проходит; payout невозможен без verified-KYC.
- **Разблокирует:** 10, 11, 13. **Усилие:** M. **Дисциплины:** SEC, LEGAL, DEV.

### F3 — PSD2/AML-гейт (письменное подтверждение) — см. отдельный документ
- **Зачем:** холд чужих средств = payment services; статус по PSD2 и AML-обязанности не определены. Самый долгий (внешний) — начинать первым.
- **Скоуп:** см. [escrow-legal-gate.md](escrow-legal-gate.md) — вопросы к Stripe + BE-counsel + NBB; кто obliged entity / SAR в CTIF-CFI / sanctions; конфликт AML-retention 10 лет vs GDPR-erasure.
- **Acceptance:** письменное заключение получено; модель Stripe Connect подтверждена; решено, нужна ли NBB-регистрация агента.
- **Разблокирует:** 10, 11, 13 (прод-запуск). **Усилие:** L (внешнее). **Дисциплины:** LEGAL, SEC.

### F4 — GDPR-фундамент (RoPA / DPIA / DPA-реестр / transfers / retention / DPO)
- **Зачем:** механики GDPR в коде есть, но нет базовых артефактов; для trust-платформы с профайлингом DPIA обязателен (Art.35).
- **Скоуп:** RoPA (Art.30); DPIA (Art.35) для escrow+KYC+fraud-профайлинга; реестр DPA с процессорами (Stripe, itsme, Supabase, Bpost, Sentry, fraud-API); SCCs/мех-мы трансфера (Schrems II); retention-таблица с числами по типам данных (OTP/логи/чат/сделки/KYC); назначить/оформить DPO; cookie-banner reject==accept симметрия (GBA).
- **Acceptance:** артефакты созданы и связаны; PRD 41 переведён ✅; retention enforce-ится cron'ом.
- **Разблокирует:** 41, 30, 35, 38, 16, 17. **Усилие:** L. **Дисциплины:** LEGAL.

### F5 — DSA-роль платформы (PoC / legal rep / DSC) + правки нумерации
- **Зачем:** роль маркетплейса по DSA не зафиксирована; в PRD 38 перепутаны статьи.
- **Скоуп:** назначить Point of Contact (Art.11/12), legal representative; привязка к DSC (BIPT, Бельгия); починить ссылки (statement of reasons = Art.17, не 16); добавить Art.18/21/22/23(2)/24; Art.30 KYBC для traders включать при escrow (не откладывать).
- **Acceptance:** DSA-обязанности расписаны и назначены; PRD 38/40/14 обновлены.
- **Разблокирует:** 38, 40, 14. **Усилие:** M. **Дисциплины:** LEGAL.

### F6 — Единый sink аналитики `analytics_events` + воронка view→contact→deal
- **Зачем:** только сырьё-таблицы; сквозной воронки нет → KPI большинства PRD неизмеримы.
- **Скоуп:** таблица/поток `analytics_events(event_name, user_id?, session_id, ts, props jsonb, dedup_key)`; канон ~20 событий (view, search, swipe[dir], save_search, contact_start, deal_created/paid/delivered/released, dispute_*…); серверная запись ключевых; дедуп по `dedup_key`.
- **Acceptance:** воронка view→contact→deal строится сквозным запросом; события документированы (см. data-review).
- **Разблокирует:** 01, 33, 34, 37, 52, 58 + KPI всех. **Усилие:** M. **Дисциплины:** DATA, DEV.

### F7 — `generation_id` нормализованной колонкой + `resolveGeneration` (фикс 1996)
- **Зачем:** баг 1996 ЖИВ — `determineGeneration()` берёт `.find()` (первого кандидата) при overlap; `generation_id` хранится в JSONB без FK.
- **Скоуп:** колонка `adverts.generation_id uuid references vehicle_generations(id)`; серверный `resolveGeneration(modelId, year)` → `{status: unique|ambiguous|none, candidates[]}`; chooser в форме при ambiguous; бэкфилл существующих объявлений; убрать `.find()`-логику.
- **Acceptance:** тест 1996 BMW 5 → `ambiguous` (E34+E39), не авто-выбор; на карточке верный KB; FK enforce-ит валидную модель.
- **Разблокирует:** 62. **Усилие:** M. **Дисциплины:** DATA, DEV.

### F8 — Серверный client-IP (не доверять `x-forwarded-for`)
- **Зачем:** `getClientIp` берёт первый IP из клиентского XFF → все per-IP лимиты и гео-аномалии обходятся подделкой заголовка.
- **Скоуп:** брать IP из доверенного источника платформы (Vercel `x-vercel-forwarded-for`/`request.ip`), а не произвольного XFF; единый хелпер.
- **Acceptance:** подделанный `x-forwarded-for` не меняет rate-limit bucket.
- **Разблокирует:** 11, 13, 16, 35, 38, 55. **Усилие:** S. **Дисциплины:** SEC, DEV.

### F9 — Подключить `fraud-detection` в рантайм + `checkUserBlocked` fail-closed
- **Зачем:** fraud-engine и 8 правил существуют, но 0 call-site; `checkUserBlocked` fail-open на создании объявления.
- **Скоуп:** вызвать `fraud-detection` на create/publish/checkout; `checkUserBlocked(..., {failClosed:true})` на высокорисковых путях; price-anomaly/velocity подключить в листинг-флоу.
- **Acceptance:** заблокированный юзер не создаёт объявление при ошибке БД; bait/velocity флагаются в рантайме.
- **Разблокирует:** 38, 31, 10. **Усилие:** M. **Дисциплины:** SEC, DEV.

### F10 — Колонка `itsme_sub` + хард-реджект коллизии
- **Зачем:** в схеме есть только `itsme_verified`/`itsme_kyc_level`; колонки `itsme_sub` НЕТ → уникальность «один человек = один аккаунт» нереализуема.
- **Скоуп:** `profiles.itsme_sub text unique`; при itsme-callback — `INSERT/UPDATE` с проверкой уникальности `sub`; хард-реджект второго аккаунта на коллизию; OIDC state/nonce/signature + защита link-ATO (step-up).
- **Acceptance:** второй аккаунт на тот же `sub` отклоняется; verified-tier репутация портативна по `sub`.
- **Разблокирует:** 30, 55, 60. **Усилие:** M. **Дисциплины:** SEC, DATA.

### F11 — Дедуп `advert_views` + закрыть открытый anon-insert
- **Зачем:** накрутка просмотров течёт в ранжирование (`top_sellers.avg_views`), популярность, trust, аналитику.
- **Скоуп:** дедуп по (advert, viewer/ip-hash, окно времени); ограничить anon-insert (rate-limit/серверная запись); пересчитать зависимые метрики на дедуп-данных.
- **Acceptance:** повторные просмотры одним актором не накручивают счётчик; ранжирование/trust на чистых данных.
- **Разблокирует:** 33, 34, 37, 58. **Усилие:** M. **Дисциплины:** DATA.

### F12 — Подключить per-category JSON-LD + structured data в PRD 62 / SEO `/c/*`
- **Зачем:** генераторы `lib/seo/catalog/*` (RealEstateListing/JobPosting/Product) написаны, но 0 импортов; `/c/*` без SEO; PRD 62 без раздела structured data.
- **Скоуп:** подключить генераторы на ad-странице по категории (Vehicle/Car, RealEstate, Product, JobPosting); SEO категорийных страниц (метаданные/H1/BreadcrumbList/ItemList/перелинковка); маппинг полей карточки → schema.org (mileage/fuelType/EPC/baseSalary); заменить `seller`-заглушку.
- **Acceptance:** rich-results валидны по категориям; `/c/*` имеют уникальные метаданные.
- **Разблокирует:** 62, 32, 33, 31. **Усилие:** M. **Дисциплины:** SEO, DEV.

### F13 — Конфиг раскладки `catalog_groups` + рендерер с ARIA-tabs
- **Зачем:** текущий `FieldGroup` хардкодит `<h3>`-секции; вкладочная раскладка карточек (PRD 62) нереализуема.
- **Скоуп:** `catalog_groups(domain, group_key, display: tab|section, tab_key, tab_order, icon, collapsed)`; рендерер читает конфиг → вкладки (ARIA-tabs, клавиатура) или аккордеон; per-category стабильная раскладка (не по числу заполненных полей).
- **Acceptance:** транспорт/недвижимость — вкладки, мода/дом — секции; доступно с клавиатуры.
- **Разблокирует:** 62. **Усилие:** M. **Дисциплины:** DEV, UX.

### F14 — Явная trust-score формула + анти-накрутка
- **Зачем:** формулы trust нет (`deriveTrust` даёт только identity-уровни); `profiles.rating` = голый avg, default 5.0 (безотзывный = «идеальный»).
- **Скоуп:** прозрачная формула из проверяемых компонент (verified identity, завершённые escrow-сделки, споры/отмены, скорость ответа, риск-флаги чата); Байес/сглаживание рейтинга; анти-стэкинг отзывов (не через N объявлений одного продавца); объяснение составляющих в UI.
- **Acceptance:** trust-score воспроизводим и объясним; накрутка через пустой рейтинг/мульти-листинги невозможна.
- **Разблокирует:** 37, 34, 60. **Усилие:** M. **Дисциплины:** DATA, UX.

---

## Порядок запуска
1. **Параллельно-внешнее (долгое):** F3 (юр-гейт), F4 (GDPR-артефакты), F5 (DSA-роль) — начать первыми, т.к. ждут людей вне команды.
2. **Дешёвые быстрые победы:** F1, F8, F10 (S), затем F9, F11.
3. **Под текущий фокус (дизайн/карточки):** F7 (фикс 1996), F13 (вкладки), F12 (SEO/structured data), F14 (trust) — разблокируют 62/37/32/33.
4. **F2, F6** — перед денежным/аналитическим ядром.

Историческая трассировка: эти F-тикеты были предпосылками старого [MASTER_TODO](../MASTER_TODO.md). Исполнять их можно только при прямой ссылке из актуального [MASTER_PRODUCTION_TZ](../MASTER_PRODUCTION_TZ.md).
