> [!IMPORTANT]
> Этот каталог содержит подчинённые implementation guides. Единственная актуальная очередь задач и release-gates: [`docs/MASTER_PRODUCTION_TZ.md`](../MASTER_PRODUCTION_TZ.md).

# LyVoX Development Documentation

Документационный фреймворк уровня production для разработки маркетплейса LyVoX.

## Структура документации

### Функциональные зоны продукта

- [Главная страница и навигация](./homepage-navigation.md)
- [Поиск и фильтры](./search-filters.md)
- [Категории (Full Taxonomy)](./categories.md)
- [Подача объявления](./ad-posting.md)
- [Страница просмотра объявления](./ad-view.md)
- [Профиль пользователя](./user-profile.md)
- [Верификация аккаунта](./verification.md)
- [Чат / Сообщения](./chat-messages.md)
- [Платежи, подписки, бустинг](./billing-subscriptions.md)
- [Модерация (AI + человек)](./moderation-ai.md)

### Инфраструктура и безопасность

- [Безопасность + Анти-фрод + RLS + GDPR](./security-compliance.md)
- [Панель пользователя (личный кабинет)](./user-dashboard.md)
- [Панель администратора](./admin-panel.md)
- [Уведомления (Email, Push, SMS)](./notifications.md)

### Технические аспекты

- [API архитектура](./api-architecture.md)
- [Supabase структура таблиц](./database-schema.md)
- [Бэкенд-логика](./backend-logic.md)
- [UI-гайды](./ui-guides.md)
- [Мобильная версия / Адаптив](./mobile-responsive.md)

### Локализация и SEO

- [SEO / Sitemap / OpenGraph](./seo-metadata.md) (см. также `../domains/seo.md`)
- [Локализация (NL/FR/EN/RU)](./i18n.md) (см. также `../domains/i18n.md`)

### Планирование

- [Production master](../MASTER_PRODUCTION_TZ.md)
- [Риски и митигация](./risks-mitigation.md)

## Использование

Каждый документ содержит:

- Конкретные технические детали (файлы, таблицы, API endpoints)
- Подчинённые implementation notes и исторические acceptance-кандидаты
- Таблицы где это полезно

Локальные TODO/checklist внутри guides не создают очередь: задача исполняется только при прямой привязке из Production master.

## Связь с другими документами

Эта документация дополняет:

- `../requirements.md` - общие требования
- `../ARCHITECTURE.md` - архитектурные решения
- `../API_REFERENCE.md` - справочник API
- `../domains/*.md` - доменные документы

## 🔗 Related Docs

**Development references:** [Production master](../MASTER_PRODUCTION_TZ.md) • [deep-audit-20251108.md](./deep-audit-20251108.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md) • [categories/real-estate.md](../catalog/categories/real-estate.md)
