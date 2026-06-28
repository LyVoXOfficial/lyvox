# LyVoX — Аудит: безопасность + мобильная адаптивность

_Дата: 2026-06-27 · Аудитор: старший инженер по безопасности и мобильной адаптивности · Репозиторий: `C:\LyvoxMarketPlace` (Next.js 16 + Supabase)_

Источники контекста: `docs/SECURITY_AUDIT.md` (предыдущий статический+runtime-аудит), `docs/features/audit/_live-capture-notes.md` (live-обзор desktop). Мобильную отрисовку инструмент не эмулирует — мобайл оценён по коду (Tailwind-классы, фикс-размеры, safe-area).

Уровни риска: **Critical** (эксплуатируемо сейчас, прямой ущерб) · **High** (серьёзно, требует приоритета) · **Med** · **Low**.

---

# ЧАСТЬ A — БЕЗОПАСНОСТЬ

## Сводная таблица находок

| ID | Находка | Риск | Файл |
|----|---------|------|------|
| A-1 | CSP только Report-Only (не enforced), `script-src` допускает `'unsafe-inline'`/`'unsafe-eval'` | **High** | `apps/web/next.config.ts` |
| A-2 | og:image/twitter:image = подписанный Supabase storage URL с токеном в HTML | **Med** | `apps/web/src/app/ad/[id]/page.tsx` |
| A-3 | `checkUserBlocked` fail-open на пути создания черновика (`POST /api/adverts`) | **Med** | `apps/web/src/lib/fraud/checkUserBlocked.ts`, `api/adverts/route.ts` |
| A-4 | Нет rate-limit на media-роуты (`sign`/`complete`/`list`/`public`) | **Med** | `apps/web/src/app/api/media/*` |
| A-5 | `scrubContacts` тривиально обходится (spelled-out, look-alikes, contiguous digits) | **Low→Med** | `apps/web/src/lib/chat/scrubContacts.ts` |
| A-6 | `X-Frame-Options: SAMEORIGIN` vs CSP `frame-ancestors 'none'` — расхождение при promote | **Low** | `apps/web/next.config.ts` |
| A-7 | `getClientIp` доверяет `x-forwarded-for` (rate-limit обходим спуфингом) | **Med** | `apps/web/src/lib/rateLimiter.ts` |
| A-8 | Rate-limiter fail-open при отсутствии Upstash env | **Low** | `apps/web/src/lib/rateLimiter.ts` |
| A-9 | `HSTS` без `preload` | **Low** | `apps/web/next.config.ts` |
| A-10 | `~27 console.log`/`console.error` с деталями (PII/ID) в проде | **Low** | разн. (см. `SECURITY_AUDIT.md` N4) |

**Что уже сделано хорошо (подтверждено):** baseline-заголовки (HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy); `supabaseService()` помечен `import "server-only"` и кидает ошибку при отсутствии ключа; webhook Stripe идемпотентен и проверяет подпись; RLS-модель с `SECURITY DEFINER`-функциями и column-level lock; rate-limit на чувствительных путях (chat, reports, phone, checkout, auth); анти-эскалация admin через `app_metadata` (C1 в прошлом аудите).

---

## A-1 — CSP не enforced, `script-src` с `unsafe-inline`/`unsafe-eval` — **High**

`apps/web/next.config.ts` отдаёт `Content-Security-Policy-Report-Only` (строки 73-74), а не enforced `Content-Security-Policy`. Это значит **CSP сейчас ничего не блокирует** — любой XSS (например, через рефлектируемый параметр или сторонний скрипт) исполнится. `script-src` к тому же содержит `'unsafe-inline' 'unsafe-eval'` (строка 10), что обнуляет защиту от inline-инъекции даже после promote.

Для trust-first маркетплейса с приватным чатом и платежами XSS = угон сессии (cookie `httpOnly:false` для `locale`, но Supabase-токены в localStorage доступны JS) → доступ к чату/аккаунту жертвы. Это ядро trust-позиционирования.

**Риск:** High. Report-Only = декларация без защиты.

**План перехода к enforced CSP с nonce (поэтапно):**

