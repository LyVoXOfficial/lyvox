# PRD: Safe-deal / Escrow (защищённая сделка)

> **Статус кода:** ⛔ НЕ НАЧАТО (Stripe обслуживает только промо/бусты, не сделки между людьми)
> **Категория:** Не хватает (критическое — ядро дифференциации)
> **Приоритет:** P0
> **Зависит от:** [[11-disputes]] (выкатывать вместе), [[12-shipping-integration]] (release по трекингу), [[13-inchat-payment-bancontact]] (метод оплаты), [[14-consumer-trader-rights]], [[30-identity-account]] (KYC), [[39-monetization-billing]] (Stripe-абстракция)
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** Доминирующий фрод на бельгийских классифайдах — «оплати, чтобы получить», фейковые скрины оплаты, фишинговые payment/courier-ссылки, неотправка после предоплаты. На 2dehands/FB структура сделки этого не предотвращает. Без защищённой сделки LyVoX — «ещё одна доска».
- **Исход.** Покупатель платит в платформенный холд; продавец отправляет; деньги уходят продавцу только после подтверждения/таймаута осмотра; при провале — авто-возврат. Тогда **вся семья «оплата-вперёд» скамов структурно не работает** — это и есть главный маркетинговый месседж.
- **Стратегия.** Единственный защищаемый wedge (trust as a *product*, не бейдж).
- **KPI:** доля сделок через safe-deal от всех контактов-сделок; fraud/chargeback rate < X%; время до release; конверсия «escrow предложен → оплачен».

## 2. Контекст и текущее состояние (As-is)
- Нет таблиц `deals/deal_events/deal_payments/payouts/disputes`. Stripe billing есть только для бустов (`/api/billing/*`, `lib/stripe`).
- `trust_score` и fraud-rules существуют, но к сделкам не привязаны.
- Решение по PSP/праву не зафиксировано письменно (см. §13).

## 3. Пользователи и сценарии
- **Покупатель:** «Хочу платить безопасно, деньги не уйдут продавцу, пока я не получу товар».
- **Продавец:** «Хочу гарантию, что покупатель реально оплатил, и быстрый payout после доставки».
- **Модератор/Support:** «Хочу видеть статус сделки и разрешать спор по доказательствам».
- Happy-path: чат → продавец/покупатель создаёт сделку → покупатель платит (Bancontact/card) в холд → продавец отправляет с трекингом → доставка → окно осмотра 3–7 дней → подтверждение/таймаут → payout продавцу.

## 4. UX и поведение (детально)
- **Старт сделки:** кнопка «Безопасная сделка» в чате/на карточке (только shipped-режим на старте). Форма: цена, кто платит protection fee, адрес доставки, способ доставки ([[12-shipping-integration]]).
- **Оплата:** checkout с dynamic payment methods (Bancontact обязателен) → статус «Оплачено, в холде».
- **Таймлайн сделки** (общий для обеих сторон): создано → оплачено → отправлено (трек) → доставлено → осмотр (таймер) → завершено/возврат/спор. Каждое событие — иммутабельная запись.
- **Release:** по подтверждению покупателя ИЛИ по таймауту окна осмотра (3–7 дней, для дорогой/чувствительной электроники — продлеваемо).
- **Отмена/возврат:** до отправки — возврат целиком; protection fee частично возвратный при отмене/вине продавца (контр-приём против жалоб конкурентов).
- **Состояния:** ожидание оплаты, в холде, спор открыт, возврат в процессе, завершено.
- **Анти-скам копирайт:** «Никогда не платите по ссылке вне LyVoX, чтобы получить деньги».

