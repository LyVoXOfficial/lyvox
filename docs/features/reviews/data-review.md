# DATA-ревью PRD LyVoX (до airtight)

> **Ревьюер:** DATA / ML-инженер + продуктовый аналитик
> **Дата:** 2026-06-28
> **Зона:** 62 (KB + range-aware матчинг, баг 1996), 37 (trust-score), 34 (taste/рекомендации), 33 (ранжирование), 52 (AI-цена), 58 (аналитика продавца), 01 (аналитика свайпов)
> **Метод:** прочитаны все 7 PRD + сверка с фактической схемой (`supabase/migrations/*`) и кодом (`apps/web/src/app/ad/[id]/page.tsx`, `lib/trust/deriveTrust.ts`).
> **Поля/таблицы/события — английский. Остальное — русский.**

Легенда вердиктов: ✅ airtight (data-часть) · 🔄 нужны правки (перечислены) · ⛔ блокер по данным (без этого нельзя зашивать).

---

## 0. Резюме (для занятых)

- **Баг 1996 НЕ исправлен в коде.** `determineGeneration()` (`ad/[id]/page.tsx:1212–1248`) использует `generations.find(...)` → возвращает **первого** кандидата при overlap. PRD-62 описывает правильный фикс (range-aware + чузер), но в коде range-логика всё ещё «молча угадывает». Это главный блокер.
- **Trust-score формулы нет вообще.** `deriveTrust.ts` выдаёт только identity-уровни L0–L4. `trust_score.score` — голый `int`, инкрементится непрозрачной `trust_inc()` из модерации. Веса/компоненты/нормализация не определены. PRD-37 DoD «объяснение составляющих» невыполним без модели.
- **`advert_views` без дедупа** (нет unique-ключа, `anon insert with check(true)`) → счётчик просмотров накручиваем; на нём же стоит `top_sellers.avg_views` (ранжирование) и аналитика продавца (58). Data-leakage + накрутка в трёх PRD сразу.
- **Reviews-стэкинг:** `unique(advert_id, reviewer_id)` ограничивает 1 отзыв на объявление, но не на продавца → один пользователь может «накидать» рейтинг через N объявлений одного продавца.
- **Аналитических событий нет как класса.** Только сырьё (`advert_views`, `advert_likes`, `favorites`). Сквозной воронки `view → contact → deal` с единой схемой событий не существует — её надо определить (см. §9).

---

## 1. PRD-62 — Карточки по категориям + базы знаний + range-aware матчинг

### 1.1 Data-пробелы

**A. Баг 1996 — корень в коде, а не только в PRD (БЛОКЕР).**
Фактическая функция:
```
// ad/[id]/page.tsx:1230-1242
const match = generations.find((generation) => {
  const startMatch = generation.start_year === null || generation.start_year <= advertYear;
  const endMatch   = generation.end_year   === null || generation.end_year   >= advertYear;
  return startMatch && endMatch;        // <-- .find() = ПЕРВЫЙ кандидат, молчаливый выбор
});
```
При overlap E34 (1988–1996) / E39 (1995–2003) и year=1996 возвращается тот, что раньше в сортировке (`order start_year asc` → E34). Это и есть симптом. PRD описывает правильное решение, но:
- PRD не фиксирует, что **бэкенд-источник истины** — это явный `generation_id` на объявлении, а fallback-by-year должен оставаться **только** для legacy-объявлений без `generation_id`, и при ambiguous он обязан показывать «уточните», а не угадывать. Сейчас `determineGeneration` сначала смотрит `specifics.generation_id` (хорошо), но при его отсутствии тихо берёт первого.
- Нет правила миграции/бэкфилла существующих объявлений (у скольких нет `generation_id`? как разрешать их ambiguous-кейсы — массово пометить «поколение не выбрано»?).

**B. `generation_id` не хранится в нормализованной колонке.** Сейчас он лежит в `specifics` (JSONB, `specifics.generation_id`). Нет FK на `vehicle_generations(id)`, нет валидации, что выбранное поколение принадлежит выбранной модели. Можно записать `generation_id` чужой модели — KB подтянет мусор.

**C. KB-модель не унифицирована (есть только транспорт).** Миграции содержат `vehicle_*` (makes/models/generations/insights + i18n), но `device_models`, `pet_breeds`, `fashion_brands`, общей `kb_entities/kb_insights` — **нет ни одной таблицы**. Все KB-обещания §5 (electronics/pets/fashion) — на бумаге.

