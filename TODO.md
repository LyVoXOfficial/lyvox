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

## Очередь

- [ ] **T01** — Dwell-бакетирование в свайп-аналитике (P0-приватность, ~30 мин) → [docs/todo/T01-dwell-buckets.md](docs/todo/T01-dwell-buckets.md)
- [ ] **T02** — URL-allowlist в чат-скраббере (P1, ~1 час) → [docs/todo/T02-scrub-url-allowlist.md](docs/todo/T02-scrub-url-allowlist.md)
- [ ] **T03** — Аудит категорий и вертикальный контракт — ДОКУМЕНТ, не код (P0-фундамент, ~3 часа) → [docs/todo/T03-category-audit.md](docs/todo/T03-category-audit.md)
- [ ] **T04** — TrustSignalPolicy: единый конфиг trust-сигналов (P1, ~2 часа) → [docs/todo/T04-trust-signal-policy.md](docs/todo/T04-trust-signal-policy.md)
- [ ] **T05** — Строгий радиус в /search + секция «вне радиуса» (P1, ~3 часа) → [docs/todo/T05-strict-radius.md](docs/todo/T05-strict-radius.md)
- [ ] **T06** — Внутренний прайс-оценщик median/IQR (P1, ~4 часа, БЕЗ публичного UI) → [docs/todo/T06-price-estimator-internal.md](docs/todo/T06-price-estimator-internal.md)
- [ ] **T07** — ChatOffer: структурированные предложения цены + пороги продавца (P1, ~1 день) → [docs/todo/T07-chat-offers.md](docs/todo/T07-chat-offers.md)
- [ ] **T08** — fast_goods: /post за ≤4 шага для простых товаров (P1-конверсия, ~1-2 дня, СЛОЖНОЕ) → [docs/todo/T08-post-fast-goods.md](docs/todo/T08-post-fast-goods.md)
- [ ] **T09** — Переводы объявлений: миграция + async-джоб + лейблы (P1, ~2 дня, СЛОЖНОЕ) → [docs/todo/T09-advert-translations.md](docs/todo/T09-advert-translations.md)
- [ ] **T10** — Store-of-One: сессионная персонализация фида, client-only MVP (P2, потом) → [docs/todo/T10-session-personalization.md](docs/todo/T10-session-personalization.md)

## Крупные волны после T01-T10 (инструкция-файл создаётся сильной моделью при взятии в работу)

- [ ] **T11** — Конвейер изображений: превью 400px WebP при аплоаде + стабильные кэшируемые URL вместо пере-подписи на каждый рендер (крупнейший perf-выигрыш всего продукта; см. SITE_BLUEPRINT «конвейер изображений ДО редизайнов» + память media-image-pipeline)
- [ ] **T12** — Saved-search алерты end-to-end + push/PWA (PRD 34/36/18): retention-контур; cron `saved-search-alerts` уже существует и ждёт CRON_SECRET — довести UI подписок и email-канал
- [ ] **T13** — UX1: редизайн-фиксы страниц по мокапам (`docs/features/audit/01` + `mockups/redesign-mockups.html`)
- [ ] **T14** — Системный проход empty-states + /search полировка (skeleton, verified-чип с предпросмотром счётчика, zero-result авторасширение) — SITE_BLUEPRINT волна 4
- [ ] **T15** — URL-локали `/nl /fr /de /en /ru` + hreflang (МИГРАЦИЯ, сильная модель + план: сейчас Google индексирует один язык из пяти; чем позже — тем дороже)
- [ ] **T16** — Контент-хаб `/guides`: 10-15 анти-скам гайдов nl/fr (SEO-канал GTM Фазы 1; БЕЗ имён конкурентов — CEL VI.17)
- [ ] **T17** — Волна 3 остаток: sticky one-primary contact-bar на /ad + safety bottom-sheet + чат-хинт (SITE_BLUEPRINT волна 3)
- [ ] **T18 (LAUNCH-GATE)** — Seed-выключатель: флаг seed-аккаунтов + исключение из агрегатов/JSON-LD/медиан на уровне запросов; сам purge — ТОЛЬКО по команде основателя перед рекламой

## Задачи основателя (не для агентов)
- Ключи: Turnstile (free) + `CRON_SECRET` в Vercel env (иначе кроны и алерты — no-op), Stripe recurring Price для Pro.
- Через ~неделю после 2026-07-03: посмотреть собранные отчёты `/api/csp-report` → включить CSP enforcement.
- Прогнать 1 объявление через Facebook Sharing Debugger (проверка og-картинок соцсетями).
