# Мобильная версия / Адаптив

## Breakpoints

| Размер | Пиксели | Использование |
|--------|---------|--------------|
| Mobile | < 768px | Мобильные телефоны |
| Tablet | 768px - 1024px | Планшеты |
| Desktop | > 1024px | Десктоп |

**Tailwind CSS префиксы:**
- `sm:` - 640px+
- `md:` - 768px+
- `lg:` - 1024px+
- `xl:` - 1280px+

## Key Adaptations

| Компонент | Desktop | Mobile |
|-----------|---------|--------|
| Navigation | Top nav с dropdown | Bottom nav |
| Search | Header bar | Fullscreen modal |
| Filters | Sidebar | Drawer |
| Forms | Multi-step | Accordion |
| Tables | Full table | Card list |
| Gallery | Grid 3-4 columns | Grid 2 columns |

## Mobile-First Components

### Touch Targets

**Требования:**
- Минимум 44x44px для всех интерактивных элементов
- Достаточный spacing между элементами

```css
/* Пример */
.button {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;
}
```

### Swipe Gestures

**Реализация:**
- Галерея: swipe для переключения изображений
- Список объявлений: swipe to delete (в личном кабинете)
- Библиотека: `react-swipeable` или `swiper`

### Bottom Sheet

**Использование:**
- Модальные окна на mobile
- Фильтры
- Меню действий

**Компонент:**
```typescript
// apps/web/src/components/BottomSheet.tsx
// Использовать Radix UI Sheet или кастомный
```

## Navigation

### Desktop Navigation

**Компонент:** `MainHeader.tsx`
- Logo слева
- Категории (dropdown)
- Поиск (глобальная строка)
- Профиль/Вход справа

### Mobile Navigation

**Компонент:** `BottomNav.tsx`
- Fixed position внизу экрана
- 5 иконок: Home, Browse, Post, Profile, More
- Active state индикация
- Только для screens < 768px

## Search

### Desktop
- Глобальная строка поиска в header
- Autocomplete dropdown

### Mobile
- Иконка поиска в header
- При клике: fullscreen modal
- Поисковая строка + фильтры в одном интерфейсе

## Forms

### Multi-Step Form (Desktop)
- Прогресс-бар сверху
- Все шаги видимы
- Навигация вперед/назад

### Accordion Form (Mobile)
- Каждый шаг = accordion секция
- Свернуть/развернуть шаги
- Прогресс-бар компактный

## Performance

**Требования:**
- Load time < 3s на 3G
- LCP < 2.5s
- FID < 100ms

**Оптимизации:**
- Lazy loading изображений
- Code splitting по routes
- Оптимизация bundle size

**Изображения:**
- WebP формат с fallback
- Responsive images: `srcset`
- Lazy loading: `loading="lazy"`

```typescript
<Image
  src={imageUrl}
  srcSet={`${imageUrl}?w=400 400w, ${imageUrl}?w=800 800w`}
  sizes="(max-width: 768px) 100vw, 50vw"
  loading="lazy"
  alt={title}
/>
```

## PWA Support (Post-MVP)

**Манифест:**
```json
// apps/web/public/manifest.json
{
  "name": "LyVoX",
  "short_name": "LyVoX",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [...]
}
```

**Service Worker:**
- Offline поддержка
- Cache стратегия
- Push notifications

**Install Prompt:**
- Автоматический prompt после взаимодействия (future)
- Кнопка "Установить" в меню (manual)

## Чек-лист MVP

- [ ] Все страницы responsive
- [ ] Mobile navigation (bottom nav)
- [ ] Touch-friendly интерфейс (min 44x44px)
- [ ] Оптимизация изображений (WebP, lazy loading)
- [ ] Fast load times (< 3s на 3G)
- [ ] Swipe gestures для галереи

## Чек-лист Post-MVP

- [ ] PWA манифест
- [ ] Service worker
- [ ] Offline поддержка
- [ ] Install prompt

## TODO for developers

1. **Адаптировать все страницы**
   - [ ] Проверка на всех breakpoints (mobile/tablet/desktop)
   - [ ] Использование Tailwind responsive префиксов
   - [ ] Тестирование на реальных устройствах

2. **Создать BottomNav компонент**
   - [ ] 5 иконок с labels
   - [ ] Active state индикация
   - [ ] Fixed position
   - [ ] Только для mobile (< 768px)

3. **Адаптировать формы**
   - [ ] Multi-step на desktop
   - [ ] Accordion на mobile
   - [ ] Touch-friendly inputs (больше размер, больше spacing)

4. **Оптимизировать изображения**
   - [ ] WebP конвертация
   - [ ] Responsive srcset
   - [ ] Lazy loading
   - [ ] Placeholder blur

5. **Улучшить performance**
   - [ ] Code splitting
   - [ ] Bundle size optimization
   - [ ] Lazy loading компонентов
   - [ ] Проверка Core Web Vitals

6. **Добавить swipe gestures**
   - [ ] Галерея изображений
   - [ ] Swipe to delete (в личном кабинете)
   - [ ] Библиотека: react-swipeable

7. **Создать BottomSheet компонент**
   - [ ] Для модальных окон на mobile
   - [ ] Smooth animations
   - [ ] Backdrop с blur

8. **PWA setup (Post-MVP)**
   - [ ] Манифест файл
   - [ ] Service worker регистрация
   - [ ] Offline стратегия
   - [ ] Install prompt

---

## 🔗 Related Docs

**Development:** [deep-audit-20251108.md](./deep-audit-20251108.md) • [Production master](../MASTER_PRODUCTION_TZ.md) • [database-schema.md](./database-schema.md) • [notifications.md](./notifications.md) • [README.md](./README.md)