**D. Качество/полнота справочника поколений неизвестны.** Нет метрик покрытия: сколько моделей имеют ≥1 поколение, доля поколений с заполненным `start_year`, доля с `end_year=NULL` (в производстве vs «просто не заполнили» — это два разных смысла, схема их не различает!). `end_year=NULL` сейчас перегружен: «в производстве» И «неизвестно» → range-matching будет ложно матчить «неизвестные» поколения на любой свежий год.

**E. `years_available int[]` на `vehicle_models` дублирует range на `vehicle_generations`.** Два источника истины по годам → риск рассинхрона. Нужен один канон (диапазоны поколений), массив на модели — производный/кэш.

**F. catalog_groups для раскладки вкладки/секции не существует.** PRD предлагает `catalog_groups` или `metadata`. В схеме `catalog_fields.metadata jsonb` есть, но конфига display/tab нет. Без него «вкладки vs секции» — хардкод (как сейчас `<h3>`-секции).

### 1.2 Что добавить, чтобы airtight

**Range-aware `resolveReference` — обобщённый контракт (общий для ВСЕХ диапазонных справочников):**
```
resolveReference(input: {
  refTable: 'vehicle_generations' | 'device_models' | 'property_year_norms' | 'fashion_collections',
  parentId: uuid,          // model_id / brand_id / ...
  value: number,           // year / release_year / build_year
  rangeStartCol: 'start_year',
  rangeEndCol:   'end_year', // NULL trailing = open range
}): {
  status: 'unique' | 'ambiguous' | 'none',
  candidates: Array<{ id, label, range_start, range_end, distinguishers }>,
  // distinguishers: краткие отличия (code/body/photo) для чузера
}
```
SQL-ядро (одинаковое для всех таблиц):
```sql
where parent_id = :parentId
  and range_start <= :value
  and (range_end is null or :value <= range_end)
order by range_start asc
```
- `count = 1` → `unique` (авто-выбор + «изменить»).
- `count > 1` → `ambiguous` → **обязательный чузер**, ничего не пишем молча.
- `count = 0` → `none` → ближайшие по `abs(range_start - value)` + опция «не в списке/неизвестно».

**Семантику `end_year` развести явно** (устранить перегрузку NULL):
- Добавить `production_status text check in ('in_production','ended','unknown')` ИЛИ соглашение: `end_year=NULL AND in_production=true`. Range-matching по открытому диапазону применять **только** к `in_production=true`. Для `unknown` — не матчить молча, считать кандидатом «под вопросом».

**Хранение выбора (нормализация + целостность):**
- Добавить нормализованную колонку `adverts.generation_id uuid references vehicle_generations(id)` (или generic `adverts.kb_reference_id` + `kb_reference_type`), помимо `specifics`.
- CHECK/триггер: `generation_id` принадлежит `model_id` (защита от cross-model мусора).
- Backfill-стратегия: прогнать `resolveReference` по всем legacy-объявлениям; `unique` → проставить; `ambiguous`/`none` → `generation_id=NULL` + флаг `kb_needs_review=true` (не угадывать ретроактивно).

**Унифицированная KB-схема (новые миграции):**
```sql
kb_entities (
  id uuid pk, domain text, entity_type text,   -- 'device_model'|'pet_breed'|'fashion_brand'
  ref_key text,                                 -- стабильный машинный ключ
  parent_ref uuid null,                         -- бренд → модель и т.п.
  range_start int null, range_end int null,     -- для диапазонных (год релиза/ревизии)
  range_status text null,                        -- in_production|ended|unknown
  facts jsonb default '{}',
  source text, source_date date,                -- провенанс (обязателен для KB)
  created_at timestamptz
)
kb_insights (
  entity_id uuid pk references kb_entities(id),
  pros text[], cons text[], watchouts text[], tips text[],
  facts jsonb,                                   -- official_specs/typical_used_price/...
  reliability_score numeric null,
  created_at timestamptz
)
kb_insights_i18n (entity_id, locale, pros[], cons[], watchouts[], tips[], pk(entity_id, locale))
```
Транспорт оставить в `vehicle_*` (как есть), новые категории — в `kb_*`. UI-блок «Об этой модели» читает через единый адаптер.

**Метрики качества справочников (DATA-дашборд, добавить в §10 PRD):**
- `kb_coverage_rate` = доля объявлений категории с непустым `reference_id`.
- `kb_ambiguity_rate` = доля резолвов со статусом `ambiguous` (целевой KPI «неверно сопоставленных → 0» измеряется именно так).
- `kb_orphan_rate` = доля моделей без поколений / поколений без insights / insights без i18n.
- `range_overlap_count` per model — каталог-санитар: подсветить все модели с пересекающимися диапазонами (их у нас не баг, а норма, но надо знать объём для чузера).

