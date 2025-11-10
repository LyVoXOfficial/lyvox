# 📊 CSV Import Guide - Автоматический импорт из CSV

> Полное руководство по автоматическому импорту марок и моделей из CSV файла с обогащением через AI

---

## 🎯 Обзор

Система автоматического импорта позволяет:
- ✅ Загрузить данные из `transport_make_model.csv` (357 моделей)
- ✅ Автоматически обогатить через AI (generations, insights, specs)
- ✅ Автоматически перевести на 5 языков (EN, RU, NL, FR, DE)
- ✅ Сгенерировать SQL seed
- ✅ Применить к базе данных

---

## 📁 Структура

### Входные файлы:
- `seed/transport_make_model.csv` - CSV с марками и моделями

### Скрипты:
1. `scripts/import-from-csv.mjs` - Покомпонентный импорт (1 модель = 1 AI запрос)
2. `scripts/import-csv-batch.mjs` - **Batch импорт** (10 моделей = 1 AI запрос) ⭐ РЕКОМЕНДУЕТСЯ
3. `scripts/csv-import-master.mjs` - **Мастер-скрипт** (всё в одном) ⭐⭐ ЛУЧШИЙ ВАРИАНТ

### Выходные файлы:
- `seed/vehicles_from_csv_enriched.json` - Обогащенный JSON
- `vehicles_seed.sql` - SQL seed для БД

---

## 🚀 Быстрый старт

### Вариант 1: Одна марка (РЕКОМЕНДУЕТСЯ для теста)

```bash
# Только BMW
export GOOGLE_API_KEY="your-key"
export DATABASE_URL="postgresql://..."

node scripts/csv-import-master.mjs --make BMW --apply
```

### Вариант 2: Все марки

```bash
# Все 70+ марок из CSV
export GOOGLE_API_KEY="your-key"
export DATABASE_URL="postgresql://..."

node scripts/csv-import-master.mjs --all --apply
```

### Вариант 3: Пошаговый режим

```bash
# Шаг 1: Импорт и обогащение
GOOGLE_API_KEY="..." MAKE="BMW" node scripts/import-csv-batch.mjs

# Шаг 2: Генерация SQL
INPUT_JSON="seed/vehicles_from_csv_enriched.json" node scripts/generateVehicleSeed.mjs

# Шаг 3: Применение к БД
DATABASE_URL="..." node scripts/runSeed.mjs ./vehicles_seed.sql
```

---

## 📚 Детальное описание скриптов

### 1. `import-csv-batch.mjs` ⭐ РЕКОМЕНДУЕТСЯ

**Batch обработка - быстрая и экономичная**

```bash
# Одна марка
GOOGLE_API_KEY="..." MAKE="BMW" node scripts/import-csv-batch.mjs

# Несколько марок, batch size = 5
GOOGLE_API_KEY="..." MAKE="BMW,Audi,Mercedes-Benz" BATCH_SIZE=5 node scripts/import-csv-batch.mjs

# Все марки
GOOGLE_API_KEY="..." node scripts/import-csv-batch.mjs
```

**Параметры:**
- `GOOGLE_API_KEY` - обязательно
- `MAKE` - фильтр по марке (опционально)
- `BATCH_SIZE` - количество моделей в одном запросе (по умолчанию: 10)

**Преимущества:**
- ⚡ **В 10 раз быстрее** чем покомпонентный импорт
- 💰 **В 10 раз дешевле** (меньше API запросов)
- 🎯 Более консистентные данные

---

### 2. `csv-import-master.mjs` ⭐⭐ ЛУЧШИЙ ВАРИАНТ

**Полная автоматизация - всё в одном скрипте**

```bash
# Тест: только BMW, без применения к БД
GOOGLE_API_KEY="..." node scripts/csv-import-master.mjs --make BMW --dry-run

# BMW + применение к БД
GOOGLE_API_KEY="..." DATABASE_URL="..." node scripts/csv-import-master.mjs --make BMW --apply

# Все марки
GOOGLE_API_KEY="..." DATABASE_URL="..." node scripts/csv-import-master.mjs --all --apply
```