1. **Шаг 1 (сейчас, безопасно):** оставить Report-Only, но добавить `report-uri`/`report-to` на реальный коллектор (сейчас отчёты идут только в консоль браузера — никто их не собирает). Без сбора отчётов фаза наблюдения бессмысленна.
2. **Шаг 2:** внедрить nonce. В Next.js 16 (App Router) nonce генерируется в `middleware.ts` (crypto random), прокидывается через заголовок запроса и читается в `<script nonce>` Next-рантайма. Заменить `'unsafe-inline'` → `'nonce-<random>' 'strict-dynamic'`. `'unsafe-eval'` обычно нужен только dev-режиму Next и некоторым полифиллам — проверить, что прод-бандл без `eval` (Next 16 прод обычно работает без `unsafe-eval`).
3. **Шаг 3:** убрать `'unsafe-inline'` из `style-src` (сложнее — Tailwind/inline-стили; можно оставить временно, риск ниже скриптов).
4. **Шаг 4:** переименовать заголовок `Content-Security-Policy-Report-Only` → `Content-Security-Policy` (enforced), сохранив параллельный Report-Only на следующую итерацию правил.

**Правка (минимум на шаг 1 — собирать отчёты):**
```ts
// next.config.ts — добавить в конец массива contentSecurityPolicy:
"report-uri /api/csp-report",
"report-to csp-endpoint",
```
плюс новый роут `apps/web/src/app/api/csp-report/route.ts`, логирующий нарушения через `logger`.

---

## A-2 — og:image = подписанный Supabase URL с токеном в HTML — **Med**

`apps/web/src/app/ad/[id]/page.tsx` (`generateMetadata`, строки 270-285): `openGraph.images[].url` и `twitter.images[]` = `primaryImage.url`. `primaryImage` приходит из `loadAdvertData` → `signMediaUrls` (`apps/web/src/lib/media/signMediaUrls.ts`), который через `createSignedUrls(..., 15*60)` генерирует подписанные URL с TTL 15 минут и токеном в query.

Этот токенизированный URL попадает в `<meta property="og:image">` в исходник HTML, доступный краулерам, кэшам соц-сетей и любому, кто откроет «исходный код страницы».

**Двойной риск:**
1. **Истечение (UX/SEO):** TTL=15 мин → соц-превью (Facebook/LinkedIn/WhatsApp) отвалится почти сразу после первого шэринга; кэш соц-сети сохранит мёртвый URL. Уже зафиксировано в live-notes.
2. **Утечка пути + временный доступ:** токен даёт доступ к объекту на ~15 мин любому, у кого URL; путь объекта (`{userId}/{advertId}/...`) раскрывает UUID владельца и структуру хранилища.

Поскольку медиа объявления и так публичны для активных объявлений (RLS `media` "Public view active advert media"), конфиденциальность самого изображения низкая — но практика подписывать публичный og-ассет неверна.

**Правка:** для og/twitter использовать **публичный, не истекающий** URL, а не подписанный. Варианты:
- (предпочт.) хранить превью объявления в **публичном** bucket (`/storage/v1/object/public/...`) — `next.config.ts` уже разрешает только публичные supabase-паттерны в `remotePatterns`; добавить генерацию публичного URL для первого изображения активного объявления.
- либо отдавать стабильный прокси-эндпоинт `apps/web/src/app/ad/[id]/opengraph-image.tsx` (Next OG route), который сам подписывает/стримит — стабильный внешний URL, токен не утекает.

Файл: `apps/web/src/app/ad/[id]/page.tsx` строки 270-285; источник — `signMediaUrls.ts`.

---

## A-3 — fail-open `checkUserBlocked` на создании объявления — **Med (подтверждено)**

`apps/web/src/lib/fraud/checkUserBlocked.ts`: при ошибке чтения `profiles` (строки 24-36) — если **не** передан `failClosed:true`, возвращает `{isBlocked:false}` (**fail-open**). Подтверждено поведение из `SECURITY_AUDIT.md`.

**Где fail-closed (хорошо):**
- `api/billing/checkout/route.ts:48` — `checkUserBlocked(user.id, { failClosed: true })`
- `api/adverts/[id]/route.ts:134` — publish, `failClosed: true`

