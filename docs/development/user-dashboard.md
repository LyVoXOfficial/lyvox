# Панель пользователя (личный кабинет)

## Overview

Личный кабинет пользователя с разделами для управления объявлениями, настройками и активностью.

## Sections

| Секция | Путь | Описание |
|--------|------|----------|
| Dashboard | `/profile` | Обзор статистики |
| Мои объявления | `/profile/adverts` | Управление объявлениями |
| Избранное | `/profile/favorites` | Сохраненные объявления |
| Сообщения | `/profile/messages` | Чат диалоги |
| Настройки | `/profile/settings` | Профиль, consents, уведомления |
| Покупки | `/profile/billing` | История покупок |
| Безопасность | `/profile/security` | Пароль, сессии |

## Dashboard

**Метрики:**
- Количество активных объявлений
- Количество просмотров (future: analytics)
- Количество контактов (запросов телефона)
- Trust score и пояснение
- Статус верификаций

**Компоненты:**
- `apps/web/src/app/(protected)/profile/dashboard/page.tsx`
- `apps/web/src/components/profile/DashboardStats.tsx`
- `apps/web/src/components/profile/VerificationStatus.tsx`

## Мои объявления

**Фильтры:**
- Status: active / draft / archived
- Категория
- Дата создания

**Действия:**
- Edit: `/post?edit=[id]`
- Delete: модалка подтверждения
- Duplicate: создание копии draft
- Activate/Archive: переключение статуса

**Компоненты:**
- `apps/web/src/app/(protected)/profile/adverts/page.tsx`
- `apps/web/src/components/profile/AdvertList.tsx`
- `apps/web/src/components/profile/AdvertActions.tsx`

## Избранное

**Функциональность:**
- Список избранных объявлений
- Удаление из избранного
- Отображение статуса (active/archived)

**Компоненты:**
- `apps/web/src/app/(protected)/profile/favorites/page.tsx`
- `apps/web/src/components/profile/FavoritesList.tsx`

## Сообщения

**Перенаправление на:**
- `/profile/messages` → `/chat` (см. `chat-messages.md`)

## Настройки

**Подразделы:**
- Profile: display_name, avatar
- Consents: marketing opt-in/out
- Notifications: preferences для email/push
- Language: интерфейс (NL/FR/EN/RU)

**Компоненты:**
- `apps/web/src/app/(protected)/profile/settings/page.tsx`
- `apps/web/src/components/profile/SettingsForm.tsx`

## Покупки

**Отображаемые данные:**
- История purchases
- Активные benefits
- Invoices (если доступно)

**Компоненты:**
- `apps/web/src/app/(protected)/profile/billing/page.tsx` (см. `billing-subscriptions.md`)

## Безопасность

**Функции:**
- Смена пароля
- Активные сессии (devices)
- Logout из всех устройств

**Компоненты:**
- `apps/web/src/app/(protected)/profile/security/page.tsx`

## Чек-лист MVP

- [ ] Dashboard с метриками
- [ ] Все разделы личного кабинета
- [ ] Responsive design (mobile-friendly)
- [ ] Навигация между разделами
- [ ] Уведомления центр (in-app)

## TODO for developers

1. **Создать Dashboard страницу**
   - [ ] Загрузка статистики через API
   - [ ] Отображение метрик (карточки)
   - [ ] Trust score с пояснением
   - [ ] Quick actions (разместить объявление, проверить сообщения)

2. **Реализовать страницу Мои объявления**
   - [ ] Фильтры по статусу и категории
   - [ ] Пагинация
   - [ ] Quick actions (edit/delete/duplicate)
   - [ ] Empty states

3. **Реализовать страницу Избранное**
   - [ ] Загрузка избранных объявлений
   - [ ] Удаление из избранного
   - [ ] Отображение статуса объявления

4. **Создать страницу Настройки**
   - [ ] Форма изменения display_name
   - [ ] Avatar upload
   - [ ] Consents management UI
   - [ ] Notification preferences
   - [ ] Language switcher

5. **Создать страницу Безопасность**
   - [ ] Форма смены пароля
   - [ ] Список активных сессий (через Supabase Auth)
   - [ ] Logout из всех устройств

6. **Добавить навигацию**
   - [ ] Sidebar или tabs для навигации между разделами
   - [ ] Active state индикация
   - [ ] Mobile-friendly (drawer или bottom nav)

7. **Реализовать in-app уведомления**
   - [ ] Центр уведомлений (dropdown или отдельная страница)
   - [ ] Отметка прочитанными
   - [ ] Badge с количеством непрочитанных

---

## 🔗 Related Docs

**Development:** [user-profile.md](./user-profile.md) • [Production master](../MASTER_PRODUCTION_TZ.md) • [deep-audit-20251108.md](./deep-audit-20251108.md) • [database-schema.md](./database-schema.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)



