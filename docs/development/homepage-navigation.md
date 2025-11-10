# Главная страница и навигация

## MVP Scope

### Компоненты главной страницы

| Компонент | Описание | Приоритет |
|-----------|----------|-----------|
| Hero-секция | CTA "Разместить объявление", статистика платформы | P0 |
| Навигация категорий | 3-уровневая структура (dropdown desktop, drawer mobile) | P0 |
| Лента свежих объявлений | 24 последних активных объявлений | P0 |
| Блок бесплатных | До 10 объявлений с ценой 0 или null | P1 |
| Популярные категории | Топ-8 категорий по количеству объявлений | P1 |
| Footer | Legal links, контакты, социальные сети | P0 |

## Technical Implementation

### Файлы

| Путь | Назначение | Тип |
|------|-----------|------|
| `apps/web/src/app/page.tsx` | Главная страница (SSR) | Server Component |
| `apps/web/src/components/MainHeader.tsx` | Верхняя навигация | Client Component |
| `apps/web/src/components/BottomNav.tsx` | Мобильная навигация | Client Component |
| `apps/web/src/components/LegalFooter.tsx` | Футер | Client Component |
| `apps/web/src/components/AdvertGrid.tsx` | Grid лента объявлений | Client Component |
| `apps/web/src/components/CategoryTree.tsx` | Дерево категорий | Client Component |

### API/Queries

**Загрузка свежих объявлений:**
```typescript
const { data } = await supabase
  .from('adverts')
  .select('id, title, price, location, created_at')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(24);
```

**Загрузка категорий:**
```typescript
const { data } = await supabase
  .from('categories')
  .select('*')
  .eq('level', 1)
  .eq('is_active', true)
  .order('sort');
```

**Загрузка медиа (batch):**
```typescript
const { data } = await supabase
  .from('media')
  .select('advert_id, url, sort')
  .in('advert_id', advertIds)
  .order('sort', { ascending: true });
```

### Структура навигации

**Desktop Navigation:**
- Logo (слева)
- Категории (dropdown с 3 уровнями)
- Поиск (глобальная строка)
- Профиль/Вход (справа)

**Mobile Navigation:**
- Bottom nav: Home, Browse, Post, Profile, More
- Top: Logo, Search, Profile (иконки)

## Чек-лист MVP

- [ ] Hero-секция с CTA и базовой статистикой
- [ ] 3-уровневая навигация категорий (desktop dropdown, mobile drawer)
- [ ] Лента свежих объявлений (grid/list toggle на desktop)
- [ ] Мобильная навигация с иконками (BottomNav)
- [ ] Breadcrumbs на внутренних страницах
- [ ] Footer с локализованными ссылками (NL/FR/EN/RU)
- [ ] Оптимизация изображений (WebP, lazy loading)
- [ ] Performance: LCP < 2.5s, FID < 100ms

## Post-MVP Enhancements

1. **Персонализация ленты** - рекомендации на основе истории просмотров
2. **AI-powered рекомендации** - блок "Рекомендации для вас"
3. **Live статистика** - количество объявлений, пользователей в hero
4. **Trending категории** - динамический топ на основе активности

## TODO for developers

1. **Создать компонент MainHeader**
   - [ ] Интеграция с `CategoryTree` для dropdown
   - [ ] Глобальная строка поиска (`SearchBar`)
   - [ ] Адаптация для mobile (burger menu)

2. **Создать компонент BottomNav**
   - [ ] 5 иконок: Home, Browse, Post, Profile, More
   - [ ] Active state индикация
   - [ ] Только для mobile (< 768px)

3. **Оптимизировать главную страницу**
   - [ ] SSR для SEO
   - [ ] Lazy loading для изображений
   - [ ] Кэширование запросов к Supabase (revalidate 60s)

4. **Реализовать Breadcrumbs**
   - [ ] Компонент `Breadcrumbs.tsx`
   - [ ] Динамические пути для категорий
   - [ ] Локализация названий

5. **Создать LegalFooter**
   - [ ] Ссылки: Terms, Privacy, GDPR, Contact
   - [ ] Социальные сети (иконки)
   - [ ] Локализация всех ссылок

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md) • [DATABASE_STRATEGY.md](../catalog/DATABASE_STRATEGY.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../catalog/CATALOG_IMPLEMENTATION_STATUS.md) • [categories/real-estate.md](../catalog/categories/real-estate.md)




