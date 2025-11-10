# Поиск и фильтры

## MVP Scope

| Функция | Описание | Приоритет |
|---------|----------|-----------|
| Full-text поиск | PostgreSQL `to_tsvector` по title и description | P0 |
| Фильтр по категории | Каскадный выбор (3 уровня) | P0 |
| Фильтр по цене | Range slider (min/max) | P0 |
| Фильтр по локации | Autocomplete + radius (km) | P0 |
| Сортировка | По дате, цене, релевантности | P0 |
| Геопоиск | Выбор на карте + радиус | P1 |
| URL синхронизация | Query params для фильтров | P0 |

## Database Schema

```sql
CREATE TABLE public.search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  query text,
  filters jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_search_history_user_created 
  ON public.search_history(user_id, created_at DESC);
```

## PostgreSQL Function

```sql
CREATE OR REPLACE FUNCTION search_adverts(
  search_query text DEFAULT NULL,
  category_id_filter uuid DEFAULT NULL,
  price_min_filter numeric DEFAULT NULL,
  price_max_filter numeric DEFAULT NULL,
  location_filter text DEFAULT NULL,
  radius_km numeric DEFAULT 50,
  sort_by text DEFAULT 'created_at_desc',
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 24
)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  price numeric,
  location text,
  created_at timestamptz,
  relevance real
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.description,
    a.price,
    a.location,
    a.created_at,
    CASE 
      WHEN search_query IS NOT NULL THEN
        ts_rank(
          to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.description, '')),
          plainto_tsquery('english', search_query)
        )
      ELSE 0
    END AS relevance
  FROM public.adverts a
  WHERE a.status = 'active'
    AND (search_query IS NULL OR 
         to_tsvector('english', coalesce(a.title, '') || ' ' || coalesce(a.description, '')) 
         @@ plainto_tsquery('english', search_query))
    AND (category_id_filter IS NULL OR a.category_id = category_id_filter)
    AND (price_min_filter IS NULL OR a.price >= price_min_filter)
    AND (price_max_filter IS NULL OR a.price <= price_max_filter)
    AND (location_filter IS NULL OR a.location ILIKE '%' || location_filter || '%')
  ORDER BY 
    CASE sort_by
      WHEN 'price_asc' THEN a.price
      WHEN 'price_desc' THEN -a.price
      WHEN 'relevance' THEN relevance DESC
      ELSE a.created_at DESC
    END
  LIMIT page_limit OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;
```

## API Endpoints

### GET /api/search

**Query Parameters:**
| Параметр | Тип | Описание |
|----------|-----|----------|
| `q` | string | Поисковый запрос |
| `category` | uuid | ID категории |
| `price_min` | number | Минимальная цена |
| `price_max` | number | Максимальная цена |
| `location` | string | Название локации |
| `radius` | number | Радиус поиска (km) |
| `sort` | string | Сортировка (created_at_desc, price_asc, price_desc, relevance) |
| `page` | number | Номер страницы (default: 1) |

**Response:**
```json
{
  "ok": true,
  "data": {
    "items": [...],
    "total": 150,
    "page": 1,
    "pageSize": 24
  }
}
```

### POST /api/search/save

**Body:**
```json
{
  "query": "BMW 535d",
  "filters": {
    "category": "uuid",
    "price_min": 4000,
    "price_max": 6000
  }
}
```

**Response:**
```json
{
  "ok": true,
  "id": "uuid"
}
```

## Frontend Components

| Компонент | Путь | Описание |
|-----------|------|----------|
| SearchBar | `apps/web/src/components/SearchBar.tsx` | Глобальная строка поиска |
| SearchFilters | `apps/web/src/components/SearchFilters.tsx` | Панель фильтров |
| SearchResults | `apps/web/src/components/SearchResults.tsx` | Результаты с пагинацией |
| SearchPage | `apps/web/src/app/search/page.tsx` | Страница поиска |

## Чек-лист MVP

- [ ] Глобальная строка поиска в header (autocomplete на категориях)
- [ ] Страница `/search?q=...` с результатами и фильтрами
- [ ] Фильтры: категория (каскад), цена (slider), локация (autocomplete), радиус
- [ ] Сортировка: новинки / цена ↑↓ / релевантность
- [ ] Геопоиск: выбор на карте + радиус в км
- [ ] Пагинация: 24 на страницу, бесконечный scroll (mobile) / кнопки (desktop)
- [ ] URL синхронизация: фильтры → query params
- [ ] Сохранение поиска (для авторизованных пользователей)

## Post-MVP

- Фасетный поиск (filters-as-you-type)
- Поиск по изображениям (reverse image search)
- Сохраненные поиски с email-уведомлениями
- AI-рекомендации похожих объявлений

## TODO for developers

1. **Создать PostgreSQL function `search_adverts`**
   - [ ] Миграция с функцией поиска
   - [ ] Тестирование full-text search
   - [ ] Оптимизация индексов (GIN для tsvector)

2. **Реализовать API endpoint `/api/search`**
   - [ ] Валидация query params (Zod schema)
   - [ ] Вызов `search_adverts` через `supabase.rpc()`
   - [ ] Обработка ошибок
   - [ ] Rate limiting (опционально)

3. **Создать компонент SearchBar**
   - [ ] Autocomplete для категорий
   - [ ] Дебаунс поиска (300ms)
   - [ ] Навигация на `/search?q=...`

4. **Создать компонент SearchFilters**
   - [ ] Каскадный селектор категорий
   - [ ] Range slider для цены
   - [ ] Autocomplete для локации
   - [ ] Кнопка "Сбросить фильтры"
   - [ ] Desktop: sidebar, Mobile: drawer

5. **Создать страницу SearchPage**
   - [ ] SSR для SEO (если query статический)
   - [ ] Client-side фильтрация
   - [ ] URL sync с фильтрами
   - [ ] Пагинация или infinite scroll

6. **Реализовать геопоиск**
   - [ ] Интеграция карты (Mapbox/Google Maps)
   - [ ] Выбор точки на карте
   - [ ] Расчет расстояния через PostGIS (если `location_id` используется)

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [database-schema.md](./database-schema.md) • [deep-audit-20251108.md](./deep-audit-20251108.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [categories/real-estate.md](../catalog/categories/real-estate.md)




