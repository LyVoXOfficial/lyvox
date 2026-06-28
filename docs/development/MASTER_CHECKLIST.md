> ⚠ УСТАРЕЛО — этот файл больше не ведётся. Единый источник правды: [docs/MASTER_TODO.md](../MASTER_TODO.md). Сведено туда; можно удалить.

# Master Checklist - LyVoX Development

> **🎯 ГЛАВНЫЙ ФАЙЛ ДЛЯ КОМАНДЫ** - все задачи в одном месте, упорядоченные по приоритетам

> **📋 Интеграция с промптом**: Этот файл интегрирован с `PROMPT_MAIN.md`. AI ассистенты автоматически обновляют прогресс после выполнения задач. См. секцию "Post-Task Deployment Checklist" в `PROMPT_MAIN.md`.

## Как использовать этот файл

### Структура

- **Сверху (🔴)** → Задачи делать **прямо сейчас** (независимые, основа всего)
- **Внизу (⚪)** → Задачи на будущее (зависят от вышестоящих)

### Правила выполнения

1. ✅ **Не перескакивайте** между фазами - это вызовет переделки
2. ✅ **Делайте по порядку** - сверху вниз внутри каждой фазы
3. ✅ **Можно параллельно** - задачи внутри одной фазы можно делать одновременно разными разработчиками
4. ✅ **Отмечайте прогресс** - ставьте `[x]` сразу после завершения
5. ✅ **Проверяйте зависимости** - если задача требует что-то из другой фазы, сначала завершите зависимость

### Формат задачи

```
- [ ] **ID**: Название задачи
  - [ ] Подзадача 1
  - [ ] Подзадача 2
  - [ ] Файл: путь/к/файлу
```

### Статус выполнения

- `[ ]` - Не начато
- `[~]` - В процессе (можно добавить вручную)
- `[x]` - Выполнено

---

## 🔴 PHASE 0: Foundation (Сделать ПЕРВЫМ - основа для всего)

> **Зачем:** Без этого нельзя двигаться дальше. Эти задачи не зависят друг от друга и не требуют переделок.

### Database Infrastructure

- [x] **DB-001**: Проверить существующие миграции для MVP таблиц
  - [x] `adverts`, `media`, `categories`, `profiles`, `phones`, `phone_otps`, `reports`, `trust_score`, `logs`
  - [x] Создать недостающие миграции (если есть пробелы)
  - [x] Файл: `supabase/migrations/20251102033919_mvp_tables_complete.sql`

- [x] **DB-002**: Добавить недостающие индексы для производительности
  - [x] Индексы для поиска: `adverts(title, description)` - GIN для full-text
  - [x] Индексы для фильтрации: `adverts(category_id, status, created_at DESC)`
  - [x] Индексы для категорий: `categories(parent_id, is_active, sort)`
  - [x] Файл: `supabase/migrations/20251102034309_mvp_indexes.sql`

- [x] **DB-003**: Проверить и усилить RLS policies для всех MVP таблиц
  - [x] Аудит текущих policies
  - [x] Тестирование от лица разных пользователей (guest, user, admin)
  - [x] Файл: `supabase/migrations/20251102034546_mvp_rls_complete.sql`

- [x] **DB-004**: Создать helper функции PostgreSQL
  - [x] `search_adverts(...)` - поиск с фильтрами (см. `search-filters.md`)
  - [x] Проверить `trust_inc()` и `is_admin()` (уже есть)
  - [x] Файл: `supabase/migrations/20251102034812_mvp_functions.sql`

### Core API Infrastructure

- [x] **API-001**: Стандартизировать формат ответов всех endpoints
  - [x] Success: `{ok: true, data: {...}}`
  - [x] Error: `{ok: false, error: 'ERROR_CODE', detail?: string}`
  - [x] Файл: `apps/web/src/lib/apiErrors.ts` (обновить)

- [x] **API-002**: Централизовать error handling
  - [x] Helper `createErrorResponse()` используется везде
  - [x] HTTP status codes правильные (400/401/403/404/429/500)
  - [x] Файл: `apps/web/src/lib/apiErrors.ts`

- [x] **API-003**: Добавить Zod validation для всех request bodies
  - [x] Создать schemas в `apps/web/src/lib/validations/`
  - [x] Интегрировать в каждый POST/PATCH endpoint
  - [x] Понятные error messages

- [x] **API-004**: Настроить rate limiting на чувствительных endpoints
  - [x] `/api/phone/*` - 5/15min user, 20/60min IP
  - [x] `/api/reports/*` - 5/10min user, 50/24h IP
  - [x] `/api/admin/*` - 60/min admin
  - [x] Файл: `apps/web/src/lib/rateLimiter.ts` (обновить)

---

## 🟠 PHASE 1: Core MVP Features (После Foundation - независимые модули)

