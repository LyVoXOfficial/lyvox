# 📚 Scripts - Документация

> Коллекция скриптов для автоматизации задач проекта LyVoX

---

## 📁 Структура

```
scripts/
├── analyze-vehicle-sync.mjs          # Анализ JSON vs БД
├── check-vehicle-duplicates.mjs      # Проверка дубликатов
├── generateVehicleSeed.mjs           # Генератор seed (>= 1980)
├── sync-vehicles-master.mjs          # Мастер-скрипт синхронизации
│
├── import-csv-batch.mjs              # ⭐ CSV импорт (batch) + AI
├── import-from-csv.mjs               # CSV импорт (покомпонентный)
├── csv-import-master.mjs             # ⭐⭐ Мастер-скрипт CSV импорта
│
├── vehicle_i18n_normalize.mjs        # Переводы RU->EN (AI)
├── vehicle_i18n_expand.mjs           # Расширенные переводы (AI)
│
├── runSeed.mjs                       # Применение seed к БД
├── seedCategories.ts                 # Seed для категорий
│
├── check-i18n-keys.js                # Проверка i18n ключей
├── update-checklist-progress.js      # Обновление прогресса
│
└── README.md                         # Этот файл
```

---

## 🚗 Vehicle Data Completion (новое)

### Быстрый старт - Завершение каталога

```bash
# Полное завершение каталога (все недостающие данные):
export DATABASE_URL="postgresql://..."
export GOOGLE_API_KEY="AIzaSyB..."
node scripts/complete-vehicle-catalog.mjs
```

### Документация
- 📖 [Полное руководство по завершению данных](../docs/development/VEHICLE_DATA_COMPLETION.md)
- 📖 [План завершения](../vehicle.plan.md)

---

## 🚗 Vehicle Sync (базовая синхронизация)

### Быстрый старт

```bash
# Полная автоматическая синхронизация (>= 1980):
export DATABASE_URL="postgresql://..."
node scripts/sync-vehicles-master.mjs --apply
```

### Описание скриптов

