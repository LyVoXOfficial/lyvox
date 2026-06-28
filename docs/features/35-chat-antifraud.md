# PRD: Чат + чат-антифрод

> **Статус кода:** ✅ ГОТОВО (чат + scrubContacts; усиление как сигнал — roadmap)
> **Категория:** Есть (с доработками)
> **Приоритет:** P0
> **Зависит от:** [[30-identity-account]] (trust-гейт), [[13-inchat-payment-bancontact]], [[36-notifications]], [[16-account-takeover-protection]]
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** Чат — главная поверхность фрода (увод в WhatsApp, внешние payment-ссылки). Нужен realtime-чат + защита от увода/фишинга.
- **Исход.** Realtime-чат с RLS, маскированием контактов/ссылок и JIT-предупреждениями; off-platform попытки — фрод-сигнал. Настоящий «замок» — escrow ([[10-escrow-safe-deal]]), скрабинг — сигнал/деттеррент.
- **KPI:** доля диалогов с off-platform попыткой (снижать); конверсия чат→сделка; время ответа.

## 2. Контекст и текущее состояние (As-is)
- Realtime-чат (`/api/chat/{start,send,history,read}`, `ChatWindow`, `conversations/messages`, RLS), unread-трекинг, пагинация.
- Недавние фиксы: RLS-рекурсия, `start_conversation` RPC (lock direct insert), read-marking RLS.
- **Чат-антифрод:** `lib/chat/scrubContacts.ts` (+тесты) — маскирование телефонов/email/ссылок (применяется в `/api/chat/send`).
- Roadmap (TODO): message-level reports/auto-mute, retention/TTL/DSAR-экспорт чата, нотификации (event→channel матрица).

## 3. Пользователи и сценарии
- «Написать продавцу/покупателю в реальном времени»; «получить предупреждение при попытке увода/внешней ссылки»; «пожаловаться на сообщение».

## 4. UX и поведение (детально)
- Список диалогов + окно чата; realtime, unread, read-state.
- **Скрабинг/маскирование** телефонов/email/URL/IBAN/QR + инлайн-предупреждение «LyVoX никогда не просит платить по ссылке вне приложения».
- **Запрос оплаты** нативно в чате ([[13-inchat-payment-bancontact]]).
- Жалоба на сообщение; (roadmap) auto-mute при паттернах.
- Состояния: загрузка/пусто/ошибка/реконнект.

## 5. Логика и правила
- Серверная проверка участников; rate-limit на send; only authenticated.
- **Скрабинг — сигнал+деттеррент**, не стена (обходится unicode/«ноль-восемь»/фото номера) → логировать попытки как риск-сигнал в trust-score ([[37-trust-reviews]]).
- Retention/TTL сообщений, soft-delete, DSAR-экспорт (roadmap).
- Краевые: реконнект, дубли сообщений, оффлайн-отправка.

## 6. Данные (Data model)
- `conversations`, `conversation_participants`, `messages`; (roadmap) `message_risk_flags`. RLS: только участники; `start_conversation` RPC. Retention/TTL + cron-очистка (roadmap).

## 7. API / интеграции
- `/api/chat/{start,send,history,read}`; Supabase Realtime; интеграция с payment-request ([[13-inchat-payment-bancontact]]) и нотификациями.

## 8. Безопасность, приватность, комплаенс
- RLS, rate-limit, скрабинг-сигнал; off-platform логирование; DSAR-экспорт/retention (GDPR); message-level модерация (DSA).

## 9. Аналитика
- Off-platform попытки, конверсия чат→сделка, время ответа, реконнекты/ошибки канала (Sentry).

## 10. Доступность и i18n
- Доступный чат (клавиатура/скринридер); i18n `chat.*` + предупреждения (NL/FR/EN).

## 11. Тестирование
- Unit: scrubContacts (есть). API: start/send/read + RLS + rate-limit. e2e: диалог realtime, реконнект, предупреждение при ссылке, жалоба.

## 12. План внедрения (Rollout)
- **Поддержка/усиление:** message-level reports + auto-mute; risk-flags в trust-score; retention/TTL/DSAR; нотификации чата. Усилие: M.

## 13. Открытие вопросы и решения
- TTL сообщений. Пороги auto-mute. Какие паттерны логировать как риск.

## 14. Критерии готовности (DoD)
- [ ] Realtime-чат с RLS, unread, реконнект.
- [ ] Скрабинг + JIT-предупреждения; off-platform логируется как сигнал.
- [ ] Message-level жалобы/модерация; retention/DSAR.
- [ ] Тесты §11 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

### SEC (фундаменты F8, S-2; F14)
- **`scrubContacts` тривиально обходится (A-5, подтверждено):** слитные `0612345678` без разделителя, unicode look-alikes, дробление по сообщениям, IBAN с пробелом. Честно зафиксировано как deterrent (ок), но как **сигнал недокручен**. Усилить: NFKC-нормализация + маскирование слитного BE-номера `^0\d{9}$` + агрегация по conversation → trust-score (F14). PRD-13 анти-фишинг опирается на это — поднять приоритет.
- **Stored-XSS через `messages.body` (High, зависит от S-2):** при CSP Report-Only прорыв экранирования = угон сессии в приватном чате. Вывести зависимость от **enforced CSP + nonce** явно как acceptance этого PRD.
- **Realtime-authorization:** подтвердить в §8, что Supabase Realtime-подписки на `messages`/`conversations` gated теми же RLS, что REST (`is_conversation_participant`); никаких service-role в клиентских Realtime.
- **Серверный IP (F8):** rate-limit на send обходим до фикса `getClientIp` (доверять только последнему доверенному hop).
- **Нет rate-limit на media (A-4):** медиа-вложения в чате идут через `api/media/*` без `withRateLimit` — связать с [[17-image-verification]].
- **Retention/TTL/DSAR чата:** из roadmap в DoD **до escrow-запуска** (чат станет каналом сделок → копит PII бессрочно). Cron-очистка + DSAR-экспорт.

### DEV (фундамент F14)
- **`message_risk_flags`** как место хранения сигнала: `(id, message_id, conversation_id, sender_id, types text[], created_at)` + агрегатор в trust ([[37-trust-reviews]]).
- Тесты: слитный номер → flagged; unicode → flagged; агрегат N сообщений → risk.

**Вердикт:** 🔄 Доработать — база (realtime + RLS + scrub + тесты) готова; roadmap-пункты (risk-flags→trust, retention/DSAR до escrow) и зависимости (enforced CSP, серверный IP) уточнить схемой. После правок → ✅.