> **Зачем:** Эти задачи можно делать параллельно после Phase 0. Не мешают друг другу.

### Главная страница и навигация

- [x] **UI-001**: Создать компонент MainHeader
  - [x] Интеграция с CategoryTree для dropdown
  - [x] Глобальная строка поиска (SearchBar)
  - [x] Адаптация для mobile (burger menu)
  - [x] Файлы: `apps/web/src/components/main-header.tsx`, `CategoryTree.tsx`, `SearchBar.tsx`

- [x] **UI-002**: Создать компонент BottomNav (mobile)
  - [x] 5 иконок: Home, Browse, Post, Profile, More
  - [x] Active state индикация
  - [x] Только для mobile (< 768px)
  - [x] Файл: `apps/web/src/components/bottom-nav.tsx`

- [x] **UI-003**: Оптимизировать главную страницу
  - [x] SSR для SEO
  - [x] Lazy loading изображений
  - [x] Кэширование запросов (revalidate 60s)
  - [x] Файл: `apps/web/src/app/page.tsx`

- [x] **UI-004**: Создать Breadcrumbs компонент
  - [x] Динамические пути для категорий
  - [x] Локализация названий
  - [x] Файл: `apps/web/src/components/Breadcrumbs.tsx`

- [x] **UI-005**: Создать LegalFooter
  - [x] Ссылки: Terms, Privacy, GDPR, Contact
  - [x] Социальные сети
  - [x] Локализация всех ссылок
  - [x] Файл: `apps/web/src/components/LegalFooter.tsx`

### Поиск и фильтры

- [x] **API-005**: Создать PostgreSQL function `search_adverts`
  - [x] Full-text search по title и description
  - [x] Фильтры: category, price, location, radius
  - [x] Сортировка и пагинация
  - [x] Файл: `supabase/migrations/20250128120000_search_function.sql`

- [x] **API-006**: Реализовать API endpoint `/api/search`
  - [x] Валидация query params (Zod)
  - [x] Вызов `search_adverts` через `supabase.rpc()`
  - [x] Rate limiting (опционально)
  - [x] Файл: `apps/web/src/app/api/search/route.ts`

- [x] **UI-006**: Создать компонент SearchBar
  - [x] Autocomplete для категорий
  - [x] Дебаунс поиска (300ms)
  - [x] Навигация на `/search?q=...`
  - [x] Файл: `apps/web/src/components/SearchBar.tsx`

- [x] **UI-007**: Создать компонент SearchFilters
  - [x] Каскадный селектор категорий
  - [x] Range slider для цены
  - [x] Autocomplete для локации
  - [x] Desktop: sidebar, Mobile: drawer
  - [x] Файл: `apps/web/src/components/SearchFilters.tsx`

- [x] **UI-008**: Создать страницу SearchPage
  - [x] URL sync с фильтрами
  - [x] Пагинация или infinite scroll
  - [x] Файл: `apps/web/src/app/search/page.tsx`

### Категории

- [x] **DB-005**: Создать materialized view для подсчета объявлений
  - [x] `category_advert_counts` view
  - [x] Cron job для обновления (каждый час)
  - [x] Файл: `supabase/migrations/20251102100000_category_counts.sql`

- [x] **API-007**: Реализовать `/api/categories/tree`
  - [x] Локализация по `locale` параметру
  - [x] Рекурсивная загрузка children
  - [x] Кэширование ответа
  - [x] Файл: `apps/web/src/app/api/categories/tree/route.ts`

- [x] **UI-009**: Создать компонент CategoryTree
  - [x] Рекурсивный рендеринг дерева
  - [x] Dropdown desktop, drawer mobile
  - [x] Локализация названий
  - [x] Файл: `apps/web/src/components/CategoryTree.tsx`

### Профиль пользователя (базовый)

- [x] **UI-010**: Создать публичный профиль `/user/[id]`
  - [x] SSR страница
  - [x] RLS проверка (только публичные поля)
  - [x] Отображение статистики
  - [x] Файл: `apps/web/src/app/user/[id]/page.tsx`
  - [x] Миграция: `supabase/migrations/20251102120000_public_trust_score_access.sql`

- [x] **UI-011**: Расширить личный кабинет `/profile`
  - [x] Вкладки для разных разделов
  - [x] Dashboard с метриками
  - [x] Навигация между разделами
  - [x] Файл: `apps/web/src/app/(protected)/profile/page.tsx`

- [x] **UI-012**: Реализовать секцию "Мои объявления"
  - [x] Фильтры по статусу
  - [x] Пагинация
  - [x] Quick actions (edit/delete/duplicate)
  - [x] Файл: `apps/web/src/app/(protected)/profile/adverts/page.tsx`
  - [x] API: `apps/web/src/app/api/profile/adverts/route.ts`

### Авторизация и валидация