**catalog_groups (конфиг раскладки):**
```sql
catalog_groups (domain text, group_key text, display text check in ('tab','section'),
  tab_key text, tab_order int, icon text, collapsed_by_default bool, pk(domain, group_key))
```

### 1.3 Вердикт: ⛔ (баг 1996 не закрыт в коде; KB-унификация и нормализация `generation_id` отсутствуют)

---

## 2. PRD-37 — Trust-score, бейджи, отзывы

### 2.1 Data-пробелы

**A. Формулы trust-score не существует (БЛОКЕР для DoD).** `deriveTrust.ts` = только identity-levels L0–L4. `trust_score.score int` мутируется `trust_inc()` (модерация), это не репутационный балл. PRD §13 «веса составляющих» открыт → весь алгоритм undefined. DoD «объяснение составляющих» неисполним: нет хранимых компонент.

**B. Нет хранения компонент score (нельзя объяснить).** Таблица — один `score`. Чтобы показать «почему такой» (верификация / сделки / споры / скорость ответа), нужны разложенные субскоры с timestamp пересчёта.

**C. Reviews — два анти-накрутка пробела:**
- **Стэкинг по продавцу:** `unique(advert_id, reviewer_id)` не мешает одному ревьюеру оставить отзывы на N объявлений одного продавца → массовый буст/слив рейтинга. Нужен `unique(subject_id, reviewer_id)` ИЛИ оконное ограничение (1 отзыв на пару за период).
- **Chat-gate форджабелен через дешёвый контакт:** gate = «есть conversation, где оба участника». Завести conversation дёшево (1 сообщение). Для contact-only маркетплейса это пока единственный возможный гейт, но он открывает накрутку «договорились друг друга оценить». Нужен сигнал-вес: отзывы от L0/L1 и от свежих аккаунтов — пониженный вклад в агрегат.

**D. `profiles.rating` пересчитывается как простое `avg(rating)`** (триггер `refresh_seller_rating`). Нет:
- байесовского сглаживания (новый продавец с 1×5★ = «идеальный» 5.0; defaultит в 5.0 даже при 0 отзывов — вводит в заблуждение);
- защиты от bombing (вес по доверию ревьюера);
- разделения «нет отзывов» vs «средний 5.0».

**E. Data-leakage в `top_sellers`:** ранжирование тянет `avg_views` из ненадёжного `advert_views` (см. §0). Trust-выдача накручиваема через фейковые просмотры.

**F. Портативность по `sub` (verified identity) описана, но в схеме `trust_score.user_id → auth.users(id)`** — привязка к аккаунту, не к verified-identity. При пере-регистрации с тем же itsme-`sub` перенос репутации не определён в данных.

### 2.2 Что добавить

**Явная формула trust-score (вписать в PRD, не оставлять «веса — открытый вопрос»):**
```
trust_score = round(100 * sigmoid(
    w_id   * identity_level_norm        // L0..L4 → 0..1
  + w_deal * completed_deals_norm       // log1p(deals) нормализ. (когда escrow появится)
  + w_rev  * bayes_rating_norm          // байес-сглажённый рейтинг (см. ниже)
  + w_resp * response_speed_norm        // p50 времени ответа → 0..1 (быстрее = выше)
  - w_disp * dispute_rate               // споры/сделки
  - w_risk * chat_risk_flags_norm       // из 35-chat-antifraud
))
```
Стартовые веса (до калибровки на данных): `w_id=0.35, w_deal=0.25, w_rev=0.20, w_resp=0.10, w_disp=0.07, w_risk=0.03`. Калибровать по корреляции с конверсией (KPI PRD). **Пока нет сделок** (escrow не запущен) → `w_deal=0`, веса ре-нормировать на доступные сигналы; явно пометить score как «ранний».

**Байесовское сглаживание рейтинга** (вместо голого avg):
```
bayes_rating = (C * m + Σ ratings) / (C + n)
  m = глобальное среднее по платформе (стартовый prior, напр. 4.2)
  C = «виртуальные» отзывы (вес prior, напр. 5)
  n = число валидных отзывов
weighted: каждый rating домножается на reviewer_trust_weight (L0/L1 < L4)
```

**Таблица компонент (для объяснимости + анти-leakage аудита):**
```sql
trust_score_components (
  user_id uuid references auth.users(id),
  component text,        -- 'identity'|'deals'|'reviews'|'response'|'disputes'|'risk'
  raw_value numeric, normalized numeric, weight numeric, contribution numeric,
  computed_at timestamptz, pk(user_id, component)
)
```
UI «почему такой score» читает отсюда. Пересчёт — батч/триггер, не on-the-fly.