**Где fail-open (риск):**
- `api/adverts/route.ts:31` — `checkUserBlocked(user.id)` **без** `failClosed` (создание объявления/черновика).

При транзиентной ошибке БД заблокированный за мошенничество пользователь может **создать объявление**. Авторы прошлого аудита сознательно оставили draft-create fail-open («low risk»), т.к. публикация (`adverts/[id]` publish) уже fail-closed. Но `POST /api/adverts` создаёт строку adverts — нужно проверить, не становится ли она сразу видимой (DB default `status='active'` — см. комментарий в `20260627230000`; создание теперь service-role, статус ставится сервером). Если создание ставит `draft`/`pending` — риск Low; если есть путь к `active` без отдельного publish — Med.

**Правка:** для консистентности и trust-позиционирования передать `failClosed: true` и в `api/adverts/route.ts:31`. Цена fail-closed — пользователь видит «verification temporarily unavailable» при редкой ошибке БД; это приемлемо.

`checkUserFlags` (строки 76-101) использует `.single()` (а не `.maybeSingle()`) — кинет ошибку при 0 строк и вернёт `hasFlags:false` (тоже fail-open); проверить вызовы.

---

## A-4 — нет rate-limit на media-роуты — **Med**

`apps/web/src/app/api/media/{sign,complete,list,public,[id]}` — **ни один не обёрнут** в `withRateLimit` (grep подтвердил: 0 совпадений `withRateLimit|createRateLimiter` в `api/media`). `sign` и `complete` используют **service-role** (`supabaseService()`) для создания signed upload URL и записи в `media`.

`POST /api/media/sign` для авторизованного владельца объявления генерирует signed upload URL. Лимит медиа на объявление (`MEDIA_LIMIT_PER_ADVERT`) есть, но **нет лимита частоты запросов**: автоматизированный клиент может спамить `sign`/`complete`, нагружая storage-API и БД (каждый `sign` — счётчик + signedUploadUrl; каждый `complete` — несколько запросов + signedUrl). Стоимость Supabase storage-операций и риск abuse.

**Правка:** обернуть `sign` и `complete` в `withRateLimit` (per-user, напр. 30/мин), как сделано в `chat/send` и `reports/create`. `media/public` (публичный?) — per-IP лимит.

---

## A-5 — `scrubContacts`: сигнал, не контроль; обходы — **Low→Med**

`apps/web/src/lib/chat/scrubContacts.ts` маскирует phone/email/url/iban в чате. Сам код честно декларирует: «DETERRENT + SIGNAL, not a guarantee». Оценка корректна.

**Реальные обходы (все работают):**
- **Прописью:** «zero six...», «ноль шесть...», «six-eight-three» — не матчится `PHONE_RE`.
- **Contiguous digits:** правило сознательно пропускает слитные цифры без разделителей (IMEI/EAN/serial). Значит `0612345678` без пробелов/`+` **не маскируется** (нет `intlPrefix`, нет separator) → телефон проходит. Это явный обход (комментарий строки 62-64 признаёт компромисс).
- **Unicode look-alikes:** кириллическая/полноширинная цифра, `＠` вместо `@`.
- **Раздробление:** «my num is 06 1 2 3...» в нескольких сообщениях.
- **IBAN с обходом regex:** пробелы внутри ловятся, но `IBAN_RE` требует 2 буквы + 2 цифры в начале — «B E 68...» (пробел после первой буквы) не матчится.

**Вывод:** как сигнал риска (логирование `types`) — ок и полезно. Но как **контроль** масштабирования off-platform fraud — слабый. Это **не** Critical, потому что (а) это deterrent by design, (б) реальный контроль (escrow/in-platform) — стратегический, не входит в скоуп scrub.

**Правка (усилить сигнал, не контроль):**
- маскировать **слитные** 9-10-значные строки, начинающиеся с `0` (бельгийский нац. формат `0xxxxxxxxx`) — отделить от IMEI(15)/EAN(13) по длине: BE-мобайл = ровно 10 цифр с ведущим 0.
- нормализовать unicode (`String.normalize('NFKC')` + маппинг полноширинных цифр) перед матчингом.
- агрегировать сигнал по **сессии/конверсации** (N сообщений с flagged → поднять risk score пользователя), а не только per-message.
Файл: `scrubContacts.ts`; вызов — `api/chat/send/route.ts:61`.

