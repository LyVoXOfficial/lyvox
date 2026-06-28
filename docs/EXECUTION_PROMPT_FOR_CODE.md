# Промпт для Claude Code — исполнение по MASTER_TODO.md

Скопируй всё ниже (между линиями) и вставь в Claude Code в корне репозитория `C:\LyvoxMarketPlace`.

---

Ты — старший fullstack-инженер на проекте **LyVoX** (trust-first маркетплейс для Бельгии). Стек: **Next.js 16 (App Router) + React + TypeScript + Supabase (Postgres/Auth/Storage/Edge Functions) + Stripe + Upstash**, pnpm-монорепо, деплой Vercel. Аутентификация — **Supabase Auth + itsme (OIDC)**, НЕ Auth0.

## Источник правды
Единственный бэклог — `docs/MASTER_TODO.md`. Детали по каждому пункту — в `docs/features/<id>-*.md` (в конце каждого PRD есть раздел «Ревью-требования и sign-off» — это обязательные требования). Сквозные предпосылки — `docs/features/FOUNDATIONS-F1-F14.md`. Юр-гейт по escrow — `docs/features/escrow-legal-gate.md`. Синтез ревью — `docs/features/reviews/README.md`.

## Золотые правила (соблюдай всегда)
1. Перед любой задачей: прочитай её PRD целиком + его раздел «Ревью-требования и sign-off» + связанные F-тикеты. Не начинай код, не прочитав требования.
2. **Уважай блокеры ⛔.** PRD 10/13 (escrow/оплата) — НЕ писать прод-код денежного флоу, пока не закрыт `escrow-legal-gate.md` (F3). Схему данных и провайдер-абстракцию проектировать можно.
3. Каждая фича — за **feature-flag**; мелкие атомарные коммиты/PR по одному пункту; ветка `feat/<id>-<slug>`.
4. После каждого изменения держи зелёными: `pnpm typecheck`, `pnpm test`, `pnpm lint`. Не мержить красное.
5. Новые таблицы — timestamped-миграции `supabase/migrations/YYYYMMDDHHMMSS_*.sql` + **RLS обязательно** (owner/participant-only; service-role только server-side) + обнови типы (`pnpm gen:types`).
6. Вебхуки — идемпотентны (F1). Денежные переходы — server-side авторизация суммы/получателя (F2). Никаких секретов в клиенте.
7. Строки UI — только через `t()` (i18n NL/FR/EN приоритет), без хардкода.
8. Не делай SEO/Security «pre-launch hardening» как отдельный этап (он отложен), КРОМЕ F-предпосылок ниже (F1/F2/F8/F9/F10/F12), которые нужны раньше как основа денег/анти-фрода/данных.
9. После завершения пункта — обнови статус и матрицу §8 в `docs/MASTER_TODO.md` (🔄→✅) и поставь галочки в DoD соответствующего PRD.

## Порядок исполнения
Следуй `FOUNDATIONS-F1-F14.md` → «Порядок запуска»:
1. **Внешне-долгие (запустить как артефакты/вопросы сразу):** F3 (escrow-гейт), F4 (GDPR-артефакты), F5 (DSA-роль) — это не код, а документы/решения: подготовь черновики и список вопросов.
2. **Быстрые победы (код):** F1 → F8 → F10 → F9 → F11.
3. **Под текущий фокус (дизайн/карточки):** F7 (фикс бага 1996) → F13 (вкладочный рендерер) → F12 (structured data/SEO) → F14 (trust-формула).
4. **Затем области:** B (10–15, после гейта) → C (16,17,30,37,38) → A-доработки (31 воронка, 33/32 SEO, 01 свайпы, 62) → D (18,34,35,36,61) → монетизация (39,40,41,42) → бонусы (50–60).

## Какие скилы использовать по каждому пункту (вызывай через `/`)
> Если какого-то скила нет в твоём Claude Code — установи плагин knowledge-work-plugins или примени эквивалентную экспертизу. Перед стартом один раз: `/init` (создай/обнови CLAUDE.md по этому репозиторию).

