# Безопасность + Анти-фрод + RLS + GDPR

## Row-Level Security (Current)

### Таблицы с RLS

| Таблица | RLS Status | Policies |
|---------|------------|----------|
| `adverts` | ✅ Enabled | Public read active, owners manage own |
| `media` | ✅ Enabled | Public read active, owners manage own |
| `profiles` | ✅ Enabled | Owners read/update own, public read limited |
| `phones` | ✅ Enabled | Owners manage own |
| `phone_otps` | ✅ Enabled | Owners read own history |
| `reports` | ✅ Enabled | Reporters see own, admins see all |
| `trust_score` | ✅ Enabled | Owners read own, admins adjust |
| `logs` | ✅ Enabled | Users insert own, admins read all |

### Helper Functions

```sql
-- Проверка админ роли
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Rate Limiting

| Endpoint | Лимит | Ключ | Window |
|----------|-------|------|-------|
| `/api/phone/request` | 5 | `otp:user:<uid>` | 15 минут |
| `/api/phone/request` | 20 | `otp:ip:<ip>` | 60 минут |
| `/api/reports/create` | 5 | `report:user:<uid>` | 10 минут |
| `/api/reports/create` | 50 | `report:ip:<ip>` | 24 часа |
| `/api/reports/list` | 60 | `report:admin:<uid>` | 1 минута |

**Implementation:**
- Upstash Redis для хранения счетчиков
- Sliding window алгоритм
- Headers: `RateLimit-Limit`, `RateLimit-Remaining`, `Retry-After`

## Trust Score System

**Текущая логика:**
```sql
CREATE OR REPLACE FUNCTION public.trust_inc(uid uuid, pts integer)
RETURNS void AS $$
BEGIN
  INSERT INTO public.trust_score (user_id, score)
  VALUES (uid, GREATEST(0, LEAST(100, pts)))
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    score = GREATEST(0, LEAST(100, trust_score.score + pts)),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**События:**
| Событие | Изменение score |
|---------|-----------------|
| Регистрация | +10 |
| Email verification | +5 |
| Phone verification | +5 |
| Положительный отзыв | +10 |
| Жалоба принята | -15 |
| Жалоба отклонена (несправедливая) | +5 |

## Fraud Detection Rules

### Database Schema

```sql
CREATE TABLE public.fraud_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text UNIQUE NOT NULL,
  condition_sql text NOT NULL, -- SQL condition that triggers rule
  action text NOT NULL, -- 'block', 'flag', 'review'
  severity integer CHECK (severity >= 1 AND severity <= 10),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### Примеры правил

**Rule 1: Multiple accounts from same IP**
```sql
INSERT INTO public.fraud_rules (rule_name, condition_sql, action, severity) VALUES (
  'multiple_accounts_same_ip',
  'SELECT COUNT(DISTINCT user_id) > 3 FROM public.logs WHERE action = ''user_signup'' AND details->>''ip'' = $1 AND created_at > now() - interval ''24 hours''',
  'flag',
  7
);
```

**Rule 2: Rapid posting**
```sql
INSERT INTO public.fraud_rules (rule_name, condition_sql, action, severity) VALUES (
  'rapid_posting',
  'SELECT COUNT(*) > 10 FROM public.adverts WHERE user_id = $1 AND created_at > now() - interval ''1 hour''',
  'review',
  8
);
```

**Rule 3: Suspicious price patterns**
```sql
INSERT INTO public.fraud_rules (rule_name, condition_sql, action, severity) VALUES (
  'suspicious_prices',
  'SELECT COUNT(*) > 5 FROM public.adverts WHERE user_id = $1 AND (price = 0 OR price IS NULL) AND created_at > now() - interval ''7 days''',
  'flag',
  6
);
```

### Account Flags

```sql
ALTER TABLE public.profiles ADD COLUMN flags jsonb DEFAULT '{}'::jsonb;
-- flags: {fraud_risk: true, spam_detected: true, manual_review: true}
ALTER TABLE public.profiles ADD COLUMN blocked_until timestamptz;
```

**Проверка flags:**
```sql
-- При создании объявления
SELECT flags FROM public.profiles WHERE id = auth.uid();
-- Если flags->>'fraud_risk' = 'true' → блокировка
```

## IP Reputation

**Интеграция с Cloudflare:**
- IP reputation score через Cloudflare API
- Блокировка IP с высоким fraud score (> 7/10)

**Implementation:**
```typescript
// Проверка IP reputation при регистрации/публикации
const ipReputation = await checkCloudflareIP(ip);
if (ipReputation.score > 7) {
  // Блокировка или дополнительная верификация
}
```

## GDPR Compliance

### DSAR (Data Subject Access Request)

**Endpoint:** `/api/gdpr/export`

**Экспорт данных:**
```typescript
// Экспорт всех данных пользователя:
- profiles
- adverts
- media
- messages (conversations, messages)
- purchases
- favorites
- reports (где reporter = user_id)
- logs (где user_id = user_id)
- consents history
```

**Формат экспорта:**
- JSON или CSV
- Включает все связанные данные
- Timestamps для audit

### Право на удаление

**Endpoint:** `/api/gdpr/delete`

**Логика:**
- Soft delete: анонимизация данных (для активных аккаунтов)
- Hard delete: полное удаление (для неактивных >6 месяцев)

**Soft delete:**
```sql
UPDATE public.profiles SET 
  display_name = 'Deleted User',
  email = NULL, -- через Supabase Auth
  phone = NULL