---

## A-6 — расхождение X-Frame-Options vs CSP frame-ancestors — **Low**

`next.config.ts`: заголовок `X-Frame-Options: SAMEORIGIN` (строка 60), а CSP содержит `frame-ancestors 'none'` (строка 20). Под Report-Only безвредно. **При promote CSP к enforced** они конфликтуют: `frame-ancestors 'none'` запретит даже same-origin встраивание, что может сломать любые внутренние iframe-эмбеды. Зафиксировано в `SECURITY_AUDIT.md` M3.

**Правка:** выбрать одну политику фрейминга. Если same-origin embeds не нужны — оставить `'none'` и убрать `X-Frame-Options` (или поставить `DENY`). Если нужны — `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`.

---

## A-7 — `getClientIp` доверяет `x-forwarded-for` — **Med**

`apps/web/src/lib/rateLimiter.ts` (`getClientIp`, строки 192-216): берёт **первый** IP из `x-forwarded-for` (строка 196-197). Клиент может прислать произвольный `X-Forwarded-For` → **спуфинг IP** → обход per-IP rate-limit (каждый запрос с новым фейковым IP = новый бакет). Это подрывает все IP-лимиты (auth check-email, chat IP-bucket, reports IP-bucket).

`x-forwarded-for` доверять можно **только** значению, проставленному вашим reverse-proxy/CDN (последний доверенный hop), а не первому элементу списка от клиента.

**Правка:** если деплой на Vercel — использовать `req.headers.get('x-vercel-forwarded-for')` или брать **последний** доверенный IP, либо ограничить доверие конкретному proxy. Минимум: предпочесть `cf-connecting-ip`/`x-real-ip` (их ставит инфра) первым в приоритете над клиентским `x-forwarded-for`. Сейчас порядок обратный (XFF первым, строки 195-205).

---

## A-8 — rate-limiter fail-open без Upstash env — **Low**

`rateLimiter.ts` строки 49-58: если `UPSTASH_REDIS_REST_URL`/`TOKEN` не заданы, `createRateLimiter` возвращает функцию, которая **всегда** `success:true` (rate-limit отключён, только warn в консоль). Если в проде env-переменные не проставлены/слетели — **все лимиты молча отключаются**. Для prod это fail-open угроза (брутфорс auth, спам чата/репортов).

**Правка:** в проде (`NODE_ENV === 'production'`) при отсутствии Upstash env — **кидать ошибку при старте** (fail-closed на конфиге), а не молча отключать. Dev/test — оставить no-op.

---

## A-9 — HSTS без preload — **Low**

`next.config.ts:57`: `max-age=31536000; includeSubDomains` — нет `preload`. Для HSTS preload-листа нужен флаг `preload`. Не критично, но для trust-сайта желательно.

**Правка:** добавить `; preload` после валидации, что все поддомены на HTTPS, и подать домен в hstspreload.org.

---

## Прочее (подтверждено, рисков нет)