**Фундаменты:**
- **F1 webhook_events (идемпотентность):** `/engineering:system-design` (схема `webhook_events`), `/engineering:testing-strategy` (тест двойной доставки), `/engineering:code-review`.
- **F2 авторизация денег:** `/engineering:architecture` (ADR модели), `/security-review`, `/engineering:code-review`.
- **F3 escrow legal-gate:** `/legal:compliance-check`, `/legal:legal-risk-assessment` (PSD2/AML/NBB по `escrow-legal-gate.md`) — оформить вопросы и решение, кода не писать.
- **F4 GDPR-артефакты (RoPA/DPIA/DPA/retention):** `/legal:compliance-check`, `/legal:legal-risk-assessment`.
- **F5 DSA-роль (PoC/legal rep/DSC):** `/legal:compliance-check`, `/legal:brief`.
- **F6 analytics_events sink:** `/engineering:system-design`, `/data:sql-queries`, `/data:validate-data`.
- **F7 фикс 1996 (generation_id + resolveGeneration):** `/data:explore-data` + `/data:sql-queries` (миграция колонки+FK, бэкфилл), `/engineering:system-design` (хелпер resolveGeneration unique|ambiguous|none + chooser), `/engineering:testing-strategy` (кейс BMW 5 1996 → ambiguous), `/engineering:debug`.
- **F8 серверный client-IP:** `/security-review`, `/engineering:code-review`.
- **F9 fraud-engine в рантайм + fail-closed:** `/security-review`, `/engineering:debug`, `/engineering:code-review`.
- **F10 itsme_sub uniqueness (Supabase Auth, не Auth0):** `/engineering:system-design` (миграция `profiles.itsme_sub unique`), `/security-review` (OIDC state/nonce, anti link-ATO).
- **F11 дедуп advert_views:** `/data:sql-queries`, `/data:validate-data`, `/engineering:code-review`.
- **F12 structured data + SEO /c/*:** `/marketing:seo-audit`, затем имплементация — `/engineering:code-review`, `web-design-guidelines`. Подключить готовые `lib/seo/catalog/*` (RealEstateListing/JobPosting/Product) + Vehicle/Car; заменить `seller`-заглушку.
- **F13 catalog_groups + ARIA-tabs рендерер:** `/design:design-system`, `/design:design-handoff`, `/design:accessibility-review`, `vercel-composition-patterns`, `vercel-react-best-practices`.
- **F14 trust-формула + анти-накрутка:** `/data:statistical-analysis`, `/data:sql-queries`, `/data:validate-data`.

**Области/PRD:**
- **01 свайпы:** `/design:design-critique`, `/design:ux-copy`, `/design:accessibility-review`, `vercel-react-view-transitions` (анимации вылета/undo), `vercel-react-best-practices`.
- **62 карточки по категориям:** сначала F7+F13+F12; затем `/design:design-system`, `/data:sql-queries` (KB-таблицы), `/marketing:seo-audit`.
- **31 создание объявления (воронка/черновик-до-верификации):** `/design:design-critique`, `/design:ux-copy`, `/engineering:code-review`.
- **32/33 каталоги/поиск (SEO + relevance):** `/marketing:seo-audit`, `/data:write-query`, `/engineering:code-review` (вынести `/search` из `"use client"` для metadata/noindex).
- **10/11/12/13 escrow/споры/доставка/оплата:** (после F3) `/engineering:architecture`, `/engineering:system-design`, `/security-review`, `/legal:compliance-check`, `/engineering:testing-strategy` (Stripe test mode).
- **30 identity / 16 ATO:** `/security-review`, `/engineering:architecture` (Supabase Auth + itsme; ревокация через GoTrue `admin.signOut(global)`). НЕ использовать `/auth0:*`.
- **38 модерация:** `/security-review`, `/engineering:code-review`, `/legal:compliance-check` (DSA Art.16/17/20/22/23).
- **36 уведомления / 18 PWA:** `/engineering:system-design` (event→channel матрица), `vercel-react-best-practices` (PWA/serwist).
- **39 монетизация / 40 бизнес:** `/engineering:code-review`, `/legal:compliance-check` (ranking-transparency, P2B, DSA Art.30).
- **41 GDPR / 42 i18n:** `/legal:compliance-check`, `/marketing:seo-audit` (hreflang nl-BE/fr-BE/x-default).
- **34 discovery / 35 чат / 37 trust:** `/engineering:code-review`, `/data:*` (сигналы/дедуп), `/security-review` (чат).
- **Перед деплоем:** `/engineering:deploy-checklist`, `vercel-cli-with-tokens`.

## Рабочий цикл на каждый пункт
1. `/engineering:architecture` или `/engineering:system-design` — зафиксируй решение/схему (если есть нетривиальный выбор → короткий ADR в `docs/`).
2. Реализация (миграции + RLS + код + i18n + feature-flag).
3. `/engineering:testing-strategy` → напиши unit/API/e2e по разделу §11 PRD; `pnpm test` зелёный.
4. `/engineering:code-review` (+ `/security-review` для денег/auth/чата/медиа; `/review` общий).
5. Обнови статус в `MASTER_TODO.md` (§8 матрица + статус строки) и DoD в PRD.
6. Коммит `feat(<id>): <что>`; маленький PR.

## С чего начать прямо сейчас
1. `/init` (CLAUDE.md). 2. Прочитай `docs/MASTER_TODO.md`, `docs/features/FOUNDATIONS-F1-F14.md`, `docs/features/reviews/README.md` и выведи краткий план первых 5 тикетов с оценками. 3. Подготовь артефакты F3/F4/F5 (вопросы/черновики). 4. Начни с **F1**, затем **F8**, **F10**. 5. Параллельно под текущий фокус — **F7 (фикс 1996)** и **F13 (вкладки)**, т.к. они разблокируют PRD 62 и 37.

Жди подтверждения после плана (шаг 2), затем выполняй пункты по одному, отчитываясь о каждом.

---
