# PRD: Защита от угона аккаунта (ATO)

> **Статус кода:** 🟡 ЧАСТИЧНО (WebAuthn/TOTP/rate-limit есть; нет device fingerprint, гео-аномалий, отзыва сессий)
> **Категория:** Не хватает (усиление)
> **Приоритет:** P1
> **Зависит от:** [[30-identity-account]], [[35-chat-antifraud]]
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** Типовой вектор — «дай код из SMS», вход с нового устройства/гео, смена реквизитов выплат. Сейчас нет device fingerprint, гео-аномалий, ревокации сессий → угон возможен.
- **Исход.** Подозрительный вход/смена выплат требует доп-проверки; «дай свой SMS-код» структурно бесполезно; пользователь видит сессии и может их отозвать.
- **KPI:** доля заблокированных подозрительных входов; падение ATO-инцидентов; время до ревокации.

## 2. Контекст и текущее состояние (As-is)
- Есть: phone OTP, WebAuthn (`lib/webauthn.ts`, `/api/auth/webauthn/*`), TOTP (`TOTPEnrollment/Settings`), rate-limit (`lib/rateLimiter.ts`, Upstash), Turnstile/disposable-email (`lib/antifraud`).
- Нет: device fingerprinting, гео/IP-аномалии, list/revoke сессий, правила на смену выплат/нового устройства.

## 3. Пользователи и сценарии
- **Пользователь:** «Хочу видеть активные сессии и выйти везде», «получить алерт о входе с нового устройства».
- **Система:** «При смене payout-реквизитов/новом устройстве — step-up верификация».
- **Support:** «Вижу риск-сигналы по аккаунту».

## 4. UX и поведение (детально)
- **Профиль → Безопасность:** список сессий/устройств (где, когда, текущее), кнопка «Выйти» по сессии и «Выйти везде». (расширить существующий security-экран)
- **Step-up:** при рисковом действии (смена email/пароля/выплат, новое устройство, аномальное гео) — повторная верификация (WebAuthn/TOTP/OTP).
- **Алерты:** письмо/пуш «вход с нового устройства» с быстрым «это не я».
- **Анти-социнж:** баннер «LyVoX никогда не просит код подтверждения — не передавайте его».

## 5. Логика и правила
- **Device fingerprint** (через off-the-shelf fraud API — не хэндроллить): риск-скор устройства/почты/телефона.
- **Гео/IP-аномалия:** новый регион/невозможная скорость → step-up.
- **Payout-change rule:** смена реквизитов → задержка + повторная верификация + алерт.
- **`checkUserBlocked`:** на высокорисковых путях — **fail-closed** (сейчас fail-open).
- Лимиты на попытки, блок при серии аномалий.

## 6. Данные (Data model)
- `user_sessions { id, user_id, device_label, ip_region, user_agent, last_seen, created_at, revoked_at }`
- `auth_events { id, user_id, type (login|stepup|payout_change|...), risk_score, metadata, created_at }`
- RLS owner-only (+admin/support read). Retention для логов; экспорт/удаление (GDPR).

## 7. API / интеграции
- Внешний fraud/identity API (device fingerprint, email/phone enrichment).
- `GET/POST /api/auth/sessions` (list/revoke), step-up хуки в чувствительных эндпойнтах, payout-change флоу ([[10-escrow-safe-deal]]).

## 8. Безопасность, приватность, комплаенс
- Минимизация данных fingerprint; прозрачность в privacy-политике (GDPR/Бельгия APD/GBA — профайлинг).
- Аудит auth-событий; защита от перечисления аккаунтов.

## 9. Аналитика
- `login_new_device`, `stepup_triggered/passed/failed`, `session_revoked`, `payout_change_blocked`, ATO-инциденты.

## 10. Доступность и i18n
- Доступный security-экран; i18n `security.*` (NL/FR/EN).

## 11. Тестирование
- Unit: правила риска, fail-closed `checkUserBlocked`. API: list/revoke сессий, step-up. e2e: новый «девайс» → step-up; смена выплат → задержка+алерт.

## 12. План внедрения (Rollout)
- **NEXT:** device fingerprint (fraud API) + payout/new-device правила; список/ревокация сессий; fix fail-open. Усилие: M.

## 13. Открытые вопросы и решения
- Выбор fraud-API вендора. Глубина гео-правил. Задержка на payout-change.

## 14. Критерии готовности (DoD)
- [ ] Список/ревокация сессий; «выйти везде».
- [ ] Step-up на рисковые действия; payout-change под задержкой+алертом.
- [ ] `checkUserBlocked` fail-closed на high-risk.
- [ ] Аудит/приватность; тесты §11 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

### DEV
- **Ревокация сессий поверх Supabase GoTrue (ключевой нюанс):** GoTrue управляет сессиями/refresh-токенами сам. «Выйти везде» = `supabase.auth.admin.signOut(user_id, 'global')` (service-role) + пометка своей `user_sessions.revoked_at` для UI; одиночная ревокация = revoke конкретного refresh-токена. Своя `user_sessions` — зеркало; запись `revoked_at` без вызова GoTrue токен НЕ инвалидирует (косметика). Уточнить в §7.
- **Список high-risk путей (закрыть):** `payout_change`, `email_change`, `password_change`, `new_device_login`, `withdraw` — на них `checkUserBlocked(..., {failClosed:true})` (F9/S-4).
- **Step-up хук:** единый `requireStepUp(action, riskScore)` / `requireRecentAuth(maxAgeSec)` middleware; payout-change → задержка (`pending_payout_change` + apply-cron).
- **Поля:** `auth_events.ip`, `auth_events.outcome`.
- **Device fingerprint вендор (§13):** не выбран; задать, где хранится риск-скор и порог step-up.
- **Фиче-флаг** `ato_stepup_enabled`, порог `ATO_RISK_THRESHOLD`.
- **Тесты:** fail-closed `checkUserBlocked`; revoke реально инвалидирует (интеграционно с GoTrue); step-up на payout-change.

### SEC
- **F8/S-1 — серверный IP как предусловие:** вся гео-аномалия/«невозможная скорость» строится на IP; пока `getClientIp` берёт первый `x-forwarded-for` (спуфабельно) — ключевой контроль PRD недостоверен. Доверять только последнему доверенному hop (`x-vercel-forwarded-for`). Зафиксировать как предусловие.
- **Payout-change — серверный fail-closed gate (Critical):** step-up (WebAuthn/TOTP/OTP) + cooling-off + алерт «это не я»; до прохождения payout-реквизиты НЕ применяются (не UI-баннер).
- **fail-open `checkUserBlocked`** (A-3, подтверждён на `api/adverts:31`) → fail-closed на всех high-risk (S-4).
- **DPIA для device-fingerprint вендора:** внешний fraud-API получает device/email/phone enrichment → APD/GBA профайлинг; минимизация + legal basis (Art.6(1)(f) + LIA) + privacy-нотис (F4).
- **`user_sessions`/`auth_events`** — RLS owner-only (+admin read через `app_metadata`-роль), retention/GDPR-экспорт (DSAR-реестр S-9 → PRD 41).
- **Перечисление аккаунтов:** step-up/alert-флоу не раскрывают существование аккаунта.

**Вердикт:** 🔄 — механика ревокации поверх GoTrue, список high-risk, step-up хук, серверный IP (F8) как предусловие, payout fail-closed gate, DPIA вендора.