**Анти-накрутка (data-уровень):**
- `reviews`: добавить `unique(subject_id, reviewer_id)` (или вынести гейт в `create_review`: один отзыв на продавца за rolling-90d).
- Хранить `reviewer_trust_weight` на момент отзыва (снапшот) для воспроизводимости агрегата.
- Anomaly-метрика: ревью-velocity по продавцу (всплеск отзывов от молодых аккаунтов в коротком окне → флаг в 38-moderation).
- `profiles.rating` default: разрешить `NULL` для «нет отзывов» (UI: «Нет отзывов» ≠ «5.0»).

**Портативность:** ключ репутации = verified-identity `sub`, не `user_id`. Добавить `identity_reputation (identity_sub text pk, score, ...)`; `trust_score.user_id` → резолв через `sub`. Пере-регистрация с тем же itsme не сбрасывает.

### 2.3 Вердикт: ⛔ (нет формулы и компонент score; reviews-стэкинг; avg без сглаживания; leakage из advert_views)

---

## 3. PRD-34 — Discovery-extras (taste / рекомендации / сравнение)

### 3.1 Data-пробелы

**A. Taste только в localStorage → невоспроизводимо, не оценимо.** Нельзя посчитать офлайн-качество рекомендаций (нет ground-truth логов сигналов на сервере). KPI «использование сравнения/избранного» считается, но качество rerank — нет.

**B. Веса taste (like+1/fav+2/pass−1/down−2) — эвристика без обоснования и без decay.** Нет временного затухания (старые интересы = текущие), нет нормализации по активности пользователя (актив с 1000 свайпов забивает сигнал).

**C. Cold-start = «популярное/новое», но «популярное» считается из `advert_views`** (ненадёжный, см. §0) и `lib/popularity.ts`. Популярность накручиваема.

**D. Saved-search алерты: дедуп/частота/quiet hours упомянуты, но схема `saved_search_alerts` не специфицирует ключ дедупа** (по `advert_id`? по `saved_search_id+advert_id`?) и окно. Риск дублей/спама или пропусков.

**E. `favorites` vs `advert_likes` — два разных счётчика, оба питают разные места** (favorites → личное + аналитика 58; likes → публичный счётчик + taste). Нет единого определения «engagement», легко рассинхрон в метриках.

### 3.2 Что добавить

- **Серверный лог taste-сигналов** (даже если rerank остаётся клиентским): `taste_signals (user_id|anon_id, advert_id, signal text, weight, ts)` под `functional`-consent — для офлайн-оценки качества (precision@k, like-rate uplift A/B). Без этого «рекомендации» не аудируемы.
- **Decay в taste:** `weight * exp(-Δt/τ)`, τ ~ 30 дней; нормализация вектора пользователя (L2) перед scoring.
- **Cold-start на надёжном сигнале:** популярность считать из дедупленных просмотров + контактов (см. §9), не из сырых views.
- **Дедуп алертов явно:** ключ `unique(saved_search_id, advert_id)` в `saved_search_alerts`; частота = max 1 дайджест/сутки/поиск; quiet hours из notification-prefs (36).
- **Единое определение engagement** для метрик: документировать, что `like` (публичный сигнал) и `favorite` (личный буклет) считаются раздельно, и какой идёт в taste, какой — в seller-analytics.

### 3.3 Вердикт: 🔄 (работает, но рекомендации неаудируемы; нужны серверный лог сигналов + decay + дедуп-ключ алертов + надёжная популярность)

---

## 4. PRD-33 — Поиск / ранжирование / релевантность

### 4.1 Data-пробелы

**A. Релевантность FTS не настроена/не измеряется.** Postgres FTS «as-built», но нет: весов полей (title >> description), `ts_rank` конфигурации, обработки опечаток (упомянута roadmap), синонимов/стоп-слов для NL/FR. «Релевантность» как сортировка есть, как качество — не оценивается.

**B. Boost-ранжирование за фиче-флагом — корректно, но нет анти-злоупотребления.** PRD верно откладывает влияние бустов до ликвидности. Но не определена формула смешивания (`final = relevance * (1 + boost_factor)`?) и cap, чтобы платный буст не топил релевантность полностью.

**C. Zero-result rate — ключевой KPI, но событие zero-result не логируется** (нет аналитического события `search_performed` с `result_count`). Без него KPI неизмерим.

**D. Нет лог-схемы поисковых запросов для оценки релевантности** (query → clicked_position). Невозможно посчитать MRR/CTR@k или обучить ранжирование позже.

### 4.2 Что добавить

