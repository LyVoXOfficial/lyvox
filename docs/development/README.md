> [!CAUTION]
> **Исторический индекс development-документации. Не начинать работу с `MASTER_CHECKLIST.md` и не обновлять прогресс по описанному ниже workflow.** Единственная актуальная очередь задач и release-gates: [`docs/MASTER_PRODUCTION_TZ.md`](../MASTER_PRODUCTION_TZ.md).

# LyVoX Development Documentation

Документационный фреймворк уровня production для разработки маркетплейса LyVoX.

## Исторический checklist (retired)

**[📋 MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)** — архив; **не начинайте работу отсюда**.

Сводный файл со всеми задачами, организованными по приоритетам и зависимостям:

- 🔴 Сверху: что делать **прямо сейчас** (основа, не зависит ни от чего)
- ⚪ Внизу: задачи на будущее (зависят от вышестоящих)
- Минимизирует переделку кода за счет правильного порядка выполнения

Каждая задача имеет уникальный ID (например, `DB-001`, `UI-015`) для отслеживания прогресса.

---

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

- [Roadmap: MVP → M1 → M2 → Production](./roadmap.md)
- [Риски и митигация](./risks-mitigation.md)
- [Чек-листы и контрольные точки](./checklists.md)

## Использование

Каждый документ содержит:

- Конкретные технические детали (файлы, таблицы, API endpoints)
- Чек-листы для реализации
- Секцию "TODO for developers" с конкретными задачами
- Таблицы где это полезно

## Связь с другими документами

Эта документация дополняет:

- `../PROMPT_MAIN.md` — исторический AI-prompt (retired; не использовать для выбора задач или обновления прогресса)
- `../requirements.md` - общие требования
- `../ARCHITECTURE.md` - архитектурные решения
- `../API_REFERENCE.md` - справочник API
- `../domains/*.md` - доменные документы

### Retired progress automation

> [!CAUTION]
> Не запускать `pnpm run checklist:update`, не менять галочки в `MASTER_CHECKLIST.md` и не использовать автоматизацию из `PROMPT_MAIN.md`. Этот контур обновляет архивный tracker. Статус меняется только по правилам актуального [`docs/MASTER_PRODUCTION_TZ.md`](../MASTER_PRODUCTION_TZ.md).

## Структура файлов

Всего создано **23 документа**:

- 10 файлов по функциональным зонам продукта
- 4 файла по инфраструктуре и безопасности
- 6 файлов по техническим аспектам
- 3 файла по планированию

Каждый документ содержит конкретные детали реализации, чек-листы и секцию "TODO for developers" с задачами для команды.

---

## 🔗 Related Docs

**Historical development references:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [deep-audit-20251108.md](./deep-audit-20251108.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md) • [categories/real-estate.md](../catalog/categories/real-estate.md)
