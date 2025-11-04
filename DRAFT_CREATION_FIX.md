# Исправление создания черновика

## 📅 Дата: 4 ноября 2025, 20:25

---

## ⚠️ Проблема

**Симптомы:**
1. На шаге 7 (Фотографии) отображается "Загрузка..." без возможности добавить фото
2. При попытке публикации появляется ошибка:
   ```
   Publish error: Error: Failed to create draft
   ```

**Скриншот:**
- Прогресс: 88% (Шаг 7 из 8)
- Раздел "Фотографии" показывает "Загрузка..."
- Компонент `UploadGallery` не появляется

---

## 🔍 Причина

### Проблема #1: `ensureAdvertId` не обернута в `useCallback`

Функция `ensureAdvertId` создаётся заново при каждом рендере, что нарушает зависимости `useEffect`:

```typescript
// ❌ БЫЛО - функция создаётся заново каждый раз
const ensureAdvertId = async (): Promise<string> => {
  // ...
};

useEffect(() => {
  await ensureAdvertId(); // функция всегда "новая", useEffect не срабатывает правильно
}, [currentStep, advertId, isLoading, t]); // ensureAdvertId отсутствует в зависимостях!
```

**Результат:** `useEffect` мог не срабатывать или срабатывать неправильно.

### Проблема #2: Отсутствие debug логирования

Не было понятно, на каком этапе происходит ошибка:
- Вызывается ли `useEffect`?
- Отправляется ли запрос к API?
- Что возвращает API?

---

## ✅ Решение

### 1. Обернули `ensureAdvertId` в `useCallback`

```typescript
// ✅ СТАЛО - функция мемоизирована
const ensureAdvertId = useCallback(async (): Promise<string> => {
  if (advertId) return advertId;
  
  console.log("[PostForm] Creating new draft...");
  const response = await apiFetch("/api/adverts", { method: "POST" });
  const result = await response.json();
  console.log("[PostForm] Draft API response:", result);

  if (!result.ok) {
    console.error("[PostForm] Draft creation failed:", result.error);
    throw new Error(result.error || t("post.create_failed"));
  }
  
  const newId = result.data?.advert?.id;
  if (!newId) {
    console.error("[PostForm] No advert ID in response:", result);
    throw new Error("Failed to create draft");
  }
  
  console.log("[PostForm] Draft created successfully:", newId);
  setAdvertId(newId);
  return newId;
}, [advertId, t]);
```

**Зависимости `useCallback`:**
- `advertId` - чтобы проверить, создан ли уже черновик
- `t` - функция перевода

### 2. Добавили `ensureAdvertId` в зависимости `useEffect`

```typescript
useEffect(() => {
  if (currentStep === 7 && !advertId && !isLoading && !draftCreationInProgress.current) {
    console.log("[PostForm] Auto-creating draft for step 7...");
    draftCreationInProgress.current = true;
    const createDraft = async () => {
      try {
        const newId = await ensureAdvertId();
        console.log("[PostForm] Draft created, ID:", newId);
        toast.success(t("post.draft_created") || "Черновик создан");
      } catch (error: any) {
        console.error("[PostForm] Draft creation error:", error);
        toast.error(t("post.update_error") || "Ошибка", { 
          description: error.message 
        });
      } finally {
        draftCreationInProgress.current = false;
      }
    };
    createDraft();
  }
}, [currentStep, advertId, isLoading, t, ensureAdvertId]); // ← добавлено ensureAdvertId
```

### 3. Добавили подробное логирование

Теперь в консоли браузера можно увидеть:
- `[PostForm] Auto-creating draft for step 7...` - `useEffect` сработал
- `[PostForm] Creating new draft...` - начало запроса к API
- `[PostForm] Draft API response: {...}` - ответ от API
- `[PostForm] Draft created successfully: uuid` - успешное создание
- `[PostForm] Draft created, ID: uuid` - ID установлен в state

**При ошибке:**
- `[PostForm] Draft creation failed: error message` - ошибка от API
- `[PostForm] No advert ID in response: {...}` - нет ID в ответе
- `[PostForm] Draft creation error: Error` - общая ошибка

