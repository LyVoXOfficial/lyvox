# LyVoX — состояние проекта и следующие шаги

Дата: 2026-06-27
Автор: ассистент (онбординг-аудит по коду + свежий рыночный ресёрч)

Цель документа — дать цельную картину по четырём осям: **состояние кода, конкурентное поле Бельгии, готовность к запуску, приоритеты.** Опирается на реальный код репозитория и на источники 2026 года (см. конец).

---

## 0. TL;DR

LyVoX — это **не идея, а зрелый pre-launch продукт**. Классифайд-слой (объявления, поиск, чат, медиа, модерация) сильный. За последние недели код ушёл вперёд относительно стратегических доков: уже появились **chat anti-fraud (scrubContacts), saved-searches + алерты, reviews, бизнес-аккаунты, KYC/verifications, badges**, а все 5 локалей (NL/FR/EN/DE/RU) синхронизированы.

**Главный нерешённый пробел остался прежним и он же — суть всей стратегии:** транзакционного ядра (escrow / safe deal / payout / disputes) **нет**. Это и есть единственное реальное конкурентное преимущество против 2dehands и Facebook Marketplace. Пока его нет — LyVoX это «ещё один классифайд», а с ним — «единственное место в Бельгии, где сделка структурно безопасна».

---

## 1. Состояние кода

Стек: Next.js 16 / React 19 / TypeScript 5.9 / Tailwind 4 / Supabase (Postgres+Auth+Storage) / Edge Functions / Stripe / Upstash. Монорепо на pnpm+Turbo, husky pre-commit, ~78 API-роутов, 70 миграций, тесты (vitest). Очень активная разработка (десятки коммитов в день).

### Готово / сильное
- **Объявления:** 8-шаговый мастер создания, автосейв, категорийные поля, медиа со signed-storage.
- **Поиск:** Postgres FTS, фильтры, гео, сортировки, пагинация, проекция на карточные поля.
- **Чат:** realtime, RLS-scoped, unread-трекинг; недавно починена рекурсия в RLS.
- **Chat anti-fraud:** `lib/chat/scrubContacts.ts` (+тесты) — маскирование телефонов/email/ссылок. *Был «критическим пробелом» в стратегии — теперь закрыт.*
- **Reviews:** таблица + chat-gated RPC + триггер рейтинга + UI (`LeaveReviewForm`).
- **Saved searches + алерты:** таблицы, API, cron-рассылка. *Топовый retention-рычаг — уже есть.*
- **Бизнес-аккаунты:** businesses_core, члены команды, верификация, pro-подписка, KBO/CBE-онбординг.
- **Identity/KYC:** verifications, kyc_records, badges; phone OTP, WebAuthn, itsme OAuth (закодирован).
- **Модерация/жалобы:** очереди, reports (5 причин, rate-limit), admin-review, AI-moderation + fraud-detection Edge Functions.
- **Комплаенс-флоу:** удаление/экспорт аккаунта (GDPR), consent-история, erasure-миграция, retention cron.
- **i18n:** 5 локалей синхронизированы построчно (1887 строк каждая).

### В работе (uncommitted на момент аудита)
- Pro-кабинет (BusinessCabinet, ProOnboardingWizard, TeamManager) + правки локалей.
- Большой редизайн под макеты (серия коммитов T0–T4: header, home, listing detail, search, seller profile).

### Ключевой пробел (критический)
- **Транзакционное ядро отсутствует:** нет таблиц/флоу `deals`, `deal_events`, `deal_payments`, `disputes`, нет payout. Stripe обслуживает только платные промо/буусты, **не сделки между покупателем и продавцом.** Без этого нет escrow, нет dispute-движка, нет «trust as a product».
- **Сопутствующее:** fraud-detection engine и trust_score существуют, но в рантайм-флоу подключены частично; интеграцию надо доводить.

---

## 2. Конкурентное поле Бельгии (свежие данные 2026)

