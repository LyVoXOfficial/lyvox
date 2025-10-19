# LyVoX — Текущая архитектура (ARCHITECTURE)

## Обзор

- Frontend: Next.js 15 (App Router, SSR/ISR), React 19, Tailwind, shadcn/ui.
- Backend: Route Handlers `app/api/**` (Node runtime).
- DB: Supabase Postgres + RLS (миграции `supabase/migrations/**`).
- Storage: Supabase Storage (bucket `ad-media`).
- Auth: Supabase Auth (magic link, phone OTP), план Itsme OAuth.
- Интеграции: Twilio, Upstash (rate limit), Cloudflare WAF, Vercel.

## Потоки

- Публикация объявления → draft → upload media → publish.
- Верификация телефона → request OTP (rate-limit) → verify → mark verified.
- Жалоба/модерация → create report → admin list → update → trust_inc.
- Регистрация (email/password) → GDPR consent log → Supabase signUp → redirect на `/onboarding`.

## Rate limiting

- Серверная обёртка `apps/web/src/lib/rateLimiter.ts` использует Upstash Redis (sliding window) для ключей `otp:user`, `otp:ip`, `report:user`, `report:ip`, `report:admin`; конкретные квоты описаны в [requirements.md#rate-limiting-plan](./requirements.md#rate-limiting-plan).
- Хэндлеры `/api/phone/request`, `/api/reports/create`, `/api/reports/list`, `/api/reports/update` обёрнуты через `withRateLimit` с кэшированием Supabase `auth.getUser()`.
- Клиентский слой — `apps/web/src/lib/fetcher.ts` бросает `RateLimitedError`; формы (`profile/phone`, `components/ReportButton`) реагируют тостами Sonner и локальным cooldown.

## Авторизация (кратко)

- guest: read-only
- user: CRUD своих объявлений/медиа, reports, phone verify
- admin (JWT role): модерация, trust-actions

## Схема данных

Смотри ER-диаграмму и RLS-SQL: `docs/requirements.md`.

## Журнал изменений архитектуры

- 2025-10-05 - Document governance introduced (project-rules.yaml) and initial duplication audit recorded.
