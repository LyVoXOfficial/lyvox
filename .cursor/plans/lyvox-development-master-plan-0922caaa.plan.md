<!-- 0922caaa-e43a-4d82-b2f6-da67a5bf7395 5fd603f7-5a2a-4e73-9725-225321760894 -->
# Детализированный план разработки маркетплейса LyVoX

## Структура документа

- Функциональные зоны продукта
- API и база данных
- Безопасность и соответствие
- UX/UI гайды
- Roadmap MVP → M1 → M2 → Production
- Чек-листы и контрольные точки

---

## 1. ГЛАВНАЯ СТРАНИЦА И НАВИГАЦИЯ

### MVP Scope

- Лендинг с hero-секцией и категориями
- Top navigation: Logo, категории (dropdown), поиск, профиль/вход
- Bottom navigation (mobile): Home, Browse, Post, Profile, More
- Блоки: "Свежие объявления" (24 последних), "Бесплатные" (до 10), "Популярные категории"
- Footer: Legal links (Terms, Privacy, GDPR), контакты, социальные сети

### Technical Implementation

**Файлы:**

- `apps/web/src/app/page.tsx` - главная страница (SSR)
- `apps/web/src/components/MainHeader.tsx` - верхняя навигация
- `apps/web/src/components/BottomNav.tsx` - мобильная навигация
- `apps/web/src/components/LegalFooter.tsx` - футер

**API/Queries:**

- Главная: `supabase.from('adverts').select(...).eq('status','active').order('created_at',{ascending:false}).limit(24)`
- Категории: `supabase.from('categories').select(...).eq('level',1).eq('is_active',true).order('sort')`
- Медиа: batch load first image per advert from `media` table

**Чек-лист MVP:**

- [ ] Hero-секция с CTA "Разместить объявление"
- [ ] 3-уровневая навигация категорий (dropdown на desktop, drawer на mobile)
- [ ] Лента свежих объявлений (grid/list toggle на desktop)
- [ ] Мобильная навигация с иконками
- [ ] Breadcrumbs на внутренних страницах
- [ ] Footer с локализованными ссылками (NL/FR/EN/RU)

**Post-MVP Enhancements:**

- Персонализация ленты по истории просмотров
- Блок "Рекомендации для вас" (AI-powered)
- Статистика платформы в hero (количество объявлений, пользователей)

---

## 2. ПОИСК И ФИЛЬТРЫ

### MVP Scope

- Full-text поиск по заголовку и описанию (PostgreSQL `to_tsvector`)
- Фильтры: категория, цена (min/max), локация (city/region), дата публикации
- Сортировка: по дате (новые первыми), по цене (возр/убыв), по релевантности
- Геопоиск: радиус поиска (km) от выбранной точки на карте
- Сохранение фильтров в URL query params

### Technical Implementation

**Новая таблица:**

```sql
CREATE TABLE public.search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  query text,
  filters jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_search_history_user_created ON public.search_history(user_id, created_at DESC);
```

**API Endpoints:**

- `GET /api/search?q=...&category=...&price_min=...&price_max=...&location=...&radius=...&sort=...&page=...`
  - Использует `supabase.rpc('search_adverts', {...})`
- `POST /api/search/save` - сохранение поискового запроса (опционально, после аутентификации)

**PostgreSQL Function:**

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
RETURNS TABLE(...) AS $$
BEGIN
  -- Full-text search + filters + sorting + pagination
