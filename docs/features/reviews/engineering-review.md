# LyVoX — Инженерное ревью PRD (staff-engineer)

> Роль: staff-инженер (Next.js 16 / React / TypeScript / Supabase / Stripe).
> Зона: технические PRD `01, 10, 11, 12, 13, 16, 17, 18, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 62` + контекст `audit/03-security-mobile-audit.md`.
> Метод: каждый PRD сверен с кодом (`apps/web/src`, `supabase/migrations`). Для каждого: (1) тех-пробелы/риски, (2) что добавить для реализуемости без вопросов, (3) вердикт ✅ sign-off / 🔄 доработать / ⛔ блокер + оценка S/M/L.
> Дата: 2026-06-28.

Условные обозначения вердикта:
- **✅ sign-off** — PRD реализуем как есть, инженеру не нужно задавать вопросов.
- **🔄 доработать** — концепция верна, но не хватает схем/сигнатур/правил, чтобы строить без догадок.
- **⛔ блокер** — есть нерешённый внешний/архитектурный гейт (юр-заключение, отсутствующая абстракция), без которого стройку начинать нельзя.

---

## Сквозные тех-требования (обязательны для всех денежных/транзакционных PRD)

Эти требования вынесены отдельно, чтобы не дублировать в каждом PRD. Любой эндпойнт/таблица из 10/11/12/13/16/39 им следует.

### S0. Идемпотентность вебхуков — на `event.id`, а не на бизнес-объекте
**Находка (код).** Текущий `api/billing/webhook/route.ts` дедуплицирует только по эффекту: `purchases.status === 'completed'` (строки 124-134), а подписочная ветка не дедуплицирует вовсе (идемпотентна «по эффекту» переустановки `pro_until`). Stripe-`event.id` нигде не хранится. Для escrow/payout/refund это **недопустимо**: повторная доставка события `transfer.created`/`charge.refunded` при race с ручным апдейтом приведёт к двойному payout/refund.
**Требование.** Завести таблицу-журнал обработанных событий:
```sql
create table webhook_events (
  id text primary key,              -- Stripe event.id
  provider text not null,           -- 'stripe' | 'stripe_connect' | 'bpost' | ...
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',  -- received|processed|failed
  payload jsonb
);
```
Обработчик: `INSERT ... ON CONFLICT (id) DO NOTHING` → если `0 rows` затронуто, событие уже видели → `200 OK` без побочных эффектов. Денежные мутации — внутри транзакции с апдейтом `processed_at`. Это must для PRD 10/12/13/39.

### S1. Провайдер-абстракция PSP/Carrier — определить интерфейс ДО стройки
PRD 10/13/39 трижды упоминают «провайдер-абстракцию», но интерфейс не задан → каждый инженер изобретёт свой. Зафиксировать в PRD 10:
```ts
interface PaymentProvider {
  createEscrowCheckout(input: EscrowCheckoutInput): Promise<{ sessionId: string; url: string }>;
  capture(intentId: string): Promise<void>;
  releaseToSeller(dealId: string, sellerAccountId: string, amount: Money): Promise<{ transferId: string }>;
  refundBuyer(dealId: string, amount: Money): Promise<{ refundId: string }>;
  verifyWebhook(rawBody: string, sig: string): WebhookEvent;
}
interface CarrierProvider {
  searchPoints(postcode: string, opts): Promise<PudoPoint[]>;
  createLabel(input: LabelInput): Promise<{ trackingNumber: string; labelUrl: string }>;
  parseWebhook(raw: string, sig: string): CarrierEvent;       // → внутренний enum-статус
  mapStatus(carrierCode: string): ShipmentStatus;
}
```
Stripe и Bpost — конкретные реализации. Это снимает риск vendor lock-in, заявленный в PRD.

### S2. Деньги — целочисленные минорные единицы + явная валюта
Во всех схемах `amount`/`protection_fee` хранить как `integer` (центы) + `currency text` (ISO-4217), не float/numeric с неявным масштабом. Добавить `Money = { amount: number; currency: string }` тип и запретить арифметику между разными валютами. На старте — только EUR, но тип фиксируем сразу.

### S3. Иммутабельные таймлайны (`*_events`) — enforce на уровне БД
PRD 10/11 называют `deal_events`/`dispute_events` «иммутабельными», но иммутабельность нигде не enforce-нута. Требование: RLS/grants дают только `INSERT` (никаких `UPDATE`/`DELETE` даже владельцу/сервису через PostgREST); запись событий — только через `SECURITY DEFINER` RPC или service-role server-side. Добавить триггер `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`. Это паттерн уже используется в проекте (`create_review`, `start_conversation` RPC) — переиспользовать.

### S4. Машины состояний — задать явные допустимые переходы
PRD перечисляют состояния списком, но не таблицу переходов → невалидные переходы (например `released` → `refunded`) пройдут. Для `deals`, `disputes`, `deal_shipments`, `payment_requests` добавить в PRD таблицу «из состояния → допустимые в», и валидировать переход в RPC/хелпере перед записью события. Запрещённый переход = `409 Conflict`.

### S5. Денежные пути — `checkUserBlocked(..., { failClosed: true })` + участники только через сервер
Любой эндпойнт, двигающий деньги или создающий сделку, вызывает `checkUserBlocked` с `failClosed:true` (см. A-3 ниже) и проверяет членство в сделке server-side (никогда не доверять `deal_id` из тела без проверки `buyer_id/seller_id = auth.uid()`).

### S6. Конкаррентность release vs dispute — оптимистичная блокировка
Release по таймауту (cron) и открытие спора покупателем — гонка. Требование: апдейт статуса делать как `UPDATE deals SET status=... WHERE id=$1 AND status=$expected` и проверять `rowCount`. Если спор уже открыт (`status='disputed'`), release-апдейт затронет 0 строк → не делать payout. То же для двойного confirm.

### S7. Тест-инфраструктура денежных вебхуков
Для каждого PSP/carrier-вебхука обязательны тесты: (а) валидная подпись → эффект; (б) невалидная подпись → 400; (в) **повтор того же `event.id`** → нет двойного эффекта; (г) событие для несуществующей сделки → 200 + лог, без краша; (д) out-of-order доставка (delivered приходит после released). Эти кейсы вписать в §11 PRD 10/12/13.

---

## PRD 10 — Escrow / Safe-deal (Stripe Connect)

**Статус кода:** ⛔ greenfield. Подтверждено: нет миграций `deal*`, нет `disputes`, нет `shipment*` (`supabase/migrations` — 0 совпадений). Stripe есть только под бусты/Pro.

