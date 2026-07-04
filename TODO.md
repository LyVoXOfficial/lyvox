# LyVoX — Операционная очередь задач

> **Как пользоваться (правила гигиены):**
> 1. Задания выполняются СТРОГО по порядку приоритета (T01 = сейчас, T10 = потом/завтра).
> 2. Инструкция каждого задания — отдельный файл в `docs/todo/T##-*.md`. Читай ТОЛЬКО файл своего задания, не всю папку.
> 3. После выполнения: поставь `[x]`, впиши SHA коммита. Держим максимум 2 выполненных задания в списке — более старые выполненные СТРОКИ УДАЛЯЙ (история живёт в git).
> 4. Новые задания добавляются в конец с следующим номером; инструкция-файл обязателен.
> 5. **Гейты перед merge (всегда):** `pnpm typecheck && pnpm test && pnpm lint` зелёные. Пре-коммит хук сам гоняет полный сьют (~2 мин) — это нормально, не прерывать.
> 6. **Деплой** = merge в main + `git push origin main` (Vercel собирает ~2 мин). После деплоя — прод-проверка из инструкции (curl).
> 7. **Красные линии (нарушать нельзя никогда):** не трогать/не удалять seed-данные (решение основателя: витрина до launch-gate); никаких «безопасная оплата/escrow/защита покупателя» в любых текстах (F3); все UI-строки через i18n и СРАЗУ в 5 локалей (en/fr/nl/de/ru — guard-тест упадёт); новые таблицы = RLS + column-scoped GRANT; новые фичи = за capability-флагом; никакого money-flow кода.
> 8. Ветки: `feat/<слаг>` или `fix/<слаг>`, merge через `--no-ff`. Трейлер коммита — указан в каждой инструкции.
> 9. Контекст проекта: `CLAUDE.md` (корень), стратегия — `docs/strategy/SITE_BLUEPRINT.md`, продуктовый бэклог — `docs/MASTER_TODO.md` (это ДРУГОЙ файл, не трогать).

> **Модель для задания (метка в каждой строке):**
> 🟢 = дешёвая/быстрая (medium) · 🟡 = средняя (high) · 🔴 = сильная (xhigh) + внимательное ревью диффа. Ставить НИЖЕ метки нельзя (будут ошибки в миграциях/RLS), выше — можно, но жжёт лимиты.

## Очередь

## Крупные волны после T01-T10 (инструкция-файл создаётся 🔴-моделью при взятии в работу)

- [x] **T13** 🟡 — UX1: редизайн-фиксы страниц по мокапам (`docs/features/audit/01` + `mockups/redesign-mockups.html`) → [T13-ux1-redesign-fixes.md](docs/todo/T13-ux1-redesign-fixes.md) — 079e5a8 (аудит на ~90% закрыт прошлыми волнами; из незакрытого+presentation-only взято 2: #9 мобильная trust-полоса, #2 скелетон аватара против auth-flicker; scope-note docs/todo/notes/T13-scope.md)
- [x] **T14** 🟡 — Системный проход empty-states + /search полировка (skeleton, verified-чип с предпросмотром счётчика, zero-result авторасширение) — SITE_BLUEPRINT волна 4 → [T14-empty-states-search.md](docs/todo/T14-empty-states-search.md) — 0f65e2a (все 5 пунктов; EmptyState=алиас MarketplaceEmptyState +children-слот; relaxation чинит только при exact=0 без гео-расширения; verified-чип N/M — реальные счётчики limit=1; desktop debounce 300мс без Apply, mobile «Показать N»; /c-index-error и discover/favorites оставлены compliant-as-is; scope-note docs/todo/notes/T14-scope.md)
- [ ] **T15** 🔴 — URL-локали `/nl /fr /de /en /ru` + hreflang (МИГРАЦИЯ архитектуры: сейчас Google индексирует один язык из пяти; чем позже — тем дороже) → [T15-url-locales.md](docs/todo/T15-url-locales.md)
- [ ] **T16** 🟢 — Контент-хаб `/guides`: 10-15 анти-скам гайдов nl/fr (SEO-канал GTM Фазы 1; БЕЗ имён конкурентов — CEL VI.17; тексты — 🟡, каркас — 🟢) → [T16-guides-hub.md](docs/todo/T16-guides-hub.md)
- [ ] **T17** 🟡 — Волна 3 остаток: sticky one-primary contact-bar на /ad + safety bottom-sheet + чат-хинт (SITE_BLUEPRINT волна 3) → [T17-ad-contact-bar.md](docs/todo/T17-ad-contact-bar.md)
- [ ] **T18 (LAUNCH-GATE)** 🔴 — Seed-выключатель: флаг seed-аккаунтов + исключение из агрегатов/JSON-LD/медиан на уровне запросов; сам purge — ТОЛЬКО по команде основателя перед рекламой → [T18-seed-switch.md](docs/todo/T18-seed-switch.md)

## Задачи основателя (не для агентов)
- Ключи: Turnstile (free) + `CRON_SECRET` в Vercel env (иначе кроны и алерты — no-op), Stripe recurring Price для Pro.
- Через ~неделю после 2026-07-03: посмотреть собранные отчёты `/api/csp-report` → включить CSP enforcement.
- Прогнать 1 объявление через Facebook Sharing Debugger (проверка og-картинок соцсетями).
