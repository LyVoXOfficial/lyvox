# Панель администратора

## Current State

| Компонент | Статус |
|-----------|--------|
| Модерация жалоб | `/admin/reports` - реализовано |

## Full Admin Panel Sections

| Секция | Путь | Описание |
|--------|------|----------|
| Dashboard | `/admin` | Статистика платформы |
| Moderation Queue | `/admin/moderation` | Очередь модерации (AI-scored + reports) |
| Users | `/admin/users` | Управление пользователями |
| Adverts | `/admin/adverts` | Управление объявлениями |
| Reports | `/admin/reports` | Список жалоб (current) |
| Analytics | `/admin/analytics` | Графики и метрики |
| Settings | `/admin/settings` | Настройки платформы |

## Dashboard

**Метрики:**
- DAU (Daily Active Users)
- Количество объявлений (всего, активных, за сегодня)
- Транзакции (объем, количество)
- Жалобы (pending, за сегодня)
- Trust score распределение

**Компоненты:**
- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/components/admin/StatsCards.tsx`
- `apps/web/src/components/admin/MetricsChart.tsx`

## Moderation Queue

**Фильтры:**
- Status: pending / auto_approved / auto_rejected
- AI Score: диапазон
- Дата создания
- Категория

**Действия:**
- Approve: одобрить объявление
- Reject: отклонить с причиной
- Bulk actions: массовое одобрение/отклонение

**Компоненты:**
- `apps/web/src/app/admin/moderation/page.tsx`
- `apps/web/src/components/admin/ModerationQueue.tsx`
- `apps/web/src/components/admin/AdvertReviewCard.tsx`

## Users Management

**Функции:**
- Поиск пользователей (по email, display_name)
- Фильтры: trust_score, верификации, flags
- Действия:
  - Блокировка/разблокировка
  - Изменение trust_score
  - Просмотр профиля
  - Просмотр объявлений пользователя

**API:**
- `GET /api/admin/users?search=...&filter=...`
- `POST /api/admin/users/[id]/block`
- `POST /api/admin/users/[id]/trust`

**Компоненты:**
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/components/admin/UsersList.tsx`
- `apps/web/src/components/admin/UserActions.tsx`

## Adverts Management

**Функции:**
- Поиск объявлений
- Фильтры: статус, категория, дата, продавец
- Массовые действия:
  - Удаление
  - Блокировка
  - Изменение категории

**Компоненты:**
- `apps/web/src/app/admin/adverts/page.tsx`
- `apps/web/src/components/admin/AdvertsList.tsx`

## Analytics

**Графики:**
- Регистрации пользователей (по дням/неделям)
- Публикации объявлений (по дням/категориям)
- Конверсии (просмотры → контакты)
- Trust score distribution

**Библиотека:**
- Recharts или Chart.js

**Компоненты:**
- `apps/web/src/app/admin/analytics/page.tsx`
- `apps/web/src/components/admin/AnalyticsChart.tsx`

## Settings

**Настройки:**
- Категории: управление, добавление, редактирование
- Products: управление платными продуктами
- AI модерация thresholds: пороги auto-approve/reject
- Fraud rules: управление правилами

**Компоненты:**
- `apps/web/src/app/admin/settings/page.tsx`

## Access Control

**Проверка роли:**
- Middleware: `apps/web/src/middleware.ts` проверяет `is_admin()` перед `/admin/**`
- API endpoints: проверка в каждом handler

**Middleware example:**
```typescript
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !isAdmin(user)) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
}
```

## API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/admin/stats` | GET | Агрегированная статистика |
| `/api/admin/users` | GET | Список пользователей |
| `/api/admin/users/[id]/block` | POST | Блокировка пользователя |
| `/api/admin/users/[id]/trust` | POST | Изменение trust score |
| `/api/admin/analytics` | GET | Аналитика с графиками |
| `/api/moderation/queue` | GET | Очередь модерации |

## Чек-лист MVP

- [ ] Dashboard с реальной статистикой
- [ ] Модерация объявлений (approve/reject/bulk actions)
- [ ] Управление пользователями
- [ ] Analytics с графиками (Chart.js или Recharts)
- [ ] Bulk operations (массовое удаление, блокировка)
- [ ] Audit log всех admin действий

## TODO for developers

1. **Создать Dashboard**
   - [ ] API endpoint `/api/admin/stats`
   - [ ] Загрузка метрик (DAU, объявления, транзакции)
   - [ ] Отображение в карточках
   - [ ] Графики трендов (future)

2. **Расширить Moderation Queue**
   - [ ] Интеграция с AI scoring (см. `moderation-ai.md`)
   - [ ] Фильтры по AI score
   - [ ] Bulk actions для массовой модерации

3. **Создать Users Management**
   - [ ] API endpoint `/api/admin/users` с поиском и фильтрами
   - [ ] Страница со списком пользователей
   - [ ] Действия: блокировка, trust score adjustment
   - [ ] Детальный просмотр пользователя

4. **Создать Adverts Management**
   - [ ] Поиск и фильтры
   - [ ] Массовые действия
   - [ ] Детальный просмотр объявления

5. **Создать Analytics**
   - [ ] API endpoint `/api/admin/analytics`
   - [ ] Графики (регистрации, публикации, конверсии)
   - [ ] Интеграция Chart.js или Recharts

6. **Создать Settings**
   - [ ] Управление категориями (future)
   - [ ] Управление products
   - [ ] Настройка AI thresholds
   - [ ] Управление fraud rules

7. **Улучшить Access Control**
   - [ ] Middleware проверка для всех `/admin/**` routes
   - [ ] Проверка в каждом API endpoint
   - [ ] 403 error handling

8. **Добавить Audit Logging**
   - [ ] Логирование всех admin действий в `logs`
   - [ ] Отображение истории действий
   - [ ] Фильтры по действию, пользователю, дате

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [moderation-ai.md](./moderation-ai.md) • [deep-audit-20251108.md](./deep-audit-20251108.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [FINAL_COMPLETION_REPORT.md](../catalog/FINAL_COMPLETION_REPORT.md)