### Тех-пробелы и риски
1. **Юр-гейт не снят (внешний блокер).** §8/§13 честно ставят гейт «письменное подтверждение Stripe + юрист BE про NBB-регистрацию». Это не инженерный, но **архитектурно-блокирующий** пункт: модель `separate charges & transfers + manual payout` выбрана верно, но до подтверждения нельзя финализировать, кто держит средства и кто KYC-субъект. Стройку схемы данных можно начинать, прод-запуск — нет.
2. **Идемпотентность задана словами, не механизмом.** «вебхук = source of truth, идемпотентно» — без `event.id`-журнала (см. S0). Текущий billing-webhook — антипаттерн, копировать нельзя.
3. **Схема таблиц неполна для денежной целостности.** Нет: `webhook_events`, `seller_stripe_accounts` (Connect account id + статус onboarding/charges_enabled/payouts_enabled), полей `application_fee`, `release_at` (дедлайн окна осмотра), `idempotency_key` на checkout, связи payout↔refund. `deal_payments.payment_intent/session_id` свалены в одно поле.
4. **Машина состояний сделки не формализована** (см. S4). Release-условие «подтверждение ИЛИ таймаут» требует cron + защиту от гонки со спором (см. S6) — в PRD не описано.
5. **Connect-онбординг продавца не специфицирован.** «KYC флоу-даун от Stripe Connect» — но нет: какой тип аккаунта (Express рекомендуется), где хранить `account.updated`-статус, что блокирует payout если `payouts_enabled=false`, как обрабатывать продавца без Connect-аккаунта на момент оплаты (деньги уже в холде — куда release?).
6. **Fee/refund-правила не вычислимы.** «фикс + %», «частично возвратный» — без формулы и round-режима юнит-тест §11 «расчёт fee» не написать.
7. **Concurrency-лимит** («потолок одновременных сделок») — нет места хранения счётчика и определения «активная сделка».

### Что добавить (для airtight)
- **Таблицы** (минор-единицы, см. S2; иммутабельный `deal_events` см. S3):
```sql
deals(id uuid pk, advert_id, buyer_id, seller_id, status text,
      amount_cents int, currency text, protection_fee_cents int, fee_payer text,
      ship_method text, release_at timestamptz, version int default 0,
      created_at, updated_at)
deal_payments(id, deal_id fk, provider, stripe_payment_intent_id, stripe_checkout_session_id,
      status text, amount_cents int, application_fee_cents int,
      release_status text, refunded_amount_cents int default 0, idempotency_key text)
payouts(id, deal_id fk, seller_id, provider_transfer_id, status, amount_cents, released_at)
seller_stripe_accounts(user_id pk, stripe_account_id, charges_enabled bool,
      payouts_enabled bool, details_submitted bool, updated_at)
deal_events(id, deal_id fk, type text, actor_id, payload jsonb, created_at)  -- insert-only
webhook_events(...)  -- см. S0
```
- **State-machine** (вписать таблицу переходов): `pending_payment → paid → shipped → delivered → (inspection) → released | refunded | disputed`; из `disputed` → `released | refunded | partial_refund`; терминальные — `released/refunded/cancelled`.
- **Эндпойнты с сигнатурами и кодами:**
  - `POST /api/deals` `{advert_id, amount_cents, fee_payer, ship_method}` → `201 {deal}`; проверка: пользователь не buyer==seller; advert активен; `checkUserBlocked failClosed`.
  - `POST /api/deals/[id]/pay` → `{checkout_url}`; создаёт PaymentIntent с `transfer_data`/manual capture + `idempotency_key=deal:{id}:pay`.
  - `POST /api/deals/[id]/confirm` (buyer) → release; оптимистичная блокировка `WHERE status='delivered'` (S6).
  - `POST /api/deals/[id]/cancel` → правила частичного возврата fee.
  - `POST /api/webhooks/stripe-connect` → S0 + S7. Обрабатываемые события: `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`, `transfer.created`, `account.updated`.
  - `POST /api/cron/deal-release` — авто-release по `release_at <= now() AND status='delivered'` (S6).
- **Fee-формула** (явно): `fee = round(amount * pct) + flat`, round-half-up, минимум/максимум; кто платит — отдельной колонкой; правило частичного возврата таблицей (отмена до отправки → 100% fee назад; вина продавца → 100%; обычная отмена покупателя → fee удержан/частично).
- **Фиче-флаги:** `escrow_enabled` (kill-switch), `escrow_max_amount_cents`, `escrow_max_concurrent_deals_per_user`.
- **Тест-кейсы:** S7 + happy-path в Stripe test mode + release-по-таймауту + гонка release/dispute + продавец без Connect-аккаунта (deny pay или hold-and-prompt).

**Вердикт: ⛔ блокер (юр-гейт §8) для запуска; схему данных/абстракцию можно начинать. Усилие: L.**
PRD концептуально силён, но не «airtight» по данным/идемпотентности/state-machine. После добавления S0–S7 и таблиц выше → 🔄 (готов к стройке схемы).

---

## PRD 11 — Dispute-движок

**Статус кода:** ⛔ greenfield (нет `disputes*`). Есть только `reports` (жалобы на объявления) — другой домен.

### Тех-пробелы и риски
1. **Связь «спор замораживает release» не атомарна.** Открытие спора и cron-release — гонка (S6). PRD говорит «release заблокирован», но не как.
2. **`resolve` двигает деньги, но кто и через что** — нет указания, что resolve дергает `PaymentProvider.refundBuyer/releaseToSeller` идемпотентно; частичный сплит (`partial_refund`) требует и refund, и transfer — две денежные операции, обе под S0.
3. **Таймеры/дефолтные решения** («молчание продавца → дефолт») — нет хранилища дедлайна (`respond_by`) и cron, который применяет дефолт.
4. **Иммутабельность `dispute_events`** не enforce-нута (S3).
5. **RLS «участники + модератор/support»** — роль модератора/support в проекте сейчас выражена через `app_metadata` (admin). Нужно явно: где берётся роль support, отличная от admin.
6. **Concurrency-лимит споров** («= пропускной способности одного человека», авто-троттлинг новых safe-deal) — нет места хранения порога и связи с PRD 10 (где блокировать создание `POST /api/deals`).

