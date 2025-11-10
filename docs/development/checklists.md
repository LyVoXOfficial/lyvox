# Чек-листы и контрольные точки

## Pre-MVP Checklist

### Database

- [ ] База данных схема создана
- [ ] Все миграции применены
- [ ] RLS policies протестированы
- [ ] Индексы оптимизированы
- [ ] Triggers работают корректно

### Backend

- [ ] API endpoints реализованы
- [ ] Валидация через Zod
- [ ] Error handling централизован
- [ ] Rate limiting настроен
- [ ] Authentication проверяется везде

### Frontend

- [ ] Компоненты готовы
- [ ] Адаптивный дизайн (mobile/tablet/desktop)
- [ ] Локализация покрывает все страницы
- [ ] SEO базовая структура
- [ ] Accessibility проверка

### Testing

- [ ] Unit тесты (50%+ coverage)
- [ ] Integration тесты для критичных flows
- [ ] E2E тесты основных сценариев
- [ ] Security тесты (RLS, auth)
- [ ] Performance тесты

---

## Pre-M1 Checklist

### Deployment

- [ ] MVP запущен в production
- [ ] Мониторинг работает
- [ ] Error tracking настроен (Sentry)
- [ ] Backup стратегия реализована

### User Feedback

- [ ] Обратная связь от пользователей собрана
- [ ] Приоритизация функций для M1
- [ ] Bug fixes выполнены

### Infrastructure

- [ ] CI/CD настроен
- [ ] Environment variables настроены
- [ ] Secrets management

---

## Pre-M2 Checklist

### Stability

- [ ] M1 функции стабильны
- [ ] Нет критичных багов
- [ ] Performance приемлемый

### Scalability

- [ ] Масштабируемость проверена
- [ ] Database оптимизирована
- [ ] CDN настроен

### AI Integration

- [ ] AI интеграция протестирована
- [ ] Accuracy приемлемая
- [ ] Thresholds откалиброваны

### Compliance

- [ ] GDPR compliance проверки пройдены
- [ ] Security audit выполнен
- [ ] Data retention работает

---

## Pre-Production Checklist

### Features

- [ ] Все функции из roadmap реализованы
- [ ] Нет известных критичных багов
- [ ] Все зависимости обновлены

### Security

- [ ] Security audit пройден
- [ ] Penetration testing выполнен
- [ ] RLS review завершен
- [ ] Rate limiting проверен

### Performance

- [ ] Performance тесты пройдены
- [ ] Load testing завершен (10k+ concurrent users)
- [ ] Core Web Vitals в норме
- [ ] Database queries оптимизированы

### Documentation

- [ ] Документация полная
- [ ] API документация обновлена
- [ ] Deployment guide готов
- [ ] Runbook для операций

### Infrastructure

- [ ] Backup/DR готовы
- [ ] Мониторинг и алертинг настроены
- [ ] Logging централизован
- [ ] Disaster recovery план

---

## Testing Checklist

### Unit Tests

- [ ] API endpoints покрыты тестами
- [ ] Utility функции протестированы
- [ ] Database functions протестированы
- [ ] Coverage > 50%

### Integration Tests

- [ ] Full user flows протестированы:
  - [ ] Регистрация → Верификация → Публикация объявления
  - [ ] Поиск → Фильтры → Просмотр → Контакт
  - [ ] Модерация → Approve/Reject
- [ ] API интеграции работают

### E2E Tests

- [ ] Критичные сценарии покрыты:
  - [ ] Подача объявления
  - [ ] Поиск и фильтрация
  - [ ] Покупка boost
  - [ ] Чат сообщения
- [ ] Тестирование на разных браузерах

### Security Tests

- [ ] RLS policies протестированы
- [ ] Authentication проверена
- [ ] Rate limiting работает
- [ ] XSS/SQL injection защита

### Performance Tests

- [ ] Load testing (10k concurrent users)
- [ ] Stress testing
- [ ] Database query performance
- [ ] Core Web Vitals

### Accessibility Tests

- [ ] WCAG 2.1 AA compliance
- [ ] Screen reader testing
- [ ] Keyboard navigation
- [ ] Color contrast

---

## Deployment Checklist

### Pre-Deployment

- [ ] Все тесты пройдены
- [ ] Code review завершен
- [ ] Документация обновлена
- [ ] Changelog готов

### Deployment

- [ ] Database migrations применены
- [ ] Environment variables обновлены
- [ ] Build успешен
- [ ] Smoke tests пройдены

### Post-Deployment

- [ ] Мониторинг показывает нормальные метрики
- [ ] Нет критичных ошибок в логах
- [ ] Основные функции работают
- [ ] Rollback план готов (если нужно)

---

## TODO for developers

1. **Создать чек-листы для команды**
   - [ ] Разбить по ролям (Backend/Frontend/QA/DevOps)
   - [ ] Создать шаблоны для каждого этапа
   - [ ] Интегрировать в workflow (GitHub Actions или аналоги)

2. **Настроить автоматизацию проверок**
   - [ ] CI/CD проверки (tests, lint, build)
   - [ ] Автоматические security сканы
   - [ ] Performance regression тесты

3. **Документировать процедуры**
   - [ ] Deployment процедура
   - [ ] Rollback процедура
   - [ ] Incident response процедура

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [search-filters.md](./search-filters.md)
**Catalog:** [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md) • [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [categories/real-estate.md](../catalog/categories/real-estate.md)




