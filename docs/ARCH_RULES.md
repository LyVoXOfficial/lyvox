# LyVoX — Архитектурные правила (ARCH_RULES)

## 1. Основные ограничения

- Язык/Runtime: TypeScript 5.9, Node.js ≥ 20 LTS, Next.js 16 (App Router, SSR/ISR).
- UI: React 19.2, TailwindCSS 4, shadcn/ui, Radix primitives.
- БД: Supabase Postgres. Все таблицы с RLS = ON. Изменения схемы — ТОЛЬКО миграции.
- Auth: Supabase Auth; **админ-права только через JWT claim `app_metadata.role = 'admin'`**.
- Секреты: никаких server-only ключей в клиенте (в т.ч. `SUPABASE_SERVICE_ROLE_KEY`).
- Лимиты: обязательный rate limiting для OTP/модерации (Upstash Redis).
- Медиа: Supabase Storage (`user_id/advert_id/timestamp-filename`), каскадная очистка при удалении объявления.
- Логи: все чувствительные операции фиксируются в `logs`.

## 2. Принципы

- SSR/ISR first; приватные данные не утекают в клиент.
- Проверка прав — только на сервере.
- Идемпотентность в OTP и модерации.
- Наблюдаемость и аудит обязательны.

## 3. Версии

- Node 20.x • TS 5.9 • React 19.2 • Tailwind 4 • supabase-js 2.76 • supabase-ssr 0.7 — зафиксированы в `package.json`. До появления новой стабильной версии `@supabase/ssr` держим 0.7.x; апгрейд возможен только после успешных `pnpm install`, `pnpm exec tsc --noEmit` и ручного SSR smoke-теста (чтение профиля через `supabaseServer()`).

## 4. Документация — как контракт

- Ограничения — здесь (ARCH_RULES.md).
- Фактическая архитектура/изменения — в `docs/ARCHITECTURE.md`.
- ERD, RLS-SQL, ENV, Roadmap — в `docs/requirements.md`.
- API-контракты — в `docs/API_REFERENCE.md`.




