# T07 — ChatOffer: структурированные предложения цены

**Модель:** сильная (gpt xhigh / opus-класс) + обязательное самоstyle-ревью диффа перед merge. Затрагивает чат и RLS.
**Ветка:** `feat/chat-offers` · **Приоритет:** P1 · **Оценка:** 1 день.

## Зачем
Краш-тест, агент D: лоуболл-спам выжигает продавцов. Rate-limit сообщений уже есть (`chat/send/route.ts:22-28`), но нет семантики оффера. Строим предложения цены КАК СООБЩЕНИЯ-СОБЫТИЯ, НЕ платёж (F3!).

## Контракт (из брифа §11.4, принят репликацией)
```ts
type ChatOffer = {
  advertId: string; conversationId: string;
  amountCents: number; currency: "EUR"; message?: string;
  status: "sent" | "declined" | "accepted_in_chat" | "expired";
};
```

## Шаги
1. Изучи чат-слой: `supabase/migrations/20251108120000_chat_tables.sql`, `apps/web/src/app/api/chat/send/route.ts`, `chat/start` (rpc `start_conversation`), компоненты `chat/ChatWindow`.
2. Миграция: таблица `chat_offers` (id, advert_id FK, conversation_id FK, sender_id FK auth.users, amount_cents int CHECK (amount_cents > 0 AND amount_cents < 100000000), currency text default 'EUR', status text CHECK из контракта, created_at, responded_at). RLS: SELECT — участники разговора (используй СУЩЕСТВУЮЩИЙ хелпер `is_conversation_participant()` — SECURITY DEFINER, НЕ инлайновый EXISTS: инлайн на своей таблице рекурсирует, урок 42P17); INSERT — только sender=auth.uid() и участник; UPDATE status — только получатель оффера. Column-scoped GRANT: authenticated UPDATE только (status, responded_at).
3. Поле продавца: колонка `adverts.min_offer_cents int null` (миграция та же) + grant в существующий editable-набор adverts НЕ добавлять — запись через существующий service-роут обновления объявления (найди PATCH advert route, добавь поле в zod + запись).
4. API `POST /api/chat/offer`: rate limit 5/час/advert per-user (`createRateLimiter prefix "chat:offer"`), валидация zod, если `amount < adverts.min_offer_cents` → создать оффер сразу в status='declined' и вернуть `{ok:true, data:{autoDeclined:true}}` (продавца НЕ дёргаем). Иначе — оффер + системное сообщение в разговор (через service-клиент, тип сообщения как у обычных, текст из i18n не хардкодить — см. как chat/send пишет).
5. UI минимальный: кнопка «Предложить цену» в ChatWindow → prompt-поле суммы → POST; оффер рендерится в ленте выделенной карточкой (сумма + статус). Кнопки получателя: принять/отклонить (PATCH status). i18n: `chat.offer_*` ключи в 5 локалей.
6. Событие в аналитику: `trackServerEvent('offer_sent'| 'offer_declined_auto')` — найди `apps/web/src/lib/analytics/trackServerEvent.ts` и его вызовы как образец.
7. Тесты: API (401/429/автодеклайн/валидация суммы), RLS-негативный (не-участник не видит),존 существующие чат-тесты зелёные.

## Проверка
- Полный сьют; миграция на прод через db push; e2e руками: два юзера (seed-креды НЕ использовать в коммитах) — оффер виден обоим.
- Коммит: `feat(chat): structured price offers + seller min-offer auto-decline (T07)` — merge --no-ff, push.

## Красные линии (ЖЁСТКО)
- НИКАКОЙ связи с billing/Stripe/purchases — это НЕ платёж (F3). Слова «оплата/payment» в UI-копиях оффера не употреблять; «предложение цены».
- `accepted_in_chat` НЕ создаёт обязательств и НЕ меняет статус объявления.
- RLS-хелпер только SECURITY DEFINER (рекурсия!). Новые функции — REVOKE от public/anon/authenticated если service-only.
