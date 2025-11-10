last_sync: 2025-10-28

# Support & Disputes (RFC)

## Overview
- Поддержка пользователей и разрешение споров по сделкам (апелляции, доказательства).
- Интеграция с `reports`, `deals`, будущими `reviews`.

## Data Model (proposed)
- `public.disputes`: `id uuid`, `deal_id`, `raised_by`, `against_user_id`, `reason`, `details`, `status`, `created_at`, `updated_at`.
- Приложения/доказательства: `public.dispute_attachments` (Storage refs).

## API Surface
- `POST /api/disputes/create`, `POST /api/disputes/update`, `GET /api/disputes/list` (роль-ориентированные ответы).

## RLS & Security
- Участники сделки и админы; третьи лица — запрещены.
- Аудит всех действий в `public.logs`.

## Integrations & Dependencies
- Взаимосвязь с модерацией (перекрёстные ссылки из жалоб), Trust Score корректировки по итогам.

## Improvements & TODO Links
- TODO.md: RFC на статусы спора, SLA, шаблоны коммуникаций, UI очередей.
- PLAN.md: добавить в Production волну как операционный процесс.

## Change Log
- 2025-10-28: Initial disputes RFC.

---

## 🔗 Related Docs

**Domains:** [adverts.md](./adverts.md) • [deals.md](./deals.md) • [moderation.md](./moderation.md) • [trust_score.md](./trust_score.md)
**Development:** [security-compliance.md](../development/security-compliance.md)
