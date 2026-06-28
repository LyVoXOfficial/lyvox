# PRD: PWA + push-уведомления

> **Статус кода:** ⛔ НЕ НАЧАТО (нет manifest/service worker/push; дизайн mobile-first есть)
> **Категория:** Не хватает (рост/ретеншен)
> **Приоритет:** P1
> **Зависит от:** [[36-notifications]] (каналы/события), [[01-discover-swipe-system]] (мобильный UX)
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** Для соло-команды одно PWA лучше двух нативных приложений. Сейчас нет manifest/service worker/push — нет «иконки на экране», офлайна и пушей; ретеншен страдает.
- **Исход.** Устанавливаемое PWA с пушами; ретеншен подкреплён пушами (где доступны) + email/SMS как фоллбэк (особенно iOS).
- **KPI:** установки PWA; opt-in на пуш; CTR пушей; D7/D30 ретеншен установивших.

## 2. Контекст и текущее состояние (As-is)
- Mobile-first дизайн-система, bottom-nav есть; `generateMetadata` ставит icons/OG; **viewport уже корректен** (в `app/layout.tsx` есть `export const viewport: Viewport` с `width=device-width, viewportFit:'cover', themeColor` — подтверждено DEV-ревью, фикс НЕ нужен); нет PWA-инфраструктуры; уведомления — только in-app/email ([[36-notifications]]).

## 3. Пользователи и сценарии
- **Пользователь:** «Добавить на главный экран; получать пуш о новых по сохранённому поиску/сообщениях».
- **iOS-пользователь:** «Пуш работает только после Add-to-Home-Screen» → подстраховка email/SMS.

## 4. UX и поведение (детально)
- **Установка:** install-prompt (Android/desktop), инструкция Add-to-Home-Screen для iOS.
- **Разрешение на пуш:** запрашивать **контекстно** (после ценного действия, напр. создания сохранённого поиска), не на входе.
- **Пуши:** новое по сохранённому поиску ([[34-discovery-extras]]), новое сообщение в чате, статусы сделки/доставки, споры.
- **Офлайн:** базовый офлайн-шелл (просмотр кэша, грациозная деградация).
- **iOS-оговорка:** низкие install-rate → не полагаться только на пуш; дублировать email/SMS (OTP-инфра есть).

## 5. Логика и правила
- Service worker: кэш-стратегии (app shell + runtime), обновление версии.
- Push: VAPID/web-push; подписки на устройство; дедуп с in-app/email ([[36-notifications]] — event→channel матрица), quiet hours, отписка/consent.
- Не дублировать пуш+email на одно событие без необходимости.

## 6. Данные (Data model)
- `push_subscriptions { id, user_id, endpoint, keys, device_label, created_at }` (RLS owner-only).
- Привязка к notification preferences ([[36-notifications]]). Retention протухших подписок (cron-очистка).

## 7. API / интеграции
- `POST /api/push/subscribe` / `DELETE /api/push/subscribe`, отправка через web-push (Edge/cron).
- `manifest.webmanifest`, `service-worker.js` (viewport уже задан в `layout.tsx` — фикс не требуется).

## 8. Безопасность, приватность, комплаенс
- Consent на пуш (GDPR/ePrivacy); легко отписаться; не слать маркетинг без opt-in.
- Подписки — owner-only; протухшие чистим.

## 9. Аналитика
- `pwa_install_prompt/installed`, `push_permission_granted/denied`, `push_sent/delivered/clicked`, ретеншен.

## 10. Доступность и i18n
- Установочные подсказки доступны; i18n `pwa.*`, `push.*` (NL/FR/EN); локализованные тексты пушей.

## 11. Тестирование
- Unit: дедуп каналов, quiet hours. e2e: установка PWA (Android/desktop), подписка/пуш (web-push test), офлайн-шелл. iOS — ручной чек Add-to-Home-Screen.

## 12. План внедрения (Rollout)
- **NEXT:** viewport-фикс → manifest + service worker → web-push → подписки + дедуп с email/SMS. Усилие: M.

## 13. Открытые вопросы и решения
- Какие события пушим по умолчанию. Политика quiet hours. iOS-фоллбэк: email vs SMS по типам событий.

## 14. Критерии готовности (DoD)
- [ ] PWA устанавливается; viewport/manifest/SW на месте; базовый офлайн-шелл.
- [ ] Контекстный запрос пуша; пуши по ключевым событиям с дедупом и quiet hours.
- [ ] iOS подстрахован email/SMS; consent/отписка; retention подписок.
- [ ] Тесты §11 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

### DEV
- **Фактическая неточность исправлена:** viewport в коде уже корректен (`app/layout.tsx`, `export const viewport: Viewport`) — пункт «viewport-фикс one-liner» из §7/§12 убран, чтобы не путать инженера.
- **SW-стек выбрать (влияет на оценку):** в Next.js 16 App Router `next-pwa` устаревает/несовместим. Рекомендация — `@serwist/next` (ручной SW + `next.config` headers как альтернатива). Зафиксировать инструмент и кэш-стратегии (app shell + runtime).
- **VAPID-ключи:** хранить в env (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — приватный server-only); описать ротацию.
- **`push_subscriptions`** — ок; добавить cron-очистку по 410/404 от push-сервиса (протухшие endpoint'ы).
- **iOS web-push:** только PWA-installed + iOS 16.4+; email/SMS fallback — учтено, хорошо.
- **Жёсткая зависимость от PRD 36:** дедуп push+email строится на event→channel матрице (enum событий + `dedup_key` + TZ для quiet hours). Нельзя строить push до реализации матрицы из 36 (F6 — единый sink/каналы).

**Вердикт:** 🔄 — выбрать SW-стек (`@serwist/next`), убрать неверный viewport-пункт (сделано), VAPID env+ротация, cron-очистка подписок, жёсткая зависимость от матрицы каналов PRD 36.
