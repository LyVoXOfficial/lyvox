# T13 — UX1 scope note (audit-first)

Источник: `docs/features/audit/01-ux-psychology-audit.md` (2026-06-27).
Метод: сверка каждой находки с текущим кодом (`file:line`), пометка done/open.
Правило T13: **presentation-only** — не трогать data-fetching, props, гейты, RLS, роуты, i18n-ключи (кроме новой видимой строки → тогда 5 локалей).

## Уже закрыто предыдущими волнами (НЕ переделывать)

| # | Находка | Статус | Доказательство |
|---|---|---|---|
| 1 | Анти-соц-доказательство `4/4/1` на home | ✅ done | stats-карточка удалена — `app/page.tsx:372-374` (комментарий council verdict), hero одноколоночный |
| 3 | Дубль поиска на home | ✅ done | `main-header.tsx:40` `showHeaderSearch = pathname !== "/"`; header-поиск скрыт на `/`, hero владеет поиском (`page.tsx:419`) |
| 7 | Витрина товара ниже фолда | ✅ done | `AdsGrid items={showcaseAds}` сразу после hero — `page.tsx:469-470`; feed демотирован в самый низ |
| home Med | Блок «как это работает / почему безопасно» | ✅ done | «HOW LYVOX PROTECTS» статический ряд — `page.tsx:483-521` |
| 4 | Ложный empty-state в Discover на старте | ✅ done | `SwipeDeck.tsx:146` `hasLoadedOnce`, `:511` `showSkeleton`, `:512` `isEmpty = hasLoadedOnce && ...` |
| 4 | Мёртвая колода / сброс `seenAdverts` | ✅ done | `SwipeDeck.tsx:597-608` кнопка reset чистит `lyvox:seenAdverts` + перезагружает |
| 4 low | Текст empty-state дружелюбнее + CTA | ✅ done | `SwipeDeck.tsx:583-614` — reset CTA + back-to-feed + error-ветка |
| 4 med | Trust-бейдж на SwipeCard | ✅ done | `SwipeCard.tsx:141-146` (badge) + `:183-187` (trust-row) `card.sellerVerified` |
| 8 | Спиннер вместо скелетона на search | ✅ done | `search/page.tsx:683-687` `AdsGridSkeleton` в initial-loading ветке (aria-busy) |
| H | Хрупкий scroll-listener + setTimeout инфинит-скролла | ✅ done | `search/page.tsx:820-828` — `IntersectionObserver` sentinel (`sentinelRef`), `Loader2` тут = load-more, не initial |

Прочее вне T13 (не presentation): #2-proper (SSR-сессия), #5 (`ru→englishMessages`), #6 (глубина воронки/гейт), #8-med (двойная модель фильтров — логика), ad `Promise.all`/location-required — это data/логика/гейты, оставляем.

## Открыто и в scope (presentation-only) — берём

| # | Находка | Приоритет | Где | План правки |
|---|---|---|---|---|
| 9 | Trust-полоса исчезает на мобайле (`TopBar` `hidden md:block`) | Med | `topbar.tsx:38` | Компактный мобильный вариант trust-строки. Переиспользуем **существующие** ключи `topbar.verified_signals/anti_scam/belgian_deals` — новых i18n-строк НЕ вводим. Сидит над sticky-хедером, top-of-page → не трогает `--bottom-nav-h`. |
| 2 | Мерцание авторизации в шапке (гость→аккаунт flash) | High | `UserMenu.tsx:183` | **Только UserMenu** (в `main-header` `hasSession` гейтит лишь `handlePostClick`, не видимый рендер). Ввести `resolved`-флаг; пока `!resolved` — нейтральный скелетон аватара вместо гостевых кнопок. **НЕ** пробрасывать серверную сессию (это data/логика, вне scope) — скелетон маскирует flash, root-cause не трогаем, и это верный in-scope компромисс. |

## Открыто, но НЕ берём (обоснование)

- **G — статичные «Enabled» бейджи уведомлений** (`profile/page.tsx:676,683`): после T12 (saved-search alert delivery, `aa61f64`) часть каналов реально забэкана — «Enabled» уже не однозначно ложь. Честная правка требует ясности data-слоя (какие каналы реально включены) → это уже не presentation-only. Оставляем до отдельного тикета, чтобы не сделать неверное trust-заявление в любую сторону.
- **Low-полировка** (trust-score тултип на `/ad`, «Шаг X из N» в PostForm, Pro/lang-ссылки в `/more`): низкая ценность, дробит presentation-риск; вне минимального набора незакрытых находок.

## Верификация
- SSR-HTML / прод-curl, НЕ дев-браузер (dev CSS stale-кэш — память deploy-pipeline).
- `pnpm typecheck && pnpm test && pnpm lint` зелёные перед merge.
