> [!WARNING]
> **ARCHIVE / SUBORDINATE REFERENCE.** Это сохранённый продуктовый контракт, а не активная задача, backlog, статус или порядок реализации. Работу активирует и принимает только [`docs/MASTER_PRODUCTION_TZ.md`](../MASTER_PRODUCTION_TZ.md).

# Saved-search alerts: сохранённые инварианты

Этот файл сохраняется только потому, что в нём есть уникальные требования к каналам уведомлений. Текущее поведение подтверждается кодом и evidence; текущий priority/status находится только в Master.

## Продуктовый контракт

- Поддерживаемая частота поиска должна соответствовать фактическому scheduler contract. Сейчас публичный выбор ограничен `daily/off`; нельзя обещать `instant`, пока такого delivery path нет.
- Отписка и удаление должны быть не сложнее подписки. `off` обязан прекращать delivery во всех каналах.
- Email для новых совпадений допускается только через provider-gated outbox/retry/bounce/complaint контур, с учётом пользовательских preferences и локали.
- Текст уведомления нейтрален: заголовок объявления, ссылка и явная отписка; никаких обещаний безопасной оплаты, гарантии или активного provider, если capability неактивна.
- Web Push остаётся отдельной default-OFF capability. Наличие service worker или VAPID keys само по себе не разрешает отправку.
- Cron остаётся fail-closed без собственного секрета, идемпотентным и наблюдаемым.

## Технические ссылки

- `apps/web/src/app/api/saved-searches/route.ts`
- `apps/web/src/app/api/saved-searches/[id]/route.ts`
- `apps/web/src/app/api/cron/saved-search-alerts/route.ts`
- `apps/web/src/components/saved/SavedSearchesClient.tsx`
- `supabase/migrations/20260711150000_saved_search_daily_cadence.sql`
