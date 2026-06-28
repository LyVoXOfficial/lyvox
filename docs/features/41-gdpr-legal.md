# PRD: Комплаенс-флоу (GDPR export/delete/consent, юр-страницы, cookies)

> **Статус кода:** 🟡 ЧАСТИЧНО (механики export/delete/consent/cookies есть, но **отсутствуют обязательные GDPR-артефакты: RoPA/DPIA/реестр DPA/transfers/retention-таблица — F4**; статус «✅ ГОТОВО» отозван по итогам legal-ревью)
> **Категория:** Есть (с доработками)
> **Приоритет:** P0
> **Зависит от:** [[35-chat-antifraud]] (chat-retention/DSAR), [[14-consumer-trader-rights]], [[38-moderation-reports]] (DSA)
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** GDPR/ePrivacy/DSA обязательны; без них — юр-риск и подрыв доверия. Новый бренд может сделать это «идеально с нуля».
- **Исход.** Экспорт/удаление/анонимизация данных, consent-история, юр-страницы (terms/privacy/cookies/imprint), cookie-consent, retention-расписание.
- **KPI:** время обработки DSAR; полнота экспорта/удаления; ноль нарушений по аудиту.

## 2. Контекст и текущее состояние (As-is)
- `/api/account/{delete,export}` (+тесты), `erasure` миграция, `lib/account`, `lib/consents`, consent-UI в профиле; `/api/profile/consents`.
- Юр-страницы: `/legal/{terms,privacy,cookies,imprint}`, `components/legal`, `legal-footer`; cookie-consent (`lib/cookieConsent`, `components/cookie`).
- Retention/cleanup: Edge Function `maintenance-cleanup` (OTP/логи).
- Roadmap: DSAR-экспорт чата, retention/TTL чата ([[35-chat-antifraud]]).

## 3. Пользователи и сценарии
- «Скачать мои данные»; «удалить аккаунт»; «управлять согласиями (маркетинг)»; «прочитать правила/политику».

## 4. UX и поведение (детально)
- **Экспорт:** запрос → файл со всеми персональными данными (включая, в перспективе, чат/сделки).
- **Удаление:** подтверждение → анонимизация/удаление (cascade), сохранение того, что обязаны по закону.
- **Consent:** тоглы (terms/privacy обязательны, marketing opt-in), история согласий.
- **Cookies:** баннер, категории (necessary/functional/analytics/marketing), запись выбора (taste/функционал уважают `functional`).
- Состояния: запрос принят/в обработке/готово.

## 5. Логика и правила
- **Retention-расписание:** OTP/логи/чат — TTL и очистка (cron).
- Экспорт/удаление охватывают все персональные сущности (профиль, объявления, чат, сделки, префы, push-подписки, compliance-доки).
- Краевые: удаление при активных сделках/спорах (блокировать до завершения), юр-обязательное хранение.

## 6. Данные (Data model)
- `consents`-история, `account_flags`, erasure-логика, cookie-consent store. Все owner-данные — RLS owner-only; аудит DSAR-операций.

## 7. API / интеграции
- `/api/account/{export,delete}`, `/api/profile/consents`, `maintenance-cleanup` cron. Связь с чат/сделки для полноты DSAR.

## 8. Безопасность, приватность, комплаенс
- **GDPR (export/delete/anonymise, retention, DSAR), ePrivacy (cookies/consent), DSA (apeal/трейдер — смежно).** APD/GBA (Бельгия) для профайлинга ([[16-account-takeover-protection]]).
- **B4 (2026-06-29):** `advert_views.ip_address` анонимизировано в проде через миграцию `20260629210000` — IPv4 → /24, IPv6 → /48; новые строки пишут `NULL`. Rate-limit и дедуп используют `viewer_key` (md5-хэш) и IP из runtime-запроса — не из БД. Адресует F4 retention: сырые IP посетителей больше не хранятся.

## 9. Аналитика
- Число/время DSAR, отписки, cookie-consent распределение.

## 10. Доступность и i18n
- Доступные юр-страницы/баннеры; i18n юр-текстов NL/FR/EN (качество — приоритет), per-locale ссылки.

## 11. Тестирование
- API: export/delete (тесты есть). Unit: consent/retention. e2e: экспорт → файл; удаление → анонимизация; cookie-consent сохраняется.

