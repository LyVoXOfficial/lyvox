# PRD: Модерация и жалобы (AI-moderation, fraud-rules, очереди)

> **Статус кода:** 🟡 ЧАСТИЧНО (скелет есть; fraud-engine не подключён в рантайм-флоу; chat-модерация — нет)
> **Категория:** Есть (с доработками)
> **Приоритет:** P0
> **Зависит от:** [[17-image-verification]], [[35-chat-antifraud]], [[31-listing-creation]] (премодерация), [[11-disputes]]
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** Маркетплейс обязан убирать нелегальный/опасный контент и фрод (DSA/GPSR). Сейчас «скелет есть, но проводка не подключена».
- **Исход.** AI-премодерация + rule-based fraud-scoring + ручная очередь + жалобы пользователей + аудит + апелляции; fraud-engine реально вызывается в рантайме.
- **KPI:** время до takedown; доля авто-отловленного фрода; доля апелляций; повторные нарушители.

## 2. Контекст и текущее состояние (As-is)
- AI-moderation Edge Function (`ai-moderation`) скорит объявления; fraud-rules (`fraud_rules`, 8 правил) — **не вызываются из web-app** (нет call-site в `apps/web/src`).
- `checkUserBlocked` (`lib/fraud/checkUserBlocked.ts`) — единственный подключённый контроль, **fail-open** при ошибке чтения профиля.
- Жалобы: `reports` (5 причин, rate-limit), `/api/reports/*`, `/api/moderation/{analyze,queue,review}`, `admin/moderation`, `admin/reports`.
- Нет: chat-level модерации, image-верификации, привязки fraud-rules к флоу листинга/checkout.

## 3. Пользователи и сценарии
- **Пользователь:** «Пожаловаться на объявление/сообщение».
- **Модератор:** «Видеть очередь с AI/fraud-сигналами, approve/reject/hide/flag».
- **Админ:** «Управлять fraud-rules, видеть аудит».

## 4. UX и поведение (детально)
- **Жалоба:** кнопка на объявлении/сообщении ([[35-chat-antifraud]]); 5+ причин.
- **Очередь модерации:** AI-скор + fraud-сигналы + жалобы; действия approve/reject/hide/flag; обоснование (statement of reasons — DSA Art.16).
- **Апелляция:** путь обжалования отклонения (DSA Art.20 — человеческий разбор).
- Состояния листинга: на модерации/опубликовано/скрыто/отклонено/на апелляции.

## 5. Логика и правила
- **Премодерация:** AI на title/description/media-метаданные + **вызов fraud-detection на создание объявления** (подключить!) рядом с `checkUserBlocked`.
- **`checkUserBlocked` → fail-closed** на высокорисковых путях.
- Price-anomaly/velocity (seeded rules) — подключить в листинг-флоу.
- Repeat-infringer policy (DSA Art.23); GPSR-нотисы об опасных товарах — обработка за 3 дня.
- Краевые: ложные срабатывания, массовые жалобы (брейгад), апелляции.

## 6. Данные (Data model)
- `reports`, `fraud_rules`, `account_flags`, `moderation_logs`/audit; (roadmap) `message_risk_flags`, `media_flags` ([[17-image-verification]]). RLS: модерация/админ; аудит действий.

## 7. API / интеграции
- `/api/reports/{create,list,update}`, `/api/moderation/{analyze,queue,review}`, Edge Functions `ai-moderation`/`fraud-detection` (вызывать из web-app), GPSR e-surveillance (внешне, roadmap).

## 8. Безопасность, приватность, комплаенс
- **DSA Art.16 (notice-and-action + statement of reasons), Art.20 (апелляции), Art.23 (повторные нарушители); GPSR (3-дневная обработка).** Аудит всех решений модераторов/админов.

## 9. Аналитика
- Время до takedown, авто-отлов %, апелляции/исходы, повторные нарушители, ложные срабатывания.

## 10. Доступность и i18n
- Доступная очередь/кнопки; i18n `moderation.*`, `report.*` (NL/FR/EN).

## 11. Тестирование
- Unit: fraud-rules, fail-closed checkUserBlocked. API: reports, moderation review + роли. e2e: жалоба → очередь → решение → апелляция.