| Игрок | Сила | Где слаб (окно для LyVoX) |
|---|---|---|
| **2dehands / 2ememain** (Adevinta) | Доминирующий классифайд, ~3–6 млн уник. визитов/мес, десятки тысяч новых объявлений/день, авто-вертикаль, бизнес-портал | Низкие оценки на Trustpilot; «верификация» = микроплатёж с банка, не identity; продукт = доска + реклама, не managed-сделка; основной канал purchase-fraud в Бенилюксе |
| **Facebook Marketplace** | Мгновенная аудитория, соцграф, лёгкий старт | Нет защиты оплаты при локальном самовывозе (доминирующий режим в BE); масса одноразовых аккаунтов; слабый локальный комплаенс |
| **Vinted** | Лидер second-hand fashion в ЕС, интеграция с Bpost, buyer protection | Узкая категория (мода); seller protection воспринимается спорно; жёсткие окна осмотра |
| **bol.com** | Доверие, логистика, quality-gates | Это B2C-ритейл, не P2P-классифайд |

**Рыночный контекст (2026):**
- E-commerce Бельгии ≈ $24 млрд (2026), стабильный рост; second-hand/circular растёт быстрее рынка (≈72% регулярных покупателей участвуют в C2C-ресейле).
- **Bancontact** — де-факто стандарт оплаты (≈30% предпочтений), **обязателен** для бельгийского checkout.
- **itsme** — >8 млн пользователей, >80% взрослых, eIDAS High, >1 млн идентификаций/день. Это уникальный бельгийский trust-рельс, которого нет у западных инкумбентов. itsme OAuth у тебя уже закодирован.
- **Фрод как боль рынка:** ~2/3 взрослых бельгийцев сталкивались со скамом; marketplace-скам — одна из самых быстрорастущих категорий; фейковые payment/transport-ссылки — типовой вектор. Это прямое подтверждение trust-first тезиса.

**Вывод:** выигрывать не широтой и не ликвидностью (проиграешь), а как **единственное место, где конкретная «страшная» сделка структурно безопасна** — в узком плацдарме (1 регион + 1–2 категории: электроника/телефоны, велосипеды, кроссовки). Это фора на 6–18 месяцев, а не вечный ров; реалистичный эндшпиль — «выиграть нишу → продаться или остаться прибыльной нишей».

---

## 3. Готовность к запуску

**Что мешает запускать прямо сейчас:**
1. **Нет safe-deal.** Маркетинг «trust-first» без работающего escrow + быстрых человеческих споров бьёт по бренду сильнее, чем помогает. Одна вирусная история скама на «безопасном» маркетплейсе токсична.
2. **Регуляторика уже жёстче (нужно заложить флоу, не только тексты):**
   - **DSA:** Know-Your-Business-Customer для трейдеров (дедлайн соответствия был 17.02.2025), trader-traceability, Art.16 notice-and-action, Art.20 человеческий разбор апелляций.
   - **Recupel/WEEE (с 29.03.2025):** оператор онлайн-маркетплейса обязан информировать продавцов электроники об EPR и проверять их соответствие (или брать обязанности на себя). Касается тебя сразу, как только заводишь электронику + бизнес-продавцов.
   - **GPSR:** обработка нотисов об опасных товарах за 3 дня, контактная точка по безопасности.
   - **DAC7:** сбор налоговых данных продавцов — собирать с первого дня (отчёт годовой, отложен).
   - **Consumer law:** как только привлекаешь power-sellers/трейдеров — 14-дневное право отказа, гарантии. Стратегия сидинга создаёт это обязательство в день первой такой сделки.
3. **Платежи:** Bancontact обязателен; для safe-deal реалистичная для соло-разработчика модель — **Stripe Connect (separate charges + manual/delayed payout)**. До стройки — письменно подтвердить у Stripe/юриста, какие KYC/AML/мониторинг-обязанности остаются на LyVoX в Бельгии.

**Что к запуску уже готово:** локализация NL/FR/EN (+DE/RU), GDPR-флоу (экспорт/удаление/consent), чат-антифрод, reviews, saved-searches, модерация, бизнес-верификация.

---

## 4. Приоритеты — что делать дальше

Сверено с твоей стратегией (NOW-1 / NOW-2) и с тем, что **уже реально в коде**.

