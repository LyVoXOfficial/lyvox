# T12 — Saved-search алерты end-to-end + email + PWA/push

**Модель:** 🟡 средняя (gpt high / sonnet-класс). Многослойно, но большинство кусков уже есть.
**Ветка:** `feat/saved-search-alerts` · **Приоритет:** P1 (retention-контур) · **Оценка:** 1 день. Делить на коммиты по слоям.

## Что УЖЕ есть (не переписывать, довести)
- API: `apps/web/src/app/api/saved-searches/route.ts` (+ `[id]/route.ts`), тесты рядом.
- Cron: `apps/web/src/app/api/cron/saved-search-alerts/route.ts` — уже находит новые совпадения и пишет **in-app** `notifications` (Bearer CRON_SECRET, fail-closed). Запланирован в `vercel.json`.
- UI: `apps/web/src/components/saved/SavedSearchesClient.tsx`, `SaveSearchButton.tsx`, страница `apps/web/src/app/saved/page.tsx`.
- Email-инфраструктура: `apps/web/src/lib/email/sender.ts` (изучи — как отправляет, какой провайдер/env).
- PWA: `apps/web/src/app/manifest.ts` есть. Service worker (`public/sw.js`) — НЕТ.
- Настройки уведомлений: `apps/web/src/app/api/notifications/preferences/route.ts`.

## Скоуп (что доделать)
1. **Частота + отписка в UI** (`SavedSearchesClient.tsx` + `SaveSearchButton.tsx`): на каждый сохранённый поиск — переключатель «Уведомлять: сразу / раз в день / выкл» и явная кнопка удаления/отписки в один клик (симметрия действий — DSA Art.25). Хранить частоту в `saved_searches` (проверь схему в `database.types.ts`; если поля нет — миграция idempotent `alter table ... add column if not exists alert_frequency text check (...) default 'daily'`). i18n-ключи `saved.alert_*` в 5 локалей.
2. **Email-канал в cron**: после успешной вставки in-app `notification` — если у владельца включён email-канал (проверь `notification_preferences`) и `alert_frequency != 'off'`, отправить письмо через `lib/email/sender.ts`. Письмо: нейтральный текст (заголовок объявления + ссылка `/ad/<id>`, БЕЗ trust-заявлений — F3), 5 локалей по `content_locale`/профилю, ссылка «отписаться» ведёт на `/saved`. **BLOCKED-развилка:** если `sender.ts` требует провайдер-ключ (env), которого нет — email-путь оставить за проверкой `if (emailProviderConfigured())`, при отсутствии ключа тихо пропустить (как Turnstile-паттерн), НЕ падать. Отметить в отчёте, какой env основатель должен задать.
3. **Push — ТОЛЬКО каркас за флагом** (VAPID-ключей нет → это founder-gated): capability-флаг `CAPABILITY_WEB_PUSH` (default OFF) + `public/sw.js` (минимальный: push + notificationclick→ссылка) + регистрация SW только при флаге ON и `Notification.permission`. Реальную отправку push НЕ реализовывать глубже заглушки за флагом. Если сомневаешься в объёме — сделай только флаг+SW-каркас и отметь push как отдельный будущий слой.

## Проверка
- Focused-тесты cron и saved-searches route зелёные; полный сьют в хуке.
- Локально: сохранить поиск → в `/saved` виден переключатель частоты; отписка убирает подписку.
- Коммиты по слоям, merge --no-ff, push. Прод: `/saved` 200.

## Красные линии
- Письма/уведомления — нейтральный текст, никаких «безопасная оплата/гарантия» (F3). Отписка не сложнее подписки. i18n сразу 5 локалей. Cron остаётся fail-closed без CRON_SECRET.