- **Веса FTS:** `setweight(title,'A') || setweight(description,'B')`; `ts_rank_cd` с нормализацией по длине; конфиг словарей `dutch`/`french`/`english` (i18n). Зафиксировать в PRD §5/§6.
- **Формула буст-микса с cap:** `final_score = base_relevance + min(boost_cap, boost_weight * is_boosted)`; буст — аддитивный bounded бонус, не множитель, чтобы нерелевантный буст не вылезал в топ. `boost_cap` за фиче-флагом + A/B.
- **События (см. §9):** `search_performed {query_hash, filters, result_count, zero_result: bool}`, `search_result_click {query_hash, advert_id, position}`. Это закрывает KPI zero-result-rate и даёт сырьё для MRR/CTR@k.
- **Zero-result loop:** логировать failed queries → словарь синонимов/редиректов (анти-отток).

### 4.3 Вердикт: 🔄 (поиск работает, но релевантность не измеряется и не настроена; нет search-событий для KPI; формула буста не определена)

---

## 5. PRD-52 — AI справедливая цена + bait-флаг

### 5.1 Data-пробелы

**A. Малый объём — главный риск, в PRD = открытый вопрос.** На запуске мало завершённых сделок и листингов по узким срезам (категория × модель × состояние × год). Простая статистика по тонкому срезу = шум; медиана по 2 объявлениям бессмысленна.

**B. Источник цены неоднозначен.** «История листингов/сделок» — но сделок нет (escrow не запущен), а **цена листинга ≠ цена сделки** (asking vs sold). Если оценивать по asking-ценам, bait-листинги сами портят медиану (рекурсивная проблема: дешёвый bait занижает медиану → следующий bait не ловится).

**C. Порог bait не определён** (PRD §13 открыт). «Относительно медианы» — но какой коэффициент, на каком объёме, с какой устойчивостью к выбросам.

**D. Data-leakage в оценке:** если в обучающую/статистическую выборку попадают уже-помеченные bait/мошеннические/удалённые листинги — оценка смещается. Нет правила исключения.

### 5.2 Что добавить

- **Иерархический fallback оценки (backoff при малом объёме):**
```
price_estimate(category, attrs):
  для уровня в [model+gen+condition+year_band, model+condition, category+condition, category]:
    n = count(comparable listings на уровне, исключая bait/removed/outliers)
    if n >= N_MIN (напр. 8): вернуть {median, IQR, n, level, confidence}
  иначе: {status: 'insufficient_data'}  // НЕ показывать число
```
- **Робастная статистика:** медиана + IQR (не среднее); winsorize/trim хвостов; bait-кандидаты исключать из расчёта (разорвать рекурсию).
- **Confidence-бэйдж:** оценка всегда с `n` и уровнем backoff; при `n < N_MIN` — «недостаточно данных», не выдумывать.
- **Порог bait (стартовый, калибруемый):** `price < median * 0.5` И `n >= N_MIN` → soft-flag; `< median * 0.35` → strong-flag в 38-moderation. Пороги — конфиг, не хардкод.
- **Anti-leakage правило (зафиксировать в §5/§8 PRD):** из расчёта исключать `status in (removed, fraud_flagged)`, отзывы/листинги от заблокированных, и **сам оцениваемый листинг**.
- **Источник цены явно:** на MVP — asking-цены активных+проданных (с пометкой), при появлении escrow — переключиться на sold-цены (точнее). Документировать сдвиг asking→sold.

### 5.3 Вердикт: 🔄 (P2, но при малом объёме без backoff + робастной статистики + anti-leakage оценка будет вводить в заблуждение и сама генерить bait-петлю)

---

## 6. PRD-58 — Аналитика продавца

### 6.1 Data-пробелы

**A. Метрики стоят на ненадёжном `advert_views`** (нет дедупа, anon-insert open). Продавец увидит накрученные просмотры; «конверсия» (контакт/просмотр) искажена знаменателем.

**B. «Контакты» и «сделки» как метрики не имеют источника.** Контакт = старт conversation? Первое сообщение? Сделки нет (escrow не запущен). Воронка `view → contact → deal` не определена в данных end-to-end.

**C. Конверсия не специфицирована.** «Конверсия» = contacts/views? favorites/views? Нет формул и окон (за всё время / 7d / 30d).

**D. Привязка просмотра к owner для RLS owner-only — есть `advert_views.advert_id`, но агрегация по продавцу требует JOIN на adverts.user_id**; materialized-агрегаты не определены (PRD «опц.»). При росте — N+1 / тяжёлые запросы.

### 6.2 Что добавить

