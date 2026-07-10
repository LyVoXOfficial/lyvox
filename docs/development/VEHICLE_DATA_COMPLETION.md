# Руководство: Завершение данных каталога транспорта

Это руководство описывает процесс заполнения всех недостающих данных в каталоге транспорта (insights, оценки, переводы).

## Предварительные требования

### Переменные окружения

```bash
DATABASE_URL="REVOKED_REPLACE_ME"
GOOGLE_API_KEY="REVOKED_REPLACE_ME"
```

### Зависимости

```bash
pnpm install pg csv-parse dotenv -w
```

## Быстрый старт

### Полный процесс (все шаги)

```bash
export DATABASE_URL="REVOKED_REPLACE_ME"
export GOOGLE_API_KEY="REVOKED_REPLACE_ME"
node scripts/complete-vehicle-catalog.mjs
```

### Dry-run режим (без изменений в БД)

```bash
export DATABASE_URL="REVOKED_REPLACE_ME"
export DRY_RUN=true
node scripts/complete-vehicle-catalog.mjs
```

## Пошаговое выполнение

### Шаг 1: Аудит покрытия данных

Запуск аудита для анализа текущего состояния:

```bash
node scripts/audit-full-coverage.mjs
```

**Выходной файл:** `audit-report.json`

**Что проверяется:**

- Модели без insights
- Пустые массивы в insights (pros, cons, inspection_tips, и т.д.)
- Модели без reliability/popularity scores
- Модели без переводов
- Дубликаты моделей

**Время выполнения:** ~30-60 секунд

---

### Шаг 2: Заполнение недостающих insights

Генерация insights для моделей, у которых их нет:

```bash
export BATCH_SIZE=10  # Количество моделей в батче
node scripts/fill-missing-insights.mjs
```

**Что заполняется:**

- `pros` (преимущества)
- `cons` (недостатки)
- `inspection_tips` (советы при осмотре)
- `notable_features` (примечательные особенности)
- `engine_examples` (примеры двигателей)
- `common_issues_by_engine` (частые проблемы по двигателям)
- `reliability_score` (оценка надёжности 0-10)
- `popularity_score` (оценка популярности 0-10)
- `generations` (поколения)

**Зависимости:**

- Требуется `audit-report.json` (запустите Шаг 1)
- Требуется `GOOGLE_API_KEY`

**Лимиты AI:**

- Используется Google Gemini API
- Rate limit: ~60 запросов/минуту
- Батчи обрабатываются с задержкой 2 секунды

**Время выполнения:**

- ~2-3 минуты на 10 моделей
- Для 93 моделей: ~20-30 минут

**DRY_RUN режим:**

```bash
export DRY_RUN=true
node scripts/fill-missing-insights.mjs
```

---

### Шаг 3: Заполнение reliability/popularity scores

Проставление оценок для моделей, у которых они null:

```bash
export BATCH_SIZE=20  # Скорее всего, будет обрабатываться меньше
node scripts/fill-model-scores.mjs
```

**Что заполняется:**

- `reliability_score` (0-10)
- `popularity_score` (0-10)

**Факторы оценки:**

- Reliability: качество сборки, частота проблем, стоимость ремонта, долговечность
- Popularity: объём продаж, присутствие на рынке, узнаваемость бренда

**Зависимости:**

- Требуется `GOOGLE_API_KEY`

**Время выполнения:**

- ~1-2 минуты на 20 моделей
- Для 811 моделей: ~40-80 минут

**DRY_RUN режим:**

```bash
export DRY_RUN=true
node scripts/fill-model-scores.mjs
```

---

### Шаг 4: Заполнение пустых массивов

Обновление существующих insights, у которых есть пустые массивы:

```bash
node scripts/backfill-insight-arrays.mjs
```

**Что заполняется:**

- Пустые `pros`, `cons`, `inspection_tips`, и т.д.

**Зависимости:**

- Требуется `audit-report.json` (запустите Шаг 1)
- Требуется `GOOGLE_API_KEY`

**Время выполнения:**

- Зависит от количества моделей с пустыми массивами
- ~1.5 секунды на модель

**DRY_RUN режим:**

```bash
export DRY_RUN=true
node scripts/backfill-insight-arrays.mjs
```

---

### Шаг 5: Обновление переводов

Генерация переводов для новых моделей:

```bash
node scripts/update-i18n.mjs
```

**Что обновляется:**

- `vehicle_make_i18n` (переводы марок)
- `vehicle_model_i18n` (переводы моделей)
- `vehicle_generation_i18n` (переводы поколений)

**Языки:** DE, EN, FR, NL, RU

**Зависимости:**

- Требуется `vehicle_i18n_normalize.mjs`
- Требуется `vehicle_i18n_expand.mjs`

**Время выполнения:** ~5-10 минут

---

### Шаг 6: Слияние дубликатов

Объединение дублирующихся моделей:

```bash
node scripts/merge-duplicate-models.mjs
```

**Что происходит:**

- Находит дубликаты по нормализованным именам
- Выбирает канонический вариант
- Переносит generations, insights, i18n
- Удаляет дублирующиеся записи

**Время выполнения:** ~1-3 минуты

**DRY_RUN режим:**

```bash
export DRY_RUN=true
node scripts/merge-duplicate-models.mjs
```

---

### Шаг 7: Обновление агрегатных полей

