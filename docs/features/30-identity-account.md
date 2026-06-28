# PRD: Идентичность и аккаунт

> **Статус кода:** 🟡 ЧАСТИЧНО (auth силён; itsme закодирован но не прод-тестирован; document-KYC нет)
> **Категория:** Есть (с доработками)
> **Приоритет:** P0
> **Зависит от:** [[16-account-takeover-protection]], [[37-trust-reviews]], [[14-consumer-trader-rights]]
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** Доверие начинается с идентичности. Нужен лёгкий вход (рост) и крепкая верификация (доверие/анти-фрод), без жёсткого ID для всех (это убивает конверсию онбординга).
- **Исход.** Многоуровневая идентичность: email/phone → опционально itsme (verified-tier). Уникальность по itsme `sub`. Trust-сигналы привязаны к уровню верификации.
- **KPI:** конверсия регистрации; доля verified (itsme); доля throwaway-аккаунтов в low-trust лейне.

## 2. Контекст и текущее состояние (As-is)
- Email/password + magic link; онбординг (`app/onboarding`, `app/register`) с consent-capture.
- Phone OTP (`/api/phone/*`, rate-limit).
- WebAuthn/passkeys (`lib/webauthn.ts`, `/api/auth/webauthn/*`, `BiometricEnroll/Login/Settings`).
- TOTP 2FA (`TOTPEnrollment/Settings`).
- itsme OAuth — закодирован (`itsme_fields` миграция), **не прод-тестирован**; `sub`-uniqueness не enforced.
- KYC/verifications/badges (`verifications`, `kyc_records`, `badges_awarded`).
- Анти-фрод регистрации: disposable email + Turnstile (`lib/antifraud`).
- Account flags, удаление/экспорт ([[41-gdpr-legal]]).

## 3. Пользователи и сценарии
- **Гость → Registered:** быстрый вход email/magic link.
- **Registered → Verified:** phone + опц. itsme → бейдж «Verified», доступ к высокому доверию (escrow high-value, faster payout).
- **Business:** KBO/CBE/VAT ([[40-business-accounts]]).

## 4. UX и поведение (детально)
- **Онбординг:** минимальные шаги, consent (terms/privacy/marketing-optional), выбор локали (сохраняется).
- **Верификация — optional-then-stepped-up:** не форсить hard-ID всем; гейтить высокодоверенные действия за itsme.
- **Профиль → Безопасность:** passkeys, TOTP, сессии ([[16-account-takeover-protection]]).
- **itsme:** «Verified with itsme» в секунды; публично «LyVoX никогда не хранит скан вашего ID».
- Состояния: unverified / phone-verified / itsme-verified / business-verified.

## 5. Логика и правила
- **itsme:** принимать verified attributes по OIDC (имя, адрес, `age_gte_18`), **не** хранить скан ID (GDPR-clean, избегаем Art.9). **Хранить `sub` и хард-реджектить второй аккаунт при коллизии `sub`** (уникальность — в коде, не «бесплатно»).
- **Tiering:** unverified — низкий trust/лимиты; verified — высокие сигналы. «Structurally can't re-register» — только для verified-tier (не оверселлить).
- Age-gate только для возрастных категорий (через `age_gte_18`), не всей платформы.

## 6. Данные (Data model)
- `profiles` (+ consents, locale, verified flags), `phones`/`phone_otps`, `verifications`, `kyc_records`, `badges_awarded`, `account_flags`, itsme-поля (`sub`).
- RLS owner-only на чувствительное; service-role server-only. Retention OTP/логов; экспорт/удаление ([[41-gdpr-legal]]).

## 7. API / интеграции
- `/api/auth/*` (register/check-email/signout/webauthn), `/api/phone/*`, itsme OIDC callback, `/api/me`.
- itsme как identity-rail; eIDAS/EUDI-Wallet fallback для не-бельгийцев (roadmap).

## 8. Безопасность, приватность, комплаенс
- «Verify, don't warehouse» (itsme attributes, не сканы). GDPR consent-история. Профайлинг/риск → privacy-нотис.
- Уникальность `sub`; throwaway-аккаунты — low-trust лейн.

## 9. Аналитика
- Воронка регистрации/верификации; доля verified; `sub`-коллизии; использование passkey/TOTP.

