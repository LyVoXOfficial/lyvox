# API архитектура

## Current Structure

**Framework:** Next.js API Routes

**Расположение:** `apps/web/src/app/api/**`

**Supabase клиенты (оба асинхронные, требуется `await`):**
- `supabaseServer()` — anon key + cookies (user-scoped)
- `supabaseService()` — service role (admin operations)

## API Standards

### 1. Endpoint Naming

| Паттерн | Пример | Использование |
|---------|--------|---------------|
| RESTful CRUD | `/api/resource/[id]` | Стандартные операции |
| Actions | `/api/resource/action` | Специфичные действия |
| Nested resources | `/api/resource/[id]/nested` | Вложенные ресурсы |

**Примеры:**
- `GET /api/adverts/[id]` - получить объявление
- `POST /api/adverts` - создать объявление
- `PATCH /api/adverts/[id]` - обновить объявление
- `DELETE /api/adverts/[id]` - удалить объявление
- `POST /api/chat/send` - отправить сообщение (action)

### 2. Request/Response Format

**Success Response:**
```typescript
{
  ok: true,
  data: {...} // или просто данные без обертки
}
```

**Error Response:**
```typescript
{
  ok: false,
  error: 'ERROR_CODE',
  detail?: string // Опциональное описание
}
```

**HTTP Status Codes:**
| Код | Использование |
|-----|---------------|
| 200 | Success |
| 400 | Bad Request (валидация) |
| 401 | Unauthorized (не авторизован) |
| 403 | Forbidden (нет прав) |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Internal Server Error |

### 3. Authentication

**Проверка:**
```typescript
const supabase = await supabaseServer();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return createErrorResponse('UNAUTHENTICATED', { status: 401 });
}
```

**Admin проверка:**
```typescript
const { data: { user } } = await supabase.auth.getUser();
const isAdmin = user?.app_metadata?.role === 'admin';

if (!isAdmin) {
  return createErrorResponse('FORBIDDEN', { status: 403 });
}
```

### 4. Rate Limiting

**Обертка:**
```typescript
// apps/web/src/lib/rateLimiter.ts
export async function withRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  handler: () => Promise<Response>
): Promise<Response> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  
  if (count > limit) {
    return new Response(
      JSON.stringify({
        error: 'rate_limited',
        retry_after_seconds: windowSeconds,
        limit,
        remaining: 0
      }),
      { status: 429, headers: { 'Retry-After': windowSeconds.toString() } }
    );
  }
  
  return handler();
}
```

**Использование:**
```typescript
export async function POST(request: Request) {
  return withRateLimit(
    `otp:user:${userId}`,
    5,
    900, // 15 минут
    async () => {
      // Обработка запроса
    }
  );
}
```

### 5. Error Handling

**Централизованный handler:**
```typescript
// apps/web/src/lib/apiErrors.ts
export enum ApiErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  // ...
}

export function createErrorResponse(
  code: ApiErrorCode,
  options?: { status?: number; detail?: string }
): Response {
  return Response.json(
    {
      ok: false,
      error: code,
      ...(options?.detail && { detail: options.detail })
    },
    { status: options?.status || 400 }
  );
}
```

### 6. Validation

**Zod schemas:**
```typescript
import { z } from 'zod';

const CreateAdvertSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  price: z.number().min(0).optional(),
  category_id: z.string().uuid()
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = CreateAdvertSchema.safeParse(body);
  
  if (!result.success) {
    return createErrorResponse('VALIDATION_ERROR', {
      detail: result.error.message
    });
  }
  
  // Обработка с валидными данными
}
```

## API Documentation

**Текущая:** `docs/API_REFERENCE.md`

**Post-MVP:**
- OpenAPI/Swagger spec
- Автоматическая генерация из TypeScript types

## Чек-лист MVP

- [ ] Единый формат ответов
- [ ] Error handling централизован
- [ ] Rate limiting на всех чувствительных endpoints
- [ ] Валидация через Zod
- [ ] API документация обновлена

## TODO for developers

1. **Стандартизировать все endpoints**
   - [ ] Единый формат ответов (`{ok: true/false}`)
   - [ ] Централизованный error handling
   - [ ] Правильные HTTP status codes

2. **Добавить валидацию Zod**
   - [ ] Создать schemas для всех request bodies
   - [ ] Валидация в каждом endpoint
   - [ ] Понятные сообщения об ошибках

3. **Реализовать rate limiting**
   - [ ] Обертка `withRateLimit`
   - [ ] Настройка лимитов для каждого endpoint
   - [ ] Headers в ответах

4. **Улучшить authentication**
   - [ ] Helper функция для проверки auth
   - [ ] Helper функция для проверки admin
   - [ ] Консистентная обработка 401/403

5. **Обновить API документацию**
   - [ ] Все новые endpoints в `API_REFERENCE.md`
   - [ ] Примеры запросов/ответов
   - [ ] Error codes документация

6. **Тестирование**
   - [ ] Unit тесты для каждого endpoint
   - [ ] Integration тесты для полных flows
   - [ ] Тестирование rate limiting
   - [ ] Тестирование error handling

---

## 🔗 Related Docs

**Domains:** [adverts.md](../domains/adverts.md)
**Development:** [deep-audit-20251108.md](./deep-audit-20251108.md) • [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [chat-messages.md](./chat-messages.md)
**Core:** [API_REFERENCE.md](../API_REFERENCE.md)