| Скрипт | Назначение | Документация |
|--------|-----------|-------------|
| `sync-vehicles-master.mjs` | Мастер-скрипт (всё в одном) | [📖 Quick Start](../docs/development/VEHICLE_SYNC_QUICK_START.md) |
| `analyze-vehicle-sync.mjs` | Анализ JSON vs БД | [📖 Guide](../docs/development/VEHICLE_SYNC_GUIDE.md#1-analyze-vehicle-syncmjs) |
| `check-vehicle-duplicates.mjs` | Проверка дубликатов | [📖 Guide](../docs/development/VEHICLE_SYNC_GUIDE.md#2-check-vehicle-duplicatesmjs) |
| `generateVehicleSeed.mjs` | Генератор seed (>= 1980) | [📖 Guide](../docs/development/VEHICLE_SYNC_GUIDE.md#3-generatevehicleseedmjs) |
| `vehicle_i18n_normalize.mjs` | Переводы RU->EN | [📖 Guide](../docs/development/VEHICLE_SYNC_GUIDE.md#5-vehicle_i18n_normalizemjs) |
| `vehicle_i18n_expand.mjs` | Расширенные переводы | [📖 Guide](../docs/development/VEHICLE_SYNC_GUIDE.md#6-vehicle_i18n_expandmjs) |

**Полная документация:** [VEHICLE_SYNC_GUIDE.md](../docs/development/VEHICLE_SYNC_GUIDE.md)

---

## 📊 CSV Import (новое) ⭐

> Автоматический импорт моделей из CSV с AI обогащением

### Быстрый старт

```bash
# Одна марка (тест):
export GOOGLE_API_KEY="your-key"
export DATABASE_URL="postgresql://..."
node scripts/csv-import-master.mjs --make BMW --apply

# Все марки из CSV (357 моделей):
node scripts/csv-import-master.mjs --all --apply
```

### Описание скриптов

| Скрипт | Назначение | Рекомендация |
|--------|-----------|-------------|
| `csv-import-master.mjs` | Мастер-скрипт (всё в одном) | ⭐⭐ **ЛУЧШИЙ** |
| `import-csv-batch.mjs` | Batch импорт + AI обогащение | ⭐ **РЕКОМЕНДУЕТСЯ** |
| `import-from-csv.mjs` | Покомпонентный импорт | Для отладки |
| `find-duplicate-models.mjs` | Поиск дубликатов моделей после импорта | |
| `merge-duplicate-models.mjs` | Слияние дубликатов (перенос поколений, insights, i18n) | |
| `update-model-aggregates.mjs` | Пересчёт years/body/fuel/trans на основе поколений | |
| `list-bmw-models.mjs` | Быстрый список моделей марки (пример для BMW) | |
| `debug-model.mjs` | Отладка конкретной модели (поколения, поля) | |
| `dump-model-fields.mjs` | Показать массивы полей (body/fuel/trans/years) | |
| `check-json-model.mjs` | Просмотр данных модели в `vehicles_from_csv_enriched.json` | |

---

## 🎯 Data Completion (завершение каталога) ⭐⭐⭐

> Полное заполнение всех недостающих данных в каталоге

### Быстрый старт

```bash
# Полный процесс:
export DATABASE_URL="postgresql://..."
export GOOGLE_API_KEY="AIzaSyB..."
node scripts/complete-vehicle-catalog.mjs

# Dry-run (без изменений):
export DRY_RUN=true
node scripts/complete-vehicle-catalog.mjs
```

### Описание скриптов

| Скрипт | Назначение | Использование |
|--------|-----------|---------------|
| `complete-vehicle-catalog.mjs` | 🌟 **Мастер-скрипт** (все шаги) | Запустить весь процесс |
| `audit-full-coverage.mjs` | Полный аудит покрытия данных | Анализ состояния |
| `fill-missing-insights.mjs` | Заполнение insights для моделей без них | AI генерация |
| `fill-model-scores.mjs` | Проставление reliability/popularity scores | AI оценка |
| `backfill-insight-arrays.mjs` | Заполнение пустых массивов в insights | AI дозаполнение |
| `update-i18n.mjs` | Обновление переводов (wrapper) | Переводы |
| `check-insight-coverage.mjs` | Проверка покрытия insights полей | Диагностика |
| `check-i18n-counts.mjs` | Подсчёт переводов по языкам | Диагностика |
| `list-models-without-insights.mjs` | Список моделей без insights | Диагностика |

**Шаги процесса:**
1. **Аудит:** Анализ текущего состояния (модели без insights, пустые поля, дубликаты)
2. **Insights:** Генерация недостающих insights через AI (pros, cons, tips, features)
3. **Scores:** Проставление reliability/popularity оценок (0-10)
4. **Arrays:** Заполнение пустых массивов в существующих insights
5. **Translations:** Обновление переводов для новых моделей (5 языков)
6. **Merge:** Слияние дубликатов моделей
7. **Aggregates:** Пересчёт years_available, body_types, fuel_types, transmission
8. **Final Audit:** Повторный аудит для проверки результатов

**Время выполнения:**
- Аудит: ~30-60 сек
- Insights (93 модели): ~20-30 мин
- Scores (811 моделей): ~40-80 мин
- Arrays: ~5-10 мин
- Translations: ~5-10 мин
- Merge + Aggregates: ~3-5 мин
- **Итого:** ~1-2 часа

**Полная документация:** [VEHICLE_DATA_COMPLETION.md](../docs/development/VEHICLE_DATA_COMPLETION.md)

---

## 📊 CSV Import (базовый импорт)

**Что делают:**
1. Парсят `transport_make_model.csv` (357 моделей)
2. Обогащают через AI:
   - Поколения (generations)
   - Характеристики (body types, fuel, transmission)
   - Insights (pros, cons, common issues)
   - Оценки (reliability, popularity)
   - Переводы (EN, RU)
3. Генерируют SQL seed
4. Применяют к БД

**Производительность:**
- 1 марка (BMW, 19 моделей): ~2-3 минуты
- Все марки (357 моделей): ~40-60 минут
- Стоимость: БЕСПЛАТНО (Google Gemini free tier)

**Переменные окружения:**
```bash
GOOGLE_API_KEY="..."        # обязательно
DATABASE_URL="..."          # для --apply
MAKE="BMW"                  # фильтр по марке
BATCH_SIZE="10"             # размер batch (по умолчанию)
```

**Полная документация:** 
- [CSV_IMPORT_QUICK_START.md](../CSV_IMPORT_QUICK_START.md)
- [CSV_IMPORT_GUIDE.md](../docs/development/CSV_IMPORT_GUIDE.md)
- [CSV_IMPORT_COMPLETE_REPORT.md](../CSV_IMPORT_COMPLETE_REPORT.md)

---

## 🗂️ Категории

### seedCategories.ts

Загрузка категорий объявлений в БД.

```bash
# Запуск через tsx:
npx tsx scripts/seedCategories.ts
```

**Что делает:**
- Читает структуру категорий из кода
- Создаёт иерархию категорий с переводами
- Загружает в таблицу `categories`

---

## 🌍 Интернационализация (i18n)

### check-i18n-keys.js

Проверка консистентности ключей переводов.

```bash
node scripts/check-i18n-keys.js
```

**Что проверяет:**
- Все языки имеют одинаковые ключи
- Нет пропущенных переводов
- Нет дубликатов ключей

### vehicle_i18n_normalize.mjs

Нормализация vehicle названий (RU -> EN).

```bash
DATABASE_URL="..." OPENAI_API_KEY="..." node scripts/vehicle_i18n_normalize.mjs
```

**Что делает:**
- Находит записи с кириллицей в `name_en`
- Переводит через AI (OpenAI/Google)
- Сохраняет оригинал в `*_i18n` таблицы

**Переменные окружения:**
- `DATABASE_URL` - обязательно
- `OPENAI_API_KEY` или `GOOGLE_API_KEY` - обязательно
- `DRY_RUN=true` - тестовый режим

### vehicle_i18n_expand.mjs

Расширенные переводы (pros, cons, tips).

```bash
DATABASE_URL="..." GOOGLE_API_KEY="..." node scripts/vehicle_i18n_expand.mjs
```

**Что переводит:**
- `summary` - описание поколения
- `pros` - преимущества
- `cons` - недостатки
- `inspection_tips` - советы по проверке
- `common_issues` - распространённые проблемы

**Переменные окружения:**
- `DATABASE_URL` - обязательно
- `GOOGLE_API_KEY` - предпочтительнее
- `OPENAI_API_KEY` - fallback
- `ONLY_MAKES="bmw,audi"` - фильтр по маркам
- `LIMIT_ROWS=100` - лимит записей
- `DRY_RUN=true` - тестовый режим

---

## 🗄️ Database Seeds

### runSeed.mjs

Применение SQL seed файла к БД.

```bash
# Применить vehicles_seed.sql:
node scripts/runSeed.mjs ./vehicles_seed.sql

# Применить другой файл:
node scripts/runSeed.mjs ./path/to/seed.sql
```

**Переменные окружения:**
- `SUPABASE_SERVICE_ROLE_KEY` - обязательно
- `SUPABASE_DB_HOST` - опционально
- `SUPABASE_DB_PORT` - опционально
- `SUPABASE_DB_NAME` - опционально
- `SUPABASE_DB_USER` - опционально

---

## 📊 Утилиты

### update-checklist-progress.js

Обновление прогресса в MASTER_CHECKLIST.md.

```bash
node scripts/update-checklist-progress.js
```

**Что делает:**
- Подсчитывает выполненные задачи
- Обновляет секцию "Прогресс выполнения"
- Показывает следующие задачи

---

## 🔧 Общие переменные окружения

### Database

```bash
# PostgreSQL connection string (выберите один):
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"
SUPABASE_DB_URL="postgresql://postgres.PROJECT_REF:PASSWORD@HOST:5432/postgres"

# Supabase credentials (для runSeed.mjs):
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_DB_HOST="db.PROJECT_REF.supabase.co"
SUPABASE_DB_PORT="5432"
SUPABASE_DB_NAME="postgres"
SUPABASE_DB_USER="postgres"
```

### AI APIs (для переводов)

```bash
# OpenAI:
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"  # опционально

# Google Gemini:
GOOGLE_API_KEY="AIza..."
GOOGLE_MODEL="gemini-1.5-flash-latest"  # опционально
GOOGLE_API_VERSION="v1"  # опционально
```

### PostgreSQL SSL

```bash
PGSSL_REJECT_UNAUTHORIZED="false"  # для self-signed certificates
PGSSLROOTCERT="/path/to/ca.crt"
PG_KEEPALIVE="true"
PG_KEEPALIVE_DELAY_MS="10000"
```

---

## 📖 Дополнительная документация

- **Vehicle Sync Quick Start:** [VEHICLE_SYNC_QUICK_START.md](../docs/development/VEHICLE_SYNC_QUICK_START.md)
- **Vehicle Sync Guide (полная):** [VEHICLE_SYNC_GUIDE.md](../docs/development/VEHICLE_SYNC_GUIDE.md)
- **Master Checklist:** [MASTER_CHECKLIST.md](../docs/development/MASTER_CHECKLIST.md)

---

## 🐛 Troubleshooting

### SSL certificate error

```bash
export PGSSL_REJECT_UNAUTHORIZED="false"
```

### MODULE_NOT_FOUND errors

```bash
# Убедитесь, что установлены зависимости:
npm install
# или для конкретных скриптов:
npm install pg
```

### AI API rate limits

```bash
# Используйте батчи и лимиты:
LIMIT_ROWS=100 node scripts/vehicle_i18n_expand.mjs
ONLY_MAKES="bmw,audi" node scripts/vehicle_i18n_expand.mjs
```

---

## 👨‍💻 Разработка

### Добавление нового скрипта

1. Создайте файл в `scripts/`
2. Добавьте shebang: `#!/usr/bin/env node`
3. Сделайте исполняемым: `chmod +x scripts/your-script.mjs`
4. Обновите этот README
5. Добавьте в MASTER_CHECKLIST.md если нужно

### Стиль кода

- ESM модули (`.mjs`)
- Async/await для асинхронных операций
- Error handling с try/catch
- Логирование через console.log/error
- Переменные окружения через process.env

---

**Версия:** 1.1
**Обновлено:** 2025-11-03 (добавлен CSV Import)