### 4. Добавили импорт `useCallback`

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
```

---

## 📝 Изменённый файл

**Файл:** `apps/web/src/app/post/PostForm.tsx`

**Изменения:**

1. **Строка 3:** Добавлен импорт `useCallback`
2. **Строки 374-396:** Функция `ensureAdvertId` обернута в `useCallback` с логированием
3. **Строки 307-327:** Обновлён `useEffect` с добавлением `ensureAdvertId` в зависимости и логированием

---

## 🚀 Деплой

**Коммит:** `8180fe7`  
**Сообщение:** "fix: wrap ensureAdvertId in useCallback and add debug logging"

**Статус:**
- ✅ Тесты пройдены (22/22)
- ✅ Коммит создан
- ✅ Запушено на GitHub
- ⏳ Ожидается автоматический деплой на Vercel (~2-5 минут)

---

## 🧪 Как протестировать

1. **Откройте консоль браузера** (F12)
2. **Перейдите к созданию объявления:** `/post`
3. **Заполните форму** шаг за шагом до шага 7
4. **На шаге 7 проверьте консоль:**
   ```
   [PostForm] Auto-creating draft for step 7...
   [PostForm] Creating new draft...
   [PostForm] Draft API response: { ok: true, data: { advert: { id: "...", ... } } }
   [PostForm] Draft created successfully: uuid
   [PostForm] Draft created, ID: uuid
   ```
5. **Проверьте UI:**
   - ✅ Появился toast "Черновик создан"
   - ✅ Вместо "Загрузка..." появился компонент загрузки фото
   - ✅ Можно добавлять фотографии
6. **Добавьте несколько фотографий**
7. **Завершите создание объявления**

---

## 📚 Почему `useCallback` важен

### Без `useCallback`

```typescript
function Component() {
  const myFunction = () => {
    // каждый рендер создаёт НОВУЮ функцию
  };
  
  useEffect(() => {
    myFunction(); // myFunction всегда "разная"
  }, [myFunction]); // ← useEffect будет срабатывать при каждом рендере!
}
```

### С `useCallback`

```typescript
function Component() {
  const myFunction = useCallback(() => {
    // функция мемоизирована и остаётся той же
  }, [dependencies]);
  
  useEffect(() => {
    myFunction(); // myFunction стабильна
  }, [myFunction]); // ← useEffect срабатывает только когда нужно
}
```

---

## 🐛 Диагностика через консоль

### Если черновик не создаётся

**Проверьте логи в консоли:**

1. **Нет лога `[PostForm] Auto-creating draft...`**
   - Проблема: `useEffect` не срабатывает
   - Проверьте: `currentStep`, `advertId`, `isLoading`

2. **Есть `Creating new draft...` но нет `Draft API response...`**
   - Проблема: Запрос к API завис или упал
   - Проверьте: Network tab в DevTools

3. **Есть `Draft API response: { ok: false, ... }`**
   - Проблема: API вернул ошибку
   - Проверьте: `result.error` в логе

4. **Есть `No advert ID in response`**
   - Проблема: API вернул неправильную структуру
   - Проверьте: полный ответ в логе

---

## ✅ Итог

| Проблема | Статус |
|----------|--------|
| useCallback отсутствует | ✅ **ИСПРАВЛЕНО** |
| ensureAdvertId в зависимостях | ✅ **ИСПРАВЛЕНО** |
| Отсутствие логирования | ✅ **ДОБАВЛЕНО** |
| "Загрузка..." без фото | ✅ **ДОЛЖНО РАБОТАТЬ** |
| "Failed to create draft" | ✅ **ДОЛЖНО БЫТЬ ИСПРАВЛЕНО** |

---

## 📊 Все исправления

| # | Коммит | Проблема | Статус |
|---|--------|----------|--------|
| 1 | `6ea3570` | vehicle_insights_i18n translations | ✅ |
| 2 | `e948d57` | Insights query 400 error | ✅ |
| 3 | `3258012` | React Error #310 | ✅ |
| 4 | `8180fe7` | Draft creation with useCallback | ✅ |

---

**Проблема должна быть исправлена!** 🎉

После деплоя откройте консоль браузера и следите за логами для диагностики.

**Коммит:** `8180fe7`  
**Дата:** 4 ноября 2025, 20:25  
**Статус:** ✅ Готово к тестированию

