# 🎯 План действий: Система переводов

**Дата:** 2 ноября 2025  
**Статус:** 📋 В работе

---

## ✅ **ВЫПОЛНЕНО**

1. ✅ Создан полный отчёт системы переводов (`i18n-system-report.md`)
2. ✅ Все 5 языков синхронизированы (280 ключей в каждом)
3. ✅ Vehicle данные полностью локализованы
4. ✅ Проверены основные страницы:
   - Login/Register
   - Profile
   - Profile/Adverts
   - Advert view

---

## 🚀 **СЛЕДУЮЩИЕ ШАГИ**

### **Задача 1: Добавить name_de в Categories** ⚠️ КРИТИЧНО

**Проблема:** Немецкие пользователи видят категории на английском

**Решение:**
```sql
-- supabase/migrations/YYYYMMDD_add_german_to_categories.sql
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS name_de TEXT;

UPDATE public.categories 
SET name_de = name_en 
WHERE name_de IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_name_de 
ON public.categories(name_de);
```

**Затем:** Заполнить реальные немецкие переводы через админ-панель или скрипт

**Оценка:** 30 минут (миграция) + 2-4 часа (переводы)

---

### **Задача 2: Создать helper функции** 📝 ВАЖНО

**Цель:** Унифицировать доступ к локализованным полям

**Файл:** `apps/web/src/lib/i18n/helpers.ts`

```typescript
import type { Locale } from "@/lib/i18n";

/**
 * Получить локализованное поле из объекта
 * @example getLocalizedField(category, 'name', 'de') → category.name_de
 */
export function getLocalizedField<T extends Record<string, any>>(
  obj: T,
  fieldName: string,
  locale: Locale,
  fallbackLocale: Locale = 'en'
): string {
  const localizedKey = `${fieldName}_${locale}` as keyof T;
  const fallbackKey = `${fieldName}_${fallbackLocale}` as keyof T;
  const defaultKey = fieldName as keyof T;
  
  return (
    obj[localizedKey] || 
    obj[fallbackKey] || 
    obj[defaultKey] || 
    ''
  ) as string;
}

/**
 * Получить массив локализованных полей
 */
export function getLocalizedFields<T extends Record<string, any>>(
  items: T[],
  fieldName: string,
  locale: Locale
): string[] {
  return items.map(item => getLocalizedField(item, fieldName, locale));
}

/**
 * Отсортировать по локализованному полю
 */
export function sortByLocalizedField<T extends Record<string, any>>(
  items: T[],
  fieldName: string,
  locale: Locale,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const aVal = getLocalizedField(a, fieldName, locale);
    const bVal = getLocalizedField(b, fieldName, locale);
    const comparison = aVal.localeCompare(bVal, locale);
    return order === 'asc' ? comparison : -comparison;
  });
}
```

**Оценка:** 1 час

---

### **Задача 3: Обновить CategoryTree** 📝 ВАЖНО

**Проблема:** Хардкод выбора языка

**Текущий код:**
```typescript
const name = category[`name_${locale}`] || category.name_en;
```

**Новый код:**
```typescript
import { getLocalizedField } from "@/lib/i18n/helpers";

const name = getLocalizedField(category, 'name', locale);
```

**Файлы для обновления:**
- `apps/web/src/components/CategoryTree.tsx`
- `apps/web/src/app/api/categories/tree/route.ts`
- Везде, где используются `name_*` поля

**Оценка:** 2 часа

---

### **Задача 4: Аудит всех страниц** 📝 СРЕДНИЙ ПРИОРИТЕТ

**Страницы для проверки:**

| Страница | Статус | Проблемы |
|----------|--------|----------|
| `/` | ⚠️ Нужна проверка | - |
| `/search` | ⚠️ Нужна проверка | Фильтры? |
| `/category/[slug]` | ⚠️ Нужна проверка | - |
| `/post` | ⚠️ Нужна проверка | Большая форма |
| `/verify` | ⚠️ Нужна проверка | Email/phone |
| `404` | ⚠️ Нужна проверка | - |
| `500` | ⚠️ Нужна проверка | - |