## 5. Логика и правила
- **Модель: escrow-by-default, shipped-only, tracking-gated** на старте. In-person handover escrow — **отложить** ([[54-safe-meetup-points]]) как самый спорный.
- **Release-условие:** подтверждение покупателя ИЛИ таймаут осмотра при статусе «доставлено» (скан перевозчика, не «часы покупателя»).
- **Fee:** buyer protection fee = фикс + % (калибровать); частично возвратный по правилам выше.
- **Идемпотентность:** все денежные переходы — от вебхука PSP как source of truth.
- **Лимиты:** на старте — потолок суммы сделки и числа одновременных сделок (под пропускную способность споров, см. [[11-disputes]]).
- **Краевые:** двойная оплата, частичная доставка, потеря посылки, отмена после отправки, спор в окне осмотра.

## 6. Данные (Data model)
Новые таблицы (+RLS owner/participant-only, service-role только server-side):
- `deals { id, advert_id, buyer_id, seller_id, status, amount, currency, protection_fee, ship_method, created_at }`
- `deal_events { id, deal_id, type, payload jsonb, created_at }` — иммутабельный таймлайн.
- `deal_payments { id, deal_id, provider, payment_intent/session_id, status, amount, release_status, refunded_amount }`
- `payouts { id, deal_id, seller_id, provider_transfer_id, status, amount, released_at }`
- (споры — в [[11-disputes]])
Индексы по deal_id/buyer/seller/status. Retention/экспорт — GDPR ([[41-gdpr-legal]]).

## 7. API / интеграции
- **PSP: Stripe Connect, separate charges & transfers + manual/delayed payouts** — единственная реалистичная для соло модель (холд — регулируемая активность Stripe).
- Эндпойнты: `POST /api/deals` (создать), `POST /api/deals/[id]/pay` (checkout), `POST /api/deals/[id]/confirm` (release), `POST /api/deals/[id]/cancel`, `POST /api/webhooks/stripe-connect` (идемпотентно, source of truth).
- Провайдер-абстракция перед PSP (чтобы не привязываться к Stripe).
- KYC продавца — флоу-даун от Stripe Connect ([[30-identity-account]]).

