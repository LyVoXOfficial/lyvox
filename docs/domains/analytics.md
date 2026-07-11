last_sync: 2025-10-28

# User Analytics & Insights (RFC)

## Overview
- Понимание активности и удержания: события просмотра/поиска/чата/резерва.
- Хранилище: Supabase Analytics (если доступно) или PostHog/Segment.
- Privacy by design: анонимизация, согласия (см. `domains/consents.md`).

## Event Model (proposed)
- `analytics.events` (внешний провайдер) или `public.analytics_events` (самостоятельно):
  - `id uuid`, `user_id?`, `anon_id`, `name`, `properties jsonb`, `created_at`.
- Ключевые события: `advert_view`, `search`, `deal_initiated`, `chat_message_sent`, `report_created`, `media_uploaded`.

## Dashboards & Metrics
- DAU/WAU/MAU, retention cohorts, конверсия к контактам/резервам/сделкам.
- Воронки: просмотр → контакт → резерв → сделка.

## Integrations & Dependencies
- Уважать пользовательские согласия на трекинг.
- Экспорт метрик для продуктовых решений (листы приоритета).

## Candidate improvements

Исторические идеи: выбор провайдера, схема событий, базовые панели и Scaling-волна. Исполнять только после включения в [Production master](../MASTER_PRODUCTION_TZ.md).

## Change Log
- 2025-10-28: Initial analytics RFC.

---

## 🔗 Related Docs

**Development:** [admin-panel.md](../development/admin-panel.md) • [deep-audit-20251108.md](../development/deep-audit-20251108.md) • [Production master](../MASTER_PRODUCTION_TZ.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [FINAL_COMPLETION_REPORT.md](../catalog/FINAL_COMPLETION_REPORT.md)