Пересчёт `years_available`, `body_types_available`, и т.д. для всех моделей:

```bash
node scripts/update-model-aggregates.mjs
```

**Что обновляется:**

- `years_available` (список всех годов)
- `first_model_year` / `last_model_year`
- `body_types_available`
- `fuel_types_available`
- `transmission_available`

**Источник:** Агрегация данных из `vehicle_generations`

**Время выполнения:** ~2-5 минут

**DRY_RUN режим:**

```bash
node scripts/update-model-aggregates.mjs --dry-run
# или
export DRY_RUN=true
node scripts/update-model-aggregates.mjs
```

---

### Шаг 8: Финальный аудит

Повторный запуск аудита для проверки результатов:

```bash
node scripts/audit-full-coverage.mjs
```

**Проверяет:** Те же метрики, что и в Шаге 1

**Ожидаемый результат:**

- 0 моделей без insights
- 0 моделей без оценок
- 0 пустых массивов в insights
- Минимальное количество дубликатов
- Все модели имеют переводы на 5 языков

---

## Финальный отчёт

После завершения процесса генерируется финальный отчёт:

**Путь:** `docs/development/VEHICLE_SYNC_FINAL_REPORT.md`

Отчёт содержит:

- Сводную статистику (марки, модели, поколения, инсайты)
- Список оставшихся проблем
- Покрытие переводов по языкам

---

## Управление процессом

### Пропуск отдельных шагов

```bash
export SKIP_AUDIT=true        # Пропустить аудит
export SKIP_INSIGHTS=true     # Пропустить заполнение insights
export SKIP_SCORES=true       # Пропустить оценки
export SKIP_ARRAYS=true       # Пропустить пустые массивы
export SKIP_I18N=true         # Пропустить переводы
export SKIP_MERGE=true        # Пропустить слияние дубликатов
export SKIP_AGGREGATES=true   # Пропустить агрегаты

node scripts/complete-vehicle-catalog.mjs
```

### Настройка размера батчей

```bash
export BATCH_SIZE=5   # Меньше = медленнее, но безопаснее
export BATCH_SIZE=20  # Больше = быстрее, но выше риск ошибок
```

---

## Устранение неполадок

### Ошибка: "All Google AI models failed"

**Причина:** API ключ неверный или исчерпан лимит запросов

**Решение:**

- Проверьте `GOOGLE_API_KEY`
- Подождите 1-2 минуты и повторите
- Уменьшите `BATCH_SIZE`

### Ошибка: "Column does not exist"

**Причина:** Устаревшая схема базы данных

**Решение:**

- Убедитесь, что применены все миграции
- Проверьте структуру таблиц в Supabase

### Ошибка: "Cannot find package 'csv-parse'"

**Причина:** Не установлены зависимости

**Решение:**

```bash
pnpm install csv-parse pg dotenv -w
```

### Ошибка: "Database connection timeout"

**Причина:** Проблемы с сетью или неверный DATABASE_URL

**Решение:**

- Используйте Session Pooler connection string (IPv4 compatible)
- Проверьте доступность базы данных

---

## Рекомендации

1. **Начните с Dry-run:** Всегда сначала запускайте с `DRY_RUN=true`, чтобы увидеть, что будет изменено
2. **Мониторинг:** Следите за выводом в консоли, особенно за ошибками AI
3. **Логи:** Перенаправьте вывод в файл для анализа:
   ```bash
   node scripts/complete-vehicle-catalog.mjs 2>&1 | tee completion.log
   ```
4. **Резервная копия:** Перед запуском сделайте бэкап БД в Supabase
5. **Постепенный подход:** Если есть сомнения, запускайте шаги по отдельности
6. **Rate limits:** Если получаете 429 ошибки, увеличьте задержки между запросами в скриптах

---

## Контрольные проверки

После завершения процесса проверьте:

1. **Insights:**

   ```bash
   node scripts/check-insight-coverage.mjs
   ```

2. **Переводы:**

   ```bash
   node scripts/check-i18n-counts.mjs
   ```

3. **Дубликаты:**

   ```bash
   node scripts/find-duplicate-models.mjs
   ```

4. **Агрегаты:**
   ```bash
   node scripts/update-model-aggregates.mjs --dry-run
   ```

---

## Ожидаемые результаты

После успешного выполнения всех шагов:

- ✅ Все модели имеют `vehicle_insights` с заполненными массивами
- ✅ Все insights имеют `reliability_score` и `popularity_score`
- ✅ Все модели имеют переводы на 5 языков (DE, EN, FR, NL, RU)
- ✅ Дубликаты объединены
- ✅ Агрегатные поля (`years_available`, и т.д.) актуальны
- ✅ На сайте доступна полная информация по всем маркам и моделям

---

## Поддержка

Если возникают проблемы:

1. Проверьте логи в консоли
2. Изучите `audit-report.json`
3. Запустите отдельные скрипты для диагностики
4. Обратитесь к разработчику с логами и описанием ошибки

---

## 🔗 Related Docs

**Development:** [VEHICLE_COMPLETION_PROGRESS.md](./VEHICLE_COMPLETION_PROGRESS.md) • [VEHICLE_SYNC_GUIDE.md](./VEHICLE_SYNC_GUIDE.md)
**Catalog:** [FINAL_COMPLETION_REPORT.md](../catalog/FINAL_COMPLETION_REPORT.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md) • [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)