- **Дедуп просмотров (критично, общий фикс для 33/34/37/58):** `advert_views` → уникальность по `(advert_id, coalesce(user_id, ip_hash, anon_id), date_trunc('day', viewed_at))` ИЛИ отдельная `advert_view_daily (advert_id, viewer_key, day, count)`. Сырьё оставить, но метрики считать по дедупленному. Закрыть anon-spam (rate-limit + hash IP, не хранить сырой inet — GDPR).
- **Единая воронка-схема (см. §9):** `view → detail_view → contact_started → contact_replied → deal_started → deal_completed`. Каждый стейдж — событие с `advert_id, seller_id`.
- **Формулы дашборда (зафиксировать в §5 PRD):**
  - `contact_rate = unique_contacts / unique_detail_views`
  - `favorite_rate = favorites / unique_detail_views`
  - окна: 7d / 30d / all, с трендом.
- **Materialized `seller_analytics_daily`** (advert_id, seller_id, day, views_unique, likes, favorites, contacts, deals) + refresh cron; RLS owner-only через seller_id.
- **Privacy:** только агрегаты; viewer-идентичности не раскрывать; IP хранить как соль-хеш с TTL.

### 6.3 Вердикт: 🔄 (P2; зависит от дедупа views и определения воронки/контакта/сделки — без них дашборд врёт)

---

## 7. PRD-01 — Аналитика свайпов / сигналы

### 7.1 Data-пробелы

**A. События описаны в §9 PRD — это лучший по аналитике PRD из всех.** Перечень `discover_*` богатый и с полями. Но:
- **Нет приёмника/схемы хранения.** «лёгкая таблица или внешняя аналитика» (§6) — не решено. Без таблицы/sink события некуда писать; KPI (медиана свайпов, like-rate, undo-rate) неизмеримы.
- **`position_in_session` есть, но нет `session_id`** — нельзя собрать воронку open→N свайпов→action→chat на уровне сессии.
- **Taste/undo откатывает сигнал клиентски, но серверного лога нет** → like-rate/down-rate по категориям (для калибровки rerank, §9) посчитать нельзя.

**B. `discover_swipe.via: gesture|button|key` — отлично для a11y-аналитики, но нет `dwell_ms`** (время до решения) — ключевой сигнал качества/случайности свайпа (связан с undo-rate KPI).

**C. Дедуп событий при offline-очереди (§4.4 offline) не определён** → при ресинхронизации дубли свайпов исказят метрики.

### 7.2 Что добавить

- **Sink + схема (закрыть §6):** `analytics_events (id, session_id, user_id|anon_id, event_name, props jsonb, ts, client_dedup_key)` — единая таблица для ВСЕХ продуктовых событий (не только discover; переиспользовать в 33/58). `client_dedup_key` (uuid на клиенте) → идемпотентность при offline-ресинке. Батч-инсерт. RLS: insert свои; чтение — только аналитика/service.
- **Добавить в события:** `session_id` во все `discover_*`; `dwell_ms` в `discover_swipe`; `result_count` где уместно.
- **Воронка-определение в PRD §9:** `discover_open → discover_swipe (count≥N) → discover_action_message → chat_started`; формула like-rate = `swipe[dir=like] / swipe[all]` за сессию.

### 7.3 Вердикт: 🔄 (события спроектированы отлично; не хватает sink/схемы хранения, session_id, dwell_ms, dedup-ключа — без них KPI неизмеримы)

---

## 8. Сквозные DATA-требования (для всех PRD)

1. **Единый sink событий `analytics_events`** (§7.2) — основа для KPI всех PRD (01/33/34/52/58). Без него ни одна воронка не измерима.
2. **Дедуп `advert_views`** — общий блокер для 33/34/37/58 (накрутка + leakage в ранжирование, рекомендации, trust, аналитику).
3. **`generation_id`/`reference_id` как нормализованная колонка с FK** + range-status — устраняет баг 1996 на уровне данных, не только UI (62).
4. **Унифицированная KB-схема `kb_entities/kb_insights/_i18n`** + провенанс (source/date) — один UI-блок, один матчер для всех категорий (62, питает 52 «справедливая цена» для electronics).
5. **Анти-leakage реестр:** во всех скорингах (trust 37, price 52, popularity 34, ranking 33) исключать `removed/fraud_flagged/blocked` сущности и сам оцениваемый объект. Зафиксировать как сквозное правило.
6. **Обобщённый `resolveReference`** — один контракт для всех диапазонных справочников (generations, device-revisions, property-build-year-norms, fashion-collections). §1.2.
7. **Робастная статистика по умолчанию** (медиана/IQR/байес/winsorize) везде, где малый объём: цена (52), рейтинг (37), популярность (34).
8. **Провенанс KB обязателен** (source, source_date, «справочно») — юр-аккуратность + аудит свежести.
9. **GDPR в аналитике:** IP только как соль-хеш с TTL; taste/events под `functional`-consent; экспорт/удаление аккаунта чистит `analytics_events`, `taste_signals`, `trust_score_components`.
10. **Реестр KPI ↔ событие:** каждый KPI в PRD должен ссылаться на конкретное событие/метрику из §9 (сейчас KPI есть, источника данных у многих нет).

