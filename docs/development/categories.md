# Категории (Full Taxonomy)

## Current State

| Аспект               | Статус                                         |
| -------------------- | ---------------------------------------------- |
| Таблица `categories` | Существует, 3 уровня                           |
| Локализация          | Поддерживает RU/NL/FR/EN                       |
| Routing              | Path-based: `/c/transport/legkovye-avtomobili` |

## MVP Enhancements

### Database Changes

```sql
-- Добавить поле для подсчета объявлений (computed via materialized view)
ALTER TABLE public.categories ADD COLUMN advert_count integer DEFAULT 0;

-- Индексы для оптимизации
CREATE INDEX idx_categories_parent_active_sort
  ON public.categories(parent_id, is_active, sort);
CREATE INDEX idx_categories_path_active
  ON public.categories(path, is_active);

-- Materialized view для подсчета (обновляется по расписанию)
CREATE MATERIALIZED VIEW category_advert_counts AS
SELECT
  c.id,
  COUNT(a.id) as count
FROM public.categories c
LEFT JOIN public.adverts a ON a.category_id = c.id AND a.status = 'active'
GROUP BY c.id;

CREATE UNIQUE INDEX ON category_advert_counts(id);
```

### API Endpoints

| Endpoint                       | Метод | Описание                      | Параметры          |
| ------------------------------ | ----- | ----------------------------- | ------------------ |
| `/api/categories/tree`         | GET   | Дерево категорий с переводами | `locale` (query)   |
| `/api/categories/[path]/stats` | GET   | Статистика категории          | `path` (URL param) |

**Пример ответа `/api/categories/tree?locale=en`:**

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "slug": "transport",
      "name": "Transport",
      "icon": "car",
      "level": 1,
      "advert_count": 245,
      "children": [...]
    }
  ]
}
```

### Frontend Components

| Компонент           | Путь                                              | Назначение                        |
| ------------------- | ------------------------------------------------- | --------------------------------- |
| CategoryTree        | `apps/web/src/components/CategoryTree.tsx`        | Дерево категорий для навигации    |
| CategoryCard        | `apps/web/src/components/CategoryCard.tsx`        | Карточка категории с счетчиком    |
| CategoryBreadcrumbs | `apps/web/src/components/CategoryBreadcrumbs.tsx` | Breadcrumbs на странице категории |

## Локализация категорий

**Приоритет локализации:**

1. Запрошенная локализация (из cookie/URL)
2. Fallback на английский (`name_en`)
3. Fallback на русский (`name_ru`) если EN отсутствует

**Helper функция:**

```typescript
function getCategoryName(category: Category, locale: string): string {
  const localeMap: Record<string, keyof Category> = {
    nl: "name_nl",
    fr: "name_fr",
    en: "name_en",
    ru: "name_ru",
  };

  const field = localeMap[locale] || "name_en";
  return (
    category[field] || category.name_en || category.name_ru || category.slug
  );
}
```

## Иконки категорий

**Источник иконок:**

- Lucide React icons (primary)
- Кастомные SVG для специфичных категорий
- Mapping через поле `icon` в таблице или default set

**Default mapping:**

```typescript
const categoryIconMap: Record<string, string> = {
  transport: "Car",
  "real-estate": "Home",
  electronics: "Smartphone",
  services: "Briefcase",
  // ... остальные
};
```

## SEO для категорий

**Metadata generation:**

```typescript
export async function generateMetadata({
  params,
}: {
  params: { path: string[] };
}) {
  const category = await getCategoryByPath(params.path.join("/"));
  const locale = getLocale();

  return {
    title: `${category.name} - LyVoX`,
    description: `Browse ${category.advert_count} ${category.name} listings`,
    alternates: {
      languages: {
        nl: `/nl/c/${category.path}`,
        fr: `/fr/c/${category.path}`,
        en: `/en/c/${category.path}`,
        ru: `/ru/c/${category.path}`,
      },
    },
  };
}
```

## Чек-лист MVP

- [ ] Мультиязычные названия категорий (NL/FR/EN/RU, fallback на EN)
- [ ] Иконки категорий (Lucide icons или кастомные SVG)
- [ ] Breadcrumbs на странице категории
- [ ] Подсчет объявлений (materialized view, обновление раз в час)
- [ ] SEO meta для категорий: title, description, hreflang
- [ ] Индексы оптимизированы для быстрого поиска

## TODO for developers

1. **Создать materialized view для подсчета объявлений**
   - [ ] Миграция с `category_advert_counts` view
   - [ ] Cron job для обновления (каждый час)
   - [ ] Триггер для real-time обновления при изменении статуса объявления (опционально)

2. **Реализовать API endpoint `/api/categories/tree`**
   - [ ] Загрузка дерева категорий с фильтрацией по `is_active`
   - [ ] Применение локализации по `locale` параметру
   - [ ] Рекурсивная загрузка children
   - [ ] Кэширование ответа (revalidate 3600s)

3. **Реализовать API endpoint `/api/categories/[path]/stats`**
   - [ ] Подсчет объявлений в категории и всех подкатегориях
   - [ ] Возврат агрегированной статистики

4. **Создать компонент CategoryTree**
   - [ ] Рекурсивный рендеринг дерева
   - [ ] Dropdown для desktop, drawer для mobile
   - [ ] Highlight активной категории
   - [ ] Локализация названий

5. **Создать компонент CategoryCard**
   - [ ] Отображение иконки, названия, счетчика
   - [ ] Link на страницу категории
   - [ ] Hover эффекты

6. **Обновить страницу категории**
   - [ ] Breadcrumbs компонент
   - [ ] SEO metadata generation
   - [ ] hreflang alternates

---

## 🔗 Related Docs

**Domains:** [adverts.md](../domains/adverts.md)
**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [search-filters.md](./search-filters.md) • [backend-logic.md](./backend-logic.md)
**Catalog:** [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md)




