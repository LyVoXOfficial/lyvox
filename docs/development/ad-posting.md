# Подача объявления

## Current State

| Компонент | Статус |
|-----------|--------|
| 8-шаговая форма для Transport | Реализована (`apps/web/src/app/post/PostForm.tsx`) |
| Draft → Active workflow | Работает |
| Media upload | Supabase Storage |

## MVP Scope (для всех категорий)

### Шаги формы

| Шаг | Описание | Обязательные поля |
|-----|----------|------------------|
| 1. Категория | Выбор категории (3 уровня) | `category_id` |
| 2. Условие | new/used/for_parts | `condition` |
| 3. Основные поля | title, description, price, currency, location | `title`, `description` |
| 4. Специфичные атрибуты | Зависят от категории, JSON в `ad_item_specifics` | Зависит от категории |
| 5. Медиа | До 12 фото, drag&drop reorder | Минимум 1 фото для публикации |
| 6. Контакт | Телефон из профиля + дополнительный | `phone` (из профиля) |
| 7. Preview | Предпросмотр перед публикацией | - |
| 8. Публикация | Publish / Save Draft / Delete | - |

### API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/adverts` | POST | Создание draft объявления |
| `/api/adverts/[id]` | PATCH | Обновление объявления |
| `/api/adverts/[id]` | DELETE | Удаление объявления |
| `/api/media/sign` | POST | Получение signed URL для загрузки |
| `/api/media/reorder` | POST | Изменение порядка изображений |

### Валидация

| Поле | Правила | Сообщение об ошибке |
|------|---------|---------------------|
| `title` | 3-200 символов | "Title must be between 3 and 200 characters" |
| `description` | 10+ символов | "Description must be at least 10 characters" |
| `price` | >= 0, опционально | "Price must be non-negative" |
| `category_id` | Обязательно | "Please select a category" |
| `condition` | Обязательно для некоторых категорий | "Please select condition" |

### Transport-специфичные поля

Интеграция с `vehicle_makes`, `vehicle_models`, `vehicle_generations`:

```typescript
interface TransportSpecifics {
  make_id: string;
  model_id: string;
  generation_id?: string;
  year: number;
  mileage: number;
  steering_wheel: string;
  body_type: string;
  doors: number;
  color_id: string;
  // ... остальные поля
}
```

## Media Upload Flow

**Шаги загрузки:**
1. Пользователь выбирает файлы (drag&drop или click)
2. Валидация: тип (image/*), размер (max 5MB), количество (max 12)
3. Вызов `/api/media/sign` для получения signed URL
4. Загрузка в Supabase Storage: `ad-media/{user_id}/{advert_id}/{timestamp-filename}`
5. Сохранение метаданных в `media` таблице
6. Переупорядочивание через drag&drop → `/api/media/reorder`

**Структура пути в Storage:**
```
ad-media/
  └── {user_id}/
      └── {advert_id}/
          ├── 1234567890-image1.jpg
          ├── 1234567891-image2.jpg
          └── ...
```

## Draft Auto-save

**Реализация:**
- Автосохранение каждые 30 секунд (если есть изменения)
- Debounce на изменения полей формы
- Индикатор "Saving..." / "Saved"

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (hasChanges) {
      saveDraft();
    }
  }, 30000);
  
  return () => clearTimeout(timer);
}, [formData]);
```

## Preview Page

**Требования:**
- Exact preview страницы объявления (`/ad/[id]/[slug]`)
- Использовать те же компоненты, что и на реальной странице
- Индикатор "Preview mode" (не публичное объявление)
- Кнопки: "Edit", "Publish", "Save as Draft"

## Чек-лист MVP

- [ ] Multi-step форма с прогресс-баром
- [ ] Валидация на каждом шаге (client + server)
- [x] Draft сохранение (автосохранение каждые 30 сек)
- [ ] Media upload: drag&drop, preview, reorder, удаление
- [ ] Preview перед публикацией (exact preview страницы объявления)
- [ ] Публикация требует: минимум 1 фото, заполненные обязательные поля
- [ ] Success page после публикации с CTA "Посмотреть" / "Разместить еще"
- [ ] Поддержка всех категорий (не только Transport)

## Post-MVP

- AI-подсказки для описания (LLM генерация на основе фото)
- Автоматическое определение характеристик из фото (ML)
- Шаблоны объявлений (save as template)

## TODO for developers

1. **Расширить PostForm для всех категорий**
   - [ ] Условный рендеринг шага 4 в зависимости от категории
   - [ ] Генерация полей специфичных для каждой категории
   - [ ] Валидация специфичных полей

2. **Реализовать автосохранение draft**
   - [x] Debounce механизм (30 секунд)
   - [x] Индикатор статуса сохранения
   - [x] Обработка ошибок сохранения

3. **Улучшить media upload**
   - [x] Drag&drop интерфейс
   - [x] Preview миниатюр
   - [x] Reorder через drag&drop
   - [x] Удаление изображений
   - [x] Валидация: тип, размер, количество

4. **Создать preview страницу**
   - [ ] Компонент `AdPreview.tsx`
   - [ ] Использование тех же компонентов, что и на реальной странице
   - [ ] Индикатор preview mode
   - [ ] Навигация: Edit / Publish / Save Draft

5. **Реализовать success page**
   - [ ] Страница `/post/success?id=...`
   - [ ] Информация о опубликованном объявлении
   - [ ] CTA кнопки: "Посмотреть объявление", "Разместить еще"

6. **Улучшить валидацию**
   - [ ] Zod schemas для каждого шага
   - [ ] Server-side валидация в API endpoints
   - [ ] Понятные сообщения об ошибках
   - [ ] Подсветка полей с ошибками

---

## 🔗 Related Docs

**Domains:** [adverts.md](../domains/adverts.md)
**Development:** [deep-audit-20251108.md](./deep-audit-20251108.md) • [Production master](../MASTER_PRODUCTION_TZ.md)
**Catalog:** [DATABASE_STRATEGY.md](../catalog/DATABASE_STRATEGY.md)
**Core:** [API_REFERENCE.md](../API_REFERENCE.md)
