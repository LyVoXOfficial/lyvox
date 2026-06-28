# LyVoX — Аудит сайта (UX/психология · SEO · Безопасность · Мобайл)

Дата: 2026-06-27 · Метод: live-обзор www.lyvox.be (Claude in Chrome, desktop) + анализ кода тремя субагентами. Мобильная отрисовка инструментом не эмулируется → мобайл оценён по коду (адаптивные классы, мобильные компоненты).

**Детальные разделы:**
- [`_live-capture-notes.md`](./_live-capture-notes.md) — сырые live-наблюдения.
- [`01-ux-psychology-audit.md`](./01-ux-psychology-audit.md) — UX/психология по страницам.
- [`02-seo-technical-audit.md`](./02-seo-technical-audit.md) — SEO/технический.
- [`03-security-mobile-audit.md`](./03-security-mobile-audit.md) — безопасность + мобильная адаптивность.

> Важная поправка к live-заметкам (подтверждено субагентом по коду): empty-state в Discover и счётчик результатов в Search **существуют** в коде. Проблема не в их отсутствии, а в **поведении** (ложный старт пустой деки; спиннер вместо скелетона). Эталон страницы — карточка объявления `/ad/[id]` (identity-gating, trust-таймлайн, анти-скам копирайт).

> **Решение по приоритетам (2026-06-27):** SEO и Security (разделы 02 и 03-часть-A, а также P0-пункты 1–5 и P1-пункты 11–17 ниже) **отложены на потом — это последний этап** («pre-launch hardening»). Они здесь задокументированы и ждут. Текущий фокус — **дизайн + раскладка + функционал** (раздел 01 и 03-часть-B «Мобайл»).

---

## Приоритезированный список (что чинить перед отдачей в разработку)

### P0 — критично (ломает SEO/доверие/превью прямо сейчас)
1. **`metadataBase` не задан** (`layout.tsx`) → относительные og/canonical не резолвятся. → 02.
2. **Двойной слеш в canonical** `//ad/` (trailing slash в `NEXT_PUBLIC_SITE_URL` + конкатенация) → ввести `absoluteUrl()`/`getSiteUrl()`. → 02.
3. **og:image непригоден для соц-превью:** home — SVG; `/ad/*` — подписанный Supabase-URL с истекающим токеном (+ утечка пути/UUID владельца). → нужен стабильный публичный PNG 1200×630 / public storage URL. → 02, 03.
4. **Нет `sitemap.ts`/`robots.ts`** (и robots.txt/sitemap.xml) → поисковики без карты. Добавить динамический sitemap по объявлениям/категориям. → 02.
5. **CSP не enforced** (`Content-Security-Policy-Report-Only` + `unsafe-inline`/`unsafe-eval`) → XSS ничем не блокируется. План: report-uri → nonce + strict-dynamic → enforced. → 03.