## 12. План внедрения (Rollout)
- **Поддержка/улучшения:** DSAR-экспорт чата/сделок; retention/TTL чата; полнота экспорта по новым сущностям (push/сделки/compliance). Усилие: S–M.

## 13. Открытые вопросы и решения
- Точные TTL по типам данных. Что хранить юр-обязательно при удалении. Полнота DSAR по сделкам.

## 14. Критерии готовности (DoD)
- [ ] Экспорт/удаление/анонимизация охватывают все персональные сущности.
- [ ] Consent-история + cookie-consent + retention-cron.
- [ ] Юр-страницы локализованы; аудит DSAR.
- [ ] Тесты §11 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

> **Статус «✅ ГОТОВО» отозван → 🟡.** Механики (export/delete/consent/cookies) есть, но отсутствуют фундаментальные GDPR-артефакты (F4). Это не «доработки» — это обязательная база; без неё нельзя утверждать GDPR-готовность.

### LEGAL (фундамент F4 — GDPR/ePrivacy)
- **RoPA (Art.30) — ОТСУТСТВУЕТ.** Создать обязательный реестр обработок: цель → категории данных → субъекты → получатели → transfers → retention → правовое основание.
- **DPIA (Art.35) — провести и приложить:** профайлинг (trust/fraud), large-scale, sensitive (KYC/AML/itsme), систематический мониторинг (чат-скрабинг/модерация) → почти наверняка обязательна (BE GBA DPIA-list).
- **DPO — назначить или письменно обосновать отсутствие** (Art.37); опубликовать контакт.
- **Реестр Art.28 DPA со всеми процессорами:** Stripe, itsme, Supabase, Bpost, Cloudflare/Turnstile, Sentry (scrubbing!), email-provider, hosting.
- **International transfers (Ch.V):** инвентаризация процессоров + SCCs/DPF + TIA (Schrems II) для US/третьих стран (Supabase/Stripe/hosting — где?).
- **Cookie-banner (GBA Cookie Guidelines 2023):** reject-all так же легко, как accept-all (симметрия кнопок); no pre-ticked boxes (Planet49 C-673/17); consent ДО загрузки non-necessary скриптов; гранулярность + лёгкий отзыв; consent-record (timestamp/версия); срок переспроса ≤ ~6–13 мес.
- **Privacy Policy — полное содержание Art.13/14:** контроллер + контакты + DPO, цели + правовые основания по каждой, получатели, transfers, retention по категориям, права субъекта, **право жалобы в GBA/APD**, наличие профайлинга.
- **Retention-таблица с числами и обоснованием:** OTP (минуты), security logs (6–12 мес.), chat (12–24 мес. или до удаления + grace), **сделки/инвойсы 7 лет (BE bookkeeping/CIR92)**, **KYC/AML 10 лет (Loi 18.09.2017)**, consent-records (срок + 3 года). Финансы/AML **переопределяют GDPR-erasure** — записать явно.
- **DSAR (Art.12):** ответ ≤ 1 месяц (+2 для сложных), identity-check, бесплатно; ручной чат/сделки-экспорт до автоматизации.
- **Imprint (Art. XII CDE):** проверить полноту (legal name, KBO/BCE, VAT, адрес, email, supervisory authority = BIPT для DSA).

### SEC (фундамент F4 — S-9)
- **DSAR-реестр сущностей (acceptance-критерий для каждой новой PII-таблицы):** export+delete обязаны охватывать `deals, disputes, messages, payment_requests, referrals, media_hashes, user_sessions, auth_events, analytics_events, taste_signals, trust_score_components`. Неполный DSAR = нарушение GDPR.
- **Cookie-gating скриптов** по категориям до consent (ePrivacy): analytics/marketing/Stripe не грузить до согласия.
- **Export/delete за re-auth/step-up** (иначе при ATO угонщик выкачивает/удаляет данные — связь с [[16-account-takeover-protection]]).
- **Erasure vs юр-хранение:** финансы → анонимизация по сроку (7л/10л), не удаление; иммутабельный аудит DSAR-операций.

**Вердикт:** 🔄 Доработать (статус «готово» отозван) — sign-off невозможен, пока не закрыты RoPA, DPIA, DPA-реестр, transfer-mechanisms, retention-таблица с числами, полная Privacy Policy, cookie-symmetry, DPO и DSAR-реестр по новым сущностям.