**Метод проверки:**
1. Открыть страницу в каждом языке
2. Переключить язык в браузере
3. Найти непереведённые строки
4. Добавить недостающие ключи в JSON

**Оценка:** 4-6 часов

---

### **Задача 5: Добавить проверку синхронизации** 🔧 АВТОМАТИЗАЦИЯ

**Цель:** Автоматически проверять, что все языки синхронизированы

**Файл:** `scripts/check-i18n-sync.mjs`

```javascript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '../apps/web/src/i18n/locales');

const languages = ['en', 'fr', 'nl', 'ru', 'de'];
const files = languages.map(lang => 
  JSON.parse(readFileSync(join(localesDir, `${lang}.json`), 'utf8'))
);

function getKeys(obj, prefix = '') {
  return Object.keys(obj).flatMap(key => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      return getKeys(obj[key], fullKey);
    }
    return fullKey;
  });
}

const allKeys = languages.map((lang, i) => ({
  lang,
  keys: getKeys(files[i])
}));

const referenceKeys = allKeys[0].keys;
let hasErrors = false;

allKeys.forEach(({ lang, keys }) => {
  const missing = referenceKeys.filter(k => !keys.includes(k));
  const extra = keys.filter(k => !referenceKeys.includes(k));
  
  if (missing.length > 0) {
    console.error(`❌ ${lang}: Missing ${missing.length} keys:`);
    missing.forEach(k => console.error(`   - ${k}`));
    hasErrors = true;
  }
  
  if (extra.length > 0) {
    console.error(`❌ ${lang}: Extra ${extra.length} keys:`);
    extra.forEach(k => console.error(`   + ${k}`));
    hasErrors = true;
  }
  
  if (missing.length === 0 && extra.length === 0) {
    console.log(`✅ ${lang}: ${keys.length} keys (synchronized)`);
  }
});

if (hasErrors) {
  process.exit(1);
}
```

**Интеграция в CI:**
```yaml
# .github/workflows/i18n-check.yml
name: I18N Sync Check

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: node scripts/check-i18n-sync.mjs
```

**Оценка:** 2 часа

---

### **Задача 6: Email Templates** 📧 СРЕДНИЙ ПРИОРИТЕТ

**Проверить:**
- Supabase Auth email templates
- Кастомные email templates (если есть)
- Локализация по language пользователя

**Файлы:**
- Supabase Dashboard → Authentication → Email Templates
- `apps/web/src/lib/emails/` (если существует)

**Оценка:** 2-3 часа

---

## 📊 **ПРИОРИТЕЗАЦИЯ**

### **Спринт 1 (Сейчас):** ⚡ Критично
- ✅ Задача 1: Добавить name_de в Categories
- ✅ Задача 2: Создать helper функции
- ✅ Задача 3: Обновить CategoryTree

### **Спринт 2 (Эта неделя):** 📝 Важно
- 📋 Задача 4: Аудит всех страниц
- 📋 Задача 5: Автоматическая проверка

### **Спринт 3 (Следующая неделя):** 🔧 Улучшения
- 📋 Задача 6: Email Templates
- 📋 Добавить тесты для i18n
- 📋 Создать dashboard для мониторинга

---

## 🎯 **ОЖИДАЕМЫЙ РЕЗУЛЬТАТ**

После выполнения всех задач:

1. ✅ Все 5 языков полностью поддерживаются
2. ✅ Категории переведены на немецкий
3. ✅ Унифицированный доступ к переводам через helpers
4. ✅ Автоматическая проверка синхронизации в CI
5. ✅ Все страницы проверены на недостающие переводы
6. ✅ Email templates локализованы

**Качество:** 100% покрытие переводами для всех языков

---

**Документ создан:** 2025-11-02  
**Последнее обновление:** 2025-11-02

