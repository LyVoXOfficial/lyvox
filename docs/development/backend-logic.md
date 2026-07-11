# Бэкенд-логика

## Supabase Edge Functions

### Current Functions

| Function | Назначение | Status |
|----------|-----------|--------|
| `maintenance-cleanup` | Очистка старых данных | ✅ Реализован |

### New Functions

| Function | Назначение | Priority |
|----------|-----------|----------|
| `ai-moderation` | AI анализ объявлений | P0 |
| `notification-sender` | Отправка уведомлений | P1 |
| `fraud-detection` | Проверка на мошенничество | P1 |

**Структура:**
```
supabase/functions/
  ├── maintenance-cleanup/
  │   └── index.ts
  ├── ai-moderation/
  │   └── index.ts
  ├── notification-sender/
  │   └── index.ts
  └── fraud-detection/
      └── index.ts
```

## PostgreSQL Functions

### Current Functions

| Function | Назначение | Parameters |
|----------|-----------|------------|
| `trust_inc(uid, pts)` | Обновление trust score | `uuid`, `integer` |
| `is_admin()` | Проверка админ роли | - |

### New Functions

| Function | Назначение | Parameters |
|----------|-----------|------------|
| `search_adverts(...)` | Поиск с фильтрами | `search_query`, `category_id`, `price_min`, `price_max`, `location`, `radius_km`, `sort_by`, `page_offset`, `page_limit` |
| `calculate_ai_score(...)` | AI scoring (вызывается из Edge Function) | `advert_id` |

**Пример search_adverts:**
```sql
CREATE OR REPLACE FUNCTION search_adverts(
  search_query text DEFAULT NULL,
  category_id_filter uuid DEFAULT NULL,
  price_min_filter numeric DEFAULT NULL,
  price_max_filter numeric DEFAULT NULL,
  location_filter text DEFAULT NULL,
  radius_km numeric DEFAULT 50,
  sort_by text DEFAULT 'created_at_desc',
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 24
)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  price numeric,
  location text,
  created_at timestamptz,
  relevance real
) AS $$
BEGIN
  -- Full-text search + filters + sorting + pagination
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.description,
    a.price,
    a.location,
    a.created_at,
    CASE 
      WHEN search_query IS NOT NULL THEN
        ts_rank(
          to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.description, '')),
          plainto_tsquery('english', search_query)
        )
      ELSE 0
    END AS relevance
  FROM public.adverts a
  WHERE a.status = 'active'
    AND (search_query IS NULL OR 
         to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.description, '')) 
         @@ plainto_tsquery('english', search_query))
    AND (category_id_filter IS NULL OR a.category_id = category_id_filter)
    AND (price_min_filter IS NULL OR a.price >= price_min_filter)
    AND (price_max_filter IS NULL OR a.price <= price_max_filter)
    AND (location_filter IS NULL OR a.location ILIKE '%' || location_filter || '%')
  ORDER BY 
    CASE sort_by
      WHEN 'price_asc' THEN a.price
      WHEN 'price_desc' THEN -a.price
      WHEN 'relevance' THEN relevance DESC
      ELSE a.created_at DESC
    END
  LIMIT page_limit OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;
```

## Scheduled Jobs (Cron)

### Jobs

| Job | Частота | Назначение |
|-----|---------|-----------|
| Cleanup expired benefits | Ежедневно (00:00) | Удаление expired benefits |
| Anonymize old logs | Ежедневно (02:00) | Анонимизация logs старше 18 месяцев |
| Update category counts | Каждый час | Обновление `advert_count` в categories |
| Check fraud rules | Каждые 15 минут | Проверка fraud detection rules |

**Настройка через Supabase:**
```sql
-- Пример через pg_cron extension
SELECT cron.schedule(
  'cleanup-expired-benefits',
  '0 0 * * *', -- Ежедневно в 00:00
  $$DELETE FROM public.benefits WHERE valid_until < now()$$
);
```

## Background Processing

### Queue System

**Опции:**
- Supabase Realtime для простых задач
- Bull/BullMQ на Upstash Redis для сложных

**Задачи для queue:**
- Email отправка
- Image processing (resize, optimization)
- AI модерация (асинхронная)
- Push notifications отправка

**Пример с BullMQ:**
```typescript
import { Queue } from 'bullmq';

const emailQueue = new Queue('emails', {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Добавление задачи
await emailQueue.add('send-email', {
  to: 'user@example.com',
  template: 'new-message',
  data: {...}
});
```

## Чек-лист MVP

- [ ] Edge Functions реализованы
- [ ] PostgreSQL functions оптимизированы
- [ ] Cron jobs настроены
- [ ] Background processing для асинхронных задач

## TODO for developers

1. **Создать Edge Function ai-moderation**
   - [ ] Интеграция с OpenAI/Anthropic API
   - [ ] Обработка input данных
   - [ ] Возврат score и reason
   - [ ] Error handling

2. **Создать Edge Function notification-sender**
   - [ ] Чтение непрочитанных notifications
   - [ ] Отправка через email/push/SMS
   - [ ] Обновление `sent_at`
   - [ ] Дедупликация

3. **Создать Edge Function fraud-detection**
   - [ ] Проверка fraud_rules
   - [ ] Применение actions (block/flag/review)
   - [ ] Логирование результатов

4. **Реализовать PostgreSQL function search_adverts**
   - [ ] Full-text search логика
   - [ ] Фильтры
   - [ ] Сортировка
   - [ ] Пагинация
   - [ ] Тестирование производительности

5. **Настроить cron jobs**
   - [ ] Через Supabase cron или pg_cron
   - [ ] Cleanup expired benefits
   - [ ] Anonymize old logs
   - [ ] Update category counts
   - [ ] Check fraud rules

6. **Настроить background processing**
   - [ ] Выбор системы (Realtime или BullMQ)
   - [ ] Queue для email отправки
   - [ ] Queue для image processing
   - [ ] Workers для обработки задач

7. **Мониторинг и логирование**
   - [ ] Логирование выполнения Edge Functions
   - [ ] Мониторинг cron jobs
   - [ ] Алерты при ошибках

---

## 🔗 Related Docs

**Development:** [database-schema.md](./database-schema.md) • [Production master](../MASTER_PRODUCTION_TZ.md) • [deep-audit-20251108.md](./deep-audit-20251108.md) • [moderation-ai.md](./moderation-ai.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)



