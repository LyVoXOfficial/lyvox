# Платежи, подписки, бустинг

## Architecture

См. также: `../domains/billing.md`

**Payment Providers:**
- Stripe (primary)
- Mollie (для BE/NL, альтернатива)

## Database Schema

```sql
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL, -- 'boost_7d', 'premium_reserve', 'hide_phone'
  name jsonb NOT NULL, -- {en: 'Boost for 7 days', nl: 'Boost voor 7 dagen', ...}
  price_cents integer NOT NULL,
  currency text DEFAULT 'EUR',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  product_code text NOT NULL REFERENCES public.products(code),
  provider text NOT NULL, -- 'stripe', 'mollie'
  provider_session_id text UNIQUE,
  provider_payment_intent_id text,
  status text NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
  amount_cents integer NOT NULL,
  currency text DEFAULT 'EUR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.purchases(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  advert_id uuid REFERENCES public.adverts(id),
  benefit_type text NOT NULL, -- 'boost', 'premium', 'hide_phone', 'reserve'
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_benefits_user_valid 
  ON public.benefits(user_id, valid_until DESC);
CREATE INDEX idx_benefits_advert 
  ON public.benefits(advert_id) WHERE advert_id IS NOT NULL;
CREATE INDEX idx_purchases_user_status 
  ON public.purchases(user_id, status, created_at DESC);
```

## Products

| Code | Название | Описание | Срок действия |
|------|----------|----------|---------------|
| `boost_7d` | Boost 7 дней | Поднимает объявление в топ | 7 дней |
| `boost_30d` | Boost 30 дней | Поднимает объявление в топ | 30 дней |
| `premium_reserve` | Premium Reserve | Резервирование для VIP | 30 дней |
| `hide_phone` | Скрыть номер | Скрывает телефон, только чат | 90 дней |
| `highlight` | Highlight | Выделение цветом/рамкой | 30 дней |

## API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|-----------|
| `/api/billing/checkout` | POST | Создать Stripe Checkout Session |
| `/api/billing/webhook` | POST | Обработка Stripe webhooks |
| `/api/billing/benefits` | GET | Активные бенефиты пользователя |
| `/api/billing/purchases` | GET | История покупок |

**POST /api/billing/checkout:**
```typescript
Body: {
  productCode: 'boost_7d',
  advertId?: uuid // Опционально, для boost/highlight
}

Response: {
  ok: true,
  sessionId: 'cs_...',
  url: 'https://checkout.stripe.com/...'
}
```

**POST /api/billing/webhook:**
- Events: `checkout.session.completed`, `payment_intent.succeeded`
- Идемпотентность через `provider_session_id`
- Обновление `purchases.status` → создание `benefits`

**GET /api/billing/benefits:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "benefit_type": "boost",
      "advert_id": "uuid",
      "valid_until": "2025-02-01T00:00:00Z"
    }
  ]
}
```

## Checkout Flow

**Шаги:**
1. Пользователь выбирает продукт (например, boost)
2. Вызов `/api/billing/checkout` с `productCode` и `advertId`
3. Создание Stripe Checkout Session
4. Редирект на Stripe Checkout
5. После оплаты: редирект на success page
6. Webhook обрабатывает событие → активация benefit

**Success page:**
```
/post/payment-success?session_id=cs_...
```

## Webhook Processing

**Идемпотентность:**
```typescript
// Проверка что purchase с таким provider_session_id уже не обработан
const existing = await supabase
  .from('purchases')
  .select('id, status')
  .eq('provider_session_id', sessionId)
  .single();

if (existing && existing.status === 'completed') {
  return; // Уже обработан
}
```

**Логика обработки:**
1. Проверка подписи Stripe webhook
2. Поиск или создание `purchase` записи
3. Обновление статуса на `completed`
4. Создание `benefit` записи с `valid_until`
5. Логирование в `logs`

## Automatic Benefit Expiration

**Cron job (ежедневно):**
```sql
-- Удалить expired benefits
DELETE FROM public.benefits
WHERE valid_until < now();

-- Обновить статус объявлений если нужно
UPDATE public.adverts
SET status = 'active' -- или другой статус
WHERE id IN (
  SELECT DISTINCT advert_id 
  FROM public.benefits 
  WHERE valid_until < now() 
    AND benefit_type = 'boost'
);
```

## UI Components

| Компонент | Путь | Описание |
|-----------|------|----------|
| BoostDialog | `apps/web/src/components/BoostDialog.tsx` | Модалка покупки буста |
| BenefitsBadge | `apps/web/src/components/BenefitsBadge.tsx` | Badge на объявлении |
| BillingPage | `apps/web/src/app/(protected)/profile/billing/page.tsx` | История покупок |

## BenefitsBadge

**Отображение:**
- На карточке объявления
- На странице объявления
- Badge "Boosted", "Premium", "Highlight"

**Проверка:**
```typescript
const isBoosted = benefits.some(
  b => b.advert_id === advert.id 
    && b.benefit_type === 'boost'
    && b.valid_until > new Date()
);
```

## Чек-лист MVP

- [ ] Stripe/Mollie интеграция
- [ ] Таблицы products, purchases, benefits
- [ ] Checkout flow: выбор продукта → платеж → активация бенефита
- [ ] Webhook обработка с идемпотентностью
- [ ] Автоматическое снятие бустов после `valid_until`
- [ ] UI индикаторы: badge "Boosted", "Premium" на объявлениях
- [ ] История покупок в профиле

## TODO for developers

1. **Создать миграции для billing**
   - [ ] Таблицы: products, purchases, benefits
   - [ ] Индексы для производительности
   - [ ] Seed данные для products

2. **Настроить Stripe интеграцию**
   - [ ] Stripe API ключи в env
   - [ ] Создание Checkout Session
   - [ ] Webhook endpoint с проверкой подписи
   - [ ] Идемпотентность обработки

3. **Реализовать API endpoints**
   - [ ] POST `/api/billing/checkout` - создание сессии
   - [ ] POST `/api/billing/webhook` - обработка webhook
   - [ ] GET `/api/billing/benefits` - активные бенефиты
   - [ ] GET `/api/billing/purchases` - история покупок

4. **Создать компонент BoostDialog**
   - [ ] Выбор продукта (boost_7d, boost_30d)
   - [ ] Отображение цены
   - [ ] Кнопка "Купить" → redirect на Stripe
   - [ ] Success handling после оплаты

5. **Создать компонент BenefitsBadge**
   - [ ] Проверка активных бенефитов
   - [ ] Отображение badge в зависимости от типа
   - [ ] Стилизация

6. **Реализовать автоматическое истечение**
   - [ ] Cron job (Supabase cron или external)
   - [ ] Удаление expired benefits
   - [ ] Обновление статусов объявлений

7. **Создать страницу истории покупок**
   - [ ] Список всех purchases пользователя
   - [ ] Отображение статуса, суммы, даты
   - [ ] Link на invoice (если доступно)

---

## 🔗 Related Docs

**Domains:** [billing.md](../domains/billing.md)
**Development:** [database-schema.md](./database-schema.md) • [backend-logic.md](./backend-logic.md) • [security-compliance.md](./security-compliance.md) • [user-profile.md](./user-profile.md)




