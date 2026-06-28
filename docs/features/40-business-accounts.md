# PRD: Бизнес-аккаунты (KBO/CBE/VIES, команда, Pro-онбординг)

> **Статус кода:** 🟡 ЧАСТИЧНО (ядро есть; часть UI uncommitted; гейты regulated-категорий — roadmap)
> **Категория:** Есть (с доработками)
> **Приоритет:** P1
> **Зависит от:** [[14-consumer-trader-rights]], [[15-recupel-dac7-compliance]], [[39-monetization-billing]] (Pro), [[30-identity-account]]
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** Малым бизнесам/zelfstandigen нужна простая витрина без сложного e-commerce; маркетплейсу нужна верификация трейдеров (DSA) и бизнес-монетизация.
- **Исход.** Бизнес-аккаунт с KBO/CBE/VAT-верификацией, командой, Pro-подпиской; для regulated-категорий — доп-проверки.
- **KPI:** число верифицированных бизнесов; конверсия в Pro; доля корректно раскрытых трейдеров.

## 2. Контекст и текущее состояние (As-is)
- `businesses_core`, `seller_type_and_advert_business`, `business_onboarding_fields`, `lock_businesses_columns`; `/api/business/*` (CRUD, members, members/accept, verify), `/api/admin/business/[id]/approve`, `/api/cron/business-verify`.
- Верификация: `lib/verification/{kbo,vies,runViesVerification,nameMatch}` (KBO + VIES VAT).
- Pro: `profiles_pro_subscription`, `/pro` (BusinessCabinet, ProOnboardingWizard, TeamManager, UpgradeProButton — **uncommitted** на момент аудита).

## 3. Пользователи и сценарии
- **Владелец бизнеса:** «Создать бизнес-профиль, пройти KBO/VAT, пригласить команду, оформить Pro».
- **Член команды:** «Принять инвайт, получить роль».
- **Админ:** «Подтвердить бизнес-верификацию».

## 4. UX и поведение (детально)
- **Онбординг бизнеса:** KBO/CBE + VAT (VIES-проверка) + name-match; статусы верификации.
- **Кабинет (Pro):** витрина, команда (инвайты/роли), подписка.
- **Гейты:** regulated-категории (электроника→Recupel [[15-recupel-dac7-compliance]]); trader-раскрытие ([[14-consumer-trader-rights]]).
- Состояния: черновик/на проверке/верифицирован/отклонён; Pro активен/истёк.

## 5. Логика и правила
- KBO/CBE + VIES VAT валидация + соответствие имени; cron-перепроверка (`business-verify`).
- Роли команды и права; передача владения.
- Краевые: невалидный VAT, несоответствие имени, истёкшая верификация.

## 6. Данные (Data model)
- `businesses` (core + onboarding fields, locked columns), members, `verifications`, `profiles_pro_subscription`. Публичные данные трейдера (DSA) vs приватный compliance-data (RLS owner/admin).

## 7. API / интеграции
- `/api/business/*`, `/api/admin/business/[id]/approve`, cron `business-verify`; KBO/CBE public search + VIES (внешне).

## 8. Безопасность, приватность, комплаенс
- DSA trader-transparency (публичное раскрытие), KYBC (Art.30 — заложить, включить при потере micro-exemption). Приватные данные под RLS; аудит верификаций.

## 9. Аналитика
- Верифицированные бизнесы, конверсия Pro, доля trader-раскрытий, отказы верификации.

## 10. Доступность и i18n
- Доступные формы/кабинет; i18n `business.*`, `pro.*` (NL/FR/EN).

## 11. Тестирование
- Unit: KBO/VIES/name-match. API: business CRUD/members/verify (тесты есть). e2e: онбординг бизнеса → VAT-проверка → Pro → инвайт члена.

## 12. План внедрения (Rollout)
- **Поддержка/улучшения:** закоммитить Pro-кабинет; гейты regulated-категорий; KYBC-архитектура. Усилие: M.

## 13. Открытые вопросы и решения
- Набор ролей команды. Когда включать KYBC. Политика перепроверки верификации.

## 14. Критерии готовности (DoD)
- [ ] Бизнес-онбординг с KBO/VIES + name-match + статусы.
- [ ] Команда (инвайты/роли), Pro-подписка.
- [ ] Гейты regulated-категорий + DSA-раскрытие.
- [ ] Тесты §11 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

### LEGAL (фундамент F5 — DSA Art.30 / P2B)
- **DSA Art.30 KYBC — НЕ откладывать «до потери micro-exemption» (исправить §8).** Если платформа позволяет заключение дистанционных договоров (escrow/in-chat payment), Art.30 traceability применяется к traders **сразу**. Собрать **и верифицировать** обязательные поля Art.30(1) (имя, адрес, телефон, email, ID/идентификация, платёжные реквизиты, KBO/CBE + self-certification) при escrow-enablement; публичное раскрытие — строго по Art.30(7).
- **Authority-to-represent:** VIES подтверждает только действительность VAT-номера и (иногда) имя, НЕ что онбордящийся уполномочен от имени компании. Связать бизнес-онбординг с itsme-verified личностью владельца + проверка мандата по KBO publication (директора/мандатарии) — защита от регистрации чужого KBO самозванцем.
- **P2B Reg. 2019/1150:** отдельные T&C для бизнес-аккаунтов (ranking-параметры, причины suspension, **30-дн. notice при termination**, redress, ODR/mediation для B2B); при необходимости DPA для team/CRM-функций. «Передача владения» — с этими гарантиями (краевой: последний owner).
- **Минимизация (GDPR):** публичные поля = ровно Art.30(7); остальной compliance-data — приватно под RLS.

### DEV (фундамент F5)
- **Роли команды (закрыть §13):** матрица owner/admin/member + права (publish/billing/members) и RLS — без неё RLS членов не написать.
- **Поведение verification при external-down:** VIES часто падает → external down = статус `pending` + retry, **не `rejected`**.
- **Явный список публичных trader-полей (DSA Art.30(7)) vs приватных** + разделение колонок/RLS (lock на businesses уже есть).
- Тесты: VIES down → pending; роль member не может биллинг; name-match отказ.

**Вердикт:** 🔄 Доработать — верификационное ядро (KBO/VIES/name-match) сильное; правки: не откладывать Art.30, authority-to-represent, P2B business-terms/suspension, роли команды, поведение при VIES down. После правок → ✅.