### Что добавить
- Поля: `disputes.respond_by timestamptz`, `resolution_amount_cents` (для сплита), `version int`. Таблица переходов состояний (S4).
- `resolve`: внутри одной логической операции — записать `dispute_events`, перевести `deals.status`, вызвать провайдера (refund и/или transfer) под `idempotency_key=dispute:{id}:resolve`, проверить `payouts`/`refunded_amount`.
- `POST /api/cron/dispute-timeouts` — дефолт-решение при истёкшем `respond_by`.
- Роль: завести `profiles.role in ('user','support','admin')` или таблицу `staff_roles`; RLS-функция `is_staff()` (SECURITY DEFINER) по аналогии с `is_conversation_participant()`.
- Связь троттлинга: счётчик открытых споров (view/функция) + флаг `disputes_intake_open`; `POST /api/deals` проверяет его.
- Тесты: спор вне окна (403), доступ постороннего (RLS), сплит двигает обе суммы один раз, гонка resolve/release.

**Вердикт: 🔄 доработать (роль support, атомарность resolve, таймеры, S3/S4/S6). Выкатывать строго с PRD 10. Усилие: M–L.**

---

## PRD 12 — Интегрированная доставка (Bpost / Mondial Relay)

**Статус кода:** ⛔ greenfield.

### Тех-пробелы и риски
1. **Release привязан к carrier-вебхуку, но carrier-вебхуки часто без подписи/слабые.** Нужна верификация (S1 `parseWebhook`), иначе подделка «delivered» = ложный release. Критично, т.к. это денежный триггер.
2. **Маппинг статусов перевозчика → внутренний enum** не задан (нужна таблица соответствий per-carrier).
3. **Идемпотентность carrier-событий** (S0) — тот же `webhook_events` журнал, ключ `carrier:{tracking}:{eventCode}:{ts}` (у carrier часто нет уникального event.id — нужен составной ключ).
4. **PII-минимизация адреса** заявлена, но не специфицировано: что именно видит продавец (PUDO снижает раскрытие — но при home-delivery адрес нужен для лейбла). Нужно правило: адрес доступен только при генерации лейбла, server-side, не в `deal_events.payload`.
5. **Невыкуп → авто-возврат отправителю → что с escrow** (refund покупателю?) — краевой случай не доведён до денежного решения.

### Что добавить
- Таблица `deal_shipments(... carrier, service, label_url, tracking_number, pudo_point_id, status, raw_last_event jsonb, shipped_at, delivered_at, version)`.
- `carrier_status_map(carrier, carrier_code, internal_status)` или хелпер `mapStatus`.
- Эндпойнты: `GET /api/shipping/points?postcode&carrier` (rate-limit per-IP), `POST /api/deals/[id]/label` (idempotent — один лейбл на сделку), `POST /api/webhooks/carrier` (S0/S1/S7).
- Правило release: только internal_status `delivered`/`picked_up` И сделка в `shipped` (S6). Невыкуп: `returned` → перевести сделку в спорный/refund-флоу явно.
- Адрес: хранить в отдельной защищённой таблице/полях с RLS, не дублировать в события.
- Тесты: sandbox-вебхук, повтор события, out-of-order, невыкуп, подделка статуса без валидной подписи → отвергнуто.

**Вердикт: 🔄 доработать (верификация carrier-вебхука, маппинг статусов, idempotency-ключ без event.id, денежный исход невыкупа). Усилие: M.**

---

## PRD 13 — In-chat оплата Bancontact (betaalverzoek)

**Статус кода:** ⛔ greenfield (флоу оплаты покупателем нет). `scrubContacts` есть.

### Тех-пробелы и риски
1. **`payment_requests` vs `deal`** — PRD колеблется («или как событие сделки»). Решить однозначно: запрос оплаты **всегда создаёт `deal` в `pending_payment`** + строку `payment_requests` со ссылкой `deal_id`. Иначе двойная истина статуса.
2. **Идемпотентность создания запроса** — «один запрос = один payment intent», но нет ключа. Нужен `idempotency_key` и защита от двойного клика «Запросить оплату».
3. **RLS «участники чата/сделки»** — `payment_requests.conversation_id` должен проверяться через `is_conversation_participant()` (уже есть в проекте).
4. **Кто инициирует** — открытый вопрос §13; для реализации нужно решение (рекомендация: продавец создаёт, покупатель платит — проще для anti-fraud и UX-карточки).
5. **Истечение** — `expires_at` + cron, который переводит `expired`; что со связанной сделкой (cancel `pending_payment`).

### Что добавить
- Таблица `payment_requests(id, conversation_id, deal_id, advert_id, seller_id, buyer_id, amount_cents, currency, status, expires_at, idempotency_key, created_at)`. RLS через participant-функцию. Состояния: `requested → paid | cancelled | expired` (S4).
- Эндпойнты: `POST /api/chat/payment-request` (rate-limit, как `chat/send`; создаёт deal+request), `POST /api/deals/[id]/pay` (переиспользуется из PRD 10), вебхук — общий stripe-connect (S0).
- Dynamic payment methods: не задавать `payment_method_types` (Bancontact включается в Dashboard) — это верно в PRD, оставить.
- Тесты: создание→оплата→холд; повтор вебхука; истечение; внешняя ссылка → предупреждение (PRD 35).

**Вердикт: 🔄 доработать (зафиксировать deal-first модель, idempotency-ключ, инициатор, cron истечения). Усилие: M. Зависит от 10.**

---

## PRD 16 — Защита от угона аккаунта (ATO)

**Статус кода:** 🟡 WebAuthn/TOTP/rate-limit есть; сессий/fingerprint/гео нет.

### Тех-пробелы и риски
1. **Список/ревокация сессий поверх Supabase Auth.** Supabase GoTrue управляет сессиями/refresh-токенами сам. Своя `user_sessions` — это **зеркало**, а реальная ревокация требует `auth.admin.signOut(userId, scope)` (admin API) или revoke refresh-token. PRD не указывает, что «выйти везде» = вызов GoTrue admin, а не просто `revoked_at` в своей таблице (иначе токен останется валидным до истечения). Это ключевой реализационный нюанс.
2. **`checkUserBlocked` fail-closed на high-risk** — корректно (см. A-3), но PRD не перечисляет полный список «high-risk путей» (payout-change, email/пароль, новое устройство). Нужен явный список.
3. **Device fingerprint через внешний API** — вендор не выбран (§13), и нет указания, где хранить риск-скор и как он гейтит (порог step-up).
4. **Step-up хук** — нет единого механизма: как эндпойнт помечается «требует свежей верификации» (например, `requireRecentAuth(maxAgeSec)` middleware).

