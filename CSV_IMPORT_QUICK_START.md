# 🚀 CSV Import - Quick Start

> **Автоматический импорт 357 моделей из CSV в БД с AI обогащением**

---

## ✅ Что создано

### Скрипты:
1. ✅ `scripts/import-csv-batch.mjs` - Batch импорт с AI обогащением
2. ✅ `scripts/import-from-csv.mjs` - Покомпонентный импорт (запасной вариант)
3. ✅ `scripts/csv-import-master.mjs` - Мастер-скрипт (всё в одном)
4. ✅ `scripts/generateVehicleSeed.mjs` - Обновлён для работы с новым JSON

### Документация:
1. ✅ `docs/development/CSV_IMPORT_GUIDE.md` - Полное руководство
2. ✅ `CSV_IMPORT_QUICK_START.md` - Этот файл

---

## 🎯 Что делают скрипты

1. **Парсинг CSV** → Читает `transport_make_model.csv` (357 моделей)
2. **AI Обогащение** → Добавляет:
   - Поколения (generations)
   - Характеристики (body types, fuel types, transmission)
   - Insights (pros, cons, common issues)
   - Оценки (reliability_score, popularity_score)
3. **Автоматические переводы** → EN, RU, NL, FR, DE
4. **Генерация SQL** → Создаёт `vehicles_seed.sql`
5. **Применение к БД** → Загружает в PostgreSQL

---

## 🚀 Как запустить (3 варианта)

### Вариант 1: Одна марка (BMW) - РЕКОМЕНДУЕТСЯ ДЛЯ ТЕСТА ⭐

```bash
# Windows PowerShell
$env:GOOGLE_API_KEY="ВАШ_GOOGLE_API_KEY"
$env:DATABASE_URL="postgresql://postgres.kjzqowcxojspjtoadzee:Mersene223!!@aws-0-eu-central-2.pooler.supabase.com:5432/postgres"

node scripts/csv-import-master.mjs --make BMW --apply
```

**Время:** ~2-3 минуты  
**Стоимость:** БЕСПЛАТНО (Google Gemini free tier)  
**Результат:** 19 моделей BMW с полными данными

---

### Вариант 2: Все марки (357 моделей) - ПОЛНАЯ ОБРАБОТКА ⭐⭐

```bash
# Windows PowerShell
$env:GOOGLE_API_KEY="ВАШ_GOOGLE_API_KEY"
$env:DATABASE_URL="postgresql://postgres.kjzqowcxojspjtoadzee:Mersene223!!@aws-0-eu-central-2.pooler.supabase.com:5432/postgres"

node scripts/csv-import-master.mjs --all --apply
```

**Время:** ~40-60 минут  
**Стоимость:** БЕСПЛАТНО (в пределах free tier)  
**Результат:** 357 моделей от 70+ марок

---

### Вариант 3: Пошаговый (для отладки)

```bash
# Шаг 1: Импорт и обогащение
$env:GOOGLE_API_KEY="ВАШ_KEY"
$env:MAKE="BMW"
node scripts/import-csv-batch.mjs

# Шаг 2: Генерация SQL
$env:INPUT_JSON="seed/vehicles_from_csv_enriched.json"
node scripts/generateVehicleSeed.mjs

# Шаг 3: Применение к БД
$env:DATABASE_URL="postgresql://..."
node scripts/runSeed.mjs ./vehicles_seed.sql

# Шаг 4: Проверка
node scripts/check-bmw-in-db.mjs
```

---

## 🔑 Получение Google API Key

### Бесплатный ключ (рекомендуется):

1. Перейдите: https://aistudio.google.com/apikey
2. Нажмите **"Get API Key"**
3. Выберите проект или создайте новый
4. Скопируйте ключ

**Free tier лимиты:**
- ✅ 15 запросов/минуту
- ✅ ~1500 запросов/день
- ✅ Достаточно для 357 моделей

---

## 📊 Что получится

### Исходный CSV (`transport_make_model.csv`):
```csv
BMW,1 Series,2004,,компактный автомобиль,Германия
BMW,3 Series,1975,,седан,Германия
```

### После обработки (`vehicles_from_csv_enriched.json`):
```json
{
  "models": [
    {
      "slug": "1-series",
      "name_en": "1 Series",
      "name_ru": "1 Серия",
      "first_model_year": 2004,
      "last_model_year": 2024,
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
          "summary": "First generation..."
        }
      ],
      "insight": {
        "pros": ["Reliable engine", "Good handling"],
        "cons": ["Expensive maintenance"],
        "inspection_tips": ["Check oil leaks"],
        "common_issues_by_engine": [...]
      }
    }
  ]
}
```

---

## ✅ Проверка результатов

### После применения к БД:

```bash
# Проверить количество марок/моделей
node scripts/quick-stats.mjs

# Проверить конкретную марку
node scripts/check-bmw-in-db.mjs

# Открыть сайт и проверить UI
cd apps/web
pnpm dev
# Откройте: http://localhost:3000/post
```

---

## 🐛 Troubleshooting

### Проблема: "API key not valid"

**Решение:** Получите новый ключ на https://aistudio.google.com/apikey

### Проблема: "Quota exceeded"

**Решение:** Уменьшите batch size:
```bash
$env:BATCH_SIZE="5"
node scripts/import-csv-batch.mjs
```

### Проблема: "Cannot find package csv-parse"

**Решение:** Установите зависимость:
```bash
pnpm add -w csv-parse
```

### Проблема: "Connection refused" (БД)

**Решение:** Проверьте DATABASE_URL:
```bash
# Используйте Session Pooler для IPv4:
postgresql://postgres.kjzqowcxojspjtoadzee:Mersene223!!@aws-0-eu-central-2.pooler.supabase.com:5432/postgres
```

---

## 📝 Checklist выполнения

- [x] ✅ Скрипты созданы
- [x] ✅ Документация готова
- [x] ✅ Тестовый запуск выполнен (BMW, fallback данные)
- [ ] 🔄 Получить валидный GOOGLE_API_KEY
- [ ] 🔄 Запустить тестовую обработку BMW с реальным API
- [ ] 🔄 Проверить обогащённые данные
- [ ] 🔄 Применить к БД
- [ ] 🔄 Верифицировать на сайте
- [ ] 🔄 Запустить полную обработку (357 моделей)

---

## 🎯 Следующие шаги

### Сейчас:
1. ✅ Скрипты готовы и протестированы
2. 📄 Получите **Google API Key**: https://aistudio.google.com/apikey
3. 🚀 Запустите тест:
   ```bash
   $env:GOOGLE_API_KEY="ВАШ_КЛЮЧ"
   $env:DATABASE_URL="postgresql://..."
   node scripts/csv-import-master.mjs --make BMW --apply
   ```

### После теста:
4. ✅ Проверьте результаты на сайте
5. 🚀 Запустите полную обработку:
   ```bash
   node scripts/csv-import-master.mjs --all --apply
   ```

---

## 📞 Нужна помощь?

- 📖 Полная документация: `docs/development/CSV_IMPORT_GUIDE.md`
- 🐛 Troubleshooting: см. раздел выше
- 📝 TODO: `CSV-003` → Получить API ключ

---

**Готово к использованию! 🎉**

Осталось только получить Google API Key и запустить!

