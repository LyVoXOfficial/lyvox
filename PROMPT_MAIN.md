last_sync: 2025-10-28

# LyVoX Knowledge Index

## Purpose

- Single entry point for contributors to discover architectural docs, domain guides, and maintenance expectations.
- Ensures code ⇆ documentation consistency across API, database schema, and operational runbooks.

## Knowledge Context

This workspace uses a layered documentation system:

- **PROMPT_MAIN.md** — root knowledge entrypoint
- **docs/KNOWLEDGE_MAP.md** — hierarchical map of all documentation sources
- **docs/CURSOR_KNOWLEDGE_BASE.md** — general technical foundation
- **docs/domains/** — domain-specific business logic
- **docs/development/** — implementation details and modules

📚 For navigation and understanding of the complete documentation structure, refer to `docs/KNOWLEDGE_MAP.md`.

## 🤖 AI Assistant Instructions

**При выполнении задач из Master Checklist (`docs/development/MASTER_CHECKLIST.md`):**

1. **После завершения задачи**: Отметьте задачу как выполненную, заменив `[ ]` на `[x]` в файле `docs/development/MASTER_CHECKLIST.md`.
2. **Автоматическое обновление прогресса**: После изменения чекбоксов запустите `pnpm run checklist:update` или `npm run checklist:update` для автоматического пересчета статистики.
3. **Коммит изменений**: Включите обновленный `MASTER_CHECKLIST.md` в коммит вместе с остальными изменениями.

**Пример workflow:**
```
1. Выполнить задачу DB-001
2. Отметить [x] для DB-001 в MASTER_CHECKLIST.md
3. Запустить: pnpm run checklist:update
4. Закоммитить: git add . && git commit -m "feat: completed DB-001 (task: DB-001)"
```

Эта процедура должна выполняться **автоматически** после каждой завершенной задачи без дополнительных напоминаний пользователю.

## Core References

- **🎯 Development Master Checklist**: `docs/development/MASTER_CHECKLIST.md` — **НАЧАТЬ ОТСЮДА!** Полный чек-лист всех задач проекта, упорядоченных по приоритетам и зависимостям.
- Architecture & Stack: `docs/ARCHITECTURE.md`, `docs/ARCH_RULES.md`, `docs/PLAN.md`.
- Requirements & Compliance: `docs/requirements.md`, `docs/ONBOARDING_REQUIREMENTS.md`, `docs/INSTALL.md`.
- API Surface: `docs/API_REFERENCE.md`.
- MCP Services: `docs/MCP_SERVICES.md` — документация по использованию MCP сервисов (Supabase, Vercel).
- Domain Guides: see `docs/domains/` (profiles, adverts, deals, moderation, trust_score, phones, consents, devops, chat, billing, analytics, support_disputes, i18n).
  - Supported languages: EN, NL, FR, RU, DE
- Development Documentation: `docs/development/` — детальная документация по каждой функциональной зоне (см. `docs/development/README.md`).
- Operational backlog: `docs/TODO.md`, roadmap milestones in `docs/PLAN.md`.

## Post-Task Deployment Checklist

**После каждой выполненной задачи при необходимости выполнить:**

1. **Master Checklist**: Обновить прогресс выполнения — если были отмечены задачи в `docs/development/MASTER_CHECKLIST.md`, запустить `pnpm run checklist:update` для автоматического обновления статистики прогресса.
2. **Git**: Обновить репозиторий — закоммитить изменения, создать коммит с описанием выполненной работы. **Важно**: включить обновленный `MASTER_CHECKLIST.md` если прогресс был обновлен.
3. **Vercel**: Проверить статус деплоев — убедиться, что изменения успешно задеплоены на Vercel, проверить статус последнего деплоя.
4. **Supabase**: При необходимости обновить — если были изменения в схеме БД или миграциях, применить миграции в Supabase.

**Команды для выполнения:**

- Master Checklist: `pnpm run checklist:update` — автоматически пересчитывает прогресс (выполненные `[x]`, в процессе `[~]`, следующие задачи)
- Git: `git add . && git commit -m "описание изменений (задача: ID)" && git push` — включать ID задачи из чек-листа (например, `DB-001`)
- Vercel: Проверить через MCP инструменты или веб-интерфейс Vercel
- Supabase: `supabase db push` или применение миграций через MCP инструменты

## Verification Checklist (run before/after major changes)

1. `pnpm install` — dependency graph must resolve (current stack: Next.js 16.0.0, React 19.2.0, TypeScript 5.9.x, `@supabase/supabase-js` 2.76.x, `@supabase/ssr` 0.7.x).
2. `pnpm exec tsc -p apps/web/tsconfig.json --noEmit` — type safety.
3. Supabase SSR smoke-test — `supabaseServer()` should fetch profile data using live cookies.
4. Schema alignment — compare `supabase/migrations/**` ↔ `supabase/types/database.types.ts` ↔ `docs/requirements.md`.
5. Documentation sync — update relevant domain doc(s), link to TODOs/PLAN items, adjust `last_sync` field.
6. **Master Checklist Progress** — обновить прогресс в `docs/development/MASTER_CHECKLIST.md`:
   - Отметить выполненные задачи как `[x]` (completed)
   - Отметить задачи в процессе как `[~]` (in progress)
   - Запустить `pnpm run checklist:update` для автоматического обновления статистики
7. **Post-Task Deployment** — выполнить Git, Vercel и Supabase обновления при необходимости.

## When Editing Domains

- Update the corresponding markdown under `docs/domains/` with schema/API changes and cross-link to authoritative sources.
- If a change impacts multiple domains (e.g., trust score adjustments triggered by moderation), update every relevant doc.
- Add or update TODO entries in `docs/TODO.md` with clear, actionable language.
- **Update Master Checklist**: Если задача из `docs/development/MASTER_CHECKLIST.md` была завершена, отметить её как `[x]` и запустить `pnpm run checklist:update`.

## Supabase Client Notes

- Service-role operations rely on `@supabase/ssr` 0.7.x; do not upgrade past that until a new stable is published and the checklist above passes.
- Keep `supabaseServer()` cookie adapters compatible with current Next.js headers API.

## Reporting

- Significant inconsistencies or schema drifts should be logged in the final agent report (see sample format in latest task outcomes).
- Include explicit ⚠️ entries when documentation and code diverge (e.g., missing migration for documented column).

---

## 🔒 Repository Visibility & Data Policy

- The entire `/docs` directory (including `PROMPT_MAIN.md`, domain guides, requirements, and architecture files)
  **must never be uploaded, pushed, or synced to any public repository**.
- These files contain internal specifications, database schema, and compliance notes — they are for **local development only**.
- GitHub (or any other public VCS) must exclude `/docs/**` via `.gitignore`.
- Automated agents (Codex, Gemini, etc.) are not allowed to share, publish, or commit documentation content.
- Only generated code, migrations, and non-sensitive metadata may be pushed upstream.
- Internal documentation stays private until a secure private repository or self-hosted Git instance is configured.

## Realtime chat syncy

- conversations / messages tables are declared in requirements.md,
- migrations for those tables exist in supabase/migrations/\*\*,
- TODO.md contains execution tasks for Realtime chat (client hook, API, RLS),
- UI work is planned (thread list, message view),
- abuse reporting is wired into logs.
- domain guide exists: `docs/domains/chat.md`.

## Change Log

- 2025-10-28: Created after generating domain documentation set and aligning stack versions.
- 2025-01-XX: Added Master Checklist integration — `docs/development/MASTER_CHECKLIST.md` linked in Core References, automatic progress update via `pnpm run checklist:update` integrated into Post-Task Deployment Checklist and Verification Checklist.