### Что добавить
- Уточнить в §7: «выйти везде» = `supabase.auth.admin.signOut(user_id, 'global')` (service-role) + пометка своей `user_sessions.revoked_at` для UI; одиночная ревокация — revoke конкретного refresh-токена.
- Таблицы как в PRD ок (`user_sessions`, `auth_events`), добавить `auth_events.ip`, `auth_events.outcome`.
- Хелпер `requireStepUp(action, riskScore)` и список действий: `payout_change`, `email_change`, `password_change`, `new_device_login`, `withdraw`. payout-change → задержка (хранить `pending_payout_change` + apply-cron).
- Фиче-флаг `ato_stepup_enabled`, порог `ATO_RISK_THRESHOLD`.
- Тесты: fail-closed `checkUserBlocked`; revoke реально инвалидирует (интеграционно с GoTrue); step-up на payout-change.

**Вердикт: 🔄 доработать (механика ревокации поверх GoTrue, список high-risk, step-up хук, вендор). Усилие: M.**

---

## PRD 17 — Проверка фото (pHash / reverse-image)

**Статус кода:** ⛔ greenfield (AI-модерация — по тексту; image-hash нет). Хук `/api/media/complete` существует — место интеграции реально.

### Тех-пробелы и риски
1. **pHash-поиск «быстрый» — но в Postgres это не тривиально.** Нужен либо `bit`-колонка + Hamming-distance через расширение, либо `pg_trgm`/внешний индекс. PRD пишет «индексы для быстрого hash-поиска» без указания механизма. Hamming на 64-бит pHash в чистом Postgres = seq-scan (медленно при росте). Решение: хранить pHash как `bigint`, и для near-duplicate использовать BK-tree/предвычисленные бакеты или вынести в отдельный сервис. Это надо вписать, иначе «быстро» нереализуемо.
2. **Где вычисляется pHash** — на сервере (Node) после `media/complete`. Нужна библиотека (sharp + perceptual hash) и async-обработка (не блокировать ответ). PRD says «фоновая проверка» — нужна очередь/Edge Function.
3. **Reverse-image вендор** не выбран (§13) — внешний блокер для stolen-photo ветки; pHash-дубликаты — свои силы (верно приоритизировано как «дёшево»).
4. **Privacy:** хранение pHash чужих фото для матчинга — ок, но reverse-image API отправляет фото третьей стороне → GDPR-DPA нужен (вписать в §8).

### Что добавить
- Уточнить хранение/поиск: `media_hashes.phash bigint`, near-dup через Hamming с порогом; при росте — отдельный индекс-сервис (обозначить как roadmap-триггер).
- Async-флоу: `media/complete` ставит задачу → Edge Function/cron считает pHash и пишет `media_flags`.
- Таблицы как в PRD ок; добавить `media_hashes.algo`/`version` (pHash может меняться).
- Тесты: дубликат между листингами → флаг; сток-фото не ложно-срабатывает (порог); reverse-image мок.

**Вердикт: 🔄 доработать (механизм near-dup поиска в Postgres, async-пайплайн, DPA вендора). Приоритет P1/LATER — ок. Усилие: L (H в PRD оправдано).**

---

## PRD 18 — PWA + push

**Статус кода:** ⛔ нет manifest/SW/push; viewport — на самом деле уже корректен.

### Тех-пробелы и риски
1. **Фактическая неточность в As-is.** PRD говорит «`generateMetadata` ставит icons/OG, но не viewport». В коде `apps/web/src/app/layout.tsx` уже есть `export const viewport: Viewport` с `width=device-width, viewportFit:'cover', themeColor` (подтверждено аудитом B-9). «viewport-фикс one-liner» из §12 **не нужен** — убрать из плана, чтобы не путать инженера.
2. **Service worker в Next.js 16 App Router** — нет указания на способ (next-pwa несовместим/устаревает; вероятно ручной SW + `next.config` headers, или `@serwist/next`). Это влияет на оценку. Нужно зафиксировать инструмент.
3. **iOS web-push** — работает только PWA-installed + iOS 16.4+; PRD это учитывает (email/SMS fallback) — хорошо.
4. **VAPID-ключи** — где хранятся (env), ротация — не описано.
5. **Дедуп push+email** — общий с PRD 36 (event→channel матрица). Нельзя строить push до матрицы из 36.

### Что добавить
- Зафиксировать SW-инструмент (рекоменд. `@serwist/next` для Next 16) и стратегии кэша.
- `push_subscriptions` как в PRD ок + cron-очистка по 410/404 от push-сервиса.
- Убрать ложный viewport-пункт; оставить manifest + SW + web-push.
- Env: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (приватный — server-only).
- Зависимость: матрица каналов из 36 — жёсткий предшественник.

**Вердикт: 🔄 доработать (выбрать SW-стек, убрать неверный viewport-пункт, VAPID, зависимость от 36). Усилие: M.**

---

## PRD 30 — Идентичность и аккаунт

**Статус кода:** 🟡 auth силён; itsme закодирован, не прод-тестирован; `sub`-uniqueness не enforced.

### Тех-пробелы и риски
1. **`sub`-uniqueness «хард-реджект»** — не указано КАК enforce. Нужен `UNIQUE`-constraint на `profiles.itsme_sub` (или отдельная `identity_links(provider, sub, user_id)` с unique `(provider, sub)`). Без БД-констрейнта возможна гонка двух коллбэков. Это центральная фича PRD — должна быть на уровне БД, не только в коде.
2. **Tiering** (`unverified/phone/itsme/business`) — где хранится «tier» и как читается в гейтах? PRD 37 ссылается на verified-tier; нужен единый источник (например `profiles.verification_tier` derived или поле + триггер).
3. **itsme attributes без хранения скана** — верно (избегаем Art.9). Но «не хранить скан» нужно проверить, что itsme и не отдаёт скан (он и не отдаёт — отдаёт claims). Ок, но вписать что именно из claims сохраняем (`name`, `address`?, `age_gte_18`) и под каким consent.
4. **RU-локаль маппинг** (§10 «проверить маппинг `ru`») — открытый хвост, для P0-идентичности не блокер.

### Что добавить
- `identity_links(id, user_id, provider 'itsme', sub text, claims jsonb, created_at, unique(provider, sub))` + обработка `23505` (unique violation) → 409 «already linked».
- `profiles.verification_tier` (enum) + правило вычисления; гейты (escrow high-value, payout speed) читают его.
- Список действий, гейтящихся за itsme (§13 открытый вопрос — закрыть: high-value escrow, payout-change).
- Тесты: вторая регистрация с тем же `sub` → 409 (constraint), tier-переходы.

**Вердикт: 🔄 доработать (БД-constraint на sub, источник tier, список гейтов). Усилие: M (как в PRD).**

---

## PRD 31 — Создание объявления (8-шаг)