**Флаги:**
- `--make МАРКА` - обработать одну марку
- `--all` - обработать все марки
- `--batch-size N` - размер batch (по умолчанию: 10)
- `--apply` - применить к БД (без этого только генерация)
- `--dry-run` - показать что будет сделано

**Что делает:**
1. ✅ Импортирует из CSV
2. ✅ Обогащает через AI
3. ✅ Генерирует SQL seed
4. ✅ Применяет к БД (если `--apply`)
5. ✅ Проверяет результаты

---

### 3. `import-from-csv.mjs`

**Покомпонентный импорт - медленный но детальный**

```bash
# Только BMW
GOOGLE_API_KEY="..." ONLY_MAKES="BMW" node scripts/import-from-csv.mjs

# Первые 5 марок
GOOGLE_API_KEY="..." LIMIT=5 node scripts/import-from-csv.mjs
```

**Когда использовать:**
- 🐌 Когда нужна максимальная детализация
- 🔍 Для отладки проблемных моделей
- 📊 Для малого количества моделей (< 10)

**НЕ рекомендуется** для массовой обработки (слишком медленно и дорого)

---

## 🔧 Переменные окружения

### Обязательные:

```bash
# Google Gemini API (РЕКОМЕНДУЕТСЯ)
GOOGLE_API_KEY="your-key"

# или OpenAI (fallback)
OPENAI_API_KEY="sk-..."
```

### Для применения к БД:

```bash
DATABASE_URL="postgresql://postgres.kjzqowcxojspjtoadzee:Mersene223!!@aws-0-eu-central-2.pooler.supabase.com:5432/postgres"

# или отдельно
SUPABASE_SERVICE_ROLE_KEY="..."
SUPABASE_DB_HOST="aws-0-eu-central-2.pooler.supabase.com"
SUPABASE_DB_USER="postgres.kjzqowcxojspjtoadzee"
```

### Опциональные:

```bash
# Фильтр по маркам (через запятую)
MAKE="BMW"
ONLY_MAKES="BMW,Audi,Mercedes-Benz"

# Размер batch для batch импорта
BATCH_SIZE=10

# Лимит марок
LIMIT=5

# Google AI модель
GOOGLE_MODEL="gemini-2.0-flash-exp"  # по умолчанию

# Dry run (не применять изменения)
DRY_RUN=true
```

---

## 📊 Формат данных

### CSV Input (`transport_make_model.csv`):

```csv
Make,Model,Year_Start,Year_End,Body_Type,Country
BMW,1 Series,2004,,компактный автомобиль,Германия
BMW,3 Series,1975,,седан,Германия
```

### JSON Output (`vehicles_from_csv_enriched.json`):

```json
{
  "makes": [
    {
      "slug": "bmw",
      "name_en": "BMW",
      "country": "Germany",
      "models": [
        {
          "slug": "1-series",
          "name_en": "1 Series",
          "name_ru": "1 Серия",
          "first_model_year": 2004,
          "last_model_year": 2024,
          "years_available": [2004, 2008, 2012, 2016, 2020, 2024],
          "body_types_available": ["Hatchback", "Sedan"],
          "fuel_types_available": ["Gasoline", "Diesel"],
          "transmission_available": ["Manual", "Automatic"],
          "reliability_score": 7.5,
          "popularity_score": 8.0,
          "generations": [
            {
              "code": "E87 (2004-2011)",
              "start_year": 2004,
              "end_year": 2011,
              "facelift": false,
              "production_countries": ["Germany"],
              "summary": "First generation..."
            }
          ],
          "insight": {
            "pros": ["Reliable engine", "Good handling"],
            "cons": ["Expensive maintenance"],
            "inspection_tips": ["Check oil leaks"],
            "notable_features": ["RWD", "Compact size"],
            "engine_examples": ["2.0L I4", "3.0L I6"],
            "common_issues_by_engine": [
              {
                "engine_code": "N46B20",
                "common_issues_ru": ["Износ цепи ГРМ", "Утечка масла"]
              }
            ]
          }
        }
      ]
    }
  ]
}
```

---

## ⏱️ Время выполнения

