# PRD: Уведомления (in-app, email, preferences)

> **Статус кода:** 🟡 ЧАСТИЧНО (in-app + preferences есть; event→channel матрица/пуш — roadmap)
> **Категория:** Есть (с доработками)
> **Приоритет:** P1
> **Зависит от:** [[18-pwa-push]] (пуш), [[34-discovery-extras]] (saved-search алерты), [[35-chat-antifraud]] (чат-события)
> **Последнее обновление:** 2026-06-27

---

## 1. Зачем это (Problem & Outcome)
- **Проблема.** Без своевременных уведомлений падает ретеншен и скорость сделок; без consent/quiet hours — спам и юр-риск.
- **Исход.** Единая система: in-app (колокол) + email (+ пуш позже), с preferences, дедупом, quiet hours, отпиской.
- **KPI:** CTR уведомлений; opt-in на каналы; отписки; влияние на возвраты/скорость ответа.

## 2. Контекст и текущее состояние (As-is)
- `notifications` (+RLS), `/api/notifications[/[id]/read]`, `/api/notifications/preferences`, `NotificationBell`.
- Email-инфра (`lib/email`). Saved-search алерты (cron).
- Roadmap (TODO): event→channel матрица, шаблоны, delivery-логи, дедуп + quiet hours; пуш ([[18-pwa-push]]).

## 3. Пользователи и сценарии
- «Видеть события (сообщения, статусы сделки/доставки, споры, новое по сохранённому поиску)»; «настроить каналы/тихие часы»; «отписаться».

## 4. UX и поведение (детально)
- **Колокол in-app:** список, непрочитанные, отметка прочитанным.
- **Preferences:** по типам событий × каналам (in-app/email/пуш), quiet hours, отписка.
- **Email:** локализованные шаблоны (terms/privacy-ссылки per locale), без actionable-ссылок для чувствительного (анти-фишинг [[35-chat-antifraud]]).
- Состояния: пусто/есть/ошибка доставки.

## 5. Логика и правила
- **Event→channel матрица:** для каждого события — какие каналы, дедуп (не слать пуш+email на одно без нужды), quiet hours, consent.
- Delivery-логи + ретраи; идемпотентность отправки.
- Краевые: протухший email/подписка, отписка, превышение частоты.

## 6. Данные (Data model)
- `notifications`, `notification_preferences`, (roadmap) `notification_deliveries`. RLS owner-only. Retention логов доставки.

## 7. API / интеграции
- `/api/notifications*`, email-провайдер (`lib/email`), web-push ([[18-pwa-push]]). Источники событий: чат, сделки/доставка/споры, saved-search.

## 8. Безопасность, приватность, комплаенс
- Consent/opt-in (GDPR/ePrivacy), лёгкая отписка; анти-фишинг (официальные сообщения — в приложении); DMARC/DKIM/SPF для email-домена.

## 9. Аналитика
- Отправлено/доставлено/открыто/кликнуто по каналам/событиям; отписки; quiet-hours эффект.

## 10. Доступность и i18n
- Доступный колокол/preferences; i18n шаблонов и строк (NL/FR/EN), локализованные ссылки.

## 11. Тестирование
- Unit: матрица/дедуп/quiet hours. API: preferences, read, delivery. e2e: событие → in-app + email; отписка; quiet hours.

## 12. План внедрения (Rollout)
- **NEXT:** event→channel матрица + шаблоны + delivery-логи + дедуп/quiet hours; затем пуш ([[18-pwa-push]]). Усилие: M.

## 13. Открытые вопросы и решения
- Дефолтные каналы по событиям. Длина quiet hours. email vs SMS для iOS-фоллбэка.

## 14. Критерии готовности (DoD)
- [ ] In-app + email с preferences, дедупом, quiet hours, отпиской.
- [ ] Event→channel матрица + delivery-логи + ретраи.
- [ ] Анти-фишинг email (DMARC/DKIM/SPF, без actionable-ссылок чувствительного).
- [ ] Тесты §11 зелёные.

---

## Ревью-требования и sign-off (2026-06-28)

### DEV (жёсткий предшественник для [[18-pwa-push]])
- **Event→channel матрица — ядро PRD, но не специфицирована как данные/код.** Задать как конфиг: `NOTIFICATION_MATRIX: Record<EventType, { channels, quiet_hours_respected }>`; список event-типов как enum; как preferences переопределяют дефолты.
- **Идемпотентность отправки:** `notification_deliveries(id, user_id, event_type, channel, dedup_key unique, status, sent_at, error)`; `dedup_key = event_type:entity_id:user_id:channel`.
- **Quiet hours:** нужна таймзона пользователя — добавить `profiles.timezone`.
- Тесты: один `dedup_key` → одна доставка; quiet hours отложил; отписка.

### UX (фундаменты — единые правила зоны)
- **Пресеты против over-choice:** «Всё важное» (дефолт) / «Только сделки и сообщения» / «Минимум» / «Настроить вручную» (прогрессивное раскрытие матрицы).
- **Дефолтные каналы по событиям (закрыть §13):** чат → in-app + push; статусы сделки/доставки/споры → in-app + email; saved-search → in-app + дайджест-email (раз в день); маркетинг → выкл по умолчанию (opt-in, ePrivacy).
- **UX анти-фишинга:** письмо ведёт на общий вход («Откройте LyVoX → Уведомления»), не на deep-link с токеном; onboarding-памятка «Настоящие уведомления — в приложении; письма не просят пароль/оплату».
- **Убрать заглушки-обманки** (статичные «Enabled»/«coming soon» в профиле): либо работает, либо честный «Скоро».
- **Снижение тревоги «завалят»:** при включении канала — «Будем писать только по делу. Отключить можно в один тап.»
- **a11y:** колокол — `aria-label="Уведомления, N непрочитанных"`; список — фокус-менеджмент/Esc/стрелки; «Отметить прочитанным» — кнопка с label; новое уведомление — `aria-live="polite"` (не assertive); preferences — `role=switch`+`aria-checked`; **email-шаблоны — семантический HTML, alt на иконках, контраст ≥4.5:1, читаемо без картинок**; тач-таргеты ≥44px.

### LEGAL/DATA (фундамент F4)
- Маркетинг-уведомления — строго opt-in (ePrivacy Art.13 / CDE Book VI Art. VI.110); лёгкая отписка не прятать; локализованные terms/privacy-ссылки per locale.

**Вердикт:** 🔄 Доработать — бэкенд-логика airtight по замыслу, но матрица как enum+конфиг, `dedup_key`, TZ для quiet hours, UX-пресеты и a11y email недоописаны. Жёсткий предшественник для PWA-push. После правок → ✅.