## 10. Доступность и i18n
- Доступные формы; i18n `auth.*`, `onboarding.*` (NL/FR/EN; RU-локаль починена — проверить маппинг `ru`).

## 11. Тестирование
- Unit: consent, locale, `sub`-uniqueness. API: register/onboarding redirects (тесты есть), phone OTP, webauthn. e2e: регистрация → верификация телефона → itsme (stub).

## 12. План внедрения (Rollout)
- **NOW-1:** довести itsme до прод-теста + enforce `sub`-uniqueness; tiering trust. Усилие: M.

## 13. Открытые вопросы и решения
- Какие действия гейтить за itsme. EUDI-fallback для не-BE. Политика хранения KYC-доков.

## 14. Критерии готовности (DoD)
- [ ] itsme работает в проде; `sub`-коллизия хард-реджектится.
- [ ] Tiering: verified vs unverified лейны.
- [ ] Сканы ID не хранятся; consent/retention/экспорт.
- [ ] Тесты §11 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

### SEC (фундаменты F10, F8; S-12)
- **Колонка `itsme_sub` физически отсутствует** в схеме (`20251110000000_itsme_fields.sql` содержит только `itsme_verified` + `itsme_kyc_level`). DoD «хард-реджект коллизии `sub`» нереализуем как есть. **Требование (F10):** добавить в §6 `profiles.itsme_sub text` + `UNIQUE` индекс ИЛИ отдельную `identity_links(provider, sub, user_id, claims jsonb, unique(provider, sub))`; серверная коллизия-проверка при OIDC-callback → хард-реджект (обработка `23505` → 409).
- **OIDC-hardening (S-12):** в §8 явно зафиксировать валидацию `state` (CSRF), `nonce` (replay id-token), подписи id-token, точного `redirect_uri`. id-token не доверять без проверки.
- **Account-linking ATO:** привязка itsme к существующему аккаунту — только после step-up владельца; запрет силового re-link.
- **Art.9 как hard-requirement:** хранить только атрибуты (`sub`, name, `age_gte_18`), не raw KYC-документы (явно в DoD).

### DEV (фундамент F10)
- `sub`-uniqueness enforce на уровне БД (constraint), не только в коде — иначе гонка двух коллбэков. Это центральная фича PRD.
- **Источник tier:** ввести `profiles.verification_tier` (enum) + правило вычисления; гейты (escrow high-value, payout speed) читают единый источник (связь с [[37-trust-reviews]]).
- Закрыть открытый вопрос §13: список действий, гейтящихся за itsme = high-value escrow + payout-change. Зафиксировать в §5.
- Тесты: вторая регистрация с тем же `sub` → 409 (constraint); tier-переходы.

### LEGAL (фундамент F4)
- **Правовые основания по каждой цели** verified-атрибутов: trust-tier / age-gate / fraud-dedup — указать Art.6(1)(b)/(c)/(f). Для `sub`-dedup — legitimate interest + LIA + retention хэша `sub` после удаления аккаунта (анти-multi-account) с записью в Privacy Policy.
- **KYC-retention:** AML 10 лет (BE Loi 18.09.2017 Art.60-62), явно «не подлежит GDPR-erasure до истечения срока»; при document-KYC через Stripe — разнести controller/processor-роли.
- **itsme governance:** зафиксировать partner-contract, разрешённый набор attributes (минимизация), controller/processor-роль, DPA (F4).
- **Biometrics-clause:** passkeys/WebAuthn биометрию на сервере не хранят → не Art.9 (зафиксировать явно, снять вопрос).
- **Age-gate для regulated-категорий** (алкоголь/ножи/adult) — только verified age (itsme `age_gte_18`), не self-declaration чекбокс.
- **Profiling/Art.22:** нотис о tiering; право на человеческий пересмотр, если tier блокирует значимое действие (escrow high-value).

### DATA (фундамент F14)
- **Портативность репутации** должна привязываться к verified-identity `sub`, а не к `user_id` (см. [[37-trust-reviews]], `identity_reputation(identity_sub)`); пере-регистрация с тем же itsme не сбрасывает репутацию. Каскад при удалении аккаунта определить (анонимизация vs удаление).

**Вердикт:** 🔄 Доработать — после `itsme_sub`+unique (F10), OIDC-hardening, правовых оснований/retention/DPA и источника tier — sign-off реалистичен.
