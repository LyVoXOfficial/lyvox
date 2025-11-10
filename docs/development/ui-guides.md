# UI-гайды

## Design System

### Component Library

**Основа:** shadcn/ui (Radix UI + Tailwind)

**Базовые компоненты:**
- Button, Input, Select, Dialog, Tabs, Card
- Dropdown, Popover, Tooltip
- Form, Label, Textarea

**Кастомные компоненты:**
- AdvertCard, AdvertGallery
- CategoryTree, CategoryCard
- SearchBar, SearchFilters
- ChatWindow, MessageList
- ProfileCard, TrustScoreBadge

### Color Palette

| Цвет | Использование | Hex |
|------|--------------|-----|
| Primary | Основные действия, links | (брендовый цвет LyVoX) |
| Secondary | Второстепенные действия | (акцентный) |
| Success | Успешные операции | #10b981 (green) |
| Error | Ошибки, удаление | #ef4444 (red) |
| Warning | Предупреждения | #f59e0b (yellow) |
| Info | Информация | #3b82f6 (blue) |

**Tailwind конфигурация:**
```typescript
// tailwind.config.ts
colors: {
  primary: '...',
  secondary: '...',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6'
}
```

### Typography

**Шрифты:**
- Headings: Inter или система шрифтов
- Body: читаемый sans-serif (Inter)

**Размеры:**
- Desktop: `text-3xl` (headings), `text-base` (body)
- Mobile: `text-2xl` (headings), `text-sm` (body)

**Responsive:**
```css
h1 {
  @apply text-2xl md:text-3xl lg:text-4xl;
}
```

### Spacing & Layout

**Tailwind spacing scale:**
- `p-2`, `p-4`, `p-6`, `p-8` для padding
- `gap-4`, `gap-6`, `gap-8` для grid/flex

**Container:**
- Max-width: 1280px (desktop)
- Padding: `px-4 md:px-6 lg:px-8`

**Grid system:**
- 12 колонок на desktop
- Responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

### Icons

**Библиотека:** Lucide React

**Размеры:**
- Small: `w-4 h-4` (16px)
- Medium: `w-5 h-5` (20px)
- Large: `w-6 h-6` (24px)

**Использование:**
```typescript
import { Car, Search, User } from 'lucide-react';

<Car className="w-5 h-5" />
```

### Animations

**Transitions:**
- Duration: 150-300ms
- Easing: `ease-in-out`

**Loading states:**
- Skeleton screens для контента
- Spinner для действий

**Micro-interactions:**
- Hover effects на кнопках
- Button press feedback
- Smooth transitions

## Components Structure

```
apps/web/src/components/
  ├── ui/              # shadcn базовые компоненты
  ├── adverts/         # AdvertCard, AdvertGallery, AdvertDetails
  ├── chat/            # ChatWindow, MessageList, MessageInput
  ├── profile/         # ProfileCard, TrustScoreBadge, VerificationBadge
  ├── search/          # SearchBar, SearchFilters, SearchResults
  └── shared/          # MainHeader, BottomNav, LegalFooter, Breadcrumbs
```

## Accessibility (WCAG 2.1 AA)

**Требования:**
- Semantic HTML
- ARIA labels где необходимо
- Keyboard navigation
- Focus indicators
- Color contrast (минимум 4.5:1)
- Alt text для изображений

**Примеры:**
```typescript
<button
  aria-label="Close dialog"
  onClick={handleClose}
  className="focus:outline-none focus:ring-2 focus:ring-primary"
>
  <X className="w-5 h-5" />
</button>
```

## Dark Mode (Post-MVP)

**Поддержка:**
- Tailwind dark mode: `dark:` префикс
- Системная тема или переключатель
- Сохранение выбора в localStorage

## Чек-лист MVP

- [ ] Design system документирован
- [ ] Consistent spacing/typography
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Все компоненты используют shadcn/ui базовые
- [ ] Кастомные компоненты следуют тем же паттернам

## Чек-лист Post-MVP

- [ ] Все компоненты в Storybook
- [ ] Dark mode поддержка
- [ ] Animation библиотека (framer-motion)

## TODO for developers

1. **Документировать design system**
   - [ ] Цветовая палитра
   - [ ] Typography scale
   - [ ] Spacing scale
   - [ ] Component examples

2. **Создать базовые компоненты**
   - [ ] Установить shadcn/ui компоненты
   - [ ] Кастомизировать под бренд LyVoX
   - [ ] Создать кастомные компоненты (AdvertCard, etc.)

3. **Улучшить accessibility**
   - [ ] Добавить ARIA labels
   - [ ] Проверка keyboard navigation
   - [ ] Проверка color contrast
   - [ ] Screen reader testing

4. **Оптимизировать animations**
   - [ ] Smooth transitions
   - [ ] Loading states (skeleton screens)
   - [ ] Micro-interactions

5. **Создать Storybook (Post-MVP)**
   - [ ] Настройка Storybook
   - [ ] Документация всех компонентов
   - [ ] Interactive examples

6. **Реализовать Dark Mode (Post-MVP)**
   - [ ] Tailwind dark mode конфигурация
   - [ ] Переключатель темы
   - [ ] Темы для всех компонентов

---

## 🔗 Related Docs

**Development:** [database-schema.md](./database-schema.md) • [deep-audit-20251108.md](./deep-audit-20251108.md) • [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) • [roadmap.md](./roadmap.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)