**Статус кода:** ✅ as-built работает. Подтверждено: PostForm большой, каскады make/model/year есть.

### Тех-пробелы и риски
1. **A-3 (fail-open на `POST /api/adverts`)** — подтверждён в коде (`api/adverts/route.ts:31` — `checkUserBlocked(user.id)` без `failClosed`). Для trust-платформы привести к `failClosed:true` (см. сквозное S5). PRD 31 это не упоминает — добавить.
2. **fraud-rules не вызываются на создании** (см. PRD 38) — «гейты публикации: премодерация (AI + fraud-rules)» декларированы, но fraud-detection Edge Function не дёргается из web-app (0 call-sites). Это пробел между PRD 31 §5 и реальностью.
3. **`prompt()`-OTP** в форме — known issue, в PRD есть. Ок.
4. **Каскад year vs generation** (связь с PRD 62): сейчас year берётся из `models.years_available` (массив), generation не выбирается вовсе. PRD 31 не отражает, что generation-выбор (из 62) встроится в шаг транспорта.

### Что добавить
- В §5/§8: явно `checkUserBlocked failClosed:true` на create + вызов fraud-detection (связать с 38).
- В §4: точку интеграции generation-чузера из PRD 62 (шаг категорийных полей транспорта).
- Тесты: create при заблокированном юзере (fail-closed); премодерация-гейт.

**Вердикт: ✅ sign-off с правками (fail-closed + ссылка на fraud-wiring и generation). Усилие правок: S.**

---

## PRD 33 — Поиск / фильтры / сортировки

**Статус кода:** ✅ as-built (Postgres FTS, фильтры, гео, rate-limit instant-bucket).

### Тех-пробелы и риски
1. **Буст-ранжирование за фиче-флагом** — верно, но не указано КАК буст входит в `ORDER BY` (вес, тай-брейкер, чтобы не убить релевантность). Нужна формула ранжирования (например `rank = relevance + boost_weight * is_boosted`, и порядок тай-брейк).
2. **`getClientIp` доверяет `x-forwarded-for`** (A-7) — влияет на instant-bucket per-IP rate-limit (обходим спуфингом). Не специфично для 33, но search полагается на IP-лимит. Связать с A-7 fix.
3. **Empty-state/save-search CTA** — UI-доработка, не риск.

### Что добавить
- Формула буст-ранжирования + фиче-флаг `boost_ranking_enabled`; тай-брейкеры детерминированы (иначе пагинация «прыгает»).
- Стабильная сортировка (включить `id` последним ключом) — иначе keyset/offset-пагинация даёт дубли/пропуски.
- Тест: пагинация стабильна при равных ключах; буст за флагом меняет порядок предсказуемо.

**Вердикт: ✅ sign-off с уточнением формулы буста и стабильной сортировки. Усилие: S.**

---

## PRD 34 — Дискавери-дополнения

**Статус кода:** 🟡 многое есть (saved_searches + cron, favorites/likes раздельно, comparison, taste localStorage); price-drop нет.

### Тех-пробелы и риски
1. **Saved-search алерты: дедуп/частота** — cron есть, но PRD не задаёт ключ дедупа (какие adverts уже отправлены по этому saved_search). Нужен `saved_search_alerts.last_seen_advert_id`/`last_run_at` или таблица отправленного, иначе дубль-алерты.
2. **Taste в localStorage** — осознанно (приватность), но «кросс-девайс персонализация — roadmap» ок. Риск: на проде taste теряется при очистке — приемлемо, обозначено.
3. **Удалённые объявления в избранном** — краевой случай, нужно правило отображения (tombstone vs скрыть).

### Что добавить
- Дедуп-механизм алертов (курсор по advert id/created_at per saved_search) + quiet hours из PRD 36.
- Правило для удалённых favorites (скрывать/«объявление снято»).
- Тесты: cron не шлёт повтор; quiet hours.

**Вердикт: ✅ sign-off с уточнением дедупа алертов. Усилие: S–M.**

---

## PRD 35 — Чат + чат-антифрод

**Статус кода:** ✅ realtime-чат + RLS (рекурсия исправлена `is_conversation_participant`), `scrubContacts` + тесты, rate-limit на send.

### Тех-пробелы и риски
1. **`scrubContacts` тривиально обходится** (A-5, подтверждено в коде): слитные `06xxxxxxxx` без разделителя не маскируются; unicode look-alikes; прописью. PRD честно называет это «сигнал+деттеррент» — корректно. Но §5 «логировать попытки как риск-сигнал в trust-score» **ещё не реализовано** (это roadmap). Для airtight нужно: куда пишется сигнал (таблица `message_risk_flags`), как агрегируется в trust (PRD 37).
2. **Нет rate-limit на media** (A-4) — чат позволяет слать медиа? Если media-вложения в чате идут через `api/media/*`, они без rate-limit. Связать.
3. **Retention/TTL/DSAR чата** — roadmap, но GDPR-релевантно; не блокер для текущего ✅, но для DoD «retention/DSAR» нужен cron + экспорт.

### Что добавить
- `message_risk_flags(id, message_id, conversation_id, sender_id, types text[], created_at)` + агрегатор в trust (связь с 37).
- Усилить `scrubContacts` сигнал (NFKC-нормализация, слитный BE-формат 10 цифр с ведущим 0) — как сигнал, не контроль (вписать в §5, цитируя A-5).
- Тесты: слитный номер → flagged; unicode → flagged; агрегат N сообщений → risk.

**Вердикт: ✅ sign-off (база готова); roadmap-пункты (risk-flags→trust, retention/DSAR) уточнить схемой. Усилие доработок: M.**

---

## PRD 36 — Уведомления

**Статус кода:** 🟡 in-app + preferences + cron saved-search есть; event→channel матрица, delivery-логи, дедуп/quiet hours — нет.

### Тех-пробелы и риски
1. **Event→channel матрица — ядро PRD, но не специфицирована как данные/код.** Нужно: список event-типов (enum), дефолтные каналы per-event, как preferences переопределяют, где хранится. Без этого «матрица» — не реализуема без вопросов.
2. **Идемпотентность отправки** («не слать дубль») — нужен ключ (`notification_dedup_key = event_type:entity_id:user_id:channel`) + `notification_deliveries` с unique.
3. **Quiet hours** — таймзона пользователя? Где хранится TZ? Нужно поле.
4. **Анти-фишинг email (DMARC/DKIM/SPF)** — инфра-задача, вписана; ок.

