# Риски и митигация

## Риски Matrix

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| AI модерация ложные срабатывания | Высокая | Среднее | Начать с консервативных thresholds, human review для спорных случаев |
| Масштабирование БД | Средняя | Высокое | Индексы, партиционирование, read replicas |
| GDPR нарушения | Низкая | Критическое | Регулярные аудиты, автоматизация retention |
| Payment fraud | Средняя | Среднее | Stripe Radar, rate limiting, trust score |
| Performance degradation | Средняя | Высокое | Мониторинг, оптимизация запросов, CDN |

## Детальная митигация

### 1. AI Модерация ложные срабатывания

**Проблема:** AI может неправильно классифицировать объявления (false positives/negatives)

**Митигация:**
- Начать с консервативных thresholds (score < 20: approve, score > 80: reject)
- Human review для всех случаев 20-80
- Регулярный анализ точности (A/B testing)
- Возможность пересмотра решений
- Обучение модели на исторических данных

**Мониторинг:**
- Трекинг false positive rate
- Отзывы модераторов на AI решения
- Регулярная калибровка thresholds

### 2. Масштабирование БД

**Проблема:** Рост данных может привести к деградации производительности

**Митигация:**
- Оптимизация индексов (GIN для full-text, составные индексы)
- Партиционирование больших таблиц (по датам)
- Read replicas для read-heavy операций
- Кэширование частых запросов (Redis)
- Архивация старых данных

**Мониторинг:**
- Query performance tracking
- Размеры таблиц
- Медленные запросы (pg_stat_statements)

### 3. GDPR нарушения

**Проблема:** Нарушение требований GDPR может привести к штрафам

**Митигация:**
- Регулярные compliance аудиты
- Автоматизация data retention
- DSAR процесс документирован и протестирован
- Consent management система
- Data minimization принципы

**Мониторинг:**
- Audit logs всех операций с данными
- Регулярные проверки retention политик
- Тестирование DSAR экспорта

### 4. Payment Fraud

**Проблема:** Мошеннические транзакции, chargebacks

**Митигация:**
- Stripe Radar для детекции fraud
- Rate limiting на checkout
- Trust score проверка перед checkout
- IP reputation проверка
- 3D Secure для крупных сумм

**Мониторинг:**
- Chargeback rate tracking
- Fraud detection метрики
- Анализ паттернов мошенничества

### 5. Performance Degradation

**Проблема:** Увеличение нагрузки приводит к медленным ответам

**Митигация:**
- CDN для статических ресурсов
- Кэширование API ответов
- Оптимизация database queries
- Code splitting и lazy loading
- Мониторинг Core Web Vitals

**Мониторинг:**
- Response time tracking
- Error rate monitoring
- Core Web Vitals (LCP, FID, CLS)
- Database query performance

## Контрольные точки

| Этап | Контрольная точка | Критерий |
|------|-------------------|----------|
| Pre-MVP | Security audit | Все RLS policies проверены |
| Pre-MVP | Performance test | Все страницы загружаются < 3s |
| Pre-M1 | AI accuracy review | False positive rate < 10% |
| Pre-M2 | Scalability test | Система выдерживает 10k concurrent users |
| Pre-Production | Full audit | Security, GDPR, Performance проверены |

## TODO for developers

1. **Настроить мониторинг рисков**
   - [ ] Трекинг метрик для каждого риска
   - [ ] Алерты при превышении thresholds
   - [ ] Регулярные отчеты

2. **Реализовать митигацию**
   - [ ] AI thresholds консервативные на старте
   - [ ] Database оптимизации (индексы, партиционирование)
   - [ ] GDPR автоматизация
   - [ ] Payment fraud detection
   - [ ] Performance оптимизации

3. **Провести тестирование**
   - [ ] Load testing
   - [ ] Security testing
   - [ ] GDPR compliance testing
   - [ ] Payment fraud testing

---

## 🔗 Related Docs

**Domains:** [devops.md](../domains/devops.md)
**Development:** [Production master](../MASTER_PRODUCTION_TZ.md) • [deep-audit-20251108.md](./deep-audit-20251108.md) • [security-compliance.md](./security-compliance.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)