## 8. Безопасность, приватность, комплаенс
- **Остаточные обязанности остаются на LyVoX даже с PSP:** KYC продавцов, transaction monitoring/SAR, sanctions screening, refund/chargeback. Если LyVoX *направляет*/*разрешает* холд-средства — риск трактовки как платёжный посредник → возможна регистрация агента у NBB. **Гейт: письменное подтверждение от Stripe + юриста по Бельгии до стройки.**
- Аудит-лог всех денежных событий; вебхук-идемпотентность; никаких секретов в клиенте.
- Триггерит [[14-consumer-trader-rights]] при продавцах-трейдерах.

## 9. Аналитика
- `deal_created/paid/shipped/delivered/released/refunded/disputed` с суммами/категориями; воронка escrow; fraud/chargeback rate; время до release.

## 10. Доступность и i18n
- Понятный статус-таймлайн со скринридер-метками; i18n-ключи `deal.*` (NL/FR/EN приоритет): статусы, кнопки, объяснения fee и окна осмотра.

## 11. Тестирование
- Unit: расчёт fee, release-условия, частичный возврат. API: создание/оплата/release/cancel; вебхук-идемпотентность (повтор события). e2e (Stripe test mode): полный happy-path + возврат + спор. Негатив: двойной вебхук, оплата без доставки.

## 12. План внедрения (Rollout)
- **NOW-1 (до стройки):** ~100 первых сделок вручную (Stripe Checkout/links + founder-mediated release) — проверить тезис.
- **Гейт:** письменное подтверждение модели (Stripe+юрист).
- **NOW-2:** shipped-only escrow + [[11-disputes]] вместе; Bancontact; авто-возврат; концаррентный лимит.
- **LATER:** in-person escrow; миграция на спец-PSP (OPP-типа) при необходимости. Усилие: L.

## 13. Открытые вопросы и решения
- Размер protection fee и правила частичного возврата. Окно осмотра по категориям. Потолки сумм/конкарренси на старте. Нужна ли NBB-регистрация (юр-заключение). Какой EU-PSP fallback.

## 14. Критерии готовности (DoD)
- [ ] Деньги не уходят продавцу до выполнения release-условия.
- [ ] Вебхук = source of truth, идемпотентно; авто-возврат при провале.
- [ ] Таймлайн иммутабелен; RLS закрывает доступ участниками.
- [ ] Споры ([[11-disputes]]) выкатываются вместе.
- [ ] Письменное подтверждение комплаенс-модели получено.
- [ ] Тесты в Stripe test mode зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

> ⛔ Блокер ревью: escrow заблокирован у LEGAL, DEV, SEC. Корень — неопределённый статус по PSD2/AML (F3) + отсутствие в PRD механизма идемпотентности по `event.id` (F1) и server-side authorization денежных переходов (F2). До закрытия гейта и фундаментов код прод-запуска начинать нельзя; схему данных/абстракцию строить можно.

### LEGAL
- **PSD2-гейт (ужесточить §8):** не начинать разработку до получения трёх документов (F3): (a) письменного юр-заключения BE payments-counsel о квалификации модели по PSD2 и необходимости NBB-регистрации/агентства (Art.19 PSD2); commercial-agent exclusion (Art.3(b)) НЕ применять (EBA Opinion 2019); (b) письменного подтверждения Stripe, что flow (separate charges & transfers, manual payouts, holding by Stripe Payments Europe) покрыт их PI-лицензией и Connect ToS; (c) AML-RACI: кто obliged entity, кто KYC, кто submitter SAR в CTIF-CFI, кто ведёт sanctions screening (Loi 18.09.2017).
- **§8a «Роль платформы» (добавить):** явная формулировка «LyVoX — посредник/маркетплейс и техплатформа, не сторона договора купли-продажи; средства держит Stripe Payments Europe; LyVoX не оказывает payment services от своего имени». Отразить в Terms.
- **Protection fee — consumer law (§4/§5):** (1) total-price disclosure до checkout (Art. VI.45 §1 CDE, анти-drip/анти-Vinted); (2) у покупателя есть 14-дн. право отказа от escrow-услуги (CRD/CDE Book VI) — информирование + waiver на немедленное исполнение (Art. VI.53 CDE); (3) прозрачные, не-unfair правила частичного возврата fee, опубликованные в Terms (Dir 93/13); (4) рекомендуется buyer-paid fee для чистоты consumer-картины.
- **Retention (§6):** транзакционные/инвойс/payout-данные хранятся 7 лет (BE bookkeeping/tax, CDE Book III / CIR92), затем удаление/анонимизация; не подлежат GDPR-erasure до истечения срока. AML/KYC — 10 лет (см. F4).
- **Sanctions (§8):** скрининг сторон сделки по EU consolidated sanctions list при создании сделки/payout; блок при попадании; лог.
- **Minimization (§4):** адрес покупателя раскрывается продавцу только после оплаты в холд.
- **GDPR-основания:** core escrow = Art.6(1)(b); monitoring/fraud = Art.6(1)(f) + LIA. Опереться на горизонтальный GDPR-фундамент (F4: RoPA, DPIA, DPA-реестр, retention-таблица).
- **DoD добавить:** получены 3 документа гейта (PSD2-заключение, OK Stripe, AML-RACI); Terms содержат роль-посредника + fee-terms + право отказа от услуги.

### DEV
- **F1 — идемпотентность по `event.id` (S0):** завести `webhook_events(id pk = Stripe event.id, provider, type, status, payload, processed_at)`; обработчик `INSERT ... ON CONFLICT DO NOTHING`, повтор → `200 OK` без эффекта; денежные мутации в транзакции с апдейтом `processed_at`. Текущий billing-webhook (дедуп «по эффекту») копировать нельзя.
- **F2 / S7 — авторизация и тесты:** server-side проверка `оплачено == deals.amount`, payout только на verified-KYC seller сделки, допустимость статус-перехода. Тесты: валидная/невалидная подпись, повтор `event.id`, событие для несуществующей сделки, out-of-order (delivered после released).
- **S1 — провайдер-абстракция:** зафиксировать интерфейс `PaymentProvider` (`createEscrowCheckout/capture/releaseToSeller/refundBuyer/verifyWebhook`) ДО стройки; Stripe — конкретная реализация.
- **S2 — деньги:** все суммы как `integer` (центы) + `currency text` (ISO-4217); тип `Money`; запрет арифметики между валютами.
- **Схема (дополнить §6):** `deal_payments` развести `stripe_payment_intent_id`/`stripe_checkout_session_id`, добавить `application_fee_cents`, `refunded_amount_cents`, `idempotency_key`; `release_at` (дедлайн осмотра), `version int` на `deals`; таблица `seller_stripe_accounts(user_id pk, stripe_account_id, charges_enabled, payouts_enabled, details_submitted)`; `webhook_events`.
- **S3 — иммутабельный `deal_events`:** insert-only через RLS/grants + триггер `BEFORE UPDATE OR DELETE RAISE EXCEPTION`; запись только через SECURITY DEFINER RPC / service-role.
- **S4 — машина состояний:** таблица переходов `pending_payment → paid → shipped → delivered → (inspection) → released | refunded | disputed`; из `disputed` → `released | refunded | partial_refund`; невалидный переход → `409`.
- **S5 — `checkUserBlocked(..., {failClosed:true})`** на create и pay (F9); членство в сделке проверять server-side (`buyer_id/seller_id = auth.uid()`).
- **S6 — конкаррентность release vs dispute:** `UPDATE deals SET status=... WHERE id=$1 AND status=$expected`, проверять rowCount; release по cron `release_at <= now() AND status='delivered'`.
- **Fee-формула (явно):** `fee = round(amount * pct, half-up) + flat`, min/max; колонка `fee_payer`; правило частичного возврата таблицей (отмена до отправки → 100% fee назад; вина продавца → 100%; обычная отмена покупателя → удержан/частично).
- **Connect-онбординг:** тип аккаунта Express; обработка `account.updated`; payout заблокирован при `payouts_enabled=false`; правило для продавца без Connect-аккаунта на момент оплаты (deny pay или hold-and-prompt).
- **Фиче-флаги:** `escrow_enabled` (kill-switch), `escrow_max_amount_cents`, `escrow_max_concurrent_deals_per_user`.

### SEC
- **Replay вебхуков (Critical, S-3):** идемпотентность на уровне Stripe `event.id` — см. DEV F1.
- **Authorization суммы/получателя (Critical, S-7):** перед release/refund/payout сверять (a) сумму в PSP == `deals.amount`, (b) получатель == `deals.seller_id` с пройденным KYC, (c) допустимость статус-перехода; любая рассинхронизация → блок + алерт, не авто-проход.
- **Column-lock RLS (S-5):** `revoke insert,update on deals,deal_payments,payouts from authenticated,anon`; запись только service-role; участникам — `select` через `is_deal_participant()` SECURITY DEFINER. RLS = row-, не column-security.
- **KYC-гейт payout:** только на Connect-аккаунт с `charges_enabled`/`payouts_enabled`; verified-tier (itsme) для high-value (связь с PRD-30).
- **Предусловия зоны:** S-1 (серверный IP, F8), S-2 (CSP enforced + nonce), S-4 (fail-closed `checkUserBlocked`, F9), F9 (подключить `fraud-detection` в рантайм на create/pay).
- **PII в `deal_events.payload`:** не складировать адрес доставки/полные данные в иммутабельном логе; retention.

**Вердикт:** ⛔ — блокер по PSD2/AML-гейту (F3) и отсутствию в PRD идемпотентности (F1) + authorization денег (F2); после закрытия → 🔄.