WHERE id = $1;

UPDATE public.adverts SET 
  title = 'Deleted',
  description = NULL,
  status = 'archived'
WHERE user_id = $1;
```

### Consent Management

**Текущее состояние:**
- Таблица `profiles.consents` (JSONB)
- Audit log в `logs` таблице

**Структура consents:**
```json
{
  "terms": {
    "accepted": true,
    "accepted_at": "2025-01-01T00:00:00Z",
    "version": "1.0"
  },
  "privacy": {
    "accepted": true,
    "accepted_at": "2025-01-01T00:00:00Z",
    "version": "1.0"
  },
  "marketing": {
    "accepted": false,
    "accepted_at": null,
    "version": "1.0"
  }
}
```

### Data Retention

**Политики:**
| Данные | Retention | Метод очистки |
|--------|-----------|---------------|
| OTP | 24 часа | Edge Function `maintenance-cleanup` |
| Logs | 18 месяцев | Edge Function `maintenance-cleanup` |
| Messages | 6 месяцев после неактивности | Cron job |
| Reports | 12 месяцев после resolution | Cron job |

**Edge Function: `maintenance-cleanup`**
- Ежедневный запуск (Supabase cron)
- Удаление expired OTP
- Анонимизация старых logs

## Чек-лист MVP

- [ ] RLS на всех таблицах с пользовательскими данными
- [ ] Trust score логика и визуализация
- [ ] Fraud detection rules (SQL-based)
- [ ] Account flags и блокировки
- [ ] DSAR export endpoint
- [ ] GDPR deletion workflow
- [ ] Consent audit log
- [ ] Data retention автоматизация

## TODO for developers

1. **Проверить и усилить RLS policies**
   - [ ] Аудит всех таблиц
   - [ ] Тестирование policies от лица разных пользователей
   - [ ] Добавить недостающие policies

2. **Реализовать fraud detection rules**
   - [ ] Таблица `fraud_rules`
   - [ ] Система проверки правил
   - [ ] Автоматическое применение actions (block/flag/review)

3. **Реализовать account flags**
   - [ ] Поле `flags` в profiles
   - [ ] Поле `blocked_until`
   - [ ] Проверка flags при критичных операциях

4. **Создать DSAR export endpoint**
   - [ ] `/api/gdpr/export`
   - [ ] Сбор всех данных пользователя
   - [ ] Форматирование (JSON/CSV)
   - [ ] Rate limiting (1 запрос / день на пользователя)

5. **Реализовать GDPR deletion**
   - [ ] `/api/gdpr/delete`
   - [ ] Soft delete логика
   - [ ] Hard delete для неактивных >6 месяцев
   - [ ] Логирование всех удалений

6. **Улучшить consent management**
   - [ ] UI для управления consents
   - [ ] Audit log всех изменений
   - [ ] Версионирование соглашений

7. **Настроить автоматическую очистку**
   - [ ] Обновить Edge Function `maintenance-cleanup`
   - [ ] Настроить cron schedule
   - [ ] Мониторинг выполнения

8. **IP Reputation интеграция**
   - [ ] Cloudflare API интеграция
   - [ ] Проверка при регистрации
   - [ ] Блокировка высокого риска IP

---

## 🔗 Related Docs

**Domains:** [moderation.md](../domains/moderation.md) • [trust_score.md](../domains/trust_score.md) • [deals.md](../domains/deals.md)
**Development:** [deep-audit-20251108.md](./deep-audit-20251108.md)
**Core:** [API_REFERENCE.md](../API_REFERENCE.md)




