# Профиль пользователя

## Current State

| Компонент | Статус |
|-----------|---------|
| Базовая страница профиля | `apps/web/src/app/(protected)/profile/page.tsx` |
| Trust score display | Реализован |
| Phone verification | Работает |

## MVP Enhancements

### Два типа профилей

| Тип | URL | Доступ | Отображаемые поля |
|-----|-----|--------|------------------|
| Публичный | `/user/[id]` | Все | display_name, trust_score, верификации, статистика |
| Личный кабинет | `/profile` | Владелец | Все поля + управление |

### Sections личного кабинета

| Секция | Путь | Описание |
|--------|------|----------|
| Overview | `/profile` | Avatar, display_name, trust_score, верификации |
| Мои объявления | `/profile/adverts` | Список с фильтрами (active/draft/archived) |
| Избранное | `/profile/favorites` | Сохраненные объявления |
| Сообщения | `/profile/messages` | Чат (см. `chat-messages.md`) |
| Настройки | `/profile/settings` | Email, phone, consents, notifications, язык |
| Покупки | `/profile/billing` | История покупок (см. `billing-subscriptions.md`) |
| Безопасность | `/profile/security` | Смена пароля, активные сессии |

## Database Schema

```sql
CREATE TABLE public.favorites (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  advert_id uuid REFERENCES public.adverts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, advert_id)
);

CREATE INDEX idx_favorites_user ON public.favorites(user_id, created_at DESC);
```

## API Endpoints

| Endpoint | Метод | Описание | Auth |
|----------|-------|----------|------|
| `/api/profile` | GET | Текущий профиль | Required |
| `/api/profile` | PATCH | Обновление display_name, avatar | Required |
| `/api/user/[id]/public` | GET | Публичный профиль | Optional |
| `/api/favorites` | GET | Список избранного | Required |
| `/api/favorites` | POST | Добавить в избранное | Required |
| `/api/favorites/[advertId]` | DELETE | Удалить из избранного | Required |

**Response `/api/user/[id]/public`:**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "display_name": "John Doe",
    "trust_score": 85,
    "verified_email": true,
    "verified_phone": true,
    "created_at": "2025-01-01T00:00:00Z",
    "adverts_count": 12,
    "reviews_count": 5,
    "reviews_avg": 4.5
  }
}
```

## Profile Overview

**Отображаемые элементы:**
- Avatar (опционально, загрузка через `/api/profile/avatar`)
- Display name
- Trust score badge с пояснением
- Верификации: Email ✓, Phone ✓, Itsme ✓ (Post-MVP)
- Дата регистрации
- Статистика: количество объявлений, отзывов

## My Adverts Section

**Фильтры:**
- Status: active / draft / archived
- Дата создания (сортировка)
- Категория

**Quick actions:**
- Edit: переход на `/post?edit=[id]`
- Delete: модалка подтверждения → API call
- Duplicate: создание копии draft

**API:**
```typescript
GET /api/profile/adverts?status=active&page=1
// Возвращает список объявлений пользователя с пагинацией
```

## Favorites Section

**Функциональность:**
- Список избранных объявлений
- Удаление из избранного
- Отображение статуса объявления (active/archived)

**Синхронизация:**
- Использовать таблицу `favorites` (не localStorage)
- RLS для приватности

## Settings Section

**Настройки:**
- Email: отображение, изменение через Supabase
- Phone: отображение, верификация (см. `verification.md`)
- Consents: marketing opt-in/out (см. `../domains/consents.md`)
- Notification preferences: email/push/in-app (см. `notifications.md`)
- Interface language: выбор локали (NL/FR/EN/RU)

## Security Section

**Функции:**
- Смена пароля (через Supabase Auth)
- 2FA (future, Post-MVP)
- Активные сессии: список устройств, logout из всех

## Чек-лист MVP

- [ ] Публичный профиль с RLS (только публичные поля)
- [ ] Личный кабинет с полным доступом
- [ ] Список объявлений с фильтрами и пагинацией
- [ ] Избранное: добавление/удаление, список
- [ ] Настройки: consents, уведомления, язык
- [ ] Trust score с пояснением (что дает высокий score)
- [ ] Avatar upload функциональность

## TODO for developers

1. **Создать публичный профиль `/user/[id]`**
   - [ ] SSR страница с загрузкой публичных данных
   - [ ] RLS проверка (только публичные поля)
   - [ ] Отображение статистики и верификаций
   - [ ] SEO metadata (если публичный профиль индексируется)

2. **Расширить личный кабинет**
   - [ ] Вкладки для разных разделов
   - [ ] Dashboard с метриками (количество объявлений, просмотры)
   - [ ] Навигация между разделами

3. **Реализовать My Adverts секцию**
   - [ ] Фильтры по статусу
   - [ ] Пагинация
   - [ ] Quick actions (edit/delete/duplicate)
   - [ ] Empty state когда нет объявлений

4. **Реализовать Favorites**
   - [ ] Миграция для таблицы `favorites`
   - [ ] API endpoints (GET, POST, DELETE)
   - [ ] RLS policies
   - [ ] UI для добавления/удаления
   - [ ] Список избранных объявлений

5. **Создать Settings страницу**
   - [ ] Форма изменения display_name
   - [ ] Avatar upload (через Supabase Storage)
   - [ ] Consents management
   - [ ] Notification preferences
   - [ ] Language switcher

6. **Создать Security страницу**
   - [ ] Форма смены пароля
   - [ ] Список активных сессий (через Supabase Auth)
   - [ ] Logout из всех устройств

7. **Добавить пояснение Trust Score**
   - [ ] Tooltip или модалка с объяснением
   - [ ] Как повысить trust score
   - [ ] Что дает высокий score

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [database-schema.md](./database-schema.md) • [deep-audit-20251108.md](./deep-audit-20251108.md) • [user-dashboard.md](./user-dashboard.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)