| Скрипт | 1 марка (18 моделей) | Все марки (357 моделей) |
|--------|---------------------|------------------------|
| `import-from-csv.mjs` | ~20 минут | ~7 часов |
| `import-csv-batch.mjs` | ~2 минуты | ~40 минут |
| `csv-import-master.mjs` | ~3 минуты | ~45 минут |

---

## 💰 Стоимость API

### Google Gemini (РЕКОМЕНДУЕТСЯ):
- **Free tier:** 15 запросов/минуту, ~1500 запросов/день
- **Стоимость:** БЕСПЛАТНО для большинства случаев
- **Batch:** 1 марка (18 моделей) = ~2 запроса = БЕСПЛАТНО

### OpenAI (fallback):
- **gpt-4o-mini:** ~$0.001 за 1000 токенов
- **Batch:** 1 марка = ~$0.02-0.05
- **Все марки:** ~$5-10

---

## 🎯 Примеры использования

### Пример 1: Тестовая обработка BMW

```bash
# Установить ключи
export GOOGLE_API_KEY="your-key"
export DATABASE_URL="postgresql://..."

# Запустить для BMW (dry run)
node scripts/csv-import-master.mjs --make BMW --dry-run

# Применить к БД
node scripts/csv-import-master.mjs --make BMW --apply
```

### Пример 2: Обработка топ-5 марок

```bash
# BMW, Mercedes-Benz, Audi, Toyota, Volkswagen
for make in "BMW" "Mercedes-Benz" "Audi" "Toyota" "Volkswagen"; do
  echo "Обработка: $make"
  GOOGLE_API_KEY="..." MAKE="$make" node scripts/import-csv-batch.mjs
done

# Объединить результаты и применить
INPUT_JSON="seed/vehicles_from_csv_enriched.json" node scripts/generateVehicleSeed.mjs
DATABASE_URL="..." node scripts/runSeed.mjs ./vehicles_seed.sql
```

### Пример 3: Полная обработка всех марок

```bash
# Это займёт ~45 минут
GOOGLE_API_KEY="..." DATABASE_URL="..." node scripts/csv-import-master.mjs --all --apply
```

---

## 🐛 Troubleshooting

### Проблема: "Google AI error: quota exceeded"

**Решение:** Используйте меньший batch size или добавьте паузы:
```bash
BATCH_SIZE=5 node scripts/import-csv-batch.mjs
```

### Проблема: "JSON parse error"

**Причина:** AI вернул невалидный JSON

**Решение:** Попробуйте другую модель:
```bash
GOOGLE_MODEL="gemini-1.5-pro-latest" node scripts/import-csv-batch.mjs
```

### Проблема: "No AI API available"

**Решение:** Установите API ключ:
```bash
export GOOGLE_API_KEY="your-key"
# или
export OPENAI_API_KEY="sk-..."
```

---

## 📝 Checklist выполнения

- [ ] CSV файл подготовлен (`transport_make_model.csv`)
- [ ] API ключи настроены (GOOGLE_API_KEY)
- [ ] Тестовая обработка выполнена (--make BMW --dry-run)
- [ ] Результаты проверены (`vehicles_from_csv_enriched.json`)
- [ ] SQL seed сгенерирован (`vehicles_seed.sql`)
- [ ] Применено к production БД (--apply)
- [ ] Результаты верифицированы (check-bmw-in-db.mjs)

---

## 🎉 Результат

После выполнения вы получите:
- ✅ **357 моделей** от 70+ марок
- ✅ **Полная информация** (generations, insights, specs)
- ✅ **Переводы на 5 языков** (EN, RU, NL, FR, DE)
- ✅ **Готово к использованию** на сайте

---

**Версия:** 1.0  
**Дата:** 2025-11-02  
**Автор:** AI Assistant

---

## 🔗 Related Docs

**Development:** [VEHICLE_SYNC_GUIDE.md](./VEHICLE_SYNC_GUIDE.md)
**Catalog:** [DEPLOYMENT_GUIDE.md](../catalog/DEPLOYMENT_GUIDE.md) • [AI_ENRICHMENT.md](../catalog/AI_ENRICHMENT.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md) • [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)