**Сначала — дешёвая проверка тезиса (NOW-1), без стройки escrow:**
1. Зафиксировать плацдарм: 1 регион + 1–2 категории (электроника/телефоны / велосипеды / кроссовки).
2. Первые ~100 сделок закрывать вручную через Stripe Checkout/payment links + founder-mediated release — проверить, что за безопасность платят, прежде чем строить машину.
3. Operating model спорам с жёстким лимитом одновременных открытых споров под пропускную способность одного человека.
4. Довести **itsme до прод-теста** + enforce уникальность по `sub` (один человек = один аккаунт) + начать заполнять trust_score из завершённых сделок.
5. C2C-vs-трейдер на онбординге (consumer-rights + DSA trader-info). DAC7 — собирать данные.
6. Brand anti-spoofing: канонический домен, DMARC/DKIM/SPF, никаких кликабельных ссылок в письмах.

**Затем — масштабируемое ядро (NOW-2), только после подтверждения тезиса:**
7. **Shipped-only, tracking-gated escrow** через Stripe Connect, escrow-by-default, Bancontact на checkout, авто-рефанд. In-person handover escrow — отложить (самый спорный режим).
8. **Dispute-движок** в связке с escrow (общий evidence-таймлайн, мотивированное решение, апелляция, SLA) — выкатывать **вместе** с escrow, не порознь.

**Параллельно — добить интеграции существующего:**
9. Подключить fraud-detection engine + AI-moderation в рантайм-флоу листинга/checkout; `checkUserBlocked` сделать fail-closed на высокорисковых путях.
10. Boost/premium — влияние на ранжирование (сейчас `search_adverts` их игнорирует), но включать только когда появится ликвидность.
11. PWA (manifest + service worker + push), с email/SMS-ретеншеном для iOS.

---

## 5. Как ассистент может помогать дальше

- **Код/инженерия:** проектирование и реализация транзакционного ядра (deals/escrow/disputes на Stripe Connect), интеграция fraud-engine, рефакторинг, тесты, ревью, Supabase RLS/миграции, перфоманс.
- **Стратегия/рынок:** держать конкурентные данные свежими, считать unit-экономику комиссии, апдейтить COMPETITIVE_STRATEGY.md фактами.
- **Продукт/UX:** аудит экранов, дизайн-система, флоу продавца с верификацией, копирайт интерфейса на 3 языках.
- **Маркетинг/запуск:** SEO под бельгийские запросы (NL/FR), лендинг, контент, go-to-market плацдарма, концирж-сидинг.
- **Юридика/комплаенс:** чек-листы DSA/GPSR/Recupel/DAC7/GDPR как продуктовые гейты, а не только тексты.

---

## Источники (2026)
- Similarweb — [2dehands.be](https://www.similarweb.com/website/2dehands.be/), [2ememain.be](https://www.similarweb.com/website/2ememain.be/)
- Adevinta — [2dehands/2ememain](https://adevinta.com/brand/2dehands-2ememain/)
- Trustpilot — [2dehands.be reviews](https://www.trustpilot.com/review/www.2dehands.be)
- Vinted — [Buyer Protection fee](https://www.vinted.com/help/342-buyer-protection-fee-on-vinted), [Vinted Pro](https://www.vinted.com/help/3/918-vinted-pro-service); [Failory: Vinted business model 2026](https://www.failory.com/blog/vinted-business-model)
- Safeonweb — [Scammers on second-hand platforms](https://safeonweb.be/en/look-out-scammers-online-second-hand-platforms); ECC Belgium — [Online sales fraud](https://www.eccbelgium.be/themes/scams/types-of-fraud/online-sales-fraud); GASA — [State of Scams in Belgium 2025](https://gasa.org/knowledge-base/reports/state-of-scams-in-belgium-2025)
- itsme — [eIDAS LoA High](https://www.itsme-id.com/business/blog/eidas-loa-high), [NL launch](https://www.itsme-id.com/business/blog/launch-netherlands)
- E-commerce BE — [Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/belgium-ecommerce-market), [Statista outlook](https://www.statista.com/outlook/emo/ecommerce/belgium)
- Регуляторика — [Recupel: online marketplace operator](https://www.recupel.be/en/register-operator-online-marketplace), [Recupel: legal obligations](https://www.recupel.be/en/place-appliances-market/legal-obligations), [Freshfields: DSA & marketplaces](https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/dsa-decoded-9-the-dsa-and-online-marketplaces-102lx12)