END;
$$ LANGUAGE plpgsql;
```

**Frontend Components:**

- `apps/web/src/app/search/page.tsx` - страница поиска
- `apps/web/src/components/SearchBar.tsx` - глобальная строка поиска (header)
- `apps/web/src/components/SearchFilters.tsx` - панель фильтров (drawer/sidebar)
- `apps/web/src/components/SearchResults.tsx` - результаты с пагинацией

**Чек-лист MVP:**

- [ ] Глобальная строка поиска в header (autocomplete на категориях)
- [ ] Страница `/search?q=...` с результатами и фильтрами
- [ ] Фильтры: категория (каскад), цена (slider), локация (autocomplete), радиус
- [ ] Сортировка: новинки / цена ↑↓ / релевантность
- [ ] Геопоиск: выбор на карте + радиус в км
- [ ] Пагинация: 24 на страницу, бесконечный scroll (mobile) / кнопки (desktop)
- [ ] URL синхронизация: фильтры → query params

**Post-MVP:**

- Фасетный поиск (filters-as-you-type)
- Поиск по изображениям (reverse image search)
- Сохраненные поиски с email-уведомлениями
- AI-рекомендации похожих объявлений

---

## 3. КАТЕГОРИИ (FULL TAXONOMY)

### Current State

- Таблица `categories` с 3 уровнями, поддерживает RU/NL/FR/EN/DE
- Path-based routing: `/c/transport/legkovye-avtomobili`

### MVP Enhancements

- Локализация категорий в UI (fallback на EN)
- Иконки категорий (из поля `icon` или default set)
- Подсчет активных объявлений per категория
- SEO-friendly URLs: `/c/transport/cars` (EN), `/c/transport/voitures` (FR)

**Database:**

- Добавить поле `advert_count` (computed via trigger или materialized view)
- Индексы: `(parent_id, is_active, sort)`, `(path, is_active)`

**API:**

- `GET /api/categories/tree?locale=en` - возвращает дерево категорий с переводами
- `GET /api/categories/[path]/stats` - количество объявлений в категории и подкатегориях

**Components:**

- `apps/web/src/components/CategoryTree.tsx` - дерево категорий (navigation)
- `apps/web/src/components/CategoryCard.tsx` - карточка категории с счетчиком

**Чек-лист:**

- [ ] Мультиязычные названия категорий (NL/FR/EN/RU, fallback)
- [ ] Иконки категорий (Lucide icons или кастомные SVG)
- [ ] Breadcrumbs на странице категории
- [ ] Подсчет объявлений (real-time или cached, обновление раз в час)
- [ ] SEO meta для категорий: title, description, hreflang

---

## 4. ПОДАЧА ОБЪЯВЛЕНИЯ

### Current State

- 8-шаговая форма для Transport (см. `apps/web/src/app/post/PostForm.tsx`)
- Draft → Active workflow
- Media upload через Supabase Storage

### MVP Scope (для всех категорий)

- Шаг 1: Выбор категории (3 уровня)
- Шаг 2: Условие (new/used/for_parts)
- Шаг 3: Базовые поля (title, description, price, currency, location)
- Шаг 4: Специфичные атрибуты (зависят от категории, JSON в `ad_item_specifics`)
- Шаг 5: Медиа (до 12 фото, drag&drop reorder)
- Шаг 6: Контакт (телефон из профиля + дополнительный с верификацией)
- Шаг 7: Preview
- Шаг 8: Publish / Save Draft / Delete

**Technical:**

- API: `POST /api/adverts` (создание draft), `PATCH /api/adverts/[id]` (обновление)
- Media: `POST /api/media/sign` (signed upload URL), `POST /api/media/reorder`
- Валидация: title (3-200 chars), description (10+ chars), price (>=0), категория обязательна
- Transport: интеграция с `vehicle_makes`, `vehicle_models`, `vehicle_generations`

**Чек-лист:**

- [ ] Multi-step форма с прогресс-баром
- [ ] Валидация на каждом шаге (client + server)
- [ ] Draft сохранение (автосохранение каждые 30 сек)
- [ ] Media upload: drag&drop, preview, reorder, удаление
- [ ] Preview перед публикацией (exact preview страницы объявления)
- [ ] Публикация требует: минимум 1 фото, заполненные обязательные поля
- [ ] Success page после публикации с CTA "Посмотреть" / "Разместить еще"

**Post-MVP:**

- AI-подсказки для описания (LLM генерация на основе фото)
- Автоматическое определение характеристик из фото (ML)
- Шаблоны объявлений (save as template)

---

## 5. СТРАНИЦА ПРОСМОТРА ОБЪЯВЛЕНИЯ

### MVP Scope

- Hero: галерея изображений (lightbox), кнопка "Связаться"
- Основная информация: заголовок, цена, локация, дата публикации
- Описание: markdown support, line breaks
- Характеристики: таблица атрибутов из `ad_item_specifics`
- Продавец: профиль, trust score, верификации (email/phone), другие объявления
- Действия: "Пожаловаться", "Поделиться", "В избранное" (если авторизован)

**URL Schema:**

- `/ad/[id]/[slug]` - например `/ad/550e8400-e29b-41d4-a716-446655440000/bmw-535d-touring-2008`
- Slug генерируется из title: transliteration + уникальность

**Components:**

- `apps/web/src/app/ad/[id]/page.tsx` - SSR страница объявления
- `apps/web/src/components/AdvertGallery.tsx` - галерея с lightbox
- `apps/web/src/components/AdvertDetails.tsx` - таблица характеристик
- `apps/web/src/components/SellerCard.tsx` - карточка продавца
- `apps/web/src/components/ReportDialog.tsx` - модалка жалобы

**SEO:**

- JSON-LD Schema.org (Product/Car/Offer)
- OpenGraph tags (og:title, og:image, og:price)
- Canonical URL
- hreflang alternates

**Чек-лист:**

- [ ] Галерея: минимум 1 фото, max 12, fullscreen lightbox, swipe gestures
- [ ] Цена: форматирование по локали (EUR: 4.900 €, руб: 4 900 ₽)
- [ ] Контакт: кнопка "Показать телефон" (защита от ботов, требует auth или captcha)
- [ ] Карта локации (опционально, если `location_id` заполнен)
- [ ] Блок похожих объявлений (same category, similar price range)
- [ ] Социальные шаринги (WhatsApp, Facebook, Twitter, копировать ссылку)
- [ ] Breadcrumbs: Home > Category > Subcategory > Ad Title

---

## 6. ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ

### Current State

- `apps/web/src/app/(protected)/profile/page.tsx` с базовой информацией
- Trust score display
- Phone verification

### MVP Enhancements

- Публичный профиль: `/user/[id]` (только display_name, trust score, верификации, статистика)
- Личный кабинет: `/profile` (полный доступ)
- Вкладки: Мои объявления, Избранное, Сообщения, Настройки, Покупки (будущее)

**Sections:**

1. **Overview**: avatar (optional), display_name, trust_score badge, верификации, дата регистрации
2. **My Adverts**: список с фильтрами (active/draft/archived), quick actions (edit/delete/duplicate)
3. **Favorites**: сохраненные объявления (localStorage или таблица `favorites`)
4. **Settings**: email, phone, consents (marketing opt-in/out), notifications preferences, язык интерфейса
5. **Security**: смена пароля, 2FA (future), активные сессии

**Database:**

```sql
CREATE TABLE public.favorites (
  user_id uuid REFERENCES auth.users(id),
  advert_id uuid REFERENCES public.adverts(id),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, advert_id)
);
CREATE INDEX idx_favorites_user ON public.favorites(user_id, created_at DESC);
```

**API:**

- `GET /api/profile` - текущий профиль
- `PATCH /api/profile` - обновление display_name, avatar
- `GET /api/user/[id]/public` - публичный профиль
- `POST /api/favorites/add`, `DELETE /api/favorites/remove`, `GET /api/favorites`

**Чек-лист:**

- [ ] Публичный профиль с RLS (только публичные поля)
- [ ] Личный кабинет с полным доступом
- [ ] Список объявлений с фильтрами и пагинацией
- [ ] Избранное: добавление/удаление, список
- [ ] Настройки: консенты, уведомления, язык
- [ ] Trust score с пояснением (что дает высокий score)

---

## 7. ВЕРИФИКАЦИЯ АККАУНТА

### Current Implementation

- Email: Supabase magic link (автоматически при регистрации)
- Phone: OTP через Twilio (`/api/phone/request`, `/api/phone/verify`)

### MVP Scope

- Email verification: статус из `profiles.verified_email`
- Phone verification: статус из `profiles.verified_phone` (после успешного OTP)
- Визуальные индикаторы: badge "Verified" в профиле и карточках объявлений

### Itsme Integration (Post-MVP)

- OAuth flow с Itsme
- После успешной аутентификации: установить `profiles.itsme_verified = true`
- KYC level определяется Itsme (базовый/расширенный)

**Technical:**

- Itsme OAuth: добавить provider в Supabase Auth
- Endpoint: `/api/auth/itsme/callback`
- Обновление профиля после callback

**KBO/BCE API (для бизнеса):**

- Проверка регистрации компании по номеру (BE: KBO, FR: BCE)
- Поле `business_registration_number` в профиле
- Валидация через внешний API, сохранение результата

**Чек-лист:**

- [ ] Email verification badge (после подтверждения email)
- [ ] Phone verification badge (после OTP)
- [ ] Itsme OAuth интеграция (Post-MVP)
- [ ] KBO/BCE проверка для business аккаунтов
- [ ] Визуальные индикаторы: badge в профиле, фильтр "Только верифицированные"

---

## 8. ЧАТ / СООБЩЕНИЯ

### Architecture (см. `docs/domains/chat.md`)

- Realtime через Supabase Realtime (websocket)
- Таблицы: `conversations`, `conversation_participants`, `messages`
- SSR для начальной загрузки истории, client subscription для live updates

**Database Schema:**

```sql
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  advert_id uuid REFERENCES public.adverts(id),
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.conversation_participants (
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner', 'peer')),
  muted boolean DEFAULT false,
  last_read_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE public.messages (
  id bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_author ON public.messages(author_id, created_at DESC);
```

**RLS Policies:**

- `conversations`: участники или админы
- `messages`: участники диалога могут читать, только автор может писать
- `conversation_participants`: участники могут читать

**API:**

- `POST /api/chat/start` - создать/найти диалог (по `advert_id` + `peer_id`)
- `POST /api/chat/send` - отправить сообщение
- `GET /api/chat/history?conversationId=...&cursor=...` - история с пагинацией
- `POST /api/chat/read` - отметить прочитанным

**Frontend:**

- `apps/web/src/app/(protected)/chat/page.tsx` - список диалогов
- `apps/web/src/app/(protected)/chat/[conversationId]/page.tsx` - окно чата
- `apps/web/src/components/ChatWindow.tsx` - клиентский компонент с Realtime subscription
- `apps/web/src/hooks/useRealtimeMessages.ts` - хук для подписки

**Realtime Subscription:**

```ts
const channel = supabase
  .channel(`conversation:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // Add message to state
  })
  .subscribe();
```

**Чек-лист:**

- [ ] Миграции для таблиц чата
- [ ] RLS policies
- [ ] API endpoints (start, send, history, read)
- [ ] Realtime subscription с reconnect логикой
- [ ] UI: список диалогов, окно сообщений, индикатор "печатает..."
- [ ] Rate limiting: 20 сообщений/мин на пользователя
- [ ] Уведомления: email/push при новом сообщении (если участник offline)
- [ ] Модерация: кнопка "Пожаловаться" на сообщении, связь с `reports`

---

## 9. ПЛАТЕЖИ, ПОДПИСКИ, БУСТИНГ

### Architecture (см. `docs/domains/billing.md`)

- Stripe интеграция (или Mollie для BE/NL)
- Таблицы: `products`, `purchases`, `benefits`

**Database Schema:**

```sql
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL, -- 'boost_7d', 'premium_reserve', 'hide_phone'
  name jsonb NOT NULL, -- {en: 'Boost for 7 days', nl: 'Boost voor 7 dagen', ...}
  price_cents integer NOT NULL,
  currency text DEFAULT 'EUR',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  product_code text NOT NULL REFERENCES public.products(code),
  provider text NOT NULL, -- 'stripe', 'mollie'
  provider_session_id text,
  provider_payment_intent_id text,
  status text NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
  amount_cents integer NOT NULL,
  currency text DEFAULT 'EUR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.purchases(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  advert_id uuid REFERENCES public.adverts(id),
  benefit_type text NOT NULL, -- 'boost', 'premium', 'hide_phone', 'reserve'
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_benefits_user_valid ON public.benefits(user_id, valid_until DESC);
CREATE INDEX idx_benefits_advert ON public.benefits(advert_id) WHERE advert_id IS NOT NULL;
```

**API:**

- `POST /api/billing/checkout` - создать Stripe Checkout Session
  - Body: `{productCode: 'boost_7d', advertId?: uuid}`
  - Response: `{sessionId: 'cs_...', url: 'https://checkout.stripe.com/...'}`
- `POST /api/billing/webhook` - обработка Stripe webhooks
  - Events: `checkout.session.completed`, `payment_intent.succeeded`
  - Идемпотентность через `provider_session_id`
- `GET /api/billing/benefits` - активные бенефиты пользователя
- `GET /api/billing/purchases` - история покупок

**Products:**

1. **Boost объявления** (`boost_7d`, `boost_30d`): поднимает объявление в топ поиска/категории
2. **Premium Reserve** (`premium_reserve`): резервирование объявления для VIP-пользователей
3. **Скрытие номера** (`hide_phone`): скрывает телефон, коммуникация только через чат
4. **Highlight** (`highlight`): выделение объявления цветом/рамкой

**Frontend:**

- `apps/web/src/components/BoostDialog.tsx` - модалка покупки буста
- `apps/web/src/components/BenefitsBadge.tsx` - badge на объявлении (Boost, Premium)
- `apps/web/src/app/(protected)/profile/billing/page.tsx` - история покупок

**Чек-лист:**

- [ ] Stripe/Mollie интеграция
- [ ] Таблицы products, purchases, benefits
- [ ] Checkout flow: выбор продукта → платеж → активация бенефита
- [ ] Webhook обработка с идемпотентностью
- [ ] Автоматическое снятие бустов после `valid_until`
- [ ] UI индикаторы: badge "Boosted", "Premium" на объявлениях
- [ ] История покупок в профиле

---

## 10. МОДЕРАЦИЯ (AI + ЧЕЛОВЕК)

### Current State

- Базовая модерация через `reports` таблицу
- Админ панель: `/admin/reports`

### MVP Enhancements

- Pre-moderation для новых объявлений (опциональный флаг в настройках)
- AI-скоринг: автоматическая оценка риска через LLM (OpenAI GPT-4 / Claude)
- Модераторская очередь: список объявлений с высоким AI-скором

**AI Moderation Flow:**

1. При создании объявления (`status='draft'` → `'pending_review'` если включена премодерация)
2. AI анализ: текст (spam/fraud keywords), изображения (NSFW, качество), цена (аномально низкая)
3. AI score: 0-100 (0 = clean, 100 = high risk)
4. Автоматическое решение: score < 30 → auto-approve, score > 70 → auto-reject, 30-70 → очередь модераторам

**Database:**

```sql
ALTER TABLE public.adverts ADD COLUMN ai_moderation_score integer;
ALTER TABLE public.adverts ADD COLUMN ai_moderation_reason text;
ALTER TABLE public.adverts ADD COLUMN moderation_status text DEFAULT 'pending'; -- 'pending', 'approved', 'rejected', 'auto_approved'
CREATE TABLE public.moderation_logs (
  id bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
  advert_id uuid NOT NULL REFERENCES public.adverts(id),
  moderator_id uuid REFERENCES auth.users(id), -- NULL if AI
  action text NOT NULL, -- 'approve', 'reject', 'auto_approve', 'auto_reject'
  reason text,
  ai_score integer,
  created_at timestamptz DEFAULT now()
);
```

**API:**

- `POST /api/moderation/analyze` - AI анализ объявления (вызывается при publish draft)
  - Использует OpenAI API или Supabase Edge Function
  - Возвращает: `{score: number, reason: string, autoAction: 'approve'|'reject'|'manual'}`
- `POST /api/moderation/review` - решение модератора
  - Body: `{advertId: uuid, action: 'approve'|'reject', reason?: string}`
- `GET /api/moderation/queue` - очередь модерации (только для админов)

**AI Implementation:**

- Edge Function: `supabase/functions/ai-moderation/index.ts`
  - Input: title, description, price, category, images (URLs)
  - LLM prompt: "Analyze this marketplace listing for spam, fraud, or policy violations..."
  - Output: score + reason

**Чек-лист:**

- [ ] AI модерация через Edge Function (OpenAI/Anthropic API)
- [ ] Скoring система (0-100)
- [ ] Автоматические действия (auto-approve/reject)
- [ ] Модераторская очередь с фильтрами
- [ ] Логирование всех решений
- [ ] Уведомления пользователю: одобрено/отклонено

---

## 11. БЕЗОПАСНОСТЬ + АНТИ-ФРОД + RLS + GDPR

### Row-Level Security (Current)

- RLS включен на: `adverts`, `media`, `profiles`, `phones`, `phone_otps`, `reports`, `trust_score`, `logs`
- Policies проверяют `auth.uid()` и `is_admin()`

### Anti-Fraud Measures

**1. Rate Limiting (Current)**

- OTP: 5/15min per user, 20/60min per IP
- Reports: 5/10min per user, 50/24h per IP
- Admin: 60/min per admin

**2. Trust Score System**

- Базовая логика в `trust_inc()` функции
- События: регистрация (+10), верификации (+5 each), положительные отзывы (+10), жалобы (-15)

**3. Fraud Detection Rules**

```sql
CREATE TABLE public.fraud_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text UNIQUE NOT NULL,
  condition_sql text NOT NULL, -- SQL condition that triggers rule
  action text NOT NULL, -- 'block', 'flag', 'review'
  severity integer CHECK (severity >= 1 AND severity <= 10),
  active boolean DEFAULT true
);

-- Examples:
-- Rule 1: Multiple accounts from same IP
-- Rule 2: Rapid posting (10+ ads in 1 hour)
-- Rule 3: Suspicious price patterns (too many "0 EUR" ads)
-- Rule 4: Image reuse across multiple accounts
```

**4. Account Flags**

```sql
ALTER TABLE public.profiles ADD COLUMN flags jsonb DEFAULT '{}'::jsonb;
-- flags: {fraud_risk: true, spam_detected: true, manual_review: true}
ALTER TABLE public.profiles ADD COLUMN blocked_until timestamptz;
```

**5. IP Reputation**

- Интеграция с Cloudflare (IP reputation score)
- Блокировка IP с высоким fraud score

**GDPR Compliance:**

- DSAR (Data Subject Access Request): endpoint `/api/gdpr/export`
  - Экспорт всех данных пользователя: профиль, объявления, сообщения, покупки
- Право на удаление: `/api/gdpr/delete`
  - Анонимизация данных (soft delete) или полное удаление (hard delete для неактивных >6 месяцев)
- Consent management: таблица `profiles.consents` (current)
- Data retention: автоматическая очистка через Edge Function `maintenance-cleanup`

**Чек-лист:**

- [ ] RLS на всех таблицах с пользовательскими данными
- [ ] Trust score логика и визуализация
- [ ] Fraud detection rules (SQL-based)
- [ ] Account flags и блокировки
- [ ] DSAR export endpoint
- [ ] GDPR deletion workflow
- [ ] Consent audit log
- [ ] Data retention автоматизация

---

## 12. ПАНЕЛЬ ПОЛЬЗОВАТЕЛЯ (ЛИЧНЫЙ КАБИНЕТ)

### Sections (см. раздел 6 Профиль)

- Overview
- Мои объявления
- Избранное
- Сообщения (чат)
- Настройки
- Покупки (биллинг)
- Безопасность

**Additional Features:**

- Dashboard с статистикой: количество просмотров объявлений, контактов, избранных
- Экспорт данных (GDPR)
- Уведомления: список всех уведомлений (email/push/in-app)

**Components:**

- `apps/web/src/app/(protected)/profile/dashboard/page.tsx`
- `apps/web/src/app/(protected)/profile/adverts/page.tsx`
- `apps/web/src/app/(protected)/profile/favorites/page.tsx`
- `apps/web/src/app/(protected)/profile/messages/page.tsx`
- `apps/web/src/app/(protected)/profile/settings/page.tsx`
- `apps/web/src/app/(protected)/profile/billing/page.tsx`
- `apps/web/src/app/(protected)/profile/security/page.tsx`

**Чек-лист:**

- [ ] Dashboard с метриками
- [ ] Все разделы личного кабинета
- [ ] Responsive design (mobile-friendly)
- [ ] Навигация между разделами
- [ ] Уведомления центр (in-app)

---

## 13. ПАНЕЛЬ АДМИНИСТРАТОРА

### Current State

- `/admin/reports` - модерация жалоб

### Full Admin Panel

**Sections:**

1. **Dashboard**: статистика платформы (DAU, объявления, транзакции, жалобы)
2. **Moderation Queue**: объявления на модерации (AI-scored + manual reports)
3. **Users**: управление пользователями (поиск, фильтры, блокировка, trust score adjustment)
4. **Adverts**: управление объявлениями (массовые действия, поиск, фильтры)
5. **Reports**: список жалоб (current)
6. **Analytics**: графики (регистрации, публикации, конверсии)
7. **Settings**: настройки платформы (категории, продукты, AI модерация thresholds)

**API:**

- `GET /api/admin/stats` - агрегированная статистика
- `GET /api/admin/users?search=...&filter=...` - список пользователей
- `POST /api/admin/users/[id]/block` - блокировка пользователя
- `POST /api/admin/users/[id]/trust` - изменение trust score
- `GET /api/admin/analytics?period=...` - аналитика

**Components:**

- `apps/web/src/app/admin/dashboard/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/adverts/page.tsx`
- `apps/web/src/app/admin/analytics/page.tsx`

**Access Control:**

- Проверка `is_admin()` на всех admin endpoints
- Middleware: `apps/web/src/middleware.ts` проверяет роль перед доступом к `/admin/**`

**Чек-лист:**

- [ ] Dashboard с реальной статистикой
- [ ] Модерация объявлений (approve/reject/bulk actions)
- [ ] Управление пользователями
- [ ] Analytics с графиками (Chart.js или Recharts)
- [ ] Bulk operations (массовое удаление, блокировка)
- [ ] Audit log всех admin действий

---

## 14. УВЕДОМЛЕНИЯ (EMAIL, PUSH, SMS)

### Notification System

**Database:**

```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL, -- 'new_message', 'advert_approved', 'payment_completed', ...
  channel text NOT NULL, -- 'email', 'push', 'sms', 'in_app'
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb, -- дополнительные данные
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
```

**Notification Types:**

- `new_message` - новое сообщение в чате
- `advert_approved` - объявление одобрено модератором
- `advert_rejected` - объявление отклонено
- `advert_contact` - кто-то запросил телефон
- `payment_completed` - покупка завершена
- `favorite_new_ad` - новое объявление в избранной категории (saved search)

**Channels:**

1. **Email**: через Supabase Auth email или SendGrid/Mailgun
2. **Push**: через OneSignal или Firebase Cloud Messaging
3. **SMS**: через Twilio (только критичные, e.g., OTP)
4. **In-app**: через Supabase Realtime на таблице `notifications`

**API:**

- `POST /api/notifications/send` - отправка уведомления (internal, для server actions)
- `GET /api/notifications` - список уведомлений пользователя
- `POST /api/notifications/[id]/read` - отметить прочитанным
- `POST /api/notifications/preferences` - настройки уведомлений

**Preferences:**

```sql
ALTER TABLE public.profiles ADD COLUMN notification_preferences jsonb DEFAULT '{
  "email": {"new_message": true, "advert_approved": true, ...},
  "push": {"new_message": true, ...},
  "sms": {}
}'::jsonb;
```

**Templates:**

- Email templates: `apps/web/src/lib/email/templates/`
- Push templates: в payload
- Локализация: шаблоны на NL/FR/EN/RU

**Чек-лист:**

- [ ] Таблица notifications
- [ ] Email отправка (SMTP через Supabase или SendGrid)
- [ ] Push уведомления (OneSignal/FCM)
- [ ] In-app центр уведомлений
- [ ] Настройки уведомлений в профиле
- [ ] Дедупликация (не отправлять дважды за 60 сек)
- [ ] Quiet hours (не отправлять 22:00-08:00)

---

## 15. МОБИЛЬНАЯ ВЕРСИЯ / АДАПТИВ

### Responsive Design

- Breakpoints: mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
- Tailwind CSS: `sm:`, `md:`, `lg:` префиксы

**Key Adaptations:**

- Navigation: desktop (top nav) → mobile (bottom nav)
- Search: desktop (header bar) → mobile (fullscreen modal)
- Filters: desktop (sidebar) → mobile (drawer)
- Forms: multi-step на desktop → accordion на mobile
- Tables: desktop (full table) → mobile (card list)

**Mobile-First Components:**

- Touch targets: минимум 44x44px
- Swipe gestures: галерея, swipe to delete
- Bottom sheet: для модальных окон на mobile

**PWA Support (Post-MVP):**

- Service worker для offline
- Install prompt
- Push notifications

**Чек-лист:**

- [ ] Все страницы responsive
- [ ] Mobile navigation (bottom nav)
- [ ] Touch-friendly интерфейс
- [ ] Оптимизация изображений (WebP, lazy loading)
- [ ] Fast load times (< 3s на 3G)
- [ ] PWA манифест (Post-MVP)

---

## 16. SEO / SITEMAP / OPENGRAPH

### Current State

- Базовая SEO структура (см. `docs/domains/seo.md`)

### Full Implementation

**1. Metadata (per page)**

- Title, description, canonical
- OpenGraph tags (og:title, og:image, og:price, og:type)
- Twitter cards
- hreflang alternates (NL/FR/EN/RU)

**2. Sitemap**

- `apps/web/src/app/sitemap.ts` - динамическая генерация
- Включает: категории, объявления (только active), статические страницы
- hreflang для каждой страницы

**3. Robots.txt**

- `apps/web/public/robots.txt`
- Allow: все страницы
- Disallow: `/admin/**`, `/api/**`, `/(protected)/**`
- Sitemap: `https://lyvox.be/sitemap.xml`

**4. JSON-LD Schema**

- Organization (homepage)
- Product/Offer (advert pages)
- BreadcrumbList (навигация)

**5. AI Discovery Feed**

- `/api/public/feed/vehicles` - для ChatGPT/Perplexity
- `/api/public/feed/all` - все категории

**Implementation:**

- `apps/web/src/lib/seo/generateMetadata.ts` - helper для metadata
- `apps/web/src/lib/seo/generateJsonLd.ts` - helper для JSON-LD
- `apps/web/src/app/sitemap.ts` - sitemap генератор

**Чек-лист:**

- [ ] Metadata на всех страницах
- [ ] OpenGraph tags
- [ ] JSON-LD Schema
- [ ] Sitemap.xml с hreflang
- [ ] Robots.txt
- [ ] AI discovery feeds
- [ ] Structured data валидация (Google Rich Results Test)

---

## 17. ЛОКАЛИЗАЦИЯ (NL/FR/EN/RU)

### Current State

- i18n через Next.js App Router (`[locale]` routing)
- Переводы в `apps/web/src/i18n/locales/`

### Full Implementation

**Supported Locales:**

- `nl` - Nederlands (default для BE)
- `fr` - Français
- `en` - English
- `ru` - Русский

**Translation Coverage:**

- UI strings (кнопки, labels, ошибки)
- Email templates
- Push notifications
- SEO metadata
- Категории (из БД: `name_nl`, `name_fr`, `name_en`, `name_ru`)

**Currency & Number Formatting:**

- EUR для NL/FR/BE
- Форматирование: `new Intl.NumberFormat(locale, {style: 'currency', currency: 'EUR'})`
- Даты: `new Intl.DateTimeFormat(locale, {...})`

**Language Switcher:**

- Dropdown в header
- Сохранение выбора в cookie/localStorage
- URL: `/?lang=nl` или `/nl/` (если используется `[locale]` routing)

**Components:**

- `apps/web/src/components/LanguageSwitcher.tsx`
- `apps/web/src/lib/i18n/formatCurrency.ts`
- `apps/web/src/lib/i18n/formatDate.ts`

**Чек-лист:**

- [ ] Все UI strings переведены
- [ ] Email templates локализованы
- [ ] Категории с переводами из БД
- [ ] Currency/number formatting
- [ ] Language switcher
- [ ] hreflang на всех страницах
- [ ] Локализация ошибок API

---

## 18. API АРХИТЕКТУРА

### Current Structure

- Next.js API Routes: `apps/web/src/app/api/**`
- Supabase клиенты: `supabaseServer()` (anon), `supabaseService()` (service role)

### API Standards

**1. Endpoint Naming**

- RESTful: `/api/resource/[id]` для CRUD
- Actions: `/api/resource/action` (e.g., `/api/chat/send`)

**2. Request/Response Format**

- Все ответы: JSON
- Success: `{ok: true, data: {...}}`
- Error: `{ok: false, error: 'ERROR_CODE', detail?: string}`

**3. Authentication**

- Supabase session cookie (автоматически через middleware)
- Public endpoints: не требуют auth
- Protected: проверка `auth.uid()`
- Admin: проверка `is_admin()`

**4. Rate Limiting**

- Обертка `withRateLimit()` для чувствительных endpoints
- Headers: `RateLimit-Limit`, `RateLimit-Remaining`, `Retry-After`

**5. Error Handling**

- Централизованный: `apps/web/src/lib/apiErrors.ts`
- HTTP статусы: 200 (success), 400 (bad request), 401 (unauth), 403 (forbidden), 404 (not found), 429 (rate limited), 500 (server error)

**6. Validation**

- Zod schemas для request body
- Валидация на server-side

**API Documentation:**

- OpenAPI/Swagger spec (Post-MVP)
- Текущая документация: `docs/API_REFERENCE.md`

**Чек-лист:**

- [ ] Единый формат ответов
- [ ] Error handling централизован
- [ ] Rate limiting на всех чувствительных endpoints
- [ ] Валидация через Zod
- [ ] API документация обновлена

---

## 19. SUPABASE СТРУКТУРА ТАБЛИЦ

### Core Tables (Current)

- `adverts`, `media`, `categories`, `profiles`, `phones`, `phone_otps`, `reports`, `trust_score`, `logs`
- Vehicle catalog: `vehicle_makes`, `vehicle_models`, `vehicle_generations`, i18n tables

### New Tables for Full Platform

**Chat:**

```sql
CREATE TABLE public.conversations (...);
CREATE TABLE public.conversation_participants (...);
CREATE TABLE public.messages (...);
```

**Billing:**

```sql
CREATE TABLE public.products (...);
CREATE TABLE public.purchases (...);
CREATE TABLE public.benefits (...);
```

**Notifications:**

```sql
CREATE TABLE public.notifications (...);
```

**Favorites:**

```sql
CREATE TABLE public.favorites (...);
```

**Search:**

```sql
CREATE TABLE public.search_history (...);
```

**Moderation:**

```sql
CREATE TABLE public.moderation_logs (...);
CREATE TABLE public.fraud_rules (...);
```

**Полная схема:** см. разделы выше с примерами CREATE TABLE.

**Индексы:**

- Все foreign keys
- Поисковые поля: `adverts.title`, `adverts.location`
- Временные: `created_at`, `updated_at` где необходимо
- Составные: `(user_id, created_at DESC)` для лент

**Чек-лист:**

- [ ] Все таблицы созданы с правильными constraints
- [ ] Индексы оптимизированы
- [ ] RLS policies на всех таблицах
- [ ] Triggers для `updated_at`
- [ ] Миграции версионированы

---

## 20. БЭКЕНД-ЛОГИКА

### Server-Side Logic

**1. Supabase Edge Functions**

- `ai-moderation` - AI анализ объявлений
- `maintenance-cleanup` - очистка старых данных (current)
- `notification-sender` - отправка уведомлений
- `fraud-detection` - проверка на мошенничество

**2. PostgreSQL Functions**

- `search_adverts(...)` - поиск с фильтрами
- `trust_inc(uid, pts)` - обновление trust score (current)
- `is_admin()` - проверка роли (current)
- `calculate_ai_score(...)` - AI scoring (вызывается из Edge Function)

**3. Scheduled Jobs (Cron)**

- Ежедневно: очистка expired benefits, анонимизация старых логов
- Каждый час: обновление счетчиков категорий (`advert_count`)
- Каждые 15 минут: проверка fraud rules

**4. Background Processing**

- Queue для тяжелых задач (email sending, image processing)
- Использует Supabase Realtime или внешний queue (Bull/BullMQ на Upstash Redis)

**Чек-лист:**

- [ ] Edge Functions реализованы
- [ ] PostgreSQL functions оптимизированы
- [ ] Cron jobs настроены
- [ ] Background processing для асинхронных задач

---

## 21. UI-ГАЙДЫ

### Design System

**1. Component Library (shadcn/ui)**

- Базовые компоненты: Button, Input, Select, Dialog, Tabs, Card
- Расширения: AdvertCard, CategoryTree, SearchBar, ChatWindow

**2. Color Palette**

- Primary: брендовый цвет LyVoX
- Secondary: акцентные цвета
- Semantic: success (green), error (red), warning (yellow), info (blue)

**3. Typography**

- Headings: Inter или система шрифтов
- Body: читаемый sans-serif
- Размеры: responsive (mobile: smaller, desktop: larger)

**4. Spacing & Layout**

- Tailwind spacing scale
- Container max-width: 1280px (desktop)
- Grid system: 12 колонок

**5. Icons**

- Lucide React (primary)
- Custom SVG где необходимо

**6. Animations**

- Transitions: 150-300ms
- Loading states: skeleton screens
- Micro-interactions: hover effects, button presses

**Components Structure:**

```
apps/web/src/components/
  ├── ui/          # shadcn базовые
  ├── adverts/     # AdvertCard, AdvertGallery, etc.
  ├── chat/        # ChatWindow, MessageList
  ├── profile/     # ProfileCard, TrustScoreBadge
  ├── search/      # SearchBar, SearchFilters
  └── shared/      # MainHeader, BottomNav, LegalFooter
```

**Чек-лист:**

- [ ] Design system документирован
- [ ] Все компоненты в Storybook (Post-MVP)
- [ ] Consistent spacing/typography
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Dark mode (Post-MVP)

---

## 22. ROADMAP: MVP → M1 → M2 → PRODUCTION

### MVP (Минимально жизнеспособный продукт)

**Цель:** Запуск платформы с базовой функциональностью

**Включено:**

- Главная страница и навигация
- Поиск и базовые фильтры
- Категории (3 уровня, локализация)
- Подача объявления (8 шагов для Transport, упрощенная для других)
- Просмотр объявления
- Профиль пользователя (публичный + личный кабинет)
- Email/Phone верификация
- Базовая модерация (человек, без AI)
- RLS и безопасность
- Адаптивный дизайн
- SEO базовая структура
- Локализация NL/FR/EN/RU

**Исключено:**

- Чат
- Платежи
- AI модерация
- Itsme интеграция
- Push уведомления
- Advanced аналитика

**Срок:** 8-10 недель

---

### M1 (Месяц 1 после MVP)

**Цель:** Улучшение пользовательского опыта и монетизация

**Добавлено:**

- Чат (Realtime)
- Платежи (Stripe/Mollie) + бустинг
- Push уведомления
- Избранное
- Сохраненные поиски
- Улучшенная модерация (AI pre-scoring)

**Срок:** 4-6 недель

---

### M2 (Месяц 2 после MVP)

**Цель:** Масштабирование и автоматизация

**Добавлено:**

- AI модерация (полная автоматизация)
- Itsme интеграция
- KBO/BCE проверка для бизнеса
- Расширенная аналитика (админ панель)
- Fraud detection автоматизация
- PWA поддержка

**Срок:** 4-6 недель

---

### Production (Готовность к масштабированию)

**Цель:** Полнофункциональная платформа готовная к росту

**Добавлено:**

- Все функции из MVP + M1 + M2
- Performance оптимизация
- Мониторинг и алертинг (Sentry, LogRocket)
- Load testing и оптимизация
- Backup стратегия
- Disaster recovery план

**Критерии готовности:**

- Все критичные функции работают
- Тесты покрывают 70%+ кода
- Документация полная
- Мониторинг настроен
- GDPR compliance проверен

**Срок:** 2-4 недели (финализация)

---

## ЧЕК-ЛИСТЫ И КОНТРОЛЬНЫЕ ТОЧКИ

### Pre-MVP Checklist

- [ ] База данных схема создана
- [ ] RLS policies протестированы
- [ ] API endpoints реализованы
- [ ] Frontend компоненты готовы
- [ ] Локализация покрывает все страницы
- [ ] SEO базовая структура
- [ ] Тестирование критичных flows

### Pre-M1 Checklist

- [ ] MVP запущен в production
- [ ] Мониторинг работает
- [ ] Обратная связь от пользователей собрана
- [ ] Приоритизация функций для M1

### Pre-M2 Checklist

- [ ] M1 функции стабильны
- [ ] Масштабируемость проверена
- [ ] AI интеграция протестирована
- [ ] Compliance проверки пройдены

### Pre-Production Checklist

- [ ] Все функции из roadmap
- [ ] Security audit пройден
- [ ] Performance тесты пройдены
- [ ] Документация обновлена
- [ ] Backup/DR готовы

---

## РИСКИ И МИТИГАЦИЯ

| Риск | Вероятность | Влияние | Митигация |

|------|-------------|---------|-----------|

| AI модерация ложные срабатывания | Высокая | Среднее | Начать с консервативных thresholds, human review для спорных случаев |

| Масштабирование БД | Средняя | Высокое | Индексы, партиционирование, read replicas |

| GDPR нарушения | Низкая | Критическое | Регулярные аудиты, автоматизация retention |

| Payment fraud | Средняя | Среднее | Stripe Radar, rate limiting, trust score |

| Performance degradation | Средняя | Высокое | Мониторинг, оптимизация запросов, CDN |

---

## ПАРАЛЛЕЛЬНАЯ РАЗРАБОТКА

### Можно делать параллельно:

1. **Frontend + Backend**: разные команды работают над UI и API
2. **Локализация + Core features**: переводы готовятся параллельно с разработкой
3. **AI модерация + Chat**: независимые модули
4. **Billing + Notifications**: независимые системы
5. **SEO + UI**: метаданные и компоненты параллельно

### Зависимости:

- Чат зависит от RLS (M2 должен быть завершен)
- Платежи зависят от объявлений (MVP)
- AI модерация зависит от объявлений (M1/M2)

---

## 5 ПРЕДЛОЖЕНИЙ ПО УЛУЧШЕНИЮ

### 1. AI-Powered Search (Поиск с ИИ)

**Описание:** Использование LLM для понимания намерений пользователя в поисковых запросах.

**Пример:** Запрос "недорогой автомобиль для семьи" → AI понимает: низкая цена, 5+ мест, надежность.

**Реализация:** Edge Function с OpenAI/Claude для семантического поиска.

**Приоритет:** Post-MVP (M2+)

### 2. Image Recognition для автозаполнения (ML)

**Описание:** Автоматическое определение характеристик объявления из фотографий (марка, модель, год, повреждения).

**Реализация:** Computer Vision API (Google Vision, AWS Rekognition) или кастомная модель.

**Приоритет:** Post-MVP

### 3. Anti-Fraud ML Model

**Описание:** Обученная модель для детекции мошенничества на основе исторических данных (IP, поведение, паттерны).

**Реализация:** Supabase Edge Function с ML inference (TensorFlow.js или внешний API).

**Приоритет:** M2

### 4. Smart Recommendations (Рекомендательная система)

**Описание:** Персонализированные рекомендации объявлений на основе истории просмотров, избранного, похожих пользователей.

**Реализация:** Collaborative filtering или content-based recommendations.

**Приоритет:** Post-MVP

### 5. Automated Translation для описаний

**Описание:** Автоматический перевод описаний объявлений на все поддерживаемые языки (NL/FR/EN/RU) при публикации.

**Реализация:** Google Translate API или DeepL через Edge Function.

**Приоритет:** M1/M2

---

## ОБНОВЛЕНИЕ ДОКУМЕНТАЦИИ

### После выполнения плана обновить:

1. `docs/requirements.md` - добавить новые таблицы, API endpoints
2. `docs/API_REFERENCE.md` - документировать все новые endpoints
3. `docs/ARCHITECTURE.md` - обновить архитектурные решения
4. `docs/PLAN.md` - отметить выполненные этапы
5. `docs/TODO.md` - закрыть выполненные задачи
6. `docs/domains/*.md` - обновить доменные документы

---

## ПОЛНЫЙ TO-DO СПИСОК ДЛЯ КОМАНДЫ

### Backend Team

- [ ] Создать миграции для новых таблиц (chat, billing, notifications, favorites, search_history, moderation_logs, fraud_rules)
- [ ] Реализовать PostgreSQL functions (search_adverts, calculate_ai_score)
- [ ] Создать Edge Functions (ai-moderation, notification-sender, fraud-detection)
- [ ] Настроить cron jobs (Supabase cron или external scheduler)
- [ ] Реализовать API endpoints (см. секции выше)
- [ ] Настроить Stripe/Mollie интеграцию
- [ ] Реализовать DSAR export/delete
- [ ] Настроить RLS policies для новых таблиц

### Frontend Team

- [ ] Главная страница: hero, категории, лента объявлений
- [ ] Поиск: страница, фильтры, результаты
- [ ] Подача объявления: multi-step форма для всех категорий
- [ ] Просмотр объявления: галерея, детали, продавец
- [ ] Профиль: личный кабинет, публичный профиль
- [ ] Чат: список диалогов, окно сообщений
- [ ] Админ панель: dashboard, модерация, пользователи, аналитика
- [ ] Адаптивный дизайн: mobile/tablet/desktop
- [ ] Локализация: все UI strings, email templates

### DevOps Team

- [ ] Настроить мониторинг (Sentry, LogRocket, Supabase logs)
- [ ] Настроить CI/CD (GitHub Actions, Vercel)
- [ ] Backup стратегия (Supabase backups, external storage)
- [ ] Security audit (penetration testing)
- [ ] Performance тестирование (load testing, optimization)
- [ ] GDPR compliance проверка

### QA Team

- [ ] Unit тесты (API endpoints)
- [ ] Integration тесты (full flows)
- [ ] E2E тесты (Playwright/Cypress)
- [ ] Security тесты (RLS, auth, rate limiting)
- [ ] Performance тесты (load, stress)
- [ ] Accessibility тесты (WCAG)

---

## GANTT-ПЛАН ФАЗ

### Phase 1: MVP (Weeks 1-10)

- Week 1-2: Database schema, migrations, RLS
- Week 3-4: Core API endpoints (adverts, profiles, search)
- Week 5-6: Frontend core pages (home, search, advert, profile)
- Week 7-8: Forms (posting, settings), media upload
- Week 9: Moderation, reports, admin panel basics
- Week 10: Testing, bug fixes, deployment prep

### Phase 2: M1 (Weeks 11-16)

- Week 11-12: Chat implementation (DB, API, UI)
- Week 13: Payments integration (Stripe/Mollie)
- Week 14: Notifications (email, push, in-app)
- Week 15: Favorites, saved searches
- Week 16: AI pre-moderation scoring

### Phase 3: M2 (Weeks 17-22)

- Week 17-18: Full AI moderation, fraud detection
- Week 19: Itsme integration, KBO/BCE checks
- Week 20: Advanced analytics, admin enhancements
- Week 21: PWA, performance optimization
- Week 22: Testing, refinements

### Phase 4: Production (Weeks 23-26)

- Week 23: Security audit, compliance checks
- Week 24: Load testing, performance tuning
- Week 25: Documentation finalization
- Week 26: Launch preparation, monitoring setup

---

## ЗАКЛЮЧЕНИЕ

Этот план покрывает все ключевые зоны продукта LyVoX с детализацией на уровне конкретных файлов, таблиц, API endpoints и компонентов. Следование этому плану обеспечит систематическую разработку от MVP до Production с четкими контрольными точками и критериями готовности.

### To-dos

- [ ] Создать миграции для всех таблиц MVP: adverts, media, categories, profiles, phones, reports, trust_score (проверить существующие и дополнить недостающие)
- [ ] Реализовать и протестировать RLS policies для всех таблиц MVP согласно требованиям безопасности
- [ ] Разработать главную страницу: hero-секция, категории, лента свежих объявлений, адаптивная навигация
- [ ] Реализовать поиск с фильтрами: full-text search, цена, локация, сортировка, PostgreSQL function search_adverts
- [ ] Доработать форму подачи объявления для всех категорий (не только Transport): 8 шагов, валидация, draft сохранение
- [ ] Страница просмотра объявления: галерея, детали, продавец, JSON-LD Schema, OpenGraph
- [ ] Профиль пользователя: публичный профиль, личный кабинет с разделами (объявления, избранное, настройки)
- [ ] Верификация: email (Supabase), phone (OTP через Twilio), визуальные индикаторы
- [ ] Базовая модерация: reports система, админ панель для review, trust score adjustments
- [ ] Локализация: все UI strings на NL/FR/EN/RU, категории из БД, currency formatting
- [ ] SEO базовая структура: metadata, sitemap, robots.txt, hreflang, JSON-LD для объявлений
- [ ] Чат: миграции (conversations, messages, participants), API endpoints, Realtime subscription, UI компоненты
- [ ] Платежи: таблицы (products, purchases, benefits), Stripe/Mollie интеграция, checkout flow, webhooks
- [ ] Уведомления: таблица notifications, email/push отправка, in-app центр, preferences
- [ ] AI pre-moderation: Edge Function для анализа объявлений, scoring система, автоматические решения
- [ ] Полная AI модерация: автоматизация всего процесса, модераторская очередь только для спорных случаев
- [ ] Itsme интеграция: OAuth flow, KYC flags, обновление профиля после аутентификации
- [ ] Fraud detection: таблица fraud_rules, автоматические проверки, account flags, блокировки
- [ ] Расширенная аналитика: админ dashboard с графиками, метрики, отчеты
- [ ] Security audit: penetration testing, GDPR compliance проверка, RLS review
- [ ] Performance оптимизация: load testing, индексы БД, кэширование, CDN настройка
- [ ] Мониторинг и алертинг: Sentry, LogRocket, Supabase logs, uptime monitoring