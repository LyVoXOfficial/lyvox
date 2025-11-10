last_sync: 2025-10-28

# Billing & Monetization (RFC)

## Overview
- Платные бусты объявлений, премиум-резерв, скрытие номера и другие платные опции.
- Интеграция со Stripe (или альтернативным PSP) для платежей и чеков.
- Требует чётких правил возвратов и антикража (chargeback handling).
- Связанные документы: [domains/adverts.md](./adverts.md), [requirements.md](../requirements.md), [PLAN.md](../PLAN.md).

## Data Model (proposed)
- `public.products` (`id`, `code`, `name`, `price_cents`, `currency`, `active`)
- `public.purchases` (`id uuid`, `user_id`, `product_code`, `provider`, `provider_session_id`, `status`, `created_at`, `updated_at`)
- `public.benefits` (активированные преимущества по покупке: `user_id`, `advert_id?`, `benefit_type`, `valid_until`)
- Webhook журнал от PSP (`provider_events`) для reconciliation.

## API Surface
- `POST /api/billing/checkout` — создать сессию оплаты.
- `POST /api/billing/webhook` — приём событий от PSP (подпись, идемпотентность).
- `GET /api/billing/benefits` — список активных преимуществ пользователя.

## RLS & Security
- Пользователи читают только свои покупки/бенефиты.
- Запись/обновление purchase производится через сервисный клиент из webhook.

## Integrations & Dependencies
- Привязка к объявлениям (буст/скрытие номера) через `benefits`.
- UI индикаторы буста/премиума в карточке объявления.

## Improvements & TODO Links
- TODO.md: добавить RFC на продукты/бенефиты, webhook‑безопасность и reconciliation job.
- PLAN.md: добавить этап “Monetization rollout” после Production.

## Change Log
- 2025-10-28: Initial RFC for monetization.

---

## 🔗 Related Docs

**Development:** [billing-subscriptions.md](../development/billing-subscriptions.md) • [database-schema.md](../development/database-schema.md) • [MASTER_CHECKLIST.md](../development/MASTER_CHECKLIST.md) • [deep-audit-20251108.md](../development/deep-audit-20251108.md) • [backend-logic.md](../development/backend-logic.md)