- **`supabaseService()` — server-only ✓.** `apps/web/src/lib/supabaseService.ts:1` — `import "server-only"`; кидает ошибку, если нет `SUPABASE_SERVICE_ROLE_KEY` (не падает в анон-клиент). 60 файлов используют — все в `api/*`, `lib/*` (server), либо server-компонентах (`ad/[id]/page.tsx`, `c/page.tsx`). Клиентских утечек service-role не найдено.
- **Stripe webhook идемпотентен ✓.** `api/billing/webhook/route.ts`: проверка подписи (`constructEvent`, строки 52-62); идемпотентность на `checkout.session.completed` через статус `existingPurchase?.status === 'completed'` (строки 125-134). Замечание Low: подписочная ветка (`mode==='subscription'`, строки 72-113) **не** имеет явной дедупликации — повторная доставка `checkout.session.completed` для подписки просто переустановит `pro_until` (идемпотентно по эффекту, ОК). `customer.subscription.*` тоже идемпотентны по эффекту.
- **RLS-модель — сильная ✓.** Рекурсия chat-политик исправлена через `is_conversation_participant()` SECURITY DEFINER (`20260627310000`); создание конверсаций rpc-only (`start_conversation`, `20260627280000` + revoke insert `20260627290000`); reviews chat-gated через `create_review()` (`20260627270000`); column-level lock на adverts/profiles/businesses/phones/reviews (`20260627230000`, `20260627200000`) закрывает прямой PostgREST-обход (self-verify, смена status/business_id/entity_verified). Это закрывает дыры, которые оставляла бы базовая `"for all" with check (user_id=auth.uid())` политика (`20251005191500`) — она даёт row-, но не column-security.
- **Секреты не в клиенте ✓.** `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Upstash token — только серверные. В клиент идут только `NEXT_PUBLIC_*` (anon key, url).

---

# ЧАСТЬ B — МОБИЛЬНАЯ АДАПТИВНОСТЬ

## Сводная таблица находок

| ID | Находка | Приоритет | Файл |
|----|---------|-----------|------|
| B-1 | Несоответствие spacer (56px) ↔ BottomNav (76px): нижний контент обрезается на всех страницах | **High** | `viewport-bottom-spacer.tsx` + `bottom-nav.tsx` |
| B-2 | На `/ad/*` контент перекрыт MobileContactBar (66px на bottom:76px = ~142px зоны), spacer не компенсирует | **High** | `ad/[id]/page.tsx`, `AdvertMobileContactBar.tsx` |
| B-3 | Двойной отступ снизу: `<main>` pb=64px **И** `ViewportBottomSpacer`=56px → ~120px пустоты, всё равно < 76px навбара по факту? Несогласованные источники истины | **Med** | `layout.tsx`, `viewport-bottom-spacer.tsx` |
| B-4 | Тач-таргеты bottom-nav < 44px (иконки 22px, подписи 10.5px, высота ячейки ~67px но кликабельная зона визуально мелкая) | **Med** | `bottom-nav.tsx` |
| B-5 | LanguageSwitcher на мобайле = 30px высота (< 44px тач-таргет) | **Med** | `main-header.tsx` строки 191-193 |
| B-6 | Категории и trust-топбар скрыты на мобайле (`md:hidden`/`hidden md:block`) | **Low→Med** | `main-header.tsx`, `topbar.tsx` |
| B-7 | Галерея объявления `grid-cols-6` thumbnails — на мобайле миниатюры ~50px, тач-мелко | **Med** | `AdvertGallery.tsx:73` |
| B-8 | Фикс-шрифты в px (`font: "800 18px Inter"`) игнорируют системный масштаб шрифта | **Low** | `AdvertMobileContactBar.tsx`, разн. |
| B-9 | viewport meta — корректен (подтверждено) | ✓ OK | `layout.tsx:22-27` |

---

## B-1 — Несоответствие spacer ↔ BottomNav: обрезание контента — **High**

Три **разных** источника истины о высоте нижней навигации:

1. `apps/web/src/components/bottom-nav.tsx:71` — фактическая высота навбара: `style={{ height: 76 }}` (плюс `pt-[9px]` и `pb-[env(safe-area-inset-bottom)]`, плюс центральная кнопка `marginTop:-22` выпирает вверх). **Реальная высота ≈ 76px + safe-area.**
2. `apps/web/src/components/viewport-bottom-spacer.tsx:3` — резервирует `h-[calc(56px+env(safe-area-inset-bottom))]`. Комментарий говорит «56px (h-14)». **Это на 20px меньше реальных 76px.**
3. `apps/web/src/app/layout.tsx:99` — `<main>` имеет `pb-[calc(64px+env(safe-area-inset-bottom))]` — третье число (64px).

Итог: на любой странице последние ~20px контента (нижняя строка/кнопка) **уходят под фиксированный BottomNav** и недоступны/обрезаны на мобайле. Particularly страдают формы (последнее поле/submit) и низ списков.

**Правка (унифицировать высоту):**
```tsx
// 1. Сделать высоту навбара единственным источником истины (CSS-переменная):
//    в bottom-nav: style={{ height: "var(--bottom-nav-h, 76px)" }}
// 2. viewport-bottom-spacer.tsx → h-[calc(76px+env(safe-area-inset-bottom))]
// 3. layout.tsx <main> → убрать собственный pb (оставить только spacer) ИЛИ
//    pb-[calc(76px+env(safe-area-inset-bottom))]; не дублировать spacer + pb.
```
Сейчас spacer (56) + main pb (64) дают избыточный отступ местами, но **меньший из реальной потребности (76)** в худшем месте, плюс двойной отступ в обычных. Привести всё к 76px из одной переменной.

---

## B-2 — `/ad/*`: контент под MobileContactBar — **High**

`apps/web/src/components/AdvertMobileContactBar.tsx:82-90` — фиксированный бар: `bottom:76px`, `height:66px` (то есть он стоит **над** BottomNav, занимая полосу 76→142px от низа экрана), `lg:hidden`.

Страница `ad/[id]/page.tsx:1038` рендерит этот бар, но **не добавляет** компенсирующего нижнего отступа под него. Глобальный `<main>` pb=64px и `ViewportBottomSpacer`=56px рассчитаны только на BottomNav (и даже его недооценивают, см. B-1). Значит на странице объявления **последние ~142px контента** (форма отзыва `LeaveReviewForm`, блок «Похожие объявления») перекрыты двойным слоем: BottomNav (0-76px) + ContactBar (76-142px).

**Правка:** на странице `/ad/[id]` добавить нижний отступ под суммарную высоту обоих баров **только на мобайле/планшете** (`lg:hidden` логика бара):
```tsx
// ad/[id]/page.tsx — обёртке контента добавить:
className="... pb-[calc(142px+env(safe-area-inset-bottom))] lg:pb-0"
// 142 = 76 (bottom-nav) + 66 (contact bar)
```
Лучше вынести `142px` в ту же CSS-переменную, что и B-1.

---

## B-3 — Двойной/несогласованный нижний отступ — **Med**

Как следствие B-1: `<main>` имеет собственный `pb-[64px]` (`layout.tsx:99`) **и** отдельно рендерится `<ViewportBottomSpacer/>` (56px) **после** `<LegalFooter/>`. Это два механизма для одной задачи с разными числами. На обычных страницах получаем ~64px (main) + footer + 56px (spacer) = избыточно; на /ad — недостаточно (B-2).

**Правка:** один механизм. Рекомендую убрать `pb` у `<main>` и оставить только `ViewportBottomSpacer` с корректной высотой (76px), либо наоборот — но не оба. Footer должен быть **до** spacer (сейчас порядок `footer → spacer → nav` ок).

---

## B-4 — Тач-таргеты BottomNav < 44px — **Med**

`bottom-nav.tsx`: иконки `h-[22px] w-[22px]`, подписи `text-[10.5px]`. Ячейки `grid-cols-5`, высота контейнера 76px с `pt-[9px]`. Кликабельная зона `<Link>` — это flex-колонка иконка+подпись, реально ~44-50px по высоте (ок по высоте), но **по ширине** при 5 колонках на узком экране (360px) каждая ячейка ~72px — по площади приемлемо, НО визуальная мишень (иконка+мелкий текст) ощущается мелкой. Apple HIG/WCAG = ≥44×44px **именно кликабельной** зоны.

Центральная кнопка «+» — 46px диаметр (ок).

**Правка:** убедиться, что у `<Link>` `min-h-[48px]` и `py`, чтобы вся ячейка ловила тап (сейчас `gap-[4px]` без явного min-height — высота определяется контентом + `items-start`). Добавить `className="... min-h-[48px] justify-center"`.

---

## B-5 — LanguageSwitcher 30px на мобайле — **Med**

`main-header.tsx:191` — мобильная обёртка форсит `[&_button]:h-[30px]`. 30px < 44px минимума тач-таргета. Bell и UserMenu рядом — проверить их размеры тоже. На узком хедере (logo + flex-1 search + 3 контрола) это компромисс по месту, но 30px слишком мелко для языка/локали (важно для BE-мультиязычия).

**Правка:** поднять до `h-[36px]`-`h-[40px]` минимум, либо вынести язык в `/more` или в drawer, освободив хедер. Для BE (4 языка) переключатель языка важен — лучше увеличить, не прятать.

---

## B-6 — Категории и trust-топбар скрыты на мобайле — **Low→Med**

- `topbar.tsx:38` — `hidden ... md:block`: trust-полоса («Verified signals / Anti-scam / Belgian deals») **не видна на мобайле**. Это ключевой trust-месседж бренда, а мобайл — основной трафик маркетплейса. Скрытие ослабляет позиционирование на главном устройстве.
- `main-header.tsx:177-179` — на мобайле нет кнопки «Категории» и «Post» в хедере; они вынесены в BottomNav (`/c`, `/post`). Это **осознанное** решение (комментарий в коде) и архитектурно ок — категории доступны через bottom-nav «Categories». Риск Low.

**Правка (B-6 для топбара):** показать сжатый trust-сигнал и на мобайле — например, одну ротирующуюся плашку или компактную строку под хедером (`md:hidden` версия topbar с 1 сигналом). Trust — ядро LyVoX, на мобайле его терять нельзя.

---

## B-7 — Галерея: grid-cols-6 миниатюр — **Med**

`AdvertGallery.tsx:73` — `grid grid-cols-6 gap-2.5` для миниатюр. На мобайле (360px ширина минус паддинги ~328px) 6 колонок = миниатюра ~48px с gap — мелко для тапа и просмотра. `aspect-square` + `overflow-hidden` (строка 80). Главное фото выше — ок.

**Правка:** на мобайле уменьшить число колонок: `grid-cols-4 sm:grid-cols-5 md:grid-cols-6`, либо горизонтальный скролл-ряд миниатюр (`flex overflow-x-auto snap-x`) с миниатюрами ≥64px. Проверить, что главное фото на мобайле не превышает viewport (нет горизонтального скролла) — `aspect`-контейнер с `w-full` обычно ок.

---

## B-8 — Фикс-шрифты в px игнорируют системный масштаб — **Low**

`AdvertMobileContactBar.tsx`: `font: "800 18px Inter"` (цена), `font: "700 14.5px Inter"` (кнопка) — жёсткий px через `style`. Пользователи с увеличенным системным шрифтом (доступность) не получат масштабирования. Аналогично инлайн-шрифты в других местах.

**Правка:** перейти на Tailwind-классы (`text-lg font-extrabold`) / `rem`-юниты, чтобы уважать пользовательский масштаб. Низкий приоритет, но важно для accessibility-ветки.

---

## B-9 — viewport meta — корректен ✓

`apps/web/src/app/layout.tsx:22-27`:
```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#11bdf9",
};
```
Подтверждено: `width=device-width`, `viewport-fit=cover` (нужен для `env(safe-area-inset-*)` на notched iOS), `themeColor` задан. Замечаний нет. BottomNav и spacer корректно используют `env(safe-area-inset-bottom)`.

---

## Горизонтальный скролл / читаемость — общий вывод

Grep по `overflow-x`/`w-[1000+]`/`w-screen` на `page.tsx` (home) и `ad/[id]/page.tsx` совпадений не дал — явных причин горизонтального скролла в основном контенте не найдено. Хедер использует `min-w-0 flex-1` на SearchBar (`main-header.tsx:187`), что корректно предотвращает распирание flex-контейнера. Главные риски горизонтального скролла на мобайле — карусели категорий и галерея (B-7); проверить на реальном устройстве после фиксов spacing.

---

# Приоритеты к исполнению

**Сначала (блокеры мобайла + High security):**
1. B-1 + B-2 + B-3 — унифицировать высоту нижней навигации в одну CSS-переменную (76px), компенсировать ContactBar на /ad (142px). Один PR, чинит обрезание контента на всех мобильных страницах.
2. A-1 — собирать CSP-отчёты (report-uri) сейчас; запланировать nonce-миграцию для enforced CSP.

**Затем (Med):**
3. A-7 — починить доверие `x-forwarded-for` (иначе все IP-лимиты обходятся).
4. A-4 — rate-limit на `media/sign` + `media/complete`.
5. A-3 — `failClosed:true` на `api/adverts` create.
6. A-2 — публичный (не подписанный) og:image.
7. B-4, B-5, B-7 — тач-таргеты и галерея.

**Потом (Low):**
8. A-5 (усилить сигнал scrub), A-6, A-8, A-9, B-6, B-8.
