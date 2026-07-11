last_sync: 2025-10-28

# Billing & Monetization (RFC)

## Overview
- Платные бусты объявлений, премиум-резерв, скрытие номера и другие платные опции.
- Интеграция со Stripe (или альтернативным PSP) для платежей и чеков.
- Требует чётких правил возвратов и антикража (chargeback handling).
- Связанные документы: [domains/adverts.md](./adverts.md), [requirements.md](../requirements.md), [Production master](../MASTER_PRODUCTION_TZ.md).

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

## Candidate improvements

Исторические идеи: RFC на продукты/бенефиты, webhook-безопасность, reconciliation job и этап Monetization rollout. Исполнять только после включения в [Production master](../MASTER_PRODUCTION_TZ.md).

## Change Log
- 2025-10-28: Initial RFC for monetization.

---

## 🔗 Related Docs

**Development:** [billing-subscriptions.md](../development/billing-subscriptions.md) • [database-schema.md](../development/database-schema.md) • [Production master](../MASTER_PRODUCTION_TZ.md) • [deep-audit-20251108.md](../development/deep-audit-20251108.md) • [backend-logic.md](../development/backend-logic.md)