### Что добавить
- `notification_deliveries(id, user_id, event_type, channel, dedup_key unique, status, sent_at, error)`.
- Матрица как конфиг (код-таблица `NOTIFICATION_MATRIX: Record<EventType, {channels, quiet_hours_respected}>`).
- `notification_preferences` + `profiles.timezone` для quiet hours.
- Тесты: дедуп (один dedup_key — одна доставка), quiet hours отложил, отписка.

**Вердикт: 🔄 доработать (матрица как enum+конфиг, dedup_key, TZ для quiet hours). Жёсткий предшественник для PRD 18. Усилие: M.**

---

## PRD 37 — Trust score, бейджи, отзывы

**Статус кода:** 🟡 отзывы готовы (chat-gated `create_review`, forgeable-gate дофикшен); `trust_score` + `deriveTrust` есть, питается слабо.

### Тех-пробелы и риски
1. **trust_score питается из «завершённых сделок», которых нет** (escrow greenfield) — циклическая зависимость от PRD 10. PRD это признаёт. Нужно: до escrow `deriveTrust` работает на verification+reviews; интерфейс сигналов задать так, чтобы добавление deal-сигнала не ломало формулу.
2. **Веса составляющих (§13)** не заданы — без них `deriveTrust` юнит-тест неполон. Нужны конкретные веса (хоть и калибруемые за флагом).
3. **Портативность по `sub`** — зависит от `identity_links` (PRD 30). Каскад при удалении аккаунта — нужно правило (анонимизировать отзывы vs удалить).
4. **`seller_ratings` только из завершённых сделок** — таблица появится с escrow; интерфейс заранее.

### Что добавить
- Зафиксировать веса (версионируемые: `trust_weights` конфиг + `trust_score.version`).
- Интерфейс сигналов `TrustSignal[]` с источниками (verification, review, deal, chat_risk, dispute) — чтобы deal-сигнал подключался позже без рефактора.
- Правило каскада отзывов при удалении (анонимизация автора).
- Тесты: deriveTrust детерминирован при заданных сигналах; review-gate (нельзя без контакта).

**Вердикт: 🔄 доработать (веса, интерфейс сигналов, каскад). Усилие: M.**

---

## PRD 38 — Модерация и жалобы

**Статус кода:** 🟡 скелет (reports, AI-moderation Edge Function, fraud_rules); **fraud-engine не вызывается из web-app** (подтверждено: 0 call-sites `fraud-detection`/`functions.invoke` в `apps/web/src`); `checkUserBlocked` fail-open default.

### Тех-пробелы и риски
1. **Главный пробел подтверждён кодом:** `fraud_rules` (8 правил) и Edge Function `fraud-detection` существуют, но **нигде не вызываются** из листинг/checkout-флоу. PRD верно ставит «подключить!». Нужно: где именно call-site (`POST /api/adverts` create и/или publish, checkout), синхронно или async, что делать с результатом (флаг/блок/очередь).
2. **`checkUserBlocked` fail-open** (A-3) — на `POST /api/adverts` подтверждён fail-open. PRD требует fail-closed на high-risk — связать со сквозным S5.
3. **Роль модератора/support** — та же проблема, что в PRD 11 (нет роли отдельной от admin). Нужна `is_staff()`.
4. **DSA statement of reasons / апелляции** — нужна таблица `moderation_decisions(advert_id, decision, reason_text, decided_by, appeal_status)` + аудит. PRD упоминает `moderation_logs`, но не структуру обоснования/апелляции.
5. **GPSR 3-дневная обработка** — нужен таймер/SLA-трекинг.

### Что добавить
- Call-site fraud-engine: в `POST /api/adverts` (create) и publish — вызвать `fraud-detection` (или локально применить `fraud_rules`), записать `account_flags`/score, гейтить публикацию. Async-вариант (очередь) допустим, но статус листинга `pending` до результата.
- `failClosed:true` на create (S5).
- `is_staff()` RLS-функция; `moderation_decisions` со statement of reasons + `appeals(decision_id, status, reviewed_by)`.
- Тесты: fraud-rule срабатывает на создании (price-anomaly/velocity); fail-closed; апелляция-флоу; роль staff в RLS.

**Вердикт: 🔄 доработать (call-site fraud-engine — критично, fail-closed, роль staff, DSA-структуры). Усилие: M.**

---

## PRD 39 — Монетизация (billing, бусты, Pro)

**Статус кода:** 🟡 billing/бусты/Pro есть; буст-ранжирование не подключено; webhook идемпотентен «по эффекту» (см. S0 — антипаттерн для escrow).

### Тех-пробелы и риски
1. **Webhook-идемпотентность — частичная** (подтверждено: дедуп по `purchases.status`, подписка без дедупа, нет `event.id`-журнала). Для бустов риск низкий (эффект идемпотентен), но **общая провайдер-абстракция с escrow (S1)** означает: либо унифицировать на `webhook_events` (S0), либо чётко развести два вебхука. PRD говорит «провайдер-абстракция общая с escrow» — тогда S0 обязателен и здесь.
2. **Буст-ранжирование** — связь с PRD 33 (формула не задана, см. там).
3. **НДС/чеки (BE)** — упомянуто, но не специфицировано (нужны ли инвойсы через Stripe Tax/Invoicing). Для Pro-подписки бизнесу — вероятно да. Открытый юр-хвост.

### Что добавить
- Привести webhook к `event.id`-дедупу (S0) при унификации абстракции.
- Формула буста (общая с 33).
- Решение по НДС-инвойсам (Stripe Tax/Invoicing) — хотя бы зафиксировать «вне MVP» или «через Stripe Invoicing».
- Тесты: повтор `event.id` → нет двойного эффекта (после S0).

**Вердикт: ✅ sign-off для текущего скоупа (бусты/Pro работают); для общей абстракции с escrow — применить S0. Усилие: S–M.**

---

## PRD 40 — Бизнес-аккаунты (KBO/CBE/VIES)

**Статус кода:** 🟡 ядро есть (`businesses_core`, `/api/business/*`, KBO+VIES verification, cron `business-verify`); часть Pro-UI uncommitted.

### Тех-пробелы и риски
1. **VIES/KBO — внешние сервисы с нестабильным аптаймом.** VIES часто падает. PRD не задаёт поведение при недоступности (retry/cron перепроверка есть, но что со статусом: `pending` vs `failed`?). Нужно правило: external down → `pending`, не `rejected`.
2. **Роли команды** (§13 открыто) — не заданы (owner/admin/member?), права на публикацию/биллинг. Без этого RLS членов не написать.
3. **Передача владения** — упомянута, краевые (последний owner) не описаны.
4. **DSA trader-transparency** — какие поля публичны vs приватны (compliance) — нужно явное разделение колонок + RLS (lock уже есть на businesses).
5. **KYBC (Art.30)** — заложить архитектурно, включать при потере micro-exemption — ок как roadmap.