---

## 9. Минимальный набор аналитических событий (end-to-end воронка)

Единая схема: `analytics_events(session_id, user_id|anon_id, event_name, props, ts, client_dedup_key)`.
Сквозные поля во всех событиях: `session_id`, `actor (anon|registered|verified)`, `locale`, `platform (web|pwa)`, `ts`.

### 9.1 Воронка discovery → contact → deal (канон)

| # | event_name | Ключевые props | Стейдж воронки | Питает PRD/KPI |
|---|---|---|---|---|
| 1 | `search_performed` | query_hash, filters{}, result_count, zero_result:bool, sort | вход (поиск) | 33 (zero-result rate, CTR) |
| 2 | `search_result_click` | query_hash, advert_id, position, page | переход | 33 (MRR/CTR@k) |
| 3 | `discover_open` | drop | вход (свайпы) | 01 |
| 4 | `discover_swipe` | direction(like\|pass\|act\|down), advert_id, category_id, seller_verified, position_in_session, dwell_ms, via(gesture\|button\|key) | вовлечение | 01 (like-rate, down-rate, undo-rate), 34 (taste) |
| 5 | `discover_undo` | undone_direction, advert_id | качество свайпа | 01 |
| 6 | `advert_view` | advert_id, seller_id, source(search\|discover\|direct\|similar), viewer_key(dedup) | **TOP воронки** | 33/34/37/58 (дедупл. просмотры) |
| 7 | `advert_detail_view` | advert_id, seller_id, source, dwell_ms | интерес | 58 (знаменатель конверсии) |
| 8 | `advert_favorite` | advert_id, seller_id, action(add\|remove) | сигнал интереса | 34/58 |
| 9 | `advert_like` | advert_id, seller_id | публичный сигнал | 34/58 |
| 10 | `kb_block_view` | advert_id, reference_id, has_data:bool | вовлечённость в KB | 62 (KPI «вовлечённость в KB») |
| 11 | `kb_resolve` | model_id, year, status(unique\|ambiguous\|none), candidate_count | качество матчинга | 62 (KPI «неверных → 0» = ambiguity-rate) |
| 12 | `kb_ambiguity_resolved` | model_id, chosen_generation_id, candidate_count | пользователь уточнил | 62 |
| 13 | `price_suggestion_shown` | category, level, n, median, status(estimate\|insufficient) | оценка цены | 52 |
| 14 | `price_suggestion_applied` | category, suggested, chosen | использование подсказки | 52 (KPI) |
| 15 | `contact_started` | advert_id, seller_id, buyer_id, with_offer:bool, source(discover\|search\|detail) | **CONTACT** | 58 (contact_rate), 01, 37 |
| 16 | `contact_replied` | conversation_id, seller_id, response_latency_ms | скорость ответа | 37 (response component), 58 |
| 17 | `review_submitted` | advert_id, subject_id, reviewer_trust_level, rating | репутация | 37 (анти-накрутка velocity) |
| 18 | `deal_started` | advert_id, seller_id, buyer_id (когда escrow) | **DEAL start** | 37, 58 |
| 19 | `deal_completed` | deal_id, seller_id, buyer_id, amount_band | **DEAL done** | 37 (deal component), 52 (sold-цена), 58 |
| 20 | `saved_search_created` / `saved_search_alert_clicked` | saved_search_id, advert_id | ретеншен | 34 (CTR алертов) |

**Канон воронки конверсии (для дашбордов и KPI):**
```
advert_view (#6, dedup)
  → advert_detail_view (#7)
    → contact_started (#15)
      → contact_replied (#16)
        → deal_started (#18)          [после escrow]
          → deal_completed (#19)
```
Метрики: `detail_rate = #7/#6`, `contact_rate = #15/#7`, `reply_rate = #16/#15`, `deal_rate = #19/#15`. Окна 7d/30d/all.

### 9.2 Минимальный must-have на запуск (если ресурс ограничен)
События **#6, #7, #15, #16** + дедуп `advert_view` = вся базовая воронка `view→contact` и кормит 37/58/33 одновременно. KB-события **#11, #12** обязательны для проверки фикса бага 1996. Остальное — инкрементально.

---

## 10. Таблица вердиктов

