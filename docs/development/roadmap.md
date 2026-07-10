> [!WARNING]
> **Архивный roadmap. Сроки, фазы и статусы ниже не исполнять и не обновлять.** Единственный актуальный план выхода в production: [`docs/MASTER_PRODUCTION_TZ.md`](../MASTER_PRODUCTION_TZ.md). Файл сохранён как история.

# Roadmap: MVP → M1 → M2 → Production

## MVP (Минимально жизнеспособный продукт)

**Цель:** Запуск платформы с базовой функциональностью

**Срок:** 8-10 недель

### Включено

| Зона | Функции |
|------|---------|
| Главная страница | Hero, категории, лента объявлений |
| Поиск | Full-text search, базовые фильтры |
| Категории | 3 уровня, локализация |
| Подача объявления | 8 шагов (для всех категорий) |
| Просмотр объявления | Галерея, детали, продавец |
| Профиль | Публичный + личный кабинет |
| Верификация | Email + Phone |
| Модерация | Базовая (человек, без AI) |
| Безопасность | RLS, rate limiting |
| Адаптив | Mobile/tablet/desktop |
| SEO | Базовая структура |
| Локализация | NL/FR/EN/RU |

### Исключено

- Чат
- Платежи
- AI модерация
- Itsme интеграция
- Push уведомления
- Advanced аналитика

### Критерии готовности

- [ ] Все критичные функции работают
- [ ] Тесты покрывают 50%+ кода
- [ ] Документация основная
- [ ] Мониторинг базовый
- [ ] GDPR базовое соответствие

---

## M1 (Месяц 1 после MVP)

**Цель:** Улучшение пользовательского опыта и монетизация

**Срок:** 4-6 недель

### Добавлено

| Зона | Функции |
|------|---------|
| Чат | Realtime сообщения |
| Платежи | Stripe/Mollie, бустинг |
| Уведомления | Email + Push + In-app |
| Избранное | Сохранение объявлений |
| Поиск | Сохраненные поиски |
| Модерация | AI pre-scoring |

### Критерии готовности

- [ ] Чат работает стабильно
- [ ] Платежи обрабатываются корректно
- [ ] Уведомления доставляются
- [ ] AI scoring показывает приемлемую точность

---

## M2 (Месяц 2 после MVP)

**Цель:** Масштабирование и автоматизация

**Срок:** 4-6 недель

### Добавлено

| Зона | Функции |
|------|---------|
| AI модерация | Полная автоматизация |
| Itsme | OAuth интеграция |
| KBO/BCE | Проверка для бизнеса |
| Аналитика | Расширенная админ панель |
| Fraud detection | Автоматизация |
| PWA | Service worker, offline |

### Критерии готовности

- [ ] AI модерация автоматизирована (80%+ случаев)
- [ ] Itsme интеграция работает
- [ ] Fraud detection снижает мошенничество
- [ ] PWA функционален

---

## Production (Готовность к масштабированию)

**Цель:** Полнофункциональная платформа

**Срок:** 2-4 недели (финализация)

### Добавлено

- Все функции из MVP + M1 + M2
- Performance оптимизация
- Мониторинг и алертинг (Sentry, LogRocket)
- Load testing и оптимизация
- Backup стратегия
- Disaster recovery план

### Критерии готовности

- [ ] Все функции работают стабильно
- [ ] Тесты покрывают 70%+ кода
- [ ] Документация полная
- [ ] Мониторинг настроен
- [ ] GDPR compliance проверен
- [ ] Load testing пройден
- [ ] Backup/DR готовы

## Gantt Plan

### Phase 1: MVP (Weeks 1-10)

| Недели | Задачи |
|--------|--------|
| 1-2 | Database schema, migrations, RLS |
| 3-4 | Core API endpoints (adverts, profiles, search) |
| 5-6 | Frontend core pages (home, search, advert, profile) |
| 7-8 | Forms (posting, settings), media upload |
| 9 | Moderation, reports, admin panel basics |
| 10 | Testing, bug fixes, deployment prep |

### Phase 2: M1 (Weeks 11-16)

| Недели | Задачи |
|--------|--------|
| 11-12 | Chat implementation (DB, API, UI) |
| 13 | Payments integration (Stripe/Mollie) |
| 14 | Notifications (email, push, in-app) |
| 15 | Favorites, saved searches |
| 16 | AI pre-moderation scoring |

### Phase 3: M2 (Weeks 17-22)

| Недели | Задачи |
|--------|--------|
| 17-18 | Full AI moderation, fraud detection |
| 19 | Itsme integration, KBO/BCE checks |
| 20 | Advanced analytics, admin enhancements |
| 21 | PWA, performance optimization |
| 22 | Testing, refinements |

### Phase 4: Production (Weeks 23-26)

| Недели | Задачи |
|--------|--------|
| 23 | Security audit, compliance checks |
| 24 | Load testing, performance tuning |
| 25 | Documentation finalization |
| 26 | Launch preparation, monitoring setup |

## TODO for developers

1. **Создать детальный план для MVP**
   - [ ] Разбить на задачи по неделям
   - [ ] Назначить ответственных
   - [ ] Определить зависимости

2. **Настроить tracking прогресса**
   - [ ] Issue tracker (GitHub Issues или Jira)
   - [ ] Чек-листы для каждой фазы
   - [ ] Регулярные review встречи

3. **Подготовить к запуску MVP**
   - [ ] Финальное тестирование
   - [ ] Performance проверка
   - [ ] Security audit
   - [ ] Documentation review

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [deep-audit-20251108.md](./deep-audit-20251108.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [FINAL_COMPLETION_REPORT.md](../catalog/FINAL_COMPLETION_REPORT.md) • [IMPLEMENTATION_SUMMARY.md](../catalog/IMPLEMENTATION_SUMMARY.md)



