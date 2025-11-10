# Уведомления (Email, Push, SMS)

## Database Schema

```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'new_message', 'advert_approved', 'payment_completed', ...
  channel text NOT NULL, -- 'email', 'push', 'sms', 'in_app'
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb, -- дополнительные данные
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread 
  ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_created 
  ON public.notifications(user_id, created_at DESC);
```

## Notification Types

| Type | Описание | Каналы | Триггер |
|------|----------|--------|---------|
| `new_message` | Новое сообщение в чате | email, push, in_app | Новое сообщение |
| `advert_approved` | Объявление одобрено | email, in_app | Модерация approve |
| `advert_rejected` | Объявление отклонено | email, in_app | Модерация reject |
| `advert_contact` | Запрос телефона | email, in_app | Кто-то запросил телефон |
| `payment_completed` | Покупка завершена | email, in_app | Webhook payment |
| `favorite_new_ad` | Новое объявление в избранной категории | email, push | Saved search match |

## Channels

### Email

**Провайдеры:**
- Supabase Auth email (для magic links)
- SendGrid (рекомендуется для транзакционных)
- Mailgun (альтернатива)

**Templates:**
- Путь: `apps/web/src/lib/email/templates/`
- Формат: `.tsx` или `.html`
- Локализация: отдельные шаблоны для NL/FR/EN/RU

**Пример шаблона:**
```typescript
// apps/web/src/lib/email/templates/new-message.tsx
export function NewMessageEmail({ userName, senderName, messagePreview }: Props) {
  return (
    <Email>
      <Title>New message from {senderName}</Title>
      <Body>
        <p>Hi {userName},</p>
        <p>You have a new message:</p>
        <p>{messagePreview}</p>
        <Button href={conversationUrl}>View Message</Button>
      </Body>
    </Email>
  );
}
```

### Push Notifications

**Провайдеры:**
- OneSignal (рекомендуется)
- Firebase Cloud Messaging

**Setup:**
1. Регистрация service worker
2. Подписка на push notifications
3. Сохранение subscription token в БД

**Future:**
- Таблица `push_subscriptions` для хранения tokens

### SMS

**Провайдер:**
- Twilio (уже используется для OTP)

**Использование:**
- Только для критичных уведомлений
- OTP (уже реализовано)
- Важные транзакции (future)

### In-App

**Реализация:**
- Supabase Realtime subscription на таблице `notifications`
- Центр уведомлений в UI

## API Endpoints

| Endpoint | Метод | Описание | Auth |
|----------|-------|----------|------|
| `/api/notifications` | GET | Список уведомлений пользователя | Required |
| `/api/notifications/[id]/read` | POST | Отметить прочитанным | Required |
| `/api/notifications/preferences` | GET | Настройки уведомлений | Required |
| `/api/notifications/preferences` | POST | Обновить настройки | Required |
| `/api/notifications/send` | POST | Отправить уведомление (internal) | Service |

**GET /api/notifications:**
```typescript
Query: {
  page?: number,
  limit?: number, // default 20
  unread_only?: boolean
}

Response: {
  ok: true,
  data: {
    items: Notification[],
    unread_count: number,
    total: number
  }
}
```

## Preferences

**Database:**
```sql
ALTER TABLE public.profiles ADD COLUMN notification_preferences jsonb DEFAULT '{
  "email": {
    "new_message": true,
    "advert_approved": true,
    "advert_rejected": true,
    "advert_contact": true,
    "payment_completed": true,
    "favorite_new_ad": false
  },
  "push": {
    "new_message": true,
    "advert_approved": false,
    "favorite_new_ad": true
  },
  "sms": {},
  "quiet_hours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  }
}'::jsonb;
```

## Deduplication

**Логика:**
- Не отправлять уведомление если уже отправлено за последние 60 секунд
- Проверка по `(user_id, type, payload->>'advert_id' или conversation_id)`

**Implementation:**
```typescript
async function shouldSend(userId: string, type: string, payload: any) {
  const key = `${userId}:${type}:${payload.advert_id || payload.conversation_id}`;
  const sent = await redis.get(key);
  if (sent) return false;
  
  await redis.setex(key, 60, '1');
  return true;
}
```

## Quiet Hours

**Логика:**
- Не отправлять уведомления в период quiet hours (по умолчанию 22:00-08:00)
- Применяется только к email и push
- In-app уведомления отправляются всегда

## In-App Notification Center

**Компоненты:**
- `apps/web/src/components/NotificationCenter.tsx`
- Dropdown или отдельная страница
- Badge с количеством непрочитанных

**Realtime subscription:**
```typescript
const channel = supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Add notification to state
    // Show toast or badge update
  })
  .subscribe();
```

## Чек-лист MVP

- [ ] Таблица notifications
- [ ] Email отправка (SMTP через Supabase или SendGrid)
- [ ] Push уведомления (OneSignal/FCM)
- [ ] In-app центр уведомлений
- [ ] Настройки уведомлений в профиле
- [ ] Дедупликация (не отправлять дважды за 60 сек)
- [ ] Quiet hours (не отправлять 22:00-08:00)

## TODO for developers

1. **Создать миграцию для notifications**
   - [ ] Таблица `notifications`
   - [ ] Индексы для производительности
   - [ ] Поле `notification_preferences` в profiles

2. **Реализовать API endpoints**
   - [ ] GET `/api/notifications` - список уведомлений
   - [ ] POST `/api/notifications/[id]/read` - отметка прочитанным
   - [ ] GET/POST `/api/notifications/preferences` - настройки
   - [ ] POST `/api/notifications/send` - internal отправка

3. **Настроить Email отправку**
   - [ ] Интеграция SendGrid или Mailgun
   - [ ] Создание email templates (NL/FR/EN/RU)
   - [ ] Helper функция для отправки

4. **Реализовать Push уведомления**
   - [ ] OneSignal или FCM setup
   - [ ] Service worker регистрация
   - [ ] Сохранение subscription tokens
   - [ ] Отправка push notifications

5. **Создать in-app notification center**
   - [ ] Компонент `NotificationCenter.tsx`
   - [ ] Realtime subscription
   - [ ] Badge с количеством непрочитанных
   - [ ] Отметка прочитанными

6. **Реализовать дедупликацию**
   - [ ] Redis или Upstash для проверки
   - [ ] Ключ: `user_id:type:context_id`
   - [ ] TTL 60 секунд

7. **Добавить quiet hours**
   - [ ] Проверка времени перед отправкой
   - [ ] Учет timezone пользователя
   - [ ] Настройки в preferences

8. **Интегрировать уведомления в workflow**
   - [ ] Новое сообщение → уведомление
   - [ ] Модерация approve/reject → уведомление
   - [ ] Payment completed → уведомление
   - [ ] Другие триггеры

---

## 🔗 Related Docs

**Domains:** [chat.md](../domains/chat.md)
**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [deep-audit-20251108.md](./deep-audit-20251108.md) • [database-schema.md](./database-schema.md) • [README.md](./README.md)