| PRD | Область | Главные data-находки | Вердикт |
|---|---|---|---|
| **62** | KB + range-aware матчинг (баг 1996) | `determineGeneration` всё ещё `.find()` = молчаливый выбор (баг в коде, не только PRD); `generation_id` в JSONB без FK/валидации модели; KB-схема для не-транспорта отсутствует; `end_year=NULL` перегружен | **⛔** |
| **37** | Trust-score, отзывы | Формулы score нет (только L0–L4); компоненты не хранятся (объяснимость невозможна); reviews-стэкинг по продавцу; avg без байеса; leakage через advert_views; портативность по user_id, не по sub | **⛔** |
| **34** | Taste / рекомендации | Taste неаудируем (нет серверного лога сигналов); веса без decay/нормализации; cold-start на накручиваемой популярности; дедуп-ключ алертов не задан | **🔄** |
| **33** | Поиск / ранжирование | Релевантность не настроена/не измеряется; нет search-событий для zero-result KPI; формула буст-микса + cap не определены | **🔄** |
| **52** | AI-цена / bait | Малый объём без backoff; asking≠sold; bait-рекурсия в медиане; порог не задан; нет anti-leakage в выборке | **🔄** |
| **58** | Аналитика продавца | Стоит на недедупленных views; «контакт/сделка/конверсия» не определены в данных; нет materialized-агрегатов | **🔄** |
| **01** | Аналитика свайпов | События спроектированы отлично, но нет sink/схемы хранения, session_id, dwell_ms, offline-dedup → KPI неизмеримы | **🔄** |

**Sign-off DATA получают:** пока **ни один** (0/7). Блокеры: 62 и 37 (⛔). После закрытия сквозных требований §8 (sink событий + дедуп views + нормализация generation_id + формула trust + backoff цены) → 34/33/52/58/01 переходят в ✅, 62/37 — в 🔄 до реализации.

---

## 11. Топ-10 data-находок (приоритезировано)

1. **Баг 1996 жив в коде.** `determineGeneration()` (`ad/[id]/page.tsx:1212–1248`) использует `.find()` → молчаливый первый кандидат при overlap. PRD-фикс верный, но не реализован. **Блокер 62.**
2. **Trust-score формулы не существует.** `deriveTrust.ts` = только identity L0–L4; `trust_score.score` — непрозрачный модерационный int. PRD DoD «объяснить составляющие» невыполним. Нужна явная взвешенная формула + таблица компонент. **Блокер 37.**
3. **`advert_views` без дедупа + open anon-insert** → накрутка просмотров, протекающая в ранжирование (`top_sellers.avg_views`), рекомендации (popularity), trust и аналитику продавца. **Один фикс чинит 4 PRD.**
4. **Reviews-стэкинг:** `unique(advert_id, reviewer_id)` не мешает накрутке через N объявлений одного продавца. Нужен `unique(subject_id, reviewer_id)` + вес ревьюера по доверию.
5. **Нет единого sink аналитических событий.** Только сырьё-таблицы. Воронка `view→contact→deal` end-to-end не существует → KPI большинства PRD неизмеримы. Нужна `analytics_events` + 20 событий (§9), must-have #6/#7/#15/#16.
6. **`generation_id` в JSONB без FK/валидации** → можно записать поколение чужой модели, KB подтянет мусор. Нормализовать в колонку с FK + CHECK «принадлежит модели».
7. **KB-схема для не-транспорта отсутствует** (device_models, pet_breeds, fashion, kb_entities/kb_insights). Все KB-обещания §5 PRD-62 — на бумаге. Нужна унифицированная схема + провенанс.
8. **`profiles.rating` = голый avg, default 5.0** → новый/безотзывный продавец выглядит «идеальным»; нет байеса, нет защиты от bombing. Байес-сглаживание + NULL для «нет отзывов».
9. **AI-цена при малом объёме сама создаёт bait-петлю** (asking-цены, bait занижает медиану). Нужны иерархический backoff + медиана/IQR + исключение bait/removed из выборки (anti-leakage).
10. **`end_year=NULL` перегружен** («в производстве» vs «неизвестно») → range-matching ложно матчит «неизвестные» поколения на любой свежий год. Развести `production_status`.

### PRD без data sign-off (все 7)
- ⛔ **62** (баг 1996 в коде + KB-схема + нормализация generation_id)
- ⛔ **37** (формула trust + компоненты + анти-стэкинг + байес)
- 🔄 **34** (серверный лог taste + decay + дедуп алертов)
- 🔄 **33** (релевантность + search-события + формула буста)
- 🔄 **52** (backoff + робастность + anti-leakage)
- 🔄 **58** (дедуп views + определение воронки + агрегаты)
- 🔄 **01** (sink + session_id + dwell_ms + offline-dedup)