### Что добавить
- Матрица ролей команды + права (publish/billing/members) и RLS.
- Поведение verification при external-down (pending + retry, не reject).
- Явный список публичных trader-полей (DSA) vs приватных.
- Тесты: VIES down → pending; роль member не может биллинг; name-match отказ.

**Вердикт: 🔄 доработать (роли команды, поведение при VIES down, публичные/приватные поля). Усилие: M.**

---

## PRD 62 — Карточки по категориям + KB + фикс сопоставления

**Статус кода:** 🟡 гибкая схема `catalog_fields` + `group_key` есть; `DynamicFieldRenderer`/`FieldGroup` рендерят группы как `<h3>`-секции (подтверждено — **нет вкладок, нет конфига display/tab**); `vehicle_generation_insights` есть; **`resolveGeneration` отсутствует**; в `PostForm` **generation не выбирается вовсе** — year берётся из `models.years_available`.

### Тех-пробелы и риски (самый технически насыщенный PRD — оценка детальная)
1. **`resolveGeneration` — алгоритм в PRD корректен**, но нужно уточнить контракт и где он живёт. Псевдокод (range-aware, ambiguity-safe) верный: `start <= year AND (end IS NULL OR year <= end)`; 1→auto, >1→chooser, 0→nearest/unknown. Это правильное решение бага 1996 (E34 1988-1996 ∩ E39 1995-2003).
2. **Хранение `generation_id`** — критично и подтверждённо отсутствует: `adverts`/vehicle-specifics не имеют `generation_id`. Нужна миграция + поле. «Никогда не ре-деривить из года» — верно (иначе баг возвращается).
3. **`FieldDefinition` не несёт layout-метаданных.** Подтверждено: интерфейс (`DynamicFieldRenderer.tsx:10-25`) имеет `group?: string`, но нет `display:'tab'|'section'`, `tab_key`, `tab_order`, `collapsed`. `FieldGroup` хардкодит `<h3>`. Для вкладок нужно: либо `catalog_groups` таблица, либо расширить `catalog_fields.metadata` + переписать `FieldGroup` в `TabbedRenderer`/`SectionRenderer`.
4. **KB-унификация `kb_insights`** — модель разумна, но миграция новых таблиц + i18n не детализирована (ключи, как привязка `entity_ref`). Для airtight нужна точная DDL.
5. **Автокомплит «поколение с годами»** — UI-требование, но источник данных (`vehicle_generations` с годами) есть; нужно отдать в API подсказок.
6. **Перф вкладок** — данные всех вкладок грузятся сразу (1 объявление) — не проблема; KB-инсайты — отдельный запрос по `generation_id`, кэшируемо.

### Что добавить (для airtight)
- **Миграция:** `ALTER TABLE` (vehicle-specifics или adverts) `ADD COLUMN generation_id uuid REFERENCES vehicle_generations(id)`; для общих категорий — `reference_id`/`reference_type`.
- **Серверный хелпер** `resolveGeneration(modelId, year): { status:'unique'|'ambiguous'|'none', candidates: Generation[] }` (и общий `resolveReference`) — в `lib/catalog/`; использовать и в форме, и в бэкфилле существующих объявлений (миграция данных: прогнать старые adverts через resolver, ambiguous → пометить «требует уточнения»).
- **Конфиг раскладки:** таблица `catalog_groups(domain, group_key, display 'tab'|'section', tab_key, tab_order, icon, collapsed_by_default, label_i18n_key)`; расширить `FieldDefinition` полями layout; переписать `FieldGroup` → читает конфиг, рендерит `Tabs` (ARIA-tabs) или аккордеон-секции.
- **KB DDL:** `kb_entities(id, domain, entity_type, ref_id, ...)`, `kb_insights(id, entity_ref, pros text[], cons text[], watchouts text[], tips text[], facts jsonb)`, `kb_insights_i18n(insight_id, locale, ...)`; для транспорта — view/адаптер над `vehicle_generation_insights`, чтобы UI-блок один.
- **API:** `GET /api/catalog/generations?model_id=&year=` → кандидаты с годами; `GET /api/catalog/kb?generation_id=` или `?reference_id=` → инсайты (i18n по `Accept-Language`/locale).
- **Бэкфилл-стратегия** для существующих объявлений (не в PRD!): прогнать через resolver, ambiguous/none → `generation_id NULL` + флаг для повторного уточнения продавцом; не угадывать.
- **Тесты (PRD §10 ок, дополнить):** `resolveGeneration` overlap (1996 BMW 5 → ambiguous E34+E39), unique, none; рендер tabs vs sections по конфигу; пустые группы скрыты; ARIA-tabs клавиатура; e2e подача авто переходного года → chooser → карточка верный KB; бэкфилл existing → ambiguous помечен.

**Вердикт: 🔄 доработать (добавить точные DDL миграций generation_id/catalog_groups/kb_insights, контракт resolveReference, бэкфилл-стратегию, переписать FieldGroup→tabs). Алгоритм бага — sign-off. Усилие: Шаг1 (фикс) S–M, целиком M–L.**

---

## audit/03 — Security + Mobile (контекст, сверено с кодом)

Подтверждено в коде (релевантно денежным/чат/медиа PRD):
- **A-3 fail-open** на `POST /api/adverts:31` — подтверждён; `adverts/[id]:134` и `billing/checkout:48` — fail-closed (верно). Нюанс: `checkUserBlocked` основной уже на `.maybeSingle()` (аудит говорил про `.single()` только в `checkUserFlags`). → сквозное S5.
- **A-4** media-роуты без rate-limit — подтверждён (0 `withRateLimit` в `api/media/*`). Затрагивает PRD 31/35 (медиа в чате/листинге).
- **A-5** scrubContacts обходим — подтверждён (PRD 35).
- **A-7** `getClientIp` доверяет `x-forwarded-for` — затрагивает все per-IP лимиты (PRD 33 instant-bucket, chat, reports). High-приоритет для денежных путей.
- **A-1** CSP Report-Only + `unsafe-inline/eval` — для trust-платформы с чатом/платежами XSS = угон сессии; перед escrow-запуском поднять до enforced с nonce.
- **billing webhook** — идемпотентность «по эффекту», без `event.id` — **прямо влияет на дизайн escrow-вебхука** (S0).

Эти находки — обязательный pre-req для денежных PRD (10/11/12/13/39): без A-1/A-7-фиксов запускать платный escrow рискованно.