### P1 — важно к запуску
6. **Анти-соц-доказательство `4/4/1` на home** — счётчики на пустом маркете кричат «тут пусто». Скрыть/заменить ценностными тезисами до ликвидности. → 01.
7. **Мерцание авторизации в шапке** (клиентское определение сессии) → серверное состояние/скелетон. → 01.
8. **Discover: ложный старт пустой деки** (`initial={[]}`, seen-фильтр вычищает малый каталог) → SSR-сид + флаг `hasLoadedOnce` + поведение при малом каталоге. → 01, [[01-discover-swipe-system]].
9. **RU-баг онбординга/регистрации** (`ru → englishMessages`) — диаспора-сегмент видит английский, хотя `ru.json` полон. → 01, [[42-i18n-localization]].
10. **Тяжёлая воронка продавца** (8 шагов + верификация до формы) против «листинг за 60с» → черновик до верификации, гейт на публикации. → 01, [[31-listing-creation]].
11. **Одинаковый title/нет canonical** на home/search/discover/category; `search/page.tsx` — `"use client"` (нет server metadata) → per-page `generateMetadata` + server/client split. → 02.
12. **Generic meta description** везде → per-page тексты с бельгийскими ключами NL (tweedehands/te koop) / FR (occasion/à vendre). → 02.
13. **hreflang:** домен hardcoded без `www`, нет `x-default`, через `?lang=`, нет per-page alternates. → 02.
14. **Search/Discover индексируются** → должны быть `noindex` (краулер-ловушка/пустой персонализированный контент). → 02.
15. **x-forwarded-for спуфится** (`rateLimiter.getClientIp` берёт первый IP) → обход всех per-IP лимитов. → 03.
16. **Нет rate-limit на `/api/media/*`** (service-role) → abuse storage. → 03.
17. **fail-open `checkUserBlocked` на создании объявления** (`api/adverts/route.ts`) → сделать fail-closed. → 03, [[38-moderation-reports]].
18. **Мобайл: рассинхрон высот bottom-nav** (BottomNav 76px vs spacer 56px vs main 64px) → контент уходит под навбар на всех страницах; свести к одной CSS-переменной. → 03.
19. **Мобайл: контент под ContactBar на `/ad/*`** (полоса до ~142px не компенсируется) → `pb-[142px] lg:pb-0`. → 03.

### P2 — улучшения
20. **Дубль поиска на home** (header + hero) → скрыть один. → 01.
21. **Спиннер вместо скелетона на search** (`AdsGridSkeleton` импортирован, не подключён). → 01.
22. **Trust-топбар скрыт на мобайле** (`hidden md:block`) → показать сжатую версию на главном канале. → 01, 03.
23. **Витрина товара ниже фолда на home** → поднять строку карточек после hero. → 01.
24. **Сырые `<img>`** в карточках/деке/поиске → `next/image` (AVIF/WebP/srcset/lazy) — LCP/CLS. → 02, [[31-listing-creation]].
25. **JSON-LD неполный** (Product seller=заглушка, signed image; нет WebSite+SearchAction; Organization logo=favicon). → 02.
26. **Заглушки выглядят рабочими** (reviews=[], статичные «Enabled») → честнее «скоро»/скрыть. → 01.
27. **Тач-таргеты < 44px** (LanguageSwitcher ~30px, миниатюры галереи ~48px, ячейки BottomNav). → 03.
28. **Нет manifest/PNG-иконок** → [[18-pwa-push]].
29. **scrubContacts тривиально обходится** — усилить (BE-формат, NFKC-нормализация); по дизайну это сигнал. → 03, [[35-chat-antifraud]].
30. **Два файла middleware** (`apps/web/middleware.ts` и `apps/web/src/middleware.ts`) — проверить, какой активен. → 02.

---

## Подтверждено как хорошее (не трогать)
- Карточка объявления `/ad/*`: identity-gating, trust-панель, анти-скам копирайт, корректный мобильный contact-bar.
- Security-база: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy; `supabaseService()` строго server-only; Stripe webhook с проверкой подписи + идемпотентность; сильная RLS (chat-recursion fix, rpc-only conversations, chat-gated reviews, column-level locks); секреты только серверные.
- viewport meta корректен; safe-area используется; горизонтального скролла нет.
- hreflang присутствует; на `/ad/*` есть JSON-LD; next/image сконфигурирован (хоть и не везде используется).

---

## Новая фича из этого запроса
- **Помощник навигации (one-time)** — оформлен как [`../61-navigation-help-assistant.md`](../61-navigation-help-assistant.md): однократное предложение помощи при первом входе в раздел, с выключением и ручным переоткрытием, без авто-повтора.

## Связь с PRD
Находки ложатся на существующие PRD: [[01-discover-swipe-system]], [[18-pwa-push]], [[31-listing-creation]], [[35-chat-antifraud]], [[38-moderation-reports]], [[42-i18n-localization]], [[61-navigation-help-assistant]]. SEO/security-фиксы P0 стоит вынести в отдельный «pre-launch hardening» спринт.