## 12. План внедрения (Rollout)
- **NEXT:** подключить fraud-engine + AI в рантайм листинга/checkout; fix fail-open; chat-level модерация; затем image-верификация. Усилие: M.

## 13. Открытые вопросы и решения
- Пороги авто-действий vs ручной разбор. SLA takedown. Кто разбирает апелляции при росте.

## 14. Критерии готовности (DoD)
- [ ] Fraud-engine + AI вызываются в рантайме; checkUserBlocked fail-closed на high-risk.
- [ ] Жалобы/очередь/решения с обоснованием и апелляцией (DSA).
- [ ] Аудит-лог; GPSR-нотисы в срок.
- [ ] Тесты §11 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

### DEV / SEC (фундаменты F9, F8, S-4, S-6)
- **fraud-engine не подключён в рантайм (F9, подтверждено: 0 call-sites `fraud-detection`).** `fraud_rules` (8 правил) и Edge Function мертвы. **Hard-requirement DoD (не «подключить!»):** явный call-site в `POST /api/adverts` (create) и publish (+ checkout/create-deal), записать `account_flags`/score, гейтить публикацию; async-вариант (очередь) допустим, но статус листинга `pending` до результата.
- **`checkUserBlocked` fail-open на create-advert (A-3, S-4):** привести к `failClosed:true` на всех high-risk write-путях; перечислить пути явно в PRD (create-advert, create-deal, pay, payout, publish, moderation-mutate).
- **Роль модератора/support — только из `app_metadata` (S-6, анти-эскалация):** нет роли отдельной от admin — ввести `is_staff()` SECURITY DEFINER; service-role на mutate; новые модераторские эндпойнты следуют тому же паттерну.
- **Анти-brigading:** серверный IP (F8 — `getClientIp` обходим), дедуп reporter+target, велосити-порог, ручной разбор при массовости (иначе N sockpuppet-жалоб → авто-hide честного).
- **Структуры DSA:** `moderation_decisions(advert_id, decision, reason_text, decided_by, appeal_status)` + `appeals(decision_id, status, reviewed_by)` — иммутабельный аудит; GPSR — таймер/SLA-трекинг.
- Тесты: fraud-rule срабатывает на создании (price-anomaly/velocity); fail-closed; апелляция-флоу; роль staff в RLS.

### LEGAL (фундамент F5 — DSA-пакет)
- **DSA-классификация и обязательные артефакты (не «потом» — Art.11/12/14/16/17 действуют для любой online platform):** назначить и опубликовать Art.11 (PoC для authorities), Art.12 (PoC для users), legal rep / establishment в BE → **DSC = BIPT/IBPT**.
- **Исправить нумерацию:** notice-and-action = **Art.16**; statement of reasons = **Art.17** (не Art.16, как сейчас в §4/§8); внутренние апелляции = Art.20; ODS = Art.21.
- **Добавить отсутствующее:** Art.21 (информирование об out-of-court ODS), Art.22 (trusted flaggers — приоритет нотисам), Art.23(2) (меры против abusive notices/complaints — сейчас только repeat infringers Art.23(1)), Art.18 (уведомление о подозрении на преступление в law enforcement), Art.24/Transparency DB (подача SoR, если не освобождены по Art.19), Art.15 transparency report (если не micro).
- **Micro/small-анализ (Art.19) письменно от counsel:** что освобождается (Art.15/20-21/24(3)), что нет (Art.16/30/core).
- **SoR-шаблон (Art.17):** факты + правовое/контрактное основание + автоматизированность + redress (Art.20/21/суд).
- **GPSR:** опасные товары — takedown «без неоправданной задержки», НЕ фикс-3-дня (3 дня — DSA good-practice для прочего); кросс [[15-recupel-dac7-compliance]].
- **Профайлинг-блокировки (Art.22):** авто-блок = SoR + апелляция + человеческий пересмотр значимых решений.

**Вердикт:** 🔄 Доработать (с DSA-блокером по артефактам) — ядро (notice-action/очередь/апелляция) спроектировано, но DSA-пакет существенно неполон (нет PoC/legal rep/DSC, перепутаны Art.16/17, нет Art.21/22/23(2)/18/24), и **fraud-engine не вызывается в рантайме (критично)**. После call-site fraud + fail-closed + `is_staff()` + DSA-артефактов → ✅.