---

## Таблица вердиктов и оценок

| PRD | Тема | Статус кода | Главный тех-риск | Вердикт | Усилие |
|---|---|---|---|---|---|
| 10 | Escrow / Safe-deal | ⛔ greenfield | Юр-гейт + идемпотентность не как механизм (S0) + неполная схема | ⛔ блокер (юр), затем 🔄 | L |
| 11 | Disputes | ⛔ greenfield | Атомарность resolve/деньги, роль support, таймеры | 🔄 | M–L |
| 12 | Shipping | ⛔ greenfield | Верификация carrier-вебхука (денежный триггер), маппинг статусов | 🔄 | M |
| 13 | In-chat Bancontact | ⛔ greenfield | deal-first модель не зафиксирована, idempotency-ключ | 🔄 | M |
| 16 | ATO protection | 🟡 | Ревокация сессий поверх GoTrue (не своя таблица) | 🔄 | M |
| 17 | Image verification | ⛔ greenfield | Near-dup поиск pHash в Postgres «быстро» нереалистичен без сервиса | 🔄 | L |
| 18 | PWA + push | ⛔ greenfield | SW-стек не выбран; ложный viewport-пункт; зависит от 36 | 🔄 | M |
| 30 | Identity | 🟡 | sub-uniqueness без БД-constraint; источник tier | 🔄 | M |
| 31 | Listing creation | ✅ as-built | fail-open create + fraud-rules не вызываются | ✅ (с правками S) | S |
| 33 | Search | ✅ as-built | Формула буста + стабильная сортировка не заданы | ✅ (с правками S) | S |
| 34 | Discovery extras | 🟡 | Дедуп saved-search алертов | ✅ (с правками) | S–M |
| 35 | Chat antifraud | ✅ | risk-flags→trust не реализованы; scrub обходим (by design) | ✅ (roadmap M) | M |
| 36 | Notifications | 🟡 | Event→channel матрица не специфицирована как данные | 🔄 | M |
| 37 | Trust/reviews | 🟡 | Веса не заданы; зависит от escrow; интерфейс сигналов | 🔄 | M |
| 38 | Moderation | 🟡 | fraud-engine не вызывается в рантайме (подтверждено) | 🔄 | M |
| 39 | Monetization | 🟡 | Webhook идемпотентность «по эффекту» (S0 при общей абстракции) | ✅ (скоуп) / 🔄 (абстракция) | S–M |
| 40 | Business accounts | 🟡 | Роли команды, поведение при VIES down | 🔄 | M |
| 62 | Listing detail/KB | 🟡 | resolveGeneration/catalog_groups/kb_insights — DDL не задана; generation_id не хранится | 🔄 (алгоритм ✅) | M–L |

Сводка по вердиктам: **✅ sign-off (с малыми правками): 31, 33, 34, 35, 39 (скоуп).** **🔄 доработать: 11, 12, 13, 16, 17, 18, 30, 36, 37, 38, 40, 62, 39 (общая абстракция).** **⛔ блокер: 10 (юр-гейт §8 — внешний).**

---

## Топ-12 инженерных находок / рисков

1. **Идемпотентность вебхуков сделана «по эффекту», без `event.id`-журнала** (`billing/webhook` — антипаттерн). Для escrow/payout/refund это приведёт к двойному списанию/выплате. → ввести `webhook_events` (S0) до любой денежной интеграции (10/12/13/39).
2. **Escrow (10) упирается во внешний юр-гейт** (NBB/Stripe/юрист BE, §8) — единственный честный ⛔. Схему данных и провайдер-абстракцию можно строить параллельно, прод-запуск — нет.
3. **Провайдер-абстракция PSP/Carrier заявлена трижды, но интерфейс не задан** → риск трёх несовместимых реализаций. Зафиксировать `PaymentProvider`/`CarrierProvider` (S1) до стройки.
4. **fraud-engine не подключён в рантайм** (подтверждено: 0 call-sites `fraud-detection` в `apps/web/src`; `fraud_rules` мёртвы). PRD 38 верно требует «подключить!» — нужен явный call-site на create/publish/checkout.
5. **`checkUserBlocked` fail-open на `POST /api/adverts:31`** (A-3, подтверждён) — заблокированный за фрод юзер создаёт объявление при транзиентной ошибке БД. → `failClosed:true` (S5).
6. **PRD 62: `generation_id` нигде не хранится, в `PostForm` поколение не выбирается** — баг 1996 структурно неустраним без миграции поля + `resolveGeneration` + chooser. Алгоритм в PRD корректен; не хватает DDL и бэкфилл-стратегии для существующих объявлений.
7. **Раскладка вкладок (62) нереализуема текущим `FieldGroup`** — он хардкодит `<h3>`-секции, `FieldDefinition` не несёт `display/tab_key`. Нужен `catalog_groups` + переписанный рендерер с ARIA-tabs.
8. **ATO (16): «выйти везде» через свою `user_sessions` не инвалидирует токен** — Supabase GoTrue держит сессии сам; нужна `auth.admin.signOut(global)`, иначе ревокация косметическая.
9. **Carrier-вебхук (12) — денежный триггер release без верификации подписи** = подделка «delivered» → ложный payout. Верификация + S0 + маппинг статусов обязательны.
10. **`getClientIp` доверяет клиентскому `x-forwarded-for`** (A-7) → все per-IP rate-limit (поиск instant-bucket, chat, reports) обходятся спуфингом. Pre-req перед платным escrow.
11. **Иммутабельные таймлайны (10/11) и машины состояний не enforce-нуты** — «иммутабельность» только на словах; невалидные переходы (`released→refunded`) и гонки release/dispute пройдут. Нужны insert-only RLS + триггеры + оптимистичная блокировка (S3/S4/S6).
12. **Event→channel матрица (36) не специфицирована как данные** — а это жёсткий предшественник push (18) и алертов (34). Без enum событий + dedup_key + TZ для quiet hours строить нельзя; сейчас это «концепция», не ТЗ.

## PRD без sign-off (нужна доработка перед стройкой)

- **⛔ Блокер:** 10 (escrow — юр-гейт §8).
- **🔄 Доработать (схемы/контракты/правила):** 11, 12, 13, 16, 17, 18, 30, 36, 37, 38, 40, 62; 39 — в части общей с escrow провайдер-абстракции.
- **✅ Sign-off (малые правки инлайн):** 31, 33, 34, 35, 39 (текущий скоуп бустов/Pro).

Сквозные §S0–S7 — обязательная база; они закрывают большинство 🔄 по денежным PRD одним набором решений.
