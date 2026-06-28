# PRD: Монетизация (Stripe billing, бусты, benefits, Pro)

> **Статус кода:** 🟡 ЧАСТИЧНО (billing/бусты/Pro есть; буст-ранжирование не подключено; safe-deal fee — отдельно)
> **Категория:** Есть (с доработками)
> **Приоритет:** P1
> **Зависит от:** [[33-search]] (буст-ранжирование), [[40-business-accounts]] (Pro), [[10-escrow-safe-deal]] (protection fee)
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** Нужна выручка без seller-fees на листинг (бельгийская норма — продавцы ненавидят комиссии за листинг). Монетизация — через платную видимость/Pro/safe-deal fee.
- **Исход.** Платные бусты/премиум-benefits, Pro-подписка для бизнеса, (позже) buyer protection fee в escrow. Бусты реально влияют на ранжирование — но только при ликвидности.
- **KPI:** ARPU/выручка; конверсия в буст/Pro; влияние буста на просмотры/сделки.

## 2. Контекст и текущее состояние (As-is)
- Stripe billing: `/api/billing/{products,benefits,checkout,purchases,subscribe,webhook}`, `billing_tables/rls`, `lib/stripe`, `BoostDialog`, `BenefitsBadge`, профиль `billing`.
- Pro-подписка: `profiles_pro_subscription`, `/pro`.
- Известно: benefits покупаемы, но `search_adverts` их **игнорирует** (буст не влияет на ранжирование); листинг бесплатен.

## 3. Пользователи и сценарии
- **Продавец:** «Поднять объявление в выдаче (буст)».
- **Бизнес:** «Pro-подписка с витриной/инструментами».
- **Покупатель:** (позже) платит buyer protection fee в escrow.

## 4. UX и поведение (детально)
- **Буст:** `BoostDialog` → checkout (dynamic methods, Bancontact) → объявление помечается/поднимается.
- **Benefits/Pro:** покупка/подписка, бейдж, набор возможностей.
- **Checkout:** не форсить `payment_method_types` (показывать релевантные, включая Bancontact).
- Состояния: активен/истёк/отменён буст/подписка.

## 5. Логика и правила
- **Буст-ранжирование:** подключить влияние benefits в `search_adverts` — **за фиче-флагом, включать при ликвидности** (буст в пустом маркетплейсе бессмыслен).
- Идемпотентность вебхуков (source of truth); проростки/срок действия бустов.
- Листинг — бесплатен (норма BE); комиссии — на видимость/сделку.
- Краевые: возвраты, отмена подписки, истечение буста.

## 6. Данные (Data model)
- `products`, `benefits`, `purchases`, `profiles_pro_subscription`, billing tables. RLS owner-only; вебхук-обработка server-only.

## 7. API / интеграции
- `/api/billing/*` + Stripe webhook (идемпотентно). Провайдер-абстракция (общая с escrow [[10-escrow-safe-deal]]).

## 8. Безопасность, приватность, комплаенс
- Вебхук-идемпотентность; нет секретов в клиенте; чеки/НДС (BE); прозрачность цен (избегать кейсов вроде Vinted-pricing-transparency).

## 9. Аналитика
- Конверсия в буст/Pro, выручка, эффект буста на просмотры/сделки, churn подписок.

## 10. Доступность и i18n
- Доступный checkout/диалоги; i18n `billing.*`, `pro.*` (NL/FR/EN); локализованные цены/валюта.

## 11. Тестирование
- Unit: расчёт/срок буста. API: checkout/webhook идемпотентность (тесты есть), subscribe. e2e (test mode): покупка буста → отражение; подписка Pro.

## 12. План внедрения (Rollout)
- **Поддержка/улучшения:** буст-ранжирование за флагом (вкл. при ликвидности); затем protection fee в escrow. Усилие: S–M.

## 13. Открытые вопросы и решения
- Прайсинг бустов/Pro. Когда включать буст-ранжирование. Структура protection fee ([[10-escrow-safe-deal]]).

## 14. Критерии готовности (DoD)
- [ ] Бусты/benefits/Pro покупаются; вебхуки идемпотентны.
- [ ] Буст-ранжирование за фиче-флагом готово (вкл. при ликвидности).
- [ ] Прозрачность цен; листинг бесплатен.
- [ ] Тесты §11 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

### LEGAL (фундамент F4 — consumer/UCPD/Omnibus/P2B)
- **Ranking transparency (CDE Art. VI.45 §1 19° / Omnibus + P2B Reg. 2019/1150):** платные бусты влияют на ранжирование → обязанность раскрыть main ranking parameters + что paid placement влияет на позицию, **пометить «Sponsored/Реклама»** на бустнутых. Без этого = misleading practice (UCPD). **Гейт:** буст-ранжирование не включать без disclosure-метки. P2B — раздел в T&C для business-продавцов.
- **Drip-pricing prohibition (анти-Vinted):** все mandatory fees (вкл. protection fee из [[10-escrow-safe-deal]]) — в total price с первого экрана, не на последнем шаге (UCPD breach).
- **Subscriptions / Pro:** auto-renewal-информирование + лёгкая отмена (BE tacit-renewal, Art. VI.91 CDE); определить consumer vs B2B статус подписчика (zelfstandige-физлицо в двойном статусе → возможное 14-дн. право отказа от подписки); чистый B2B — мягче.
- **VAT / invoicing:** boost/Pro = electronically supplied services, **VAT 21%**; корректные legal invoices (VAT number, sequential number); place-of-supply (B2C BE = BE VAT; B2B EU = reverse charge). Решить «вне MVP» vs «через Stripe Tax/Invoicing» (закрыть открытый юр-хвост).
- **Pre-contractual info для платных фич:** buy boost = дистанционный договор → total price + что покупается + срок + подтверждение.

### DEV (фундамент F1, F8)
- **Webhook-идемпотентность частичная** (подтверждено: дедуп по `purchases.status`, подписка без дедупа, нет `event.id`-журнала). Для бустов риск низкий, но **провайдер-абстракция общая с escrow** → привести к `webhook_events(event_id)`-дедупу (F1/S0) при унификации, либо чётко развести два вебхука.
- **Формула буст-ранжирования** — общая с [[33-search]] (аддитивный bounded бонус с cap, за флагом).
- Тесты: повтор `event.id` → нет двойного эффекта (после S0).

**Вердикт:** 🔄 Доработать — текущий скоуп (бусты/Pro) технически работает (DEV ✅ для скоупа), но нельзя включать буст-ранжирование без ranking-transparency/sponsored-метки (UCPD/Omnibus/P2B); нужны VAT-invoicing, subscription-прозрачность, drip-pricing запрет и `event.id`-дедуп при общей абстракции с escrow. После правок → ✅.