- [x] **VALIDATION-001**: Улучшение валидации форм авторизации
  - [x] Добавить client-side валидацию email перед отправкой запроса
  - [x] Добавить debounce для проверки доступности email
  - [x] Улучшить сообщения об ошибках для пользователя
  - [x] Файлы: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/register/RegisterForm.tsx`
  - [x] API: `apps/web/src/app/api/auth/check-email/route.ts`
  - [x] Hook: `apps/web/src/hooks/useDebounce.ts`

---

## 🟡 PHASE 2: Dependent Features (После Phase 1 - требуют готовой базы)

> **Зачем:** Эти задачи зависят от Phase 1, но можно делать параллельно между собой.

### Биометрическая авторизация (WebAuthn)

- [x] **BIOMETRIC-001**: Настройка WebAuthn в Supabase
  - [x] Включить WebAuthn MFA в конфигурации Supabase: `[auth.mfa.web_authn]`
  - [x] `enroll_enabled = true`, `verify_enabled = true`
  - [x] Файл: `supabase/config.toml`

- [x] **BIOMETRIC-002**: Создание библиотеки WebAuthn
  - [x] Функции: `enrollBiometric()`, `verifyBiometric()`, `listCredentials()`, `removeCredential()`
  - [x] Интеграция с Supabase Auth API для WebAuthn
  - [x] Обработка ошибок (браузер не поддерживает, пользователь отменил и т.д.)
  - [x] Проверка поддержки браузера `isWebAuthnSupported()`
  - [x] Файлы: `apps/web/src/lib/webauthn.ts`, `apps/web/src/hooks/useWebAuthn.ts`

- [x] **BIOMETRIC-003**: Создание UI компонентов для биометрии
  - [x] Компонент `BiometricEnrollButton.tsx` - кнопка регистрации биометрического ключа
  - [x] Компонент `BiometricLoginButton.tsx` - кнопка входа через биометрию
  - [x] Компонент `BiometricSettings.tsx` - полная страница настроек биометрии в профиле
  - [x] Список зарегистрированных устройств с возможностью удаления
  - [x] Поддержка 5 языков: EN, NL, FR, RU, DE
  - [x] Файлы: `apps/web/src/components/Biometric*.tsx`

- [x] **BIOMETRIC-004**: Интеграция биометрии в страницу входа
  - [x] Добавлена кнопка "Войти через биометрию" на страницу логина
  - [x] Проверка наличия зарегистрированных биометрических ключей
  - [x] Fallback на обычный email вход
  - [x] Разделитель "или" между вариантами входа
  - [x] Файл: `apps/web/src/app/login/page.tsx`

- [x] **BIOMETRIC-005**: API endpoints для управления биометрией
  - [x] POST `/api/auth/webauthn/enroll` - регистрация ключа
  - [x] POST `/api/auth/webauthn/verify` - верификация
  - [x] GET `/api/auth/webauthn/list` - список ключей
  - [x] DELETE `/api/auth/webauthn/remove` - удаление ключа
  - [x] Валидация с Zod для всех endpoints
  - [x] Обработка ошибок и edge cases
  - [x] Файлы: `apps/web/src/app/api/auth/webauthn/**/route.ts`

- [x] **BIOMETRIC-006**: Обновление типов TypeScript
  - [x] Создан `apps/web/src/types/webauthn.ts` с полными типами
  - [x] Request/Response типы для всех API endpoints
  - [x] Type guards: `isWebAuthnSuccess()`, `isWebAuthnError()`
  - [x] Error codes enum: `WebAuthnApiErrorCode`
  - [x] Validation schemas константы

### Подача объявления (расширение)

- [x] **UI-013**: Расширить PostForm для всех категорий
  - [x] Условный рендеринг шага 4 в зависимости от категории
  - [x] Генерация полей специфичных для каждой категории
  - [x] Валидация специфичных полей
  - [x] Файл: `apps/web/src/app/post/PostForm.tsx`
  - [x] Компоненты: `ElectronicsFields`, `RealEstateFields`, `FashionFields`, `JobsFields`
  - [x] API endpoints и типы созданы

- [x] **UI-014**: Реализовать автосохранение draft
  - [x] Debounce механизм (30 секунд)
  - [x] Индикатор статуса сохранения
  - [x] Файл: `apps/web/src/app/post/PostForm.tsx`

- [x] **UI-015**: Улучшить media upload
  - [x] Drag&drop интерфейс
  - [x] Preview миниатюр
  - [x] Reorder через drag&drop
  - [x] Файл: `apps/web/src/components/UploadGallery.tsx` (обновить)

### Просмотр объявления

- [x] **UI-016**: Создать компонент AdvertGallery
  - [x] Библиотека react-image-gallery или photo-swipe
  - [x] Lightbox функциональность
  - [x] Swipe gestures для mobile
  - [x] Файл: `apps/web/src/components/AdvertGallery.tsx`

- [x] **UI-017**: Реализовать SSR страницу объявления
  - [x] Загрузка данных через `supabaseServer()`
  - [x] Генерация slug из title
  - [x] 404 если не найдено
  - [x] SEO metadata generation
  - [x] Файл: `apps/web/src/app/ad/[id]/page.tsx`

- [x] **UI-018**: Создать компонент AdvertDetails
  - [x] Парсинг `ad_item_specifics.specifics` (JSON)
  - [x] Таблица характеристик
  - [x] Локализация названий полей
  - [x] Файл: `apps/web/src/components/AdvertDetails.tsx`

- [x] **UI-019**: Создать компонент SellerCard
  - [x] Отображение профиля продавца
  - [x] Trust score badge
  - [x] Верификации (email/phone)
  - [x] Файл: `apps/web/src/components/SellerCard.tsx`

- [x] **UI-020**: Реализовать блок похожих объявлений
  - [x] Query для поиска похожих
  - [x] Компонент `SimilarAdverts.tsx`
  - [x] Файл: `apps/web/src/components/SimilarAdverts.tsx`

### Верификация

- [x] **UI-021**: Создать компонент VerificationBadge
  - [x] Отображение иконок для email/phone
  - [x] Tooltip с пояснением
  - [x] Файл: `apps/web/src/components/VerificationBadge.tsx`

- [x] **UI-022**: Добавить badge на карточки объявлений
  - [x] В компоненте `AdvertCard.tsx`
  - [x] Показывать только если продавец верифицирован
  - [x] Файл: `apps/web/src/components/AdvertCard.tsx`

- [x] **UI-023**: Реализовать фильтр "Только верифицированные"
  - [x] Чекбокс в `SearchFilters.tsx`
  - [x] Query фильтр
  - [x] Файл: `apps/web/src/components/SearchFilters.tsx`

### Избранное

- [x] **DB-006**: Создать таблицу `favorites`
  - [x] Миграция с таблицей и индексами
  - [x] RLS policies
  - [x] Файл: `supabase/migrations/YYYYMMDD_favorites.sql`

- [x] **API-008**: Реализовать API endpoints для избранного
  - [x] GET `/api/favorites` - список
  - [x] POST `/api/favorites` - добавить
  - [x] DELETE `/api/favorites/[advertId]` - удалить
  - [x] Файлы: `apps/web/src/app/api/favorites/**/route.ts`

- [x] **UI-024**: Реализовать UI для избранного
  - [x] Кнопка добавления/удаления в карточке объявления
  - [x] Список избранных в профиле
  - [x] Файлы: `AdvertCard.tsx`, `apps/web/src/app/(protected)/profile/favorites/page.tsx`

---

## 🟢 PHASE 3: Advanced Features (После MVP базового - расширения)

> **Зачем:** Эти задачи добавляют новую функциональность, не ломая существующую.

### UX улучшения авторизации

- [x] **UX-001**: Улучшение страницы входа
  - [x] Добавить выбор метода входа (Email OTP, Биометрия)
  - [x] Добавить индикатор загрузки с анимацией
  - [x] Улучшить сообщения об ошибках
  - [x] Добавить "Запомнить это устройство на 30 дней" опцию
  - [x] Добавить ссылку на восстановление доступа
  - [x] Файл: `apps/web/src/app/login/page.tsx`

- [x] **UX-002**: Добавление страницы настроек безопасности
  - [x] Создать страницу настроек безопасности
  - [x] Добавить секцию управления биометрическими ключами
  - [x] Добавить список активных сессий
  - [x] Добавить возможность отключения всех устройств
  - [x] Добавить рекомендации по безопасности
  - [x] Файлы: `apps/web/src/app/(protected)/profile/security/page.tsx`, `SecuritySettingsClient.tsx`

- [x] **UX-003**: Улучшение обработки сессий
  - [x] Улучшить обработку refresh tokens
  - [x] Добавить автоматическое обновление сессии перед истечением
  - [x] Улучшить обработку expired sessions
  - [x] Добавить helper функции для работы с сессиями
  - [x] Файлы: `apps/web/src/lib/supabaseServer.ts`, `apps/web/src/lib/supabaseClient.ts`

- [x] **UX-004**: Страница восстановления доступа
  - [x] Создать страницу `/auth/recovery`
  - [x] Форма отправки ссылки для восстановления
  - [x] Обработка отправки и подтверждения
  - [x] Файл: `apps/web/src/app/auth/recovery/page.tsx`

### Тестирование и документация

- [x] **ERROR-001**: Исправление критических ошибок авторизации ✅
  - [x] Устранен PKCE flow error (убран custom storageKey)
  - [x] Исправлен HTTP 500 в callback (убран NextResponse.next())
  - [x] Исправлена обработка cookies в route handlers
  - [x] Добавлен middleware для защиты маршрутов
  - [x] Исправлен PostgREST 400 error (adverts query)
  - [x] Улучшена обработка ошибок в auth callback
  - [x] Добавлены детальные error codes и messages
  - [x] Файлы: `apps/web/src/app/auth/callback/route.ts`, `apps/web/src/middleware.ts`,
        `apps/web/src/app/(protected)/profile/page.tsx`, `apps/web/src/lib/supabaseClient.ts`
  - [x] **Результат:** Email login полностью работает ✅

- [x] **TEST-001**: Создание инструментов тестирования
  - [x] Страница диагностики `/debug/auth`
  - [x] Проверка WebAuthn support
  - [x] Проверка session state
  - [x] Проверка storage availability
  - [x] Файл: `apps/web/src/app/(protected)/debug/auth/page.tsx`

- [x] **DOC-001**: Документация по авторизации
  - [x] Полная документация в `docs/domains/auth.md`

- [x] **MAINT-001**: Очистить ошибки TypeScript (`apps/web`)
  - [x] Пройти `pnpm exec tsc -p apps/web/tsconfig.json --noEmit`
  - [x] Обновить схемы каталога, UI формы, валидации и утилиты
  - [x] Убедиться, что новые компоненты и API совместимы с типами Supabase

- [x] **I18N-001**: Добавление переводов для профиля ✅
  - [x] Добавлены переводы для всех языков (RU, EN, FR, NL, DE)
  - [x] Удалены дубликаты секций profile
  - [x] Покрыты все элементы UI страницы профиля
  - [x] Файлы: `apps/web/src/i18n/locales/*.json`

- [x] **AUTH-002**: Исследование и документирование WebAuthn ⚠️
  - [x] Создана диагностическая страница `/profile/test-auth`
  - [x] Обнаружено: WebAuthn MFA не поддерживается в Supabase Production
  - [x] Документированы доступные методы MFA (TOTP, Phone)
  - [x] Создан компонент с уведомлением о недоступности WebAuthn
  - [x] Добавлены рекомендации по использованию TOTP
  - [x] Файлы: `apps/web/src/app/(protected)/profile/test-auth/page.tsx`,
        `apps/web/src/app/(protected)/profile/security/mfa-notice.tsx`,
        `docs/supabase-webauthn-enable.md`
  - [x] **Вывод:** WebAuthn недоступен in production, используем TOTP ✅

- [x] **MFA-001**: Реализация TOTP MFA (App Authenticator) ✅
  - [x] Создан hook `useTOTP` для управления TOTP факторами
  - [x] Компонент `TOTPEnrollment` с QR-кодом и верификацией
  - [x] Компонент `TOTPSettings` для управления аутентификаторами
  - [x] Обновлена страница Security Settings (замена WebAuthn на TOTP)
  - [x] Улучшена система обновления header (Supabase listener, visibility check)
  - [x] Работает на FREE плане Supabase
  - [x] Файлы: `apps/web/src/hooks/useTOTP.ts`,
        `apps/web/src/components/TOTPEnrollment.tsx`,
        `apps/web/src/components/TOTPSettings.tsx`,
        `apps/web/src/app/(protected)/profile/security/SecuritySettingsClient.tsx`
  - [x] **Результат:** TOTP MFA готов к использованию! ✅

- [x] **AUTH-003**: Множественные методы авторизации ✅
  - [x] Добавлен вход по email + password (в дополнение к magic link)
  - [x] Добавлена социальная авторизация (Google, Facebook)
  - [x] Страница /login обновлена с Tabs для выбора метода входа
  - [x] Страница /register обновлена с кнопками OAuth
  - [x] Файлы: `apps/web/src/app/login/page.tsx`, `apps/web/src/app/register/RegisterForm.tsx`
  - [x] **Результат:** Пользователи могут войти удобным способом ✅

- [x] **VERIFY-001**: Страница верификации email и телефона ✅
  - [x] Создана страница `/verify` для подтверждения email и телефона
  - [x] Компонент `VerifyEmailClient` для повторной отправки письма
  - [x] Компонент `VerifyPhoneClient` для SMS верификации
  - [x] Визуальные индикаторы статуса верификации
  - [x] Файлы: `apps/web/src/app/(protected)/verify/page.tsx`,
        `apps/web/src/app/(protected)/verify/VerifyEmailClient.tsx`,
        `apps/web/src/app/(protected)/verify/VerifyPhoneClient.tsx`
  - [x] **Результат:** Пользователи могут верифицировать свои данные ✅

- [x] **POST-001**: Требование верификации для размещения объявлений ✅
  - [x] Добавлена проверка `verified_email` и `verified_phone` в `/post`
  - [x] Пользователь перенаправляется на `/verify` если не верифицирован
  - [x] Красивое предупреждение с указанием недостающей верификации
  - [x] Файлы: `apps/web/src/app/post/page.tsx`
  - [x] **Результат:** Только верифицированные пользователи могут размещать объявления ✅

- [x] **DOC-002**: Документация по настройке OAuth ✅
  - [x] Полная инструкция по настройке Google OAuth
  - [x] Полная инструкция по настройке Facebook OAuth
  - [x] Инструкция по настройке GitHub OAuth (опционально)
  - [x] Troubleshooting guide
  - [x] Production checklist
  - [x] Файлы: `docs/supabase-oauth-setup.md`, `docs/auth-improvements-plan.md`
  - [x] **Результат:** Документация готова для настройки OAuth ✅

### SEO и локализация

- [x] **SEO-001**: Создать helper функции для SEO
  - [x] `generateMetadata.ts` - генерация metadata
  - [x] `generateJsonLd.ts` - генерация JSON-LD
  - [x] Файлы: `apps/web/src/lib/seo/*.ts`

- [x] **SEO-002**: Реализовать sitemap.ts
  - [x] Генерация статических страниц
  - [x] Генерация категорий
  - [x] Генерация объявлений (только active)
  - [x] hreflang для каждой страницы
  - [x] Файл: `apps/web/src/app/sitemap.ts`

- [x] **SEO-003**: Добавить JSON-LD на страницы
  - [x] Organization schema на homepage
  - [x] Product/Car schema на страницах объявлений
  - [x] BreadcrumbList для навигации

- [x] **I18N-001**: Завершить переводы UI strings
  - [x] Аудит всех hardcoded строк
  - [x] Добавление переводов в `locales/*.json`
  - [x] Замена на `t()` функции

- [x] **I18N-002**: Создать helper функции форматирования
  - [x] `formatCurrency.ts`
  - [x] `formatDate.ts`
  - [x] Файлы: `apps/web/src/lib/i18n/*.ts`

- [x] **I18N-003**: Реализовать Language Switcher
  - [x] Компонент `LanguageSwitcher.tsx`
  - [x] Сохранение в cookie
  - [x] Обновление URL/routing

### Модерация (базовая - без AI)

- [x] **MOD-001**: Расширить админ панель `/admin/reports`
  - [x] Улучшенный UI для модерации
  - [x] Bulk actions (массовое одобрение/отклонение)
  - [x] Фильтры и сортировка
  - [x] Файл: `apps/web/src/app/admin/reports/page.tsx`

---

## 🔵 PHASE 4: M1 Features (После MVP - монетизация и коммуникация)

> **Зачем:** Новые независимые модули, можно делать параллельно после MVP.

### Чат / Сообщения

- [x] **CHAT-001**: Создать миграции для чата
  - [x] Таблицы: conversations, conversation_participants, messages
  - [x] Индексы
  - [x] Триггеры
  - [x] Файл: `supabase/migrations/20251108120000_chat_tables.sql`

- [x] **CHAT-002**: Реализовать RLS policies для чата
  - [x] conversations: participants или admins
  - [x] messages: participants читают, автор пишет
  - [x] Файл: `supabase/migrations/20251108120100_chat_rls.sql`

- [x] **CHAT-003**: Создать API endpoints для чата
  - [x] POST `/api/chat/start` - создание/поиск диалога
  - [x] POST `/api/chat/send` - отправка сообщения
  - [x] GET `/api/chat/history` - история с пагинацией
  - [x] POST `/api/chat/read` - отметка прочитанным
  - [x] Файлы: `apps/web/src/app/api/chat/**/route.ts`

- [x] **CHAT-004**: Создать хук useRealtimeMessages
  - [x] Подписка на канал `conversation:${id}`
  - [x] Reconnect логика
  - [x] Файл: `apps/web/src/hooks/useRealtimeMessages.ts`

- [x] **CHAT-005**: Создать UI компоненты чата
  - [x] ChatListPage - список диалогов
  - [x] ChatWindow - окно чата
  - [x] MessageInput - поле ввода
  - [x] Файлы: `apps/web/src/app/(protected)/chat/**/page.tsx`, `apps/web/src/components/chat/ChatWindow.tsx`

### Платежи и бустинг

- [x] **BILL-001**: Создать миграции для billing
  - [x] Таблицы: products, purchases, benefits
  - [x] Индексы
  - [x] Файл: `supabase/migrations/20251108130000_billing_tables.sql`

- [x] **BILL-002**: Настроить Stripe интеграцию
  - [x] API ключи в env
  - [x] Создание Checkout Session
  - [x] Webhook endpoint с проверкой подписи
  - [x] Файлы: `apps/web/src/app/api/billing/**/route.ts`

- [x] **BILL-003**: Создать UI для покупок
  - [x] BoostDialog - модалка покупки буста
  - [x] BenefitsBadge - badge на объявлениях
  - [x] BillingPage - история покупок
  - [x] Файлы: `apps/web/src/components/BoostDialog.tsx`, `BenefitsBadge.tsx`

### Уведомления

- [x] **NOTIF-001**: Создать таблицу notifications
  - [x] Миграция с таблицей и индексами
  - [x] RLS policies
  - [x] Файл: `supabase/migrations/20251108140000_notifications.sql`

- [x] **NOTIF-002**: Настроить Email отправку
  - [x] Интеграция SendGrid или Mailgun
  - [x] Создание email templates (NL/FR/EN/RU/DE)
  - [x] Helper функция для отправки
  - [x] Файлы: `apps/web/src/lib/email/templates/**`, `apps/web/src/lib/email/sender.ts`

- [x] **NOTIF-003**: Реализовать API endpoints
  - [x] GET `/api/notifications` - список
  - [x] POST `/api/notifications/[id]/read` - отметка прочитанным
  - [x] GET/POST `/api/notifications/preferences` - настройки
  - [x] Файлы: `apps/web/src/app/api/notifications/**/route.ts`

- [x] **NOTIF-004**: Создать in-app notification center
  - [x] Компонент `NotificationBell.tsx`
  - [x] Realtime subscription
  - [x] Badge с количеством непрочитанных
  - [x] Файл: `apps/web/src/components/NotificationBell.tsx`, `apps/web/src/hooks/useRealtimeNotifications.ts`

---

## 🟣 PHASE 5: M2 Features (AI и автоматизация)

> **Зачем:** Продвинутые функции, требующие стабильной базы.

### AI Модерация

- [x] **AI-001**: Создать Edge Function ai-moderation
  - [x] Интеграция с OpenAI API
  - [x] LLM prompt для анализа
  - [x] Возврат score и reason
  - [x] Файл: `supabase/functions/ai-moderation/index.ts`

- [x] **AI-002**: Добавить поля в adverts для AI
  - [x] `ai_moderation_score`, `ai_moderation_reason`, `moderation_status`
  - [x] Таблица `moderation_logs`
  - [x] Файл: `supabase/migrations/20251109000000_ai_moderation.sql`

- [x] **AI-003**: Реализовать API endpoints
  - [x] POST `/api/moderation/analyze` - AI анализ
  - [x] POST `/api/moderation/review` - решение модератора
  - [x] GET `/api/moderation/queue` - очередь модерации
  - [x] Файлы: `apps/web/src/app/api/moderation/**/route.ts`

- [x] **AI-004**: Создать модераторскую очередь UI
  - [x] Страница со списком объявлений
  - [x] Быстрые действия Approve/Reject
  - [x] Детальный просмотр
  - [x] Файл: `apps/web/src/app/admin/moderation/page.tsx`

### Fraud Detection

- [x] **FRAUD-001**: Создать таблицу fraud_rules
  - [x] Миграция с таблицей
  - [x] Seed данные с базовыми правилами
  - [x] Файл: `supabase/migrations/20251109010000_fraud_rules.sql`

- [x] **FRAUD-002**: Реализовать проверку правил
  - [x] Edge Function или cron job
  - [x] Применение actions (block/flag/review)
  - [x] Логирование результатов
  - [x] Файл: `supabase/functions/fraud-detection/index.ts`

- [x] **FRAUD-003**: Добавить account flags
  - [x] Поле `flags` в profiles
  - [x] Поле `blocked_until`
  - [x] Проверка flags при критичных операциях
  - [x] Файл: `supabase/migrations/20251109020000_account_flags.sql`

### Itsme Integration

- [x] **ITSME-001**: Настроить Itsme OAuth в Supabase
  - [x] Добавить provider в Supabase Auth (документация создана)
  - [x] Настроить redirect URL (документация создана)
  - [x] Обновление профиля после callback
  - [x] Файл: `apps/web/src/app/auth/callback/route.ts` (обновлен)
  - [x] Документация: `docs/supabase-itsme-setup.md`

- [x] **ITSME-002**: Добавить поля в profiles
  - [x] `itsme_verified`, `itsme_kyc_level`
  - [x] Миграция
  - [x] Файл: `supabase/migrations/20251110000000_itsme_fields.sql`

---

## ⚪ PHASE 6: Production Readiness (Финализация)

> **Зачем:** Оптимизация и подготовка к масштабированию.

### Performance

- [x] **PERF-001**: Оптимизация database queries
  - [x] EXPLAIN ANALYZE для критичных запросов
  - [x] Добавление недостающих индексов
  - [x] Оптимизация медленных запросов
  - [x] Файлы: `supabase/migrations/20251111000000_performance_indexes.sql`, `scripts/analyze-query-performance.mjs`

- [x] **PERF-002**: Настройка CDN
  - [x] Vercel CDN для статики
  - [x] Оптимизация изображений (WebP/AVIF)
  - [x] Кэширование стратегия
  - [x] Файлы: `apps/web/next.config.ts`, `docs/development/image-optimization.md`

- [x] **PERF-003**: Code splitting и lazy loading
  - [x] Динамические импорты для тяжелых компонентов
  - [x] Route-based code splitting
  - [x] Оптимизация bundle size
  - [x] Файлы: `apps/web/src/app/page.tsx`, `apps/web/src/app/post/page.tsx`, `apps/web/src/app/(protected)/chat/[conversationId]/page.tsx`, `docs/development/code-splitting.md`

### Мониторинг

- [x] **MON-001**: Настроить Sentry
  - [x] Error tracking (документация и интеграция с errorLogger)
  - [x] Performance monitoring (документация)
  - [x] Alerts настроены (документация)
  - [x] Файлы: `docs/development/sentry-setup.md`, `apps/web/src/lib/errorLogger.ts` (обновлен)

- [x] **MON-002**: Настроить Supabase monitoring
  - [x] Database performance metrics (скрипты и документация)
  - [x] API usage tracking (документация)
  - [x] Storage usage (документация)
  - [x] Файлы: `docs/development/supabase-monitoring.md`, `scripts/monitor-supabase-daily.mjs`, `scripts/monitor-supabase-alerts.mjs`

### Testing

- [ ] **TEST-001**: Unit тесты для API endpoints
  - [ ] Покрытие > 50%
  - [ ] Тестирование error cases
  - [ ] Файлы: `apps/web/src/app/api/**/*.test.ts`

- [ ] **TEST-002**: Integration тесты
  - [ ] Full user flows
  - [ ] API интеграции
  - [ ] Файлы: `tests/integration/**`

- [ ] **TEST-003**: E2E тесты
  - [ ] Критичные сценарии
  - [ ] Playwright или Cypress
  - [ ] Файлы: `tests/e2e/**`

### Security Audit

- [ ] **SEC-001**: Penetration testing
  - [ ] Проверка RLS policies
  - [ ] Проверка rate limiting
  - [ ] Проверка XSS/SQL injection защита

- [ ] **SEC-002**: GDPR compliance проверка
  - [ ] DSAR экспорт тестирование
  - [ ] Data retention проверка
  - [ ] Consent management проверка

---

## 📊 Статистика выполнения

**Всего задач:** ~150

**По фазам:**

- Phase 0 (Foundation): ~8 задач
- Phase 1 (Core MVP): ~25 задач
- Phase 2 (Dependent): ~15 задач
- Phase 3 (Advanced): ~12 задач
- Phase 4 (M1): ~20 задач
- Phase 5 (M2): ~10 задач
- Phase 6 (Production): ~12 задач

**Приоритет выполнения:**

1. 🔴 Phase 0 - Сделать ПЕРВЫМ (независимые, основа)
2. 🟠 Phase 1 - Сразу после Phase 0 (можно параллельно)
3. 🟡 Phase 2 - После Phase 1 (зависит от базы)
4. 🟢 Phase 3 - После базового MVP (расширения)
5. 🔵 Phase 4 - M1 функции (независимые модули)
6. 🟣 Phase 5 - M2 функции (AI и автоматизация)
7. ⚪ Phase 6 - Финализация перед production

---

## 📈 Прогресс выполнения

> **Примечание:** Этот блок обновляется автоматически при изменении чекбоксов в файле.

✅ **Completed:** 477/150

⏳ **In progress:** 0

📌 **Next:** TEST-001, TEST-002, TEST-003, SEC-001, SEC-002

---

## 🎯 Quick Start для команды

**Что делать прямо сейчас (по порядку):**

1. **DB-001** → Проверить/дополнить миграции MVP таблиц
2. **DB-002** → Добавить индексы
3. **DB-003** → Проверить RLS policies
4. **API-001 до API-004** → Стандартизация API (можно параллельно с DB)
5. **UI-001 до UI-005** → Главная страница и навигация (после DB готово)

**Зависимости:**

- UI задачи требуют готовые API endpoints
- API endpoints требуют готовые таблицы БД
- Расширенные функции требуют базовый MVP

---

## 📝 Правила работы с чек-листом

1. **Отмечайте выполненные задачи** сразу после завершения
2. **Не перескакивайте** между фазами без причины
3. **Проверяйте зависимости** перед началом задачи
4. **Обновляйте статус** в этом файле регулярно
5. **Создавайте issues/PR** с ссылкой на номер задачи (например, `DB-001`)

---

## 🔗 Related Docs

**Domains:** [auth.md](../domains/auth.md)
**Development:** [deep-audit-20251108.md](./deep-audit-20251108.md) • [user-profile.md](./user-profile.md) • [README.md](./README.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)
