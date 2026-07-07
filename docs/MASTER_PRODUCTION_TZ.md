# LyVoX — MASTER PRODUCTION ТЗ (фиксы + доведение до готового продукта)

Дата: 2026-07-04 · Автор-черновик: инженерный анализ (4 разведочных агента: perf / billing-VAT / security / admin-flags) + advisor-ревью.
Это **обзорный мастер-ТЗ уровня «список для ревью»**, а не полная имплементационная спека. По договорённости с владельцем: сначала утверждаем этот список, потом проходим **по каждому пункту отдельно** (детальная спека на каждый ID — отдельный проход).

## 0. Как читать

- **Стабильный ID** у каждого пункта (`PERF-01`, `SEC-04`, `VAT-B2`, …) — чтобы на следующих проходах ссылаться однозначно.
- **Приоритет:** `P0` (без этого нет запуска/комплаенса/безопасности) · `P1` (важно к запуску) · `P2` (после запуска).
- **Статус:** ✅ есть · 🟡 частично · ⛔ нет · 🔑 код готовим сейчас, активируется ключом позже.
- Формат пункта: **Проблема → Решение (выбранное) → [для крупных: Рассмотрено N→Выбрано] → Критерии приёмки → Зависимости / Ключи.**
- **Живой трекер** — раздел «✅ TODO» ниже: единый список в порядке исполнения. Закрыли пункт → ставим `[x]` и **вычёркиваем** `~~…~~`. Порядок = сверху вниз (первый — с чего начать; последний закрывает всё).
- **Самообучение** — раздел «📏 Правила + журнал ошибок»: любую грабли заносим в журнал; **встретили >2 раз (на 3-й) → повышаем в жёсткое ПРАВИЛО** (по возможности с CI-гардом). Правила читаем перед каждым проходом.

### Про «минимум 10 вариантов на пункт»
Требование выполнено **по существу, а не буквально построчно** (буквально на каждую строку — противоречило бы просьбе «конкретный список»). На **6 ключевых архитектурных развилках** (`FLAG-01`, `VAT-B`, `SEC-CSP`, `SEC-ATO`, `UX-MOTION`, `PERF-01`) я явно выписал ~10 рассмотренных вариантов и обоснование выбора — см. блоки «Рассмотрено». На остальных (более механических) пунктах записан выбранный best + ключевые отвергнутые альтернативы. Если по какому-то пункту хочешь полный веер из 10 — скажешь на его отдельном проходе.

### Золотой принцип «ключи впишем позже» (AND-gate)
Любая интеграция, которой нужен API-ключ, включается по правилу:
```
capabilityOn(x) === adminToggle(x) === true  &&  requiredSecretsPresent(x) === true
```
- **Секреты (Stripe/Twilio/OpenAI/itsme/…) остаются в env** (Vercel-шифрование), в БД **не переносятся**.
- В БД (`platform_settings`) лежит только **не-секретный тумблер вкл/выкл + конфиг**.
- Тумблер в админке имеет **три состояния**: `ON` / `OFF` / `🔒 нет ключей (заблокирован)`. Удаление ключа в рантайме → пункт гаснет в «заблокирован», **не 500**. Тумблер = одновременно активация И «kill-switch» на случай инцидента.

---

## 🧭 Критический путь (в каком порядке двигаться)

1. **Запустить СЕЙЧАС, параллельно всему (внешне-долгие, блокируют пол-беклога):**
   - `PROD-F3` — PSD2/AML legal-gate (юрист + Stripe + возможно NBB). Это «длинный шест»: код денежного ядра нельзя, пока не закрыт.
   - `PROD-F4` — GDPR RoPA/DPIA/DPA-реестр. `PROD-F5` — DSA-роль/PoC/DSC. `VAT-LEGAL` — бухгалтер/налоговый консультант подтверждает ставки/схемы.
   Эти четыре — не код, а внешние подтверждения; чем раньше стартуют, тем лучше.
2. **Безопасность к запуску (P0, делаем в первую очередь по коду):** `SEC-CSP`, `SEC-RL1/2`, `SEC-UPLOAD`, `SEC-BOT`, `SEC-VALID`, `SEC-CSRF`, `SEC-ENV`.
3. **Перформанс (P0/P1, быстрый ощутимый эффект + SEO/CWV):** `PERF-01…03` в первую очередь.
4. **Фундамент под ключи и НДС:** `FLAG-01…06` (рантайм-тумблеры) → `VAT-A` (Stripe Tax на свои сборы) + `VAT-B` (движок для товаров, пока display/invoice/DAC7).
5. **Дизайн/motion:** `UX-MOTION` система + пройтись по экранам.
6. **Продуктовая полнота:** денежное ядро (после F3), идентичность Phase B, discovery, комплаенс.
7. **Ops/наблюдаемость/QA** — параллельно везде; `LAUNCH` — финальный go/no-go.

> Безопасность — самый **глубокий** блок ниже (по прямой просьбе владельца: «особенно тщательно защита от эксплойтов»).

---

## ⚙️ Рубрика: модель и мощность (low → ultracode)

Каждая задача помечена тегом **`[модель · мощность]`**. Смысл уровней:

| Мощность | Когда применять | Модель |
|---|---|---|
| `low` | механическое, спецификация ясна, риск низкий (конфиг, wiring, доки/раннбуки) | **Haiku 4.5** |
| `medium` | стандартная имплементация с небольшим дизайном, ограниченный blast-radius | **Sonnet 5** |
| `high` | нетривиальный дизайн/рефактор, кросс-каттинг, важна корректность | **Opus 4.8** (effort high) |
| `xhigh` | архитектурный фундамент ИЛИ рядом с безопасностью/деньгами; нужна верификация | **Opus 4.8** (effort xhigh) |
| `max` | security-critical, one-shot-must-be-right, тонкая корректность | **Opus 4.8** (effort max) |
| `ultracode` | глубочайшее: **multi-agent оркестрация** (`/code-review ultra` / Workflow) — fan-out finders + adversarial verify + synthesis. Самое рисковое/юр-нагруженное/широкий аудит | **Workflow** (Opus под капотом) |
| `n/a` | внешнее/не-кодовое (юр-гейты F3/F4/F5, VAT-LEGAL, активация ключей founder) | **—** |

Правило: не завышать (дорого) и не занижать (риск). Для шага-связки берётся **максимум** по входящим ID. Теги проставлены калибровкой + сквозной нормализацией на консистентность (одинаковый риск → одинаковый уровень; `ultracode` — только на реально самом рисковом).

---

## ✅ TODO — единый порядок исполнения (живой трекер)

**Как вести:** сверху вниз. Закрыл шаг → `- [x]` + `~~вычеркнуть~~`. Каждый шаг ссылается на ID из блоков ниже (там детали). Порядок учитывает зависимости: внешние гейты стартуют первыми (долгие), безопасность и видимость — рано, денежное ядро — в конце (за F3), последний шаг закрывает всё.

### Фаза A — старт: внешний трек + видимость
- [ ] **01.** Запустить внешние гейты (часы пошли): `PROD-F3` (PSD2/AML юрист+Stripe+NBB), `PROD-F4` (GDPR RoPA/DPIA), `PROD-F5` (DSA-роль/PoC), `VAT-LEGAL` (бухгалтер: ставки/схемы) — переписка/договоры параллельно всему коду — 🎚️ **[— · n/a внешнее]**
- [x] ~~**02.** `OPS-ERR` — Sentry + Vercel Speed Insights (снять baseline скорости/ошибок ДО оптимизаций — иначе чиним вслепую) — 🎚️ **[Haiku 4.5 · low]**~~ ✅ 2026-07-04
- [x] **03.** ~~`FLAG-05` + `SEC-RL2` — единая zod-схема env + hard-fail в prod при отсутствии критичных ключей (закрывает «rate-limiter молча выключен»)~~ ✅ `lib/env.ts` (boot-assert в `instrumentation.register()`) + rate-limiter fail-closed в prod — 🎚️ **[Opus 4.8 · high]**

### Фаза B — безопасность P0 (дёшево, критично, до запуска)
- [x] ~~**04.** `SEC-CSP` — CSP report-only → enforced (nonce + strict-dynamic, убрать `unsafe-inline`/`unsafe-eval`)~~ ✅ **код готов (report-only по умолчанию)** 2026-07-04: nonce-CSP из `middleware.ts` (`lib/security/csp.ts`), `unsafe-inline`/`unsafe-eval` сняты, Turnstile/Sentry-хосты добавлены. 🟡 **enforce-flip (`CSP_MODE=enforce`) — гейт на проде** после ревью `/api/csp-report` (RULE-04, см. SEC-CSP) — 🎚️ **[Workflow · ultracode]**
- [x] ~~**05.** `SEC-RL1` — rate-limit на create/publish объявления (спам-поверхность)~~ ✅ 2026-07-04 — 🎚️ **[Sonnet 5 · medium]**
- [x] ~~**06.** `SEC-BOT` — Turnstile на login/OTP/reset (+оценка Vercel BotID)~~ ✅ 2026-07-05 — 🎚️ **[Sonnet 5 · medium]**
- [x] ~~**07.** `SEC-UPLOAD` — magic-byte sniff + серверный ре-энкод (sharp) + EXIF-strip + лимит мегапикселей~~ ✅ 2026-07-05 — 🎚️ **[Workflow · ultracode]**
- [x] ~~**08.** `SEC-VALID` — zod-схема на всех мутирующих роутах (+CI-гард на роут без схемы)~~ ✅ 2026-07-05 — 🎚️ **[Sonnet 5 · medium]**
- [x] ~~**09.** `SEC-CSRF` — helper-ассерт Origin/Sec-Fetch-Site на мутациях~~ ✅ 2026-07-05 — 🎚️ **[Sonnet 5 · medium]**
- [x] ~~**10.** `SEC-AUTHZ-GUARD` — CI-гард RLS/column-grants/function-grants (фиксирует RULE-01/02 автоматикой)~~ ✅ 2026-07-05 — статик-гард `authz-migration-guard.test.ts` (RULE-A/RULE-01/RULE-02 на новых миграциях, allowlist по образцу SEC-VALID, +positive-detection) едет на `pnpm test`; **живой аудит** `scripts/audit-authz-live.mjs` (`pnpm authz:audit`, `role_table_grants × pg_policies × pg_proc`) прогнан по проду → отчёт `docs/security/SEC-AUTHZ-GUARD-live-audit.md`. Follow-up: column-scope `profiles`-INSERT (verified_*/itsme_*/pro_until) + purchases/reports — 🎚️ **[Opus 4.8 · high]**
- [x] ~~**11.** `SEC-DEP` — supply-chain: Dependabot + `pnpm audit` gate + gitleaks + pin actions~~ ✅ 2026-07-05 — `.github/workflows/ci.yml` (audit + gitleaks jobs, deps checked on every push), `.github/dependabot.yml` (npm + actions schedule), all actions pinned by SHA — 🎚️ **[Haiku 4.5 · low]**
- [x] ~~**12.** `SEC-ENV` — restricted Stripe-ключи + процедура ротации + CI-гард на утечку секрета~~ ✅ 2026-07-05 — CI-гард `envHygieneGuard.ts` (ловит `NEXT_PUBLIC_`+secret-имя и `"use client"`-импорт `supabaseService`, едет на `pnpm test`); `stripe/client.ts` получил `import "server-only"` (был единственный secret-клиент без него); `validateEnv()` предупреждает (не блокирует) когда `STRIPE_SECRET_KEY` — full-access (`sk_live_`) вместо restricted (`rk_live_`); процедура ротации + scope-таблица restricted-ключа → `docs/security/SEC-ENV-key-rotation.md`. Follow-up (вне scope): RULE-05 CI-грep `grep -q "next"` в `.github/workflows/ci.yml` слишком широкий (матчит `next-i18next`/`@next/eslint-plugin-next` в путях), фактическая проверка пакета `next` в этом проходе делалась вручную — 🎚️ **[Sonnet 5 · medium]**

### Фаза C — перформанс (быстрый эффект + CWV/SEO)
- [x] ~~**13.** `PERF-02` — `next/image` во всех сетках/галереях (после `SEC-UPLOAD` — картинки уже нормализованы) — 🎚️ **[Haiku 4.5 · low]**~~ ✅ 2026-07-05
- [x] ~~**14.** `PERF-01` — `/ad/[id]`: ISR + `Promise.all` + viewer-островок (+ фильтр/кэш `vehicle_options`)~~ ✅ 2026-07-05 (прод-verified: warm TTFB ~0.5s vs ~4s old). Route-ISR НЕ применим (layout читает headers/cookies → всё динамическое, и nonce-CSP на этом держится) → выигрыш на **уровне данных**: `lib/advert/advertDetail.ts` — wave-параллелизованный `loadAdvertDetailCore` (service-only, ~3 волны вместо ~18 последовательных), `getCachedActiveAdvertDetail` через `unstable_cache` (только `status='active'` → shared cache без драфтов; tag `advert:<id>`, revalidate 120), draft-fallback owner-gated; media как raw-paths + подпись per-request вне кэша; `vehicle_options` фильтр по референс-категориям; `generation_id` в base-select; viewer-островок (canSeeSeller/likeCount/viewerVerified) per-request; `revalidateAdvert()` на ВСЕХ путях мутации (PATCH/DELETE/moderation/reports×2/media×3/webhook); similar — per-request. Adversarial review (16 агентов) → 9 находок починены до деплоя. Follow-ups: PPR + single-RPC денормализация; business_id→advert reverse-invalidation. — 🎚️ **[Opus 4.8 · xhigh]**
- [x] ~~**15.** `PERF-03` — свести двух подписантов signed-URL к одному + общий кэш~~ ✅ 2026-07-05 — `lib/advertMedia.ts:resolveFirstImages` больше не зовёт `storage.createSignedUrl` по одному напрямую; переведён на `signMediaUrls` (батч `createSignedUrls` + общий `signedUrlMemoryCache`, 15-мин TTL) + `getFirstImage` для выбора preview>signed>absolute. Прод-verified: `GET /api/search` отдаёт токен с `exp-iat=900s` (было бы 600s на старом коде) — доказывает, что живой путь идёт через консолидированный подписант. — 🎚️ **[Sonnet 5 · medium]**
- [x] ~~**16.** `PERF-04` — SSR первой страницы поиска~~ ✅ 2026-07-06 (прод-verified: `curl /search` raw HTML **0→48** `/ad/`-ссылок, `aria-busy` **1→0** = результаты в HTML без JS). `search/page.tsx` был целиком `"use client"` (пустой скелет→JS→`fetch('/api/search')`); разбит на **server-component + client-остров (Model B)**: `page.tsx` (RSC) гоняет главный + fallback-поиски (precedence exact→outside-radius→relaxed→empty сохранён) и сидит `SearchClient` через `<Suspense>`. Ядро извлечено в `lib/search/executeSearch.ts` (session-scoped `supabaseServer` = RLS-паритет с API; discriminated `{ok}|{ok:false}` → RSC деградирует в пустой shell вместо 500), общее для роута и RSC (роут сохранил 400 + FETCH_FAILED envelope + тест зелёный). `SearchClient` сидится из SSR-payload с **`loading=false` init** (иначе скелет перекрывает SSR-результаты — гидрация «съедает» LCP-выигрыш); skip-first-fetch guard по канон. сигнатуре запроса; навигация через нативный History API (`pushState`) → смена фильтра/сорта/страницы = client-fetch **без** server round-trip / без двойного фетча (в App Router нет `router.push({shallow})`). Общий `readSearchRequestFromParams` → SSR-ключ и client-ключ считает ОДНА функция (нет дрейфа). §6 live: `/search`+`/search?sort_by=` → 200 (не 500); `/api/search?limit=3` → `{ok,data:{items:3,total:965,hasMore}}` (проекция user_id+category_id для deck сохранена). Preview-verify: `pushState('?sort_by=price_asc')` → `GET /api/search?sort_by=price_asc&page=0&limit=24`, mount-fetch пропущен (SSR-seed), 0 hydration-ошибок. Follow-ups: (1) SSR-поиск обходит IP-rate-limiter `/api/search` (как и SSR-чтения главной/категории) → капы/кэш в `SEC-DoS` шаг 32; (2) fallback radius/relaxed осознанно последовательны (relaxed только если outside пуст); (3) PPR + single-RPC денормализация (из PERF-01) применимы. — 🎚️ **[Opus 4.8 · high]**
- [x] ~~**17.** `PERF-05` + `PERF-06` — дедуп запросов главной + `React.cache()` сессии + бюджет бандла~~ ✅ 2026-07-06; **+ 2026-07-07 lucide tree-shake (−153kB/роут, прод-verified)**. Остаток bloat отранжирован аудитом → новый `PERF-07` (P2, deferred). — 🎚️ **[Sonnet 5 · medium]**
- [x] ~~**17b.** `PERF-07` — догнать остальной bundle-bloat (Sentry lazy-init / login-zod / search FormRenderer / trust-gate body)~~ ✅ 2026-07-07 (прод-verified: local next-start build == www.lyvox.be first-load byte-identical). Все 4 пункта замерены по отдельности (clean Turbopack build, gzip client JS/route через `check:bundle-budget` manifest-sum): **Sentry defer ~−59kB/роут** (owner-approved defer через requestIdleCallback; DSN не задан → identical behavior сегодня), **login zod removal −55kB** (login был единственным консьюмером `loginSchema`; инлайн email-валидатор — тот же trim/lowercase/regex+messages, как zod-free проверка в RegisterForm), **/search FormRenderer defer −4.3kB**, **trust-gate body defer ~−18kB/роут** (+удалён мёртвый `components/ui/form.tsx`). Итог по трекаемым роутам: / 247.7→168.5, /ad/[id] 258.6→181.2, /search 265.6→182.2 (~−31%); `bundle-budget.json` перебазирован (285/300/305 → 195/210/210). **Дебанк:** спец-фикс «page-level split» для login-zod оказался no-op (+0.8kB) — см. журнал. — 🎚️ **[Sonnet 5 · medium]** (Sentry — Opus·high)

### Фаза D — фундамент флагов/ключей (разблокирует НДС-админку и все ключи)
- [x] ~~**18.** `FLAG-01` — `platform_settings` + async-резолвер + Upstash-кэш с инвалидацией~~ ✅ 2026-07-07 (прод-verified: migration Local==Remote + smoke PASSED против прод DB+Upstash). Фундамент AND-gate (`capabilityOn === toggle && requiredSecretsPresent`) — не-секретная половина. `supabase/migrations/…_flag01_platform_settings.sql`: key→jsonb, RLS on, `is_admin()`-write policy (service-role reads bypass RLS, **grant to authenticated НЕ выдан** → SEC-AUTHZ-GUARD RULE-A/01/01b/02 зелёный без allowlist; колонки key/value/updated_at/updated_by не матчат `SENSITIVE_COLUMN_RE`). `lib/redis.ts` — общий Upstash-клиент `getRedis()` (null при отсутствии кред → degrade, не throw). `lib/settings/platformSettings.ts` — `getSetting`/`setSetting`/`invalidateSetting` + async `resolveCapability(cap)` с env-fallback на absent/error (config-store outage НЕ ломает запрос). **Positive-only кэш** (TTL 30s + явная del-инвалидация на write); DB-ошибка → **throw**, не негативный кэш (урок PERF-01). **Аддитивно:** синхронные `isCapabilityEnabled`-гарды НЕ тронуты (миграция ~13 колл-сайтов = FLAG-06/шаг 20 → до тех пор код в деплой-бандле дормантный: модули импортит только тест+смоук, ни один роут). `scripts/settings-smoke.mjs` (`pnpm settings:smoke`) — живая прод-верификация вкл. cross-instance TTL-пропагацию (прямой DB-апдейт без инвалидации → stale до TTL → fresh после) + очистка тест-строки. §6 live: /search+/login 200, / →307→/en→200, `GET /api/billing/webhook` →405 (не 500 = роуты бутаются после type-regen). Follow-ups: FLAG-02 (`getIntegrationStatus` = вторая половина AND-gate), FLAG-06 (перевод гардов на резолвер), FLAG-03 (admin UI пишет через этот слой). — 🎚️ **[Opus 4.8 · high]**
- [ ] **19.** `FLAG-02` — реестр «capability → нужные ключи» + `getIntegrationStatus()` — 🎚️ **[Sonnet 5 · medium]**
- [ ] **20.** `FLAG-06` — миграция ~13 гардов на async-резолвер (sync→async рефактор) — 🎚️ **[Opus 4.8 · xhigh]**
- [ ] **21.** `FLAG-03` — UI `/admin/settings` с тумблерами (3 состояния ON/OFF/🔒нет-ключей) + `/admin/layout.tsx` — 🎚️ **[Sonnet 5 · medium]**
- [ ] **22.** `FLAG-04` — аудит-лог изменений настроек (append-only) — 🎚️ **[Sonnet 5 · medium]**

### Фаза E — НДС (после FLAG + VAT-LEGAL sign-off)
- [ ] **23.** `VAT-FIX` — свести два расходящихся `canSellAsBusiness` (мелкий, разблокирует ключевание НДС) — 🎚️ **[Sonnet 5 · medium]**
- [ ] **24.** `VAT-A` — Stripe Tax на свои сборы boost/Pro (код за тумблером; активация — ключ+налог.регистрация) — 🎚️ **[Opus 4.8 · high]**
- [ ] **25.** `VAT-B2` — модель данных листинга: netto/brutto + `vat_class` + `vat_scheme` — 🎚️ **[Opus 4.8 · xhigh]**
- [ ] **26.** `VAT-B` — движок `vat_rates` (эффективные даты) + margin scheme + reverse-charge(VIES) + админ-редактор ставок — 🎚️ **[Workflow · ultracode]**
- [ ] **27.** `VAT-B3` + `VAT-DAC7` — генератор данных инвойса + захват DAC7-данных (сбор — за F3) — 🎚️ **[Opus 4.8 · xhigh]**

### Фаза F — дизайн/моушн (2026-grade)
- [ ] **28.** `UX-MOTION` — моушн-система: токены + нативные View Transitions + scroll-driven reveal + одна малая либа (motion-one) — 🎚️ **[Opus 4.8 · high]**
- [ ] **29.** `UX-MICRO` + `UX-SKELETON` — микро-интеракции (hover-lift/tap-scale) + шиммер + оптимистичный UI — 🎚️ **[Sonnet 5 · medium]**
- [ ] **30.** `UX-SCREENS` + `UX-A11Y` — полировка 7 экранов (+закрыть pixel/dark-mode верификацию) + доступность WCAG AA — 🎚️ **[Opus 4.8 · high]**

### Фаза G — безопасность P1 + наблюдаемость (усиление)
- [ ] **31.** `SEC-ATO` — защита от угона: `auth_events` + device-list + geo-velocity + step-up + login-alerts + breach-password — 🎚️ **[Workflow · ultracode]**
- [ ] **32.** `SEC-WAF` + `SEC-DoS` — Vercel Firewall + анти-скрейпинг капы/cost-limits/кэш дорогих ручек — 🎚️ **[Sonnet 5 · medium]**
- [ ] **33.** `SEC-AUDIT` + `SEC-ADMIN` — журнал безопасности+алёрты + обязательная 2FA/WebAuthn админам — 🎚️ **[Opus 4.8 · high]**
- [ ] **34.** `SEC-IR` — incident runbook + GDPR-72h процедура + учение kill-switch — 🎚️ **[— · n/a документ/учение]**
- [ ] **35.** `OPS-HEALTH` + `OPS-E2E` + `OPS-CI` + `OPS-STAGING` + `OPS-BACKUP` + `OPS-ANALYTICS` — health/uptime + Playwright + CI-гейты + staging + бэкапы/DR + дашборд метрик — 🎚️ **[Opus 4.8 · xhigh]** *(разброс: OPS-ERR/HEALTH — Haiku·low; OPS-BACKUP — Opus·xhigh)*

### Фаза H — продуктовая полнота
- [ ] **36.** `PROD-BIZ` + `PROD-TRUST` + `PROD-DISCOVERY` + `PROD-COMPLIANCE` + `PROD-UX-MOBILE` — довести 🟡-фичи (кабинет-по-членству, AI-модерация, swipe/saved-search/PWA-push, Recupel, мобильная раскладка) — 🎚️ **[Opus 4.8 · high]** *(разброс: PROD-UX-MOBILE — Haiku·low; PROD-TRUST — Opus·high)*
- [ ] **37.** `PROD-IDENT` — itsme/eID (OIDC) + WhatsApp-OTP + Stripe Identity (за AND-gate тумблерами+ключами) — 🎚️ **[Opus 4.8 · max]**
- [ ] **38.** `PROD-F2` + `PROD-MONEY` — server-side money authz + escrow→диспуты→доставка→оплата **(только ПОСЛЕ `PROD-F3` sign-off)** — 🎚️ **[Workflow · ultracode]**

### Фаза I — запуск (закрывает всё)
- [ ] **39.** `SEC-PENTEST` — внешний пентест ключевых потоков (auth/chat/upload/billing); закрыть high/critical — 🎚️ **[Workflow · ultracode]**
- [ ] **40.** `LAUNCH-KEYS` + `LAUNCH-LEGAL` — активация ключей (founder) + финал юр-контента + flip `LEGAL_CONTENT_APPROVED` — 🎚️ **[— · n/a внешнее]**
- [ ] **41.** `LAUNCH-GONOGO` — финальный go/no-go чек-лист + учебный прогон kill-switch → **закрывает всё** 🚀 — 🎚️ **[Workflow · ultracode]**

> Правило порядка: шаг **38** нельзя закрыть, пока не закрыт **01/F3**. Шаги **24–27** (НДС) — после **18–22** (FLAG) и `VAT-LEGAL`. Шаг **13** — после **07**. Всё до **12** можно вести без внешних ключей.

---

## 📏 Самообучение — правила и журнал ошибок

**Механика:** каждую найденную-и-починенную грабли заносим в **Журнал** со счётчиком. **Встретили >2 раз (на 3-й) → повышаем в жёсткое ПРАВИЛО** (и, где можно, закрываем CI-гардом, чтобы не повторилось механически). Правила — обязательны к соблюдению в новом коде/миграциях; читаем перед каждым проходом.

### Правила (усвоено — ≥3 повторений, обязательны)
- [x] **RULE-01 · RLS даёт ROW, не COLUMN.** Любая user-editable таблица с колонками trust/entitlement/verification/**tax** → column-scoped `GRANT UPDATE (editable cols)` к `authenticated`, revoke table-wide; такие колонки пишет только service-role/SECURITY DEFINER. *(встречено ≥3×: businesses, profiles, +5 в write-lockdown sweep)* → ✅ **автоматизировано шагом 10**: статик-гард ловит ДВА вектора — **RULE-01** (явный table-wide grant в тексте миграции) И **RULE-01b** (частый: Supabase-**дефолт**-грант, которого нет в тексте → таблица с sensitive-колонкой + authenticated write-policy без `revoke <op> … from authenticated` = дыра, как profiles-INSERT). Плюс живой аудит `pnpm authz:audit`.
- [x] **RULE-02 · Supabase грантит EXECUTE новым функциям для authenticated+anon.** Любая `SECURITY DEFINER` функция с caller-supplied id (`erase_user_data(uuid)`, любой admin/RPC-хелпер) → `REVOKE EXECUTE ON FUNCTION … FROM public, authenticated, anon;`, grant только `service_role`. Проверка `has_function_privilege('authenticated', fn, 'execute')=false`. *(класс встречен ≥3×)* → ✅ **автоматизировано шагом 10** (RULE-02 гарда требует revoke от И authenticated И anon; аудит проверяет `has_function_privilege`). **Тонкость:** таргет — uuid-**аргумент** (caller-supplied id), НЕ return-type uuid (`create_business` возвращает uuid, но берёт не-uuid args → не таргет).
- [ ] **RULE-03 · cookie-client запись = И RLS-политика, И grant; self-referential RLS-подзапрос рекурсит.** Запись через cookie-клиент требует одновременно matching RLS policy И column/table grant; `EXISTS(SELECT FROM same_table …)` в политике на своей же таблице → рекурсия `42P17`. Решение: `SECURITY DEFINER` helper (`is_conversation_participant`, `is_business_member`, `is_admin`). *(чат: 3 компаундных бага за раз)*.
- [ ] **RULE-04 · Верифицировать на ПРОДЕ, не на local dev.** dev CSS-chunk URL не контент-хеширован → браузер отдаёт stale из дискового кеша → ложное «изменение не применилось». Проверять на www.lyvox.be; при нужде `fetch(cssHref,{cache:'reload'})` перед reload. Прод-верификация статуса+контента, не пиксель/dark-mode «на глаз».
- [x] **RULE-05 · `pnpm audit --prod` перед `git push origin main`; `next` НЕ должен фигурировать.** Vercel МОЛЧА блокирует деплой на уязвимой версии Next.js (build «Completed», но deployment `● Error` «Vulnerable version of Next.js detected») — однажды заморозил прод на **227 дней**. Перед каждым пушем в `main`: `pnpm audit --prod`; если в списке есть `next` → поднять `next` + `eslint-config-next` до пропатченной версии, `pnpm install`, перепрогнать typecheck/test/lint + **чистую** сборку. *(встречено 2× — 16.0.0→16.0.11, 16.0.11→16.2.10 — но стоимость катастрофическая → сразу правило)* → CI-автоматизацию закрывает шаг 11 (`SEC-DEP` audit-gate).
- [x] **RULE-06 · Перед `db push` — `migration list`; дрейф чинить ФАЙЛОМ, не `repair --reverted`/`db pull`.** Прод `schema_migrations` дрейфует от локальных файлов (out-of-band `execute_sql`/dashboard не пишет history; squash переименовывает; мерж без push оставляет прод позади). Перед каждым `db push`: `supabase migration list --db-url` и читать колонку Remote (пусто = pending). **Remote-версия без локального файла** → создать `<version>_*.sql` из `schema_migrations.statements` (psql), idempotent; **НЕ** `migration repair --status reverted` (пометит живое откатанным), **НЕ** `db pull` (тащит весь diff). Pending-файлы старше уже-применённой версии → `db push --include-all`. Цель: Local == Remote по всем строкам. *(встречено ≥3×: squash+34-строки 2026-06-28, T18 2026-07-04, ad-media 013000 2026-07-05)*.

### Журнал ошибок (<3 повторений — наблюдаем, при 3-м → RULE)
| Грабли | Встречено | Заметка |
|---|---|---|
| API envelope: клиент читает `body.data.X`, не `body.X` | 1× | `createSuccessResponse` оборачивает в `{ok,data}`; misread отгрузил imageless search |
| RSC сериализует ВСЕ prop-значения client-компонентов в HTML | 1–2× | Редактировать приватное на server-boundary; проверять grep-ом живой HTML на реальный секрет |
| FTS: `'simple'` конфиг нужен на ОБЕИх сторонах | 1× | Иначе recall молча падает |
| `search_adverts` RPC: 13-арг сигнатура фиксирована | 1× | Не добавлять параметры без координированного DROP+CREATE |
| react-compiler ESLint hard-errors (не только tsc) | 1× | refs-during-render + reassign-after-render; debounce через useMemo object-mutation |
| Supabase migration drift (out-of-band applied) | 3× → **RULE-06** | schema_migrations рассинхронился; reverse-drift (013000 в проде без файла) чинится авторингом файла из `statements`, `db push --include-all` для pending-старше-применённой |
| env-валидация: throw на import ломает `next build`; `NODE_ENV==='production'` ловит и Vercel **preview** | 1× | Валидировать только в runtime-boot (`instrumentation.register()`), не на import; hard-fail гейтить на `VERCEL_ENV==='production'` (или self-host `NODE_ENV`), иначе падают preview-деплои без Upstash |
| nonce-CSP: двойной `Content-Security-Policy` (next.config **и** middleware) → браузер пересекает политики → ломает | 1× | CSP живёт РОВНО в одном месте (middleware); next.config держит только не-CSP headers |
| nonce-CSP: per-request nonce НЕ пропекается в статик/ISR-кэш HTML → под enforce скрипты без nonce блокируются (white-screen) | 1× | nonce требует dynamic-render; report-only фаза ловит это отчётом ДО enforce; watch-list = роуты с `revalidate`; следить за PPR/ISR-конверсиями (PERF-01) |
| nonce-CSP: Next читает nonce из **request**-заголовка `Content-Security-Policy` (не response) | 1× | В middleware ставить `x-nonce`+`Content-Security-Policy` на request-headers (имя всегда enforcing, даже в report-only), иначе Next не занонсит bootstrap |
| CSP report-only never blocks → `connect-src`/`frame-src` дыры невидимы до enforce | 1× | Turnstile-iframe (frame-src challenges.cloudflare.com) + Sentry envelope (connect-src *.sentry.io) добавлять ДО flip, не после по отчётам |
| Server-side re-encode обезвреживает байты, но НЕ закрывает byte-path в публичный bucket | 1× | Client-signed-upload напрямую в PUBLIC bucket + after-the-fact overwrite = дыра, если `/complete` не позван. Санитайзер должен быть ЕДИНСТВЕННЫМ писателем публичного bucket (server-derive), не overwrite. Публичный bucket = server-write-only |
| grep-миграций ≠ проверка живой БД: storage RLS/bucket-config провижнились out-of-band | 1× | «Нет INSERT-политики в миграциях» ≠ «клиент не может писать»: живая БД имела blanket `Enable insert for authenticated users only` (WITH CHECK true) + `ad-media public=true`. Security-инвариант про storage ПРОВЕРЯТЬ через `psql pg_policies/storage.buckets`, не grep репо. Валидировать новые storage-миграции в `begin; … rollback;` перед деплоем |
| libvips вокабуляр формата ≠ sniff-вокабуляр: AVIF → `metadata().format==='heif'` | 1× | Отдельный `ALLOWED_VIPS_FORMATS` ({jpeg,png,webp,gif,heif}) для проверки meta.format, отдельный sniff-allowlist ({…,avif}); иначе валидный AVIF отклоняется как NOT_AN_IMAGE. Также: bucket `allowed_mime_types` должен зеркалить sniff accept-surface (+heic/heif), иначе PUT блокируется до `/complete` |
| Pixel-cap как decompression-bomb guard: `>` boundary + PNG без shrink-on-load | 1× | `W*H > cap` пропускает ровно cap; PNG декодит весь растр (~W*H*4 RGBA) ДО resize (нет shrink-on-load) → байты×32 в RAM. Держать cap реалистичным (24MP≈96MB, не 40MP≈160MB), синхронно с sharp `limitInputPixels`; лимит байтов НЕ ограничивает RAM декода |
| libvips-билд в тесте не синтезирует animated-фикстуру (pageHeight игнорится) | 1× | Нельзя сделать animated GIF/WebP из raw-sprite в этом sharp/libvips → тестировать reject-animated по byte-маркеру (NETSCAPE2.0/ANIM/acTL), не по декодированным pages |
| Живой authz-аудит: `grant` без пермиссивной policy = инертен → сырой дамп грантов даёт 400+ ложных | 2× (grep-live class) | Истинный сигнал RULE-01/анон = **три-стороннее пересечение** `role_table_grants × pg_policies × gate-reachability`: (а) grant считается только если policy реально пускает роль; (б) `to public` policy с `auth.uid()`/`is_admin()`-gate НЕ пускает anon (runtime-блок); (в) не-admin authenticated проходит только owner-gated (`auth.uid()`) / open(`true`), а `is_admin()`-only — не дыра; (г) DELETE не колоночный → не RULE-01. Так 421→20 |
| Комбинированный `grant select, insert` прячет table-wide INSERT от наивного `grep "grant insert"` | 1× | `chat_offers`: `grant select, insert on … to authenticated` — INSERT без колоночного списка. Гард парсит priv-clause целиком (`isTableWideWrite`), не «grant insert/update» токеном. Также: комментарий с `revoke … from public` (erasure.sql стр.84) и слова grant/revoke в `$$`-теле — ложные срабатывания → strip комментов + бланк `$$`-тел ДО матча |
| regex ≠ SQL parser: `alter table IF EXISTS` не стрипался наивным sed → ложный «RLS-off» на adverts/profiles | 1× | Нормализовать имена таблиц/функций (strip `if exists`/`only`/`public.`/кавычки/case) единым нормализатором; многострочные сигнатуры функций (uuid на continuation-строке) — балансом скобок, не однострочным regex; сверять со **живой** БД, не с grep репо |
| `unstable_cache` кэширует любой мутирующий путь → инвалидация нужна на ВСЕХ writes к кэшируемым таблицам, не на «очевидных» 3 | 1× (PERF-01) | Ввёл кэш детали объявления, забыл про report-takedown (×2: route + admin server-action), media delete/complete/reorder, boost-webhook → takedown/фото висели ≤120s (takedown ещё и держал seller-identity в shared cache). Перед введением кэша: `grep .from("<cached_table>").(update\|insert\|delete)` по всему app, `revalidateTag` на КАЖДОМ. Централизовать tag+invalidator (`advertCacheTag`/`revalidateAdvert`) — тег обязан точно совпадать (иначе no-op). Next 16: `revalidateTag(tag,"max")` (2-арг), `updateTag` — только Server Actions |
| `unstable_cache` мемоизит **resolved `null`** → negative caching: транзиентный сбой на регенерации ACTIVE-записи кэшируется как 404 на весь revalidate-window для ВСЕХ | 1× (PERF-01) | Старый uncached-loader самолечился на следующем запросе; кэш заморозил сбой. Правило: в кэшируемой функции `return null` ТОЛЬКО для настоящего absent/404; на транзиентных/неожиданных ошибках — **throw** (throw НЕ кэшируется, пробрасывается в page-catch → «retry», следующий запрос перечитывает). Не сворачивать `catch → return null` в кэше |
| SSR client→server split: `loading` init ДОЛЖЕН быть `false` при наличии SSR-seed | 1× (PERF-04) | Клиентский остров, сидённый из SSR-payload: если `useState(loading=true)` (как в старом чисто-клиентском варианте), гидрация рисует скелет ПОВЕРХ SSR-результатов → визуально «изменение не применилось», LCP-выигрыш потерян. При наличии seed — `loading=false`, skip-first-fetch guard по ключу запроса, `pushState` (в App Router нет `router.push({shallow})`) чтобы смена фильтра не дёргала RSC + не давала двойной фетч. Проверять raw HTML `curl`-ом на `aria-busy`=0 и наличие маркера результата, не только 200 |
| `next-env.d.ts` дрейфует dev↔prod: turbopack-dev пишет `./.next/dev/types/routes.d.ts`, `next build` — `./.next/types/routes.d.ts` | 1× (PERF-04) | Запуск `pnpm dev` перед коммитом мутирует tracked `next-env.d.ts` на dev-путь; закоммитить dev-вариант = грязное дерево после чистой сборки (`pnpm build` вернёт prod-путь → §4 «git status чистый» ломается). Перед коммитом после dev-сессии: `git checkout apps/web/next-env.d.ts`, не коммитить dev-путь |
| SSR DB-чтение обходит route-level rate-limiter | 1× (PERF-04) | `/search` теперь SSR-ит `search_adverts` напрямую (`executeSearch`), минуя `/api/search` IP-лимитер (60/min). НЕ новый класс: главная (`getFreeAds`/`getLatestAds`) и `/c/*` уже SSR-ят DB-чтения без лимита. Дорогие SSR-ручки закрывать капами/кэшем централизованно в `SEC-DoS` (шаг 32), не точечно на каждой |
| `import * as X` из большой либы убивает tree-shaking → вся либа в бандле | 1× (PERF-06) | `categoryIcons.ts`: `import * as Icons from "lucide-react"` + `Icons[name]` computed-lookup = все ~1560 иконок (160kB gzip) на КАЖДОЙ странице; Next-овский `optimizePackageImports` спасает только named-import. Лечение: курируемый named-import map. Правило-кандидат: grep `import \* as` из иконочных/utility-либ в client-коде. Замер per-route JS до/после — через `pnpm analyze` + `check:bundle-budget`; verify рендер на прод-сборке (`next start`), не dev (Turbopack-dev даёт ложный «module factory is not available» на этом паттерне) |
| `scripts/*.mjs` (root) не резолвит apps/web-only deps: `@upstash/redis` есть в `apps/web/node_modules`, но НЕ в root; bare-import падает `ERR_MODULE_NOT_FOUND` | 1× (FLAG-01 smoke) | `node scripts/x.mjs` резолвит bare-specifier от расположения файла (scripts/→root node_modules), а `@supabase/*` в root есть, `@upstash/*` — нет. `import.meta.resolve(spec, parentUrl)` 2-арг не помогает (parent игнорится в этом Node). Лечение: `createRequire(pathToFileURL('apps/web/package.json'))` → `.resolve(spec)` → `import(pathToFileURL(path).href)`; даёт named-exports и для ESM, и для dual-CJS. NODE_PATH — не кросс-платформенно в npm-скрипте |
| «page-level `'use client'` → тонкий Server-Component-shell + client-child» — no-op для размера бандла | 1× (PERF-07 login-zod) | Перенос eager-import (zod/`loginSchema`) из page-модуля в eager-рендеримый client-child НЕ убирает его из first-load: child-чанк грузится на том же роуте (замер: /login 276.5→277.3, +0.8 = шум). Split уменьшает бандл ТОЛЬКО если код реально становится server-rendered (напр. статический hero через server-i18n). Реальный рычаг для «убрать N-килобайтную либу с одного роута» = не импортировать её eager вообще (инлайн-замена / lazy-`import()`), а не оборачивать в server-shell. Всегда измерять до/после, а не доверять «премисе аудита»; при no-op — откатывать (не тащить лишнюю индирекцию) и дебанкать, как sonner/Sentry-named-import |

*(при повторе любой строки до счётчика 3 — переносим в «Правила» с новым RULE-ID и, если применимо, добавляем CI-гард)*

---

# Блок PERF — Производительность и Core Web Vitals

Цель: LCP < 2.5s, CLS < 0.1, TTFB < 0.6s на ключевых страницах; Lighthouse mobile ≥ 90.

### PERF-01 · Страница объявления `/ad/[id]`: ISR + параллелизация — [P0][🟡] — **самый большой единичный выигрыш**
**Проблема:** [page.tsx:55](apps/web/src/app/ad/[id]/page.tsx) — `force-dynamic` + `revalidate = 0`; `loadAdvertData` делает **~20 запросов к БД последовательно** + `loadSimilarAdverts` + like-count после всего, **ноль кэша** на каждый просмотр. Плюс `vehicle_options` тянется **без фильтра** (весь каталог опций на каждый показ).

**Рассмотрено (10) →** ① статус-кво — ✗; ② только `Promise.all` — помогает, но без кэша; ③ только ISR `revalidate=60` — кэш есть, но регенерация всё ещё серийная; ④ **ISR + `Promise.all`** — ✓ ядро; ⑤ **+ вынести viewer-специфику (`canSeeSeller`, своё объявление) в клиентский островок** — обязательно для корректности под кэшем; ⑥ **PPR (Partial Prerendering, Next 16)** — прогреть оболочку, стримить динамику — цель след. итерации; ⑦ `React.cache()` дедуп `supabaseServer()`/сессии в пределах запроса; ⑧ CDN-кэш на 302-signed-URL (уже есть для OG); ⑨ денормализовать деталь в **один RPC/view** (один round-trip — крупнейший DB-выигрыш) — follow-up; ⑩ единый aggregate-запрос/GraphQL.
**Выбрано:** ④+⑤+⑦ немедленно; ⑥ (PPR) и ⑨ (single-RPC) — как follow-up. Плюс отдельно: дать `vehicle_options` фильтр/кэш.

**Критерии приёмки:** страница отдаёт ≤ 6 параллельных запросов на cold-regen; TTFB на тёплом ISR < 300ms; идентичность приватных данных не протекает под кэшем (проверка [[rsc-prop-privacy]]).
**Зависит:** —.

### PERF-02 · `next/image` во всех сетках/галереях — [P0][⛔]
**Проблема:** **ни одного `next/image`** во всём apps/web (grep подтвердил — все совпадения это `eslint-disable no-img-element` и lucide-иконки). Сырые `<img>` в [ad-card.tsx:104](apps/web/src/components/ad-card.tsx), `AdvertGallery.tsx`, `SwipeCard.tsx` — оригиналы в полном разрешении, без `srcset`/AVIF/WebP, без lazy, без width/height (CLS).
**Решение:** перевести карточки/галерею/свайп на `next/image` с `sizes` и явными размерами; добавить пути bucket в `images.remotePatterns` (иначе оптимизатор их отклонит). Для signed-URL — `loader` или проксирование.
**Альтернативы→выбор:** `unoptimized`-режим (быстро, но без выигрыша) — ✗; собственный CDN-трансформер — избыточно; **`next/image` + remotePatterns** — ✓.
**Критерии приёмки:** карточки грузят WebP/AVIF ≤ нужного размера; CLS сетки → 0; вес сетки из 24 карточек падает кратно.
**Зависит:** согласовать с `SEC-UPLOAD` (ре-энкод) и подписантом URL (`PERF-03`).

### PERF-03 · Консолидировать подписантов signed-URL + общий кэш — [P1][🟡]
**Проблема:** два разных подписанта. `lib/media/signMediaUrls.ts` — хорошо (батч `createSignedUrls` + 15-мин кэш). А путь поиска `lib/advertMedia.ts:resolveFirstImages` подписывает **по одному** `createSignedUrl` **без кэша** → каждый запрос поиска пере-подписывает.
**Решение:** перевести `advertMedia.ts` на батч `createSignedUrls` и переиспользовать общий `signedUrlMemoryCache`; свести к одному подписанту. (Смягчение: ads с `preview_url` отдают публичный URL и не подписываются — сохранить этот short-circuit.)
**Критерии приёмки:** один код-путь подписания; на выдаче поиска 0 пере-подписаний в пределах TTL.

### PERF-04 · Поиск — SSR первой страницы результатов — [P1][✅]
**Проблема:** `search/page.tsx` — `'use client'` целиком: пустой скелет → JS → `fetch('/api/search')`; на пустой выдаче ещё 2 **последовательных** фетча (радиус, relaxed).
**Решение:** серверно (RSC) рендерить первую страницу результатов в HTML; клиентский fetch оставить только для пагинации/смены фильтров. Fallback-фетчи (radius/relaxed) распараллелить или объединить в один RPC.
**Критерии приёмки:** первый экран результатов присутствует в HTML (виден без JS); LCP поиска < 2.5s.
**✅ Сделано (2026-07-06, шаг 16):** RSC `page.tsx` + `SearchClient`-остров (Model B), ядро `lib/search/executeSearch.ts` общее с `/api/search`. Прод-verified: raw HTML `/search` 0→48 `/ad/`-ссылок, `aria-busy` 1→0. Fallback radius/relaxed **осознанно последовательны** (precedence: relaxed только когда outside пуст — распараллеливание сменило бы поведение). Навигация фильтр/сорт/страница — нативный History `pushState` (нет server round-trip / двойного фетча). Follow-up: SSR-поиск вне IP-rate-limiter → `SEC-DoS`; PPR/single-RPC — как в PERF-01. LCP<2.5s — по CWV-baseline (OPS-ERR/Speed Insights), не замерял точечно.

### PERF-05 · Дедуп кросс-секционных запросов на главной + `React.cache()` для сессии — [P2][✅]
**Проблема:** `getFreeAds` и `getLatestAds` независимо тянут `adverts`→`media`→`profiles` (почти одинаковые наборы); ad-страница создаёт `supabaseServer()`/`getServerSession()` многократно за запрос (лишние cookie-чтения, потенциальный `refreshSession()` — сеть).
**Решение:** общий media/profile-фетч между секциями; обернуть per-request получение клиента/сессии в `React.cache()` (один инстанс на запрос).
**Критерии приёмки:** на главной нет дублирующихся media/profile round-trips; сессия читается один раз/запрос.
✅ 2026-07-06 — `lib/home/getHomeSections.ts` (вынесено из `page.tsx` — иначе тест тянул весь клиентский граф домашней страницы и падал на отсутствующих env для `createBrowserClient`) собирает `freeRows`/`latestRows` (два независимых `adverts`-запроса, разные фильтры — смёрджить нельзя), затем резолвит media/profiles/`resolveLikeCounts` **один раз** на объединении id (было: по разу на секцию — дублирование для любого объявления, попавшего в оба списка, напр. свежий бесплатный лот). `resolveLikeCounts` принимает опциональный `supabase`-клиент вместо создания своего. `lib/supabaseServer.ts` получил `getRequestSupabase = cache(supabaseServer)` (React `cache()` — request-scoped и в Server Components, и в Route Handlers, сброс на каждый инкаминг-запрос, без утечки между пользователями/запросами; см. уже имевшийся `getRequestUserId` на ad-странице) — заведён в home page + все 3 точки `supabaseServer()` на `/ad/[id]`. Тест `lib/home/__tests__/getHomeSections.test.ts` (2 кейса) фейковым supabase-клиентом с оверлапом id доказывает `media`/`profiles` вызваны ровно 1 раз при 2 независимых `adverts`-запросах. Дедуп React.cache() на ad-странице тестами НЕ покрыт (cache() — no-op вне реального RSC-рендера, см. `node -e` пробу; framework-гарантия + уже используемый в этом же файле паттерн `getRequestUserId` — достаточное основание); прод-курл `/`, `/ad/[id]`, `/search` → 200 с реальными карточками доказывает отсутствие регрессии, не сам дедуп.

### PERF-06 · Бюджет бандла + анализ — [P2][✅]
**Проблема:** нет замера. Тяжёлые `'use client'` на корнях страниц (поиск) тянут JS.
**Решение:** `@next/bundle-analyzer` в CI-отчёт; вынести тяжёлые клиентские деревья в `next/dynamic` там где не нужен SSR; проверить, что motion-либа (см. `UX-MOTION`) code-split.
**Критерии приёмки:** зафиксирован бюджет per-route JS; регрессии видны в CI.
✅ 2026-07-06 — `@next/bundle-analyzer` ANALYZE-гейтед в `next.config.ts`. **Находка:** Turbopack (дефолтный бандлер `next build` в Next 16) не совместим с `webpack-bundle-analyzer` (пакет сам это детектит и no-op'ается с варнингом) и не печатает классическую таблицу «First Load JS» — `pnpm analyze` форсит `next build --webpack` (по подсказке самого пакета: `--experimental-analyze` — Turbopack-нативная альтернатива, но пишет проприетарный бинарный формат для внутреннего вьюера, не для скриптового парсинга). `--webpack`-сборка триггерит расхождение типов `.next/types` (PageProps searchParams sync/Promise) на странице, не связанной с анализом — `ignoreBuildErrors` смягчён ТОЛЬКО под `ANALYZE=true` (реальные Turbopack-сборки/CI не затронуты). `scripts/perf/check-bundle-budget.mjs` читает per-route `page_client-reference-manifest.js` (тот же список чанков, что Next использует для гидратации), гзипует уникальные chunk-файлы и сверяет с `scripts/perf/bundle-budget.json`. Заведено в CI (`.github/workflows/ci.yml`, job `Build Check`, шаг `Check bundle budget` — переиспользует уже собранный `.next`, без второй сборки). Motion-либы code-split — N/A, `UX-MOTION` (шаг 28) ещё не начат.

**➕ Follow-up 2026-07-07 — реальный выигрыш, который вскрыл analyzer (был провал: гейт поставили, но 160kB не срезали):** `lib/categoryIcons.ts` делал `import * as Icons from "lucide-react"` + динамический `Icons[iconName]` lookup. Namespace-import + computed member access убивает tree-shaking (и Next-овский `optimizePackageImports`, который помогает только named-import'ам) → **все ~1560 иконок lucide (~160kB gzip) ехали в shared-чанк на КАЖДУЮ страницу**, тянущую этот helper (home/search/ad/category-tree/filters). Заменено на курируемый `Record<string, LucideIcon>` из named-import'ов ровно тех имён, что есть в БД (`SELECT DISTINCT icon FROM categories` → 89 валидных lucide-экспортов; 6 невалидных `BabyBottle/Broom/Soap/home/smartphone/hanger` осознанно опущены — они и раньше падали в fallback `Layers`/`Tag`, поведение идентично). Замер (чистая Turbopack-сборка, gzip client JS/route): **home 401.2→247.7 (−153.5), ad/[id] 411.4→258.6 (−152.8), search 419.2→265.6 (−153.6)**; иконок во всей сборке 1564→102. Верифицировано рендером на прод-сборке (`next start`): карусель категорий + 12/12 category-links рисуют правильные иконки, 0 console-ошибок; прод www.lyvox.be отдаёт бандл без 160kB-чанка (самый большой — Sentry 68kB) → фикс живой. `bundle-budget.json` перебазирован на новые размеры +~15% (было 460/470/480 → стало 285/300/305), чтобы гейт ловил регресс. Тест `lib/__tests__/categoryIcons.test.ts`. **RULE-кандидат (журнал):** namespace-import (`import * as`) из большой иконочной/utility-либы = tree-shaking убит, вся либа в бандле — grep'ить в CI.

**🔎 Follow-up-аудит остального bloat (Workflow, 6 агентов, 2026-07-07) → новый пункт `PERF-07` ниже.** Ключевые выводы: (1) lucide-фикс — 0 регрессий (adversarial-верификатор подтвердил полноту+идентичность поведения). (2) **Ловушка debunked:** «очевидный» Sentry named-import фикс даёт **0 байт** — Turbopack уже tree-shake'ит `import * as Sentry` (весь доступ — статический `Sentry.init`); агент проверил ре-сборкой (chunk байт-в-байт тот же). (3) **Аудит ошибся про sonner:** предложил `dynamic(ssr:false)` для `<Toaster/>` как «behavior-identical ~10kB win» — но чтение sonner@2.0.7 (`dist/index.mjs` `subscribe` L125-130/L956) показало, что late-subscriber **НЕ получает replay** уже добавленных тостов → тост, выстреленный до монтирования Toaster, теряется. Ломает `/login?error=...` (`login/page.tsx:43` шлёт `toast.error` в mount-effect после itsme/OAuth-фейла) → отложенный Toaster роняет auth-error тост. **НЕ делать. sonner остаётся статическим.** Реальных behavior-identical выигрышей после lucide больше нет.

### PERF-07 · Догнать остальной bundle-bloat (из аудита 2026-07-07) — [P2][✅ 2026-07-07, шаг 17b] — не behavior-identical, каждый пункт со своим замером
**Проблема:** после lucide shared-бандл ещё ~230kB gzip. Аудит (6 агентов) отранжировал остаток. Ни один — не «бесплатный»: каждый меняет момент загрузки/граф модулей и требует своего before/after замера + верификации, поэтому вынесены сюда, а не сделаны в PERF-06.
**Решение (по убыванию выигрыша):**
1. **Sentry lazy-init (~69kB с КАЖДОГО роута — самый большой рычаг).** `components/ErrorTrackingProvider.tsx` (`use client`, в root layout) делает статический `import * as Sentry` + `init()` на module-scope; импорт едет ~69kB даже без `NEXT_PUBLIC_SENTRY_DSN`. Фикс: `if (dsn) requestIdleCallback(() => import("@sentry/nextjs").then(S => S.init(...)))`. **Тредофф (почему не behavior-identical):** отложенный init = ранние hydration/load ошибки не ловятся первые кадры → это про мониторинг-покрытие, решение владельца. CDN-loader НЕЛЬЗЯ (strict-nonce+`strict-dynamic` CSP блокирует внешние скрипты). Чанк также несёт `@vercel/analytics` → не 69kB чистого Sentry.
2. **zod с initial-бандла `/login` (~59kB, ТОЛЬКО login).** zod НЕ едет по всему приложению (аудит-премиса неверна) — только `/login`, т.к. `login/page.tsx` сам `'use client'` → `import {loginSchema}` хойстится в route-entry. `register`/`post` уже избегают этого, будучи Server-Component-страницами с client-формой-ребёнком. Фикс: тот же шаблон — `login/page.tsx` → тонкий async Server Component + `<LoginForm/>` client-ребёнок, zod-импорт внутрь ребёнка (нужна `Suspense`/`useSearchParams`-граница).
3. **search `FormRenderer` lazy (~24kB, ТОЛЬКО search).** `SearchFilters.tsx:16` статически тянет `FormRenderer` из `@/catalog/renderer`; виджет-дерево рендерится только после выбора категории со схемой (никогда на initial `/search`, который `robots:noindex`). Фикс: `dynamic(() => import("@/catalog/renderer").then(m => m.FormRenderer))` — **именно FormRenderer, НЕ SearchFilters целиком** (desktop-рельс сайдбара = initial content, отложить = layout shift).
4. **trust-gate dialog body lazy (~17kB с КАЖДОГО роута).** Статическая цепочка `layout.tsx:103 → TrustGateProvider → TrustGateLogin → RegisterForm → react-hook-form + react-icons/fa` = hard edge в root layout (чанк в 38/39 манифестах). `dynamic()` в `app/register/page.tsx` — **недостаточно** (layout всё равно статически тянет rhf). Правильно: lazy-load тело диалога, оболочку Dialog оставить eager: `const TrustGateLogin = dynamic(() => import("@/components/trust/TrustGateLogin"))` (rhf нужен только при `open===true`). **Бонус:** `components/ui/form.tsx` (Radix+RHF-обёртка) — мёртвый код, 0 импортёров → удалить.

**Оставлено как есть (KEEP, законно на всех роутах):** Supabase browser-client (48kB — header auth-UI/notif-bell на first paint; lazy = flash logged-out), Next router-runtime+glue (~31kB), Radix Select/Popper header (16.7kB), react-remove-scroll (13.5kB, транзит Dialog-оболочки), Next app-router runtime (12kB), tailwind-merge `cn()` (8.7kB, 21 ui-примитива).
**Критерии приёмки:** каждый пункт — свой замер `pnpm analyze`+`check:bundle-budget` до/после, верификация на прод-сборке; при внедрении — ужать `bundle-budget.json`. Sentry-пункт — с явным решением владельца по мониторинг-тредоффу.
**🎚️ [Sonnet 5 · medium]** (Sentry-пункт — Opus·high из-за CSP/мониторинг-нюансов).

**✅ Сделано (2026-07-07, шаг 17b) — все 4 пункта, каждый замерен отдельно (clean Turbopack build, gzip client JS/route, `pnpm check:bundle-budget` manifest-sum):**
1. **Sentry lazy-init** — `ErrorTrackingProvider.tsx` больше не делает module-scope `import * as Sentry`; теперь `import("@sentry/nextjs").then(S=>S.init())` в `requestIdleCallback` (fallback `setTimeout`) и только при наличии DSN. **−59kB на КАЖДОМ роуте** (изолированный замер). Owner-approved defer (мониторинг-тредофф: ранние ошибки не ловятся); DSN сегодня не задан → behavior identical. `@vercel/analytics` остаётся eager (`<Analytics/>`).
2. **login zod removal** — `/login` был единственным консьюмером zod-`loginSchema`; заменён инлайн `parseLoginEmail` (тот же `trim().toLowerCase()` + email-regex + идентичные messages, shape зеркалит `safeParse` → 3 call-site не тронуты). **−55kB (login-only)** — zod плохо tree-shake'ится Turbopack'ом, оценка аудита ~59kB подтвердилась. Toast-эффект (`?error=&message=`) НЕ тронут. ⚠️ **Спец-фикс из плана (page→Server-shell + `<LoginForm/>` client-child) оказался no-op (+0.8kB) и был откачен** — eager-import в eager-рендеримом child не покидает бандл; реальный рычаг = убрать zod (см. журнал).
3. **/search FormRenderer defer** — `SearchFilters.tsx`: `FormRenderer` через `next/dynamic` (типы — `import type`), сайдбар-рельс eager. **−4.3kB (search-only).**
4. **trust-gate body defer** — `TrustGateProvider.tsx`: `TrustGateLogin`/`TrustGatePhone` (→ react-hook-form/Turnstile) через `next/dynamic` (рендерятся только при `open`). **~−18kB на КАЖДОМ роуте** (register −0.5: он и так eager-рендерит RegisterForm). Бонус: удалён мёртвый `components/ui/form.tsx` (0 импортёров).

**Итог трекаемых роутов:** / 247.7→168.5, /ad/[id] 258.6→181.2, /search 265.6→182.2 (~−31%). `bundle-budget.json` перебазирован (285/300/305 → 195/210/210, +~15% headroom). §4: typecheck/test(960)/lint зелёные, `pnpm audit --prod` без `next` (RULE-05), чистая сборка exit 0, budget-gate ok. §6 прод: все роуты 200, /login рендерит форму, /search 48 `/ad/`-ссылок, 0 console-ошибок при клике по категории (dynamic FormRenderer грузится чисто), local next-start first-load == прод byte-identical (336.1 vs 336.3 home). Follow-up: /login toast (`?error=`) не проверен живьём (браузер был залогинен → редирект на /profile), но код toast-эффекта не менялся.

---

# Блок FLAG — Админка + рантайм-флаги + управление ключами

Реализует требование «админка с тумблерами вкл/выкл везде, где нужны ключи», «ключи впишем позже».

### FLAG-01 · Слой рантайм-конфига (`platform_settings` + резолвер + кэш) — [P0][✅] — **фундамент блока** — ✅ шаг 18, 2026-07-07
**Проблема:** сейчас **нет никакого рантайм-конфига**: всё читается из `process.env` на старте процесса; сменить флаг = **редеплой Vercel**. Нет таблицы settings, нет кэша, нет hot-reload. Комментарий в `capabilities.ts` («no deploy») **неверен**.

**Рассмотрено (10) →** ① статус-кво env-only — ✗ не рантайм; ② env + read-only статус-страница — ✗ нет тумблера; ③ DB `platform_settings`, чтение без кэша каждый запрос — латентность; ④ DB + per-instance in-memory TTL — на Fluid Compute флип **не распространяется** между инстансами; ⑤ **DB + общий Upstash Redis-кэш (короткий TTL) + явная инвалидация при записи из админки** — ✓ (Redis уже в стеке, распространяется, дёшево); ⑥ Vercel Edge Config — отличная низкая латентность, Vercel-native; запись через API — как оптимизация для самых горячих флагов; ⑦ сторонний сервис (LaunchDarkly/Flagsmith/Statsig) — ✗ стоимость/внешняя зависимость/EU-residency; ⑧ Postgres LISTEN/NOTIFY — ✗ serverless не держит коннекты; ⑨ git/JSON-конфиг — ✗ редеплой; ⑩ секреты-в-БД (шифрованные) — ✗ секреты остаются в env.
**Выбрано:** **⑤ (DB `platform_settings` + Redis-кэш + инвалидация)**; ⑥ Edge Config — опционально для горячих флагов; секреты — только env (⑩ отвергнут).

**Named cost (важно):** резолвер `isCapabilityEnabled` меняется с **синхронного `process.env` на async DB+cache** → рефактор ~13 интеграционных гардов + смена сигнатуры sync→async с прокидыванием `await`. Это отдельная задача (`FLAG-06`).
**Критерии приёмки:** флип тумблера виден без редеплоя в пределах TTL (≤ 30–60s) на всех инстансах; `platform_settings` — RLS `is_admin()`-write, service-role read.
**Зависит:** —. **Ключи:** —.

### FLAG-02 · Реестр «capability → нужные ключи» + `getIntegrationStatus()` — [P0][⛔]
**Проблема:** нигде не описано, каким интеграциям какие env-ключи нужны и что ломается без них (собрано агентом, но не кодифицировано).
**Решение:** декларативный реестр: каждая capability → `{ requiredEnv: string[], optionalEnv: string[], degrade: 'block'|'noop' }`. Функция `getIntegrationStatus(cap)` → `{ toggle, hasKeys, missingKeys[], effective }`. На этом строятся три состояния тумблера.
**Инвентарь интеграций (для UI):** Supabase(core), Stripe(`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRO_PRICE_ID`), Twilio(`TWILIO_*`), Upstash(`UPSTASH_*`), Turnstile(`TURNSTILE_SECRET_KEY`/`NEXT_PUBLIC_TURNSTILE_SITE_KEY`), Email(`RESEND_API_KEY`/`SENDGRID_API_KEY`/`EMAIL_FROM`), OpenAI(ai-moderation, Edge Fn), Cron(`CRON_SECRET`), itsme(нет ключей — 🔑), WhatsApp(нет — 🔑), Stripe Identity(🔑), Escrow-provider(🔑, за F3).
**Критерии приёмки:** для каждой интеграции UI показывает точный список отсутствующих ключей.

### FLAG-03 · UI `/admin/settings` (+ `/admin/layout.tsx`) с тумблерами — [P0][⛔]
**Проблема:** `/admin` = только модерация и репорты; нет `layout.tsx`, нет settings-UI.
**Решение:** новый `/admin/layout.tsx` (навигация admin-разделов, гейт `hasAdminRole`) + `/admin/settings`: секции по интеграциям, у каждой — тумблер с тремя состояниями (`ON`/`OFF`/`🔒 нет ключей`), подпись «что включает», список нужных ключей, и (для VAT/rate-limit) поля конфига. Переиспользовать паттерн «server-component props → POST в API» из существующих admin-страниц.
**Критерии приёмки:** админ включает/выключает интеграцию без редеплоя; при отсутствии ключей тумблер заблокирован с подсказкой; изменения применяются ≤ TTL.
**Зависит:** FLAG-01, FLAG-02.

### FLAG-04 · Аудит-лог изменений настроек — [P1][⛔]
**Проблема:** тумблеры влияют на прод-поведение и деньги/безопасность → нужен неотрекаемый след.
**Решение:** таблица `settings_audit` (кто, когда, ключ, старое→новое, IP); запись при каждом флипе; просмотр в админке. Связать с `SEC-AUDIT`.
**Критерии приёмки:** любой флип оставляет строку аудита; строки только на чтение (append-only, no update/delete grant).

### FLAG-05 · Валидация env на старте (zod-схема окружения) — [P1][✅]
**Проблема:** ключи разбросаны по `process.env.*`; часть гардов degrade-silently (Upstash no-op, Turnstile skip) — удобно в dev, опасно в prod (см. `SEC-RL2`).
**Решение:** единая zod-схема env (`lib/env.ts`), парсится на boot; в `production` — **hard-fail** на отсутствии критичных (Supabase/Stripe-если-billing-on/Upstash-если-rate-limit-on); в dev — предупреждение. Совместить с `getIntegrationStatus`.
**Критерии приёмки:** прод не стартует без критичных ключей; список некритичных деградаций явный.
**✅ Сделано (2026-07-04):** `apps/web/src/lib/env.ts` — чистая `validateEnv(env)` (не бросает, не исполняется на import) + `assertEnvOnBoot()` вызывается из `instrumentation.register()`. Критичные всегда: Supabase url/anon/service-role. Критичные в prod: `UPSTASH_*` (ядро SEC-RL2). Явный список деградаций (Stripe/Turnstile/Sentry/email/Twilio/CRON_SECRET) → warnings, не блокируют boot. Hard-fail только в РЕАЛЬНОМ prod (`VERCEL_ENV==='production'` или self-host `NODE_ENV==='production'`) — **preview-деплои Vercel НЕ падают** (`isHardFailEnv`). Тесты: `lib/__tests__/env.test.ts`. `getIntegrationStatus` не существовал — не создавал (scope: FLAG-06/FLAG-03).

### FLAG-06 · Миграция ~13 гардов на async-резолвер — [P1][⛔]
**Проблема:** гарды читают env синхронно; после FLAG-01 нужно перевести их на резолвер (иначе тумблер не работает для них).
**Решение:** поэтапно заменить `isCapabilityEnabled(cap)` и точечные `process.env.X` гарды на `await resolveCapability(cap)`; сохранить обратную совместимость (env как fallback-дефолт тумблера при первом деплое).
**Критерии приёмки:** все 9 capability + интеграционные гарды ходят через резолвер; тесты на sync→async не сломаны.

---

# Блок VAT — Налоговый движок (НДС) для проф-продавцов

> ⚠️ **VAT-LEGAL (P0, внешнее):** конкретные ставки (21/12/6/0), механика маржинальной схемы, place-of-supply/OSS, reverse-charge, порядок инвойсов — **требуют подтверждения бухгалтера/налогового консультанта**, уровень блокера как F3. Ниже — архитектура, корректная **параметрически**; конкретные числа/правила не хардкодим до sign-off.

Ключ: **две разные поверхности** (не путать — иначе спроектируем не то). См. [[vat-two-surfaces]].

### VAT-A · Surface A — НДС на СОБСТВЕННЫЕ сборы LyVoX (boost + Pro) — [P0][⛔🔑]
**Проблема:** checkout/subscribe **не ставят** `automatic_tax`/`tax_behavior`; `price_cents` без семантики netto/brutto; нет инвойсов. LyVoX — поставщик электронной услуги → обязан начислять НДС (это money flow ①, company-free, уже живой рельс).
**Решение:** включить **Stripe Tax** (`automatic_tax:{enabled:true}` + сбор Tax ID + Stripe Invoicing) на `checkout/route.ts` и `subscribe/route.ts`; B2B-EU → reverse charge автоматически. Определить `price_cents` как **netto** и показывать «excl./incl. VAT». Код готовим сейчас, включается тумблером (`FLAG`) + при налоговой регистрации компании.
**Альтернативы→выбор:** ручной расчёт НДС в коде — ✗ (EU-правила меняются); сторонний Avalara/TaxJar — ✗ избыточно; **Stripe Tax** — ✓ дёшево, покрывает place-of-supply и reverse charge, даёт легальные инвойсы. Закрывает `docs/features/39-monetization-billing.md:76`.
**Критерии приёмки (при активации):** каждый чек boost/Pro имеет корректную НДС-строку и последовательный инвойс; B2B-EU с валидным VAT → reverse charge.
**Ключи:** `STRIPE_SECRET_KEY` + Stripe Tax включён + налоговая регистрация (founder).

### VAT-B · Surface B — переменный НДС на ТОВАРЫ проф-продавцов — [P1][⛔] (сбор — за F3; сейчас display/invoice/DAC7)
**Проблема:** `adverts.price` — один скаляр, нет netto/brutto, нет класса ставки, нет схемы. B2C-право требует цену **с НДС**. Для second-hand в Бельгии массово применяется **маржинальная схема** (НДС с маржи; в инвойсе **нет отдельной строки НДС**) — наивный `ставка × цена` **незаконен** для таких продавцов. Сбор денег за товар сейчас **заблокирован F3** → ближняя цель: **отображение + данные для инвойса + DAC7**, не взимание.

**Рассмотрено (10) →** ① хардкод 21% — ✗ (нет категорий/схемы); ② один env `VAT_RATE` — ✗ (редеплой, одна ставка); ③ Stripe Tax на товары — ✗ (поставщик = продавец, не LyVoX; + F3); ④ сторонний tax-API — ✗ избыточно Belgium-first; ⑤ плоская колонка ставки на категорию — без истории/схемы; ⑥ **`vat_rates` с эффективными датами** (country, vat_class, rate_bps, valid_from, valid_to) — ✓ смена ставки = новая строка → быстрая адаптация к рынку + корректная история для инвойсов; ⑦ **`vat_class` маппинг категория→класс** (6/12/21/0/exempt) — ✓; ⑧ **`vat_scheme` на бизнесе/листинге** (standard / **margin** / exempt) — ✓ критично для маржинальной схемы; ⑨ расчёт в БД (generated column) vs app-layer — app-layer гибче для reverse-charge; ⑩ ставка внутри `platform_settings` JSON — ✗ грубо, без истории.
**Выбрано:** **⑥+⑦+⑧+⑨(app-layer)**: эффективно-датированная `vat_rates` + маппинг `vat_class` + `vat_scheme` (вкл. маржинальную) + app-резолвер `resolveVat({country, vatClass, scheme, at})` с Redis-кэшем; netto/brutto split на `adverts.price`; reverse-charge для B2B-EU по VIES (`lib/verification/vies.ts` уже живой). Ставки редактируются из админки (новая эффективная строка) **без редеплоя**.
**Критерии приёмки:** проф-листинг показывает цену с НДС (или «маржинальная схема» без строки НДС); смена ставки = добавление датированной строки, историю не ломает; резолвер покрыт тестами на границах дат/классов/схем.
**Зависит:** FLAG-01 (админ-редактор ставок), VAT-LEGAL (sign-off), **сбор — PROD-F3**. **Ключи:** — (сбор позже).

### VAT-B2 · Модель данных листинга: netto/brutto + `vat_scheme` — [P1][⛔]
**Решение:** на `adverts` (для business-листингов) добавить `price_net`/`price_gross`/`vat_class`/`vat_scheme` (или вынести в `advert_tax`), на `businesses` — дефолтную `vat_scheme`/`vat_liable` (последнее уже есть). Для C2C (`business_id IS NULL`) — без НДС.
**Критерии приёмки:** миграция идемпотентна; RLS/column-grants как в [[marketplace-system-design]] (никаких user-writable trust/tax-колонок без column-scoped grant).

### VAT-B3 · Генерация инвойсов для проф-продавцов — [P2][⛔] (данные сейчас, PDF/нумерация — с активацией)
**Решение:** последовательная легальная нумерация (сиквенс), НДС-разбивка или пометка reverse-charge/маржи, реквизиты трейдера (уже в `businesses`). Пока сбор за F3 — готовим генератор данных инвойса; фактическая выдача — при money flow ②.

### VAT-DAC7 · Захват DAC7-данных о продавцах — [P1][⛔] (специфицировано в `docs/features/15`, кода нет)
**Решение:** таблицы `seller_compliance_status`/`compliance_documents`; порог «≥30 транзакций ИЛИ ≥€2000/год»; поля (физ: имя/адрес/TIN+страна/DOB; юр: legal name/адрес/TIN/KBO/VAT/фин-идентификатор); уведомление продавца; годовой XML в FOD Financiën к 31 янв; правовая основа GDPR Art.6(1)(c). Захват данных можно начинать до money flow ②.
**Зависит:** PROD-F3 (транзакции), VAT-LEGAL.

### VAT-FIX · Устранить расхождение `canSellAsBusiness` — [P1][🟡]
**Проблема:** два определения: `lib/trust/deriveTrust.ts` требует B1 (`entity_verified`), `lib/auth/canSellAsBusiness.ts` — нет. НДС-обязанность привязана к **статусу трейдера**, не к верификации.
**Решение:** свести к одному источнику истины; НДС-логику ключить на `seller_type='business'`/`business_id` + `vat_liable`, независимо от `entity_verified`. Документировать, какой гейт для чего.

---

# Блок SEC — Безопасность (defense-in-depth) 🛡️ [самый глубокий блок]

Модель угроз на запуске: XSS/сессия-хайджек, credential-stuffing/ATO, OTP/SMS-абуз (toll-fraud), спам-листинги/скам, DoS/скрейпинг, IDOR/privilege-escalation, загрузка вредоносных файлов, CSRF, утечка секретов, supply-chain. Ниже — по слоям; для каждого: что **есть**, что **делаем**.

> **Не пере-чинять (уже сделано и подтверждено):** RLS-модель (column-locks, SECURITY DEFINER-предикаты, RPC-only conversation), Stripe webhook signature + F1 идемпотентность, `server-only`-гард service-role без утечки в клиент, F8 IP-trust fix, F9 fraud-detection wiring, F10 `itsme_sub` uniqueness, базовые заголовки (HSTS-preload, XFO DENY, nosniff, Permissions-Policy), httpOnly/SameSite/secure cookies, media path-ownership double-check.
> **Внимание:** старые доки `docs/features/audit/03-*`, `reviews/security-review.md`, `docs/SECURITY_AUDIT.md` — **устарели** (описывают уже закрытые A-7/A-9/A-6/A-4/A-3/F9). Не чинить по ним заново.

### SEC-CSP · Перевести CSP из report-only в enforced (nonce + strict-dynamic) — [P0][🟡] — **топ-1 незакрытая дыра**
**Проблема:** CSP в [next.config.ts](apps/web/next.config.ts) — `Content-Security-Policy-Report-Only` (**ничего не блокирует**) и содержит `'unsafe-inline' 'unsafe-eval'` в `script-src`. Для trust-маркетплейса с приватным чатом + Stripe рефлективный/stored XSS = захват сессии/чата. `report-uri /api/csp-report` уже подключён (фаза наблюдения идёт).

**Рассмотрено (10) →** ① остаться report-only — ✗; ② enforce как есть (с unsafe-*) — ✗ бесполезно; ③ enforce, убрать unsafe-inline, хэши для известных inline — хрупко в Next; ④ **nonce-based `script-src` + `strict-dynamic`, nonce из middleware** — ✓ основной; ⑤ hash-based — ✗ сложно с динамикой; ⑥ report-uri.com/внешний коллектор — дополняет как аналитика; ⑦ убрать CSP, полагаться на экранирование — ✗; ⑧ Trusted Types + CSP — сильнейшее, фаза 2; ⑨ nonce + strict-dynamic + Trusted Types + report-uri — полная цель; ⑩ per-route relaxed CSP — сложность.
**Выбрано:** **④ → ⑨** двухфазно: сейчас генерировать nonce в `middleware.ts`, прокинуть в Next (`headers()`/`<Script nonce>`), убрать `unsafe-inline`/`unsafe-eval`, `strict-dynamic`; сохранить `report-uri`; **Trusted Types** — фаза 2. Сначала «наблюдать» (данные уже собираются) → затем «enforce».
**Критерии приёмки:** прод отдаёт enforced `Content-Security-Policy` без `unsafe-inline`/`unsafe-eval`; отчёты о нарушениях → 0 ложных; inline-инъекция скрипта блокируется.

**🟡 Сделано частично (2026-07-04) — код готов, enforce-flip = гейт на проде:**
- **Новый `apps/web/src/lib/security/csp.ts`** — чистые `buildCsp(nonce)` (script-src `'self' 'nonce-…' 'strict-dynamic'`, **без** `unsafe-inline`/`unsafe-eval`; style-src `'unsafe-inline'` оставлен — вне scope), `resolveCspMode(env)` (**fail-safe**: всё кроме точного `CSP_MODE==='enforce'` → `report-only`), `cspHeaderName(mode)`, edge-safe `generateNonce()` (`crypto.getRandomValues`+`btoa`, без `Buffer`). Тесты: `lib/__tests__/csp.test.ts` (13).
- **`middleware.ts`** — per-request nonce; `x-nonce`+`Content-Security-Policy` в **request**-заголовки (Next `getScriptNonceFromHeader` → авто-nonce bootstrap-скриптов); CSP на **response** через `applyCsp` на ВСЕХ ветках возврата (redirect `/`, protected/auth-redirect, `supabaseResponse`).
- **`next.config.ts`** — CSP **удалён** отсюда (иначе двойной заголовок → браузер пересекает → ломает); прочие security-headers (HSTS/XFO/nosniff/Referrer/Permissions-Policy) оставлены.
- **Хосты, добавленные до enforce (report-only never blocked → эти дыры невидимы сегодня, ловятся только на flip):** `frame-src https://challenges.cloudflare.com` (Turnstile-iframe — иначе register 403), `connect-src https://challenges.cloudflare.com` + `https://*.sentry.io` (Sentry envelope POST). JSON-LD (`application/ld+json` ×6) — **data-block, не executable, script-src не применяется** → nonce НЕ прокидывали.
- **Ключевой вывод (primary-source):** корневой `layout.tsx` через `getI18nProps→getInitialLocale` читает `headers()`+`cookies()` (Dynamic APIs) → **весь app рендерится динамически per-request** (метки `revalidate=60/3600` на `/`,`/guides`,`/sell`,`/c` не дают статик-кэш, т.к. дерево зависит от request) → per-request nonce доходит до HTML на КАЖДОМ роуте → **статик-nonce white-screen риска при текущем layout нет**.
- **Верификация (local `next build && next start` — прод-выход, RULE-04-совместимо, не dev):** `pnpm typecheck`/`test`(834, +13 csp)/`lint`(0 err) зелёные; build подтвердил **все HTML-роуты `ƒ Dynamic`** (в т.ч. `/guides`,`/sell` с `revalidate` — layout-headers() перебивает статик; статик только asset-роуты без скриптов). Report-only: заголовок `content-security-policy-report-only` с nonce+strict-dynamic, Next занонсил 44 bootstrap-скрипта, **header-nonce == body-nonce в одном запросе** (иначе white-screen), единственные без nonce — 2× `application/ld+json` (exempt). `CSP_MODE=enforce`: заголовок → enforcing `content-security-policy`, nonce-матч сохраняется, `/en` и `/en/register` → **200** (не белый экран). Не покрыто локально (нет ключей + нужен реальный браузер): рендер Turnstile-виджета и POST Sentry-envelope — это и есть предмет прод-observation.
- **Runbook enforce-flip (обязательно ДО `CSP_MODE=enforce`):** (1) деплой report-only на прод; (2) наблюдать `/api/csp-report` неделю на РЕАЛЬНОМ трафике (dev врёт: Turbopack HMR = eval/inline, RULE-04) по static+dynamic роутам и всем сторонним поверхностям; (3) 0 ложных → выставить `CSP_MODE=enforce` (env, редеплой). **Re-check watch-list** (`/`,`/guides`,`/guides/[slug]`,`/sell`,`/c`,`/c/[...path]`) если layout когда-либо перестанет читать headers/cookies ИЛИ придёт PPR/PERF-01 (ISR `/ad/[id]`) — тогда те роуты станут статик-кэш → nonce-less → сломаются под enforce; фикс: держать их dynamic или решить через PPR-nonce.

### SEC-RL1 · Rate-limit на create/publish объявления — [P0][✅]
**Проблема:** `api/adverts` (create) и `api/adverts/[id]` (publish) **не обёрнуты** `withRateLimit` (только `view`). Это главная поверхность спам-листингов; сейчас прикрыто только `checkUserBlocked` + fraud-velocity, но нет частотного троттла.
**Решение:** добавить per-user + per-IP лимиты на create/publish; тюнинг через `RATE_LIMIT_*`.
**Критерии приёмки:** N листингов/интервал сверх лимита → 429; лимит конфигурируем.
**✅ Сделано (2026-07-04):** `POST /api/adverts` обёрнут стеком `withRateLimit` (per-user → per-IP), паттерн 1:1 с `reports/create/route.ts` (`baseHandler` + request-scoped auth-cache через `WeakMap`). Env: `RATE_LIMIT_ADVERT_CREATE_USER_PER_10M` (default 5/10мин), `RATE_LIMIT_ADVERT_CREATE_IP_PER_24H` (default 50/24ч). `PATCH /api/adverts/[id]` НЕ обёрнут целиком (обычные правки черновика остаются без троттла) — точечная проверка лимитера внутри `if (isPublishing)`, до verification/fraud-гейтов, с реюзом канонического `build429` (экспортирован из `lib/rateLimiter.ts`). Env: `RATE_LIMIT_ADVERT_PUBLISH_USER_PER_10M` (default 10/10мин), `RATE_LIMIT_ADVERT_PUBLISH_IP_PER_24H` (default 100/24ч). Тесты: `adverts/__tests__/create-rate-limit.test.ts`, `adverts/[id]/__tests__/publish-rate-limit.test.ts` (429 при отказе лимитера + доказательство, что обычный PATCH-эдит НЕ throttled даже когда publish-лимитер настроен на отказ). Коммит `516c89b` на ветке `feat/SEC-RL1-listing-rate-limit` (не запушено). Верификация: `pnpm typecheck` чисто, `pnpm test` 112 файлов / 839 тестов зелёные, `pnpm lint` 0 ошибок (203 pre-existing warnings вне тронутых файлов). Известное ограничение (не дефект): в тестах синтетический `Request` без `x-forwarded-for` → `getClientIp` возвращает `null`, per-IP ветка не покрыта отдельным assert (код корректен, но проверялся через per-user путь).

### SEC-RL2 · Rate-limiter: hard-fail при отсутствии Upstash в prod — [P0][✅]
**Проблема:** если `UPSTASH_*` не заданы, `createRateLimiter` возвращает no-op `success:true` (только `console.warn`) — в проде это **молча отключает ВСЕ лимиты**.
**Решение:** в `NODE_ENV==='production'` — hard-fail на старте (через `FLAG-05` env-схему), либо fail-closed на запросах, если rate-limit-capability включён без ключей.
**Критерии приёмки:** прод не работает с «тихо выключенными» лимитами.
**✅ Сделано (2026-07-04):** ДВА независимых рубежа. (1) Boot: `assertEnvOnBoot()` бросает в prod → сервер не стартует без `UPSTASH_*` (FLAG-05). (2) Request-level (нагрузочный гарант, юнит-тестируем и не зависит от Next-семантики `register()`): no-Redis ветка `createRateLimiter` теперь **fail-closed** в prod — `success:false` + валидный 429-shape (`remaining:0`, `retryAfterSec:windowSec`, конечный `reset` — не NaN), вместо `success:true`. Тронута ТОЛЬКО ветка `!redisClient`; ветка пустого ключа осталась `success:true` («нечего лимитировать» ≠ «лимитер выключен»). Dev/test — прежний no-op. Тесты: `lib/__tests__/rateLimiter.failClosed.test.ts`.

### SEC-BOT · Расширить бот-защиту (Turnstile на login/OTP/reset) + оценить BotID — [P0][✅]
**Проблема:** Turnstile подключён к **единственному** роуту `auth/register`. Login, phone/OTP-request, password-reset, chat, reports — **без CAPTCHA**. BotID отсутствует. На запуске ждём credential-stuffing и OTP-абуз (toll-fraud на SMS).
**Рассмотрено→выбор:** только Turnstile расширить — ✓ дёшево; + Vercel **BotID** на самых абузных API — ✓ (Vercel-native, GA); hCaptcha/reCAPTCHA — ✗ менять провайдера; поведенческий анти-бот — фаза 2.
**Решение:** Turnstile на login, phone/request, phone/verify, password-reset; BotID (behind `FLAG`) на дорогие/абузные API; связать с `SEC-ATO` (эскалация при подозрении).
**Критерии приёмки:** формы аутентификации требуют прохождения проверки; OTP-запросы под анти-абуз-троттлом (см. также SEC-RL).
**Ключи:** `TURNSTILE_SECRET_KEY`/`NEXT_PUBLIC_TURNSTILE_SITE_KEY` (free), BotID — конфиг Vercel.

**Сделано (2026-07-05):** login (password + magic-link), password-reset, phone/request, phone/verify теперь все под Turnstile. `register` НЕ тронут — Supabase Auth Dashboard's project-wide native-captcha toggle специально НЕ включался: он покрыл бы signUp/signIn/reset одним переключателем и заставил бы либо продублировать проверку токена (single-use → конфликт), либо переписать `register` на forwarding-режим — риск на живом флоу без выигрыша (анон-ключ + Supabase REST endpoint публичны, так что и native-captcha, и наш собственный сервер-side чек одинаково обходятся атакующим, который бьёт по GoTrue напрямую, минуя наш UI; это тот же уровень defense-in-depth, что и раньше у `register`).
  - Новый общий эндпоинт `POST /api/antifraud/verify-captcha` (rate-limited, переиспользует `verifyTurnstile()`) — вызывается клиентом ПЕРЕД `supabase.auth.signInWithPassword/signInWithOtp/resetPasswordForEmail` (у этих флоу нет своего API-роута — вызов идёт из браузера напрямую в Supabase SDK).
  - `phone/request` и `phone/verify` получили inline `verifyTurnstile()`-guard (тот же паттерн, что уже был в `register`), zod-схемы дополнены optional `turnstileToken`.
  - Общий клиентский компонент `components/antifraud/TurnstileWidget.tsx` (script-load + explicit-render + imperative `reset()`) — извлечён из `RegisterForm`'s inline-реализации; `RegisterForm` не тронут.
  - i18n: `auth.captchaError` + `trust.captcha_error` добавлены во все 5 локалей (guard-тест зелёный).
  - Тесты: новый route-test для `verify-captcha` + CAPTCHA_FAILED-кейсы добавлены в `phone/request`/`phone/verify` route-tests. `pnpm typecheck && pnpm test && pnpm lint` — все зелёные (845/845 тестов, lint 0 ошибок / 203 pre-existing warnings).
  - **Adversarial review (Workflow, 4 dimensions + independent verify pass) нашёл 1 реальный баг**, исправлено: `TrustGatePhone.tsx` сбрасывал spent-токен только в ветке `CAPTCHA_FAILED`, а сервер потребляет токен ДО проверки OTP/дублей — обычный повтор после опечатки в коде получал `CAPTCHA_FAILED` вместо честной проверки нового кода. Исправлено: `reset()` перенесён в `finally` (безусловно), как уже было в `login`/`recovery`. Остальные находки (OAuth-логин без Turnstile — Google/Facebook имеют свою анти-бот защиту; client-side pre-check обходим прямым вызовом Supabase REST) — приняты как осознанный scope/defense-in-depth уровень, не баги.

**BotID — оценка (без кода, по формулировке «оценить»):** Vercel BotID нигде в кодовой базе не используется (весь бот-слой сегодня — Cloudflare Turnstile). BotID — Vercel-native, бесплатный на дорогих маршрутах (create/publish adverts, phone/request, чат) и не требует смены провайдера CAPTCHA. Рекомендация: внедрять как отдельный шаг под `SEC-WAF`/`SEC-DoS` backlog (эти пункты уже покрывают edge/WAF-слой), не расширять текущий SEC-BOT scope — тег текущего шага (`Sonnet 5 · medium`) и Приложение B («виджет Turnstile по доке») подтверждают, что BotID здесь — только оценка, не имплементация.

### SEC-UPLOAD · Безопасность загрузки медиа (magic-byte + ре-энкод + EXIF + megapixel) — [P0][✅]
**Проблема:** `contentType` — **строка от клиента**, нет sniffing по magic-byte; нет AV-скана, серверного ре-энкода, EXIF-strip, лимита мегапикселей (decompression-bomb / image-RCE риск из PRD-17). Path-ownership и размер уже проверяются.
**Рассмотрено→выбор:** доверять content-type — ✗; magic-byte sniff (file-type) — ✓ обязательно; серверный **ре-энкод** (sharp) в нормализованный WebP/AVIF (убивает polyglot/EXIF/бомбы разом) — ✓ лучший; внешний AV (ClamAV/API) — опционально фаза 2; лимит мегапикселей — ✓.
**Решение:** на `media/complete` (или в фоне): sniff magic-byte → ре-энкод через sharp с лимитом пикселей и таймаутом → strip EXIF/gps → сохранить нормализованный файл. Синергия с `PERF-02` (next/image любит нормализованные).
**Критерии приёмки:** файл с `image/png`, но не-картинкой внутри — отклонён/обезврежен; EXIF-геометки удалены; бомба-картинка не валит воркер.
**✅ Сделано (2026-07-05):** `lib/media/sanitizeImage.ts` (`sniffImageFormat` magic-byte + `isAnimatedContainer` reject + `sanitizeImageBuffer` — sharp `.rotate().resize(≤1600,inside).webp()`, EXIF/GPS сняты, decompression-bomb ограничен pixel/byte/timeout, `24 MP` cap + `limitInputPixels` + `derivePreviewBuffer`). Вшит в `api/media/complete` (download → sanitize → re-upload clean WebP → **preview деривится server-side из sanitized-буфера**; reject → cleanup orphans → 422/413; server-computed dims). Файл-байты грузятся **напрямую в Storage** (signed URL, минуя Next) → `complete` единственная точка перехвата. Миграция `20260705010000_ad_media_bucket_limits.sql` — `file_size_limit` (реальный gate на download), `public` НЕ флипается. `sharp` → прямая зависимость + `serverExternalPackages`. Тесты: `sanitizeImage.test.ts` (real-sharp: EXIF-strip, polyglot-neutralise, bomb-reject, png-header-garbage-reject, per-format), `complete/route.test.ts` (orchestration+cleanup). Verified: typecheck+test(876)+lint(0 err).
**Adversarial-pass (ultracode, 16 агентов, 8 confirmed):** ключевая находка (4 линзы сошлись) — клиент писал сырые байты в **публичный** `ad-media-preview` bucket через signed-upload token из `/sign`, а `/complete` санитизировал preview только если клиент прислал `previewStoragePath` → пропуск `/complete` оставлял неотсанитайзенные байты публично. **Fix:** `/sign` больше НЕ выдаёт preview-token, клиент грузит только full, `/complete` ВСЕГДА деривит preview server-side по пути, производному от ownership-checked full-пути → публичный bucket теперь server-write-only. Плюс: bomb off-by-one 40MP→24MP; cleanup на insert-failure; heic/heif в allowlist.
**🟡 Follow-ups (записаны, вне scope шага; spawned as chips):** (a) `media(advert_id,url)` unique index + `INSERT … ON CONFLICT` (конкурентные `/complete` → дубль-строки + обход cap; предсуществующая гонка, рискованно на prod-дубликатах); (b) orphan-sweep cron в `maintenance-cleanup` для брошенных upload-ов (клиент может залить и не звать `/complete`); (c) in-process concurrency-семафор на sanitize (→ `SEC-DoS`, шаг 32); (d) **storage-RLS + bucket-privacy pass** — live-DB проверка вскрыла: blanket-политика `Enable insert for authenticated users only` (WITH CHECK true) даёт любому authenticated `.upload()` в ЛЮБОЙ bucket/path (обход токена); и **все 3 bucket-а public=true**, включая `ad-media` (код отдаёт его через signed URLs → private-семантика, но bucket публичный). SEC-UPLOAD закрыл `ad-media-preview` точечно (restrictive-политика, миграция `20260705011000`), остальное — отдельный holistic pass.
**Прод-верификация:** ✅ `next build` компилит с sharp (exit 0, прошёл route-compile+page-data). Linux-x64 sharp-бинарь резолвится только в deploy-build (optionalDependencies, локально win32 — RULE-04) → сверить билд-лог при деплое. Миграции `20260705010000` + `20260705011000` провалидированы в rolled-back psql-транзакциях (синтаксис ок, `file_size_limit=5MB`, `public` не тронут).

### SEC-VALID · zod-схема на КАЖДОМ мутирующем роуте — [P1][✅]
**Проблема:** ~11 мутирующих роутов парсят тело без zod (ad-hoc `typeof`), включая `api/adverts` (`business_id`), favorites, likes, comparison, analytics/track, account/delete, locale.
**Решение:** обязать схему на всех мутирующих роутах; добавить lint/CI-проверку «мутирующий route без `validateRequest`». Строгие типы вместо `any` (перекликается с tech-debt `no-explicit-any`).
**Критерии приёмки:** 100% мутирующих роутов валидируются; CI ловит новый роут без схемы.
**✅ Сделано (2026-07-05):** живой аудит (51 мутирующих `route.ts` из 84 общих) показал, что тикет устарел — `favorites`/`likes`/`comparison`/`analytics/track` уже были провалидированы в прошлом проходе (инлайн zod, просто в обход общего хелпера `validateRequest`, с кодом `BAD_INPUT` вместо `INVALID_PAYLOAD` — оставлено как есть, не блокер). Реально без схемы было **5**: `adverts` (POST business_id), `account/delete`, `locale`, `moderation/analyze`, `moderation/review` — на все добавлены zod-схемы (`lib/validations/{adverts,account,locale,moderation}.ts`) через существующий `validateRequest()`. `account/delete` держит собственный `safeParse` (не `validateRequest`) чтобы сохранить старый контракт `detail:"CONFIRM_REQUIRED"` для фронтенда. **CI-гард:** `lib/validations/__tests__/route-validation-completeness.test.ts` — сканит все `app/api/**/route.ts`, требует zod-import+`safeParse`/`validateRequest` ИЛИ явную запись с обоснованием в новом `lib/validations/routeValidationExemptions.ts` (13 роутов: no-body path-param мутации, `billing/webhook` raw-HMAC, `csp-report` best-effort) + доп. проверки на «протухшие» exemptions и «reason слишком короткий». Adversarial-pass поймал регрессию: тестовые фикстуры `adverts-verify.test.ts` использовали не-UUID плейсхолдеры (`"biz-uuid-1"` и т.п.) — новый строгий `z.string().uuid()` их отверг; поправлено на настоящие v4-UUID (zod v4 требует корректные version/variant nibbles, не просто 36-символьный формат). Verified: typecheck (0 ошибок) + test (879/879 зелёных, 116 файлов) + lint (0 errors, только пред-существующие warnings).
**🟡 Follow-up (вне scope, не блокер):** `INVALID_PAYLOAD` vs `BAD_INPUT` — два кода ошибки валидации сосуществуют (helper-путь и инлайн-путь); стоит унифицировать отдельным проходом, не блокирует SEC-VALID.

### SEC-CSRF · Явная проверка Origin/Sec-Fetch-Site на мутациях — [P1][✅]
**Проблема:** анти-CSRF нет; де-факто защита — только SameSite=Lax + JSON-body. Достаточно сейчас, но неявно и незакреплено; будущий form-encoded/GET-мутирующий роут молча сломает инвариант.
**Решение:** helper-ассерт `assertSameOrigin(req)` (проверка `Origin`/`Sec-Fetch-Site`) на всех мутирующих роутах; запретить мутации через GET.
**Критерии приёмки:** cross-site запрос к мутирующему роуту отклонён на уровне helper, не полагаясь только на cookie.
**✅ Сделано (2026-07-05):** `lib/security/csrf.ts` — `assertSameOrigin(req)` (Origin-host сверяется с `x-forwarded-host`/`Host`; при отсутствии Origin — фоллбэк на `Sec-Fetch-Site`, отклоняется только `cross-site`; при отсутствии обоих заголовков — allow, т.к. non-browser клиент не несёт ambient-cookie) + `withCsrfProtection(handler)` для композиции с `withRateLimit`. Новый `ApiErrorCode.CSRF_ORIGIN_MISMATCH` (403). Вшито во все **49** мутирующих `route.ts` (Workflow, 5 параллельных агентов): `withRateLimit`-обёрнутые роуты — `withCsrfProtection(innerHandler)` в точке композиции; голые `export async function POST/PATCH/DELETE(...)` — `assertSameOrigin(req)` первой строкой тела (включая `auth/signout`, где пришлось добавить параметр `request: Request`, которого не было вовсе). Файлы с двумя мутирующими хендлерами (`adverts/[id]`, `chat/offer`, `saved-searches/[id]`) — гард в КАЖДОМ. **CI-гард:** `lib/security/__tests__/route-csrf-completeness.test.ts` (зеркалит SEC-VALID `route-validation-completeness.test.ts`) — сканит все `app/api/**/route.ts`, требует импорт+вызов `assertSameOrigin`/`withCsrfProtection` ИЛИ запись в `lib/security/csrfExemptions.ts` (2 роута: `billing/webhook` — HMAC-подписанный Stripe callback без cookie-сессии; `csp-report` — неаутентифицированный best-effort отчёт браузера, нет состояния для подделки). «Запретить мутации через GET» — проверено вручную (grep по телам всех 40 GET-хендлеров на `.insert(/.update(/.upsert(/.delete(`): мутаций в GET нет, инвариант уже соблюдён, отдельный CI-гард не заводили (не в критериях приёмки). Verified: typecheck (0 ошибок) + test (893/893 зелёных, 118 файлов, включая новые `csrf.test.ts` 11 тестов + completeness-guard 3 теста) + lint (0 errors, только пред-существующие warnings). `pnpm gen:types` не требовался (нет изменений схемы).

### SEC-ATO · Защита от угона аккаунта (feature 16) — [P1][⛔] — greenfield
**Проблема:** ATO-детекции нет: ни geo/impossible-travel, ни fingerprint, ни `auth_events`, ни step-up на смену payout/email/пароля, ни login-velocity CAPTCHA. WebAuthn enroll/verify/remove — есть (примитив step-up). IP-trust fix (F8) — предпосылка — уже готов.

**Рассмотрено (10) →** ① ничего — ✗; ② breach-password check (HaveIBeenPwned k-anon) — дёшево, ✓; ③ email/SMS-алерт о входе с нового устройства — ✓; ④ device fingerprint + список известных устройств — ✓ ядро; ⑤ impossible-travel/geo-velocity из `auth_events` — ✓ ядро; ⑥ step-up (WebAuthn/OTP) на чувствительных действиях (смена payout/email/пароля) — ✓ (примитивы есть); ⑦ login-velocity + эскалация Turnstile — ✓; ⑧ поведенческая биометрия — ✗ overkill; ⑨ сторонний adaptive-auth (Auth0/Okta) — ✗ (и CLAUDE.md: **никогда Auth0**); ⑩ session binding + refresh-token rotation + logout-all-devices — ✓.
**Выбрано:** слоёно — `auth_events` (④/⑤) + device-list + geo-velocity + step-up на чувствительном (⑥) + login-alerts (③) + breach-password (②) + Turnstile-эскалация (⑦) + refresh-rotation/logout-all (⑩). Поведенческое/сторонее — отвергнуто.
**Критерии приёмки:** вход с нового устройства/гео → алерт + step-up; смена payout/email требует повторной аутентификации; серия неудач → CAPTCHA/лок.
**Зависит:** SEC-BOT, SEC-AUDIT.

### SEC-ENV · Гигиена секретов: restricted-ключи, ротация, CI-гард на утечку — [P1][🟡]
**Проблема:** service-role не течёт (гард есть), но нет процедуры ротации, restricted Stripe-ключей, CI-гарда против случайного `NEXT_PUBLIC_`-секрета или клиентского импорта service-role.
**Решение:** Stripe **restricted keys** (минимум прав на роль); документ ротации ключей; CI-гард (grep/lint) на: клиентский импорт `supabaseService`, `NEXT_PUBLIC_`+секрет-паттерн, коммиты `.env`; secret-scanning (gitleaks) в CI.
**Критерии приёмки:** CI падает при попытке утечки секрета; ключи с минимальными правами.

### SEC-AUTHZ-GUARD · CI-гард на RLS/grants для новых таблиц/функций — [P1][✅ 2026-07-05]
**Проблема:** паттерн «RLS даёт row, не column» и «Supabase грантит EXECUTE функциям всем» ловились **реактивно трижды**. Нужна проактивная автоматика.
**Решение (реализовано):** две взаимодополняющие части.
1. **Статик-гард** `apps/web/src/lib/db/authzMigrationGuard.ts` + `__tests__/authz-migration-guard.test.ts` (едет на `pnpm test` → CI test-job, как SEC-VALID). Сканирует `supabase/migrations/*.sql` (strip комментов + бланк `$$`-тел + нормализация имён): **RULE-A** каждая новая таблица → enable RLS; **RULE-01** нет явного table-wide `insert/update/all` гранта к authenticated/anon без колоночного списка (+blanket `on all tables`); **RULE-01b** (частый вектор) таблица с sensitive-колонкой + authenticated/public write-policy (не-admin-достижимая) без явного `revoke <op> … from authenticated` — ловит дефолт-грант Supabase, которого нет в тексте (profiles-INSERT класс); **RULE-02** каждая `security definer` функция с uuid-аргументом → `revoke execute` от **И** authenticated **И** anon в той же миграции (revoke только from public — НЕ достаточно). Исторические исключения — документированный allowlist `authzGuardExemptions.ts` (reason >10 симв., + staleness-тест выкидывает запись как только remediation добавит revoke). Positive-detection: синтетические плохие миграции обязаны краснеть (вкл. точный advisor-сценарий default-grant).
2. **Живой аудит** `scripts/audit-authz-live.mjs` (`pnpm authz:audit`) — интроспекция `information_schema.role_table_grants` × `pg_policies` × `pg_proc`; grant «горит» только когда пермиссивная policy реально пускает роль (иначе инертный дефолт-грант). Прогнан по проду 2026-07-05 → `docs/security/SEC-AUTHZ-GUARD-live-audit.md` (421→20 после фильтрации; genuine follow-up: `profiles`-INSERT).
**Критерии приёмки:** ✅ новая миграция с незапертой колонкой/функцией — красный CI (доказано positive-detection тестами); ✅ живой аудит выявляет out-of-band drift.
**Follow-up (вне scope шага 10):** column-scope genuine F2-грантов (`profiles`-INSERT verified_*/itsme_*/pro_until, purchases/reports status) — отдельная remediation-задача.

### SEC-WAF · Edge/WAF слой (Vercel Firewall) — [P1][⛔]
**Проблема:** на edge нет WAF/бот-слоя/частотных правил (middleware только i18n+auth-redirect).
**Решение:** Vercel Firewall: правила частоты на дорогие пути, гео/ASN-блок при атаке, challenge-режим; BotID (см. SEC-BOT). Держать конфиг как код где возможно.
**Критерии приёмки:** всплеск с одного ASN/IP на дорогой путь — challenge/блок на edge, не доходя до функции.

### SEC-DoS · Анти-DoS/скрейпинг: пагинация-капы, cost-limits, кэш дорогих ручек — [P1][🟡]
**Проблема:** поиск/каталог — дорогие; агрессивный скрейпинг/скан может нагрузить БД.
**Решение:** жёсткие капы `limit`/`offset`, запрет неограниченных выборок, кэш дорогих публичных ответов (ISR/Redis), стоимость-лимиты на FTS; связать с SEC-RL/SEC-WAF.
**Критерии приёмки:** нельзя запросить неограниченную страницу; дорогие публичные ручки кэшируются.

### SEC-AUDIT · Журнал безопасности + мониторинг + алёрты — [P1][🟡]
**Проблема:** есть `analytics_events` (F6) и `moderation_logs`, но нет единого security-audit sink и алёртов на аномалии.
**Решение:** таблица/поток security-событий (вход, смена реквизитов, admin-действия, отклонённые authz, всплески 429/403); алёрты (порог/аномалия) в канал; связать с FLAG-04 и SEC-ATO. Ретеншен по GDPR.
**Критерии приёмки:** чувствительные события журналируются; всплеск отклонений даёт алёрт.

### SEC-ADMIN · Усиление admin-поверхности (2FA-required, аудит, опц. IP-allowlist) — [P1][🟡]
**Проблема:** admin гейтится `hasAdminRole` (app_metadata — верно), но нет обязательной 2FA/WebAuthn для админов и аудита всех admin-действий.
**Решение:** требовать WebAuthn/2FA для ролей admin; аудит каждого admin-действия (approve/verify/bulk/settings); опциональный IP-allowlist для admin через FLAG.
**Критерии приёмки:** admin без 2FA не проходит; каждое admin-действие в аудите.

### SEC-DEP · Supply-chain: Dependabot, lockfile-audit, pin, SRI — [P1][⛔]
**Проблема:** нет описанной политики зависимостей; Next-vuln уже блокировал деплой ([[deploy-pipeline]]).
**Решение:** Dependabot/renovate + `pnpm audit` gate в CI, pin GitHub-actions по SHA, минимизировать новые прод-зависимости (особенно motion-либа — см. UX-MOTION), review lockfile-диффов.
**Критерии приёмки:** известная критичная CVE в зависимости → красный CI/PR.

### SEC-IR · Incident response runbook + GDPR-72h breach — [P1][⛔]
**Проблема:** нет плана на инцидент/утечку; на запуске это критично.
**Решение:** runbook (роли, шаги, kill-switch через FLAG, ротация ключей, коммуникация), процедура GDPR-нотификации в 72ч (DPA Бельгия), контакт-точка (связать с DSA PoC — PROD-F5). Плейбук по типам (ATO-волна, XSS, утечка БД, DDoS).
**Критерии приёмки:** документ есть, роли назначены, kill-switch проверен на учении.

### SEC-PENTEST · Пентест + bug bounty перед/после запуска — [P2][⛔]
**Решение:** внешний пентест ключевых потоков (auth, chat, upload, billing) до запуска; программа bug-bounty (responsible disclosure, `security.txt`) после.
**Критерии приёмки:** high/critical из пентеста закрыты до go-live.

---

# Блок PROD — Продуктовая полнота (до «готового продукта»)

Опирается на `docs/MASTER_TODO.md` + `FOUNDATIONS-F1-F14`. Здесь — как ID для сквозного ревью; детали в существующих PRD.

### PROD-F3 · PSD2/AML legal-gate — [P0][⛔] — **длинный шест, запустить сейчас**
Внешнее подтверждение (юрист BE + Stripe + возможно NBB) до любого money flow ② (escrow/оплата товара/выплаты). Код: схему + `PaymentProvider`-абстракцию строим сейчас, прод-деньги — после sign-off. См. `docs/features/escrow-legal-gate.md`.

### PROD-F2 · Server-side авторизация денег — [P0][⛔] (предусловие money flow)
Суммы и получатели выплат авторизуются **только на сервере** (никогда с клиента). Предусловие для escrow/выплат (PROD-MONEY). Строим абстракцию сейчас, активна с money flow ② (за F3).

### PROD-F4 · GDPR RoPA/DPIA/DPA-реестр — [P0][⛔] · PROD-F5 · DSA-роль/PoC/DSC — [P0][⛔]
Внешне-долгие артефакты (юрист/DPO). F5 даёт контакт-точку для SEC-IR. Часть механик уже есть (`lib/legal/processing.ts` ROPA-каркас).

### PROD-MONEY · Денежное ядро (10→11→12→13→14) — [P0][⛔] (за F3/F2)
Escrow (Stripe Connect) → диспуты → доставка (Bpost/PUDO) → in-chat Bancontact → consumer/trader-права. Всё за F3 + `PROD-F2` (server-side money authz). Строим схему/адаптеры behind `payments_escrow` тумблер (🔑).

### PROD-IDENT · Идентичность Phase B (itsme/eID, WhatsApp-OTP, Stripe Identity) — [P1][🟡🔑]
Адаптеры-стабы + флаги уже есть (`lib/adapters`). Дописать OIDC-клиент itsme, WhatsApp-OTP, Stripe Identity — все behind AND-gate (тумблер + ключи). Ключи/контракты — после регистрации компании.

### PROD-TRUST · Trust/reviews/модерация/фото-верификация — [P1][🟡]
Trust-score (F14) ✅; reviews ✅; AI-модерация (OpenAI Edge Fn) 🟡 — довести; **feature 17 (reverse-image/pHash)** ⛔ — greenfield, зависит от `SEC-UPLOAD` (нормализованные изображения).

### PROD-DISCOVERY · Swipe-система + saved-search/алерты + PWA/push — [P1][🟡]
Discover (01) 🟡 довести жесты/настройки; saved-search alerts (cron есть) 🟡; **PWA + web-push (18)** ⛔ — behind `web_push` тумблер.

### PROD-COMPLIANCE · Recupel/WEEE + DAC7 + consumer/trader — [P1][🟡]
Recupel/WEEE (15) 🟡; DAC7 → см. `VAT-DAC7`; consumer/trader rights (14) — за F3/legal.

### PROD-BIZ · Бизнес-аккаунты: роли/кабинет-по-членству — [P1][🟡]
Известный follow-up: приглашённые не-создатели admin не доходят до кабинета (`pro/page` created_by-scoped) → role-gate секций + load-by-membership.

### PROD-UX-MOBILE · UX1/UX2 мобильная раскладка — [P1][⛔]
Bottom-nav высоты, contact-bar, тач-таргеты; редизайн-фиксы страниц. Пересекается с блоком UX.

---

# Блок UX — Дизайн и моушн (2026-grade)

Констатация: **анимационной библиотеки нет** (нет framer-motion/gsap); только CSS-transitions + **3 keyframes** (rise/pop/fade, только entrance). Для 2026 — слабо (жалоба владельца обоснована). Редизайн был контрактно presentation-only — оттого «статичен».

### UX-MOTION · Моушн-система (выбор подхода) — [P1][⛔] — фундамент блока
**Рассмотрено (10) →** ① остаться на 3 CSS-keyframes — ✗; ② рукопашные transitions везде — несогласованно; ③ только Tailwind-animate — бедно; ④ framer-motion — мощно, но вес ~40kb, конфликт с `PERF`; ⑤ **motion-one** (WAAPI, крошечный) — ✓ для микро; ⑥ GSAP — мощный скролл, тяжелее/лицензия; ⑦ **нативные View Transitions (Next 16 + React 19)** — переходы страниц/элементов без либы — ✓; ⑧ @formkit/auto-animate — крошечный, авто-лэйаут-анимации; ⑨ **нативные CSS scroll-driven + IntersectionObserver** для reveal — ✓ без JS-либы; ⑩ **гибрид**: нативные View Transitions + CSS scroll-driven + ОДНА малая либа для жестов/пружин.
**Выбрано:** **⑩, CSS-first**: моушн-токены в `globals.css` (длительности/изинги/дистанции), нативные scroll-driven + IntersectionObserver для reveal/stagger, нативные View Transitions для маршрутов/элементов, и **одна** малая либа (motion-one по умолчанию за вес; framer-motion — только если swipe-deck реально требует богатых жестов/пружин). Везде уважать `prefers-reduced-motion` (хук в globals.css уже есть). Это держит бандл лёгким (важно для PERF) и даёт уровень 2026.
**Критерии приёмки:** согласованные токены; reveal-on-scroll со stagger на сетках; плавные переходы страниц; reduced-motion полностью отключает; прирост JS ≤ бюджета `PERF-06`.

### UX-MICRO · Микро-интеракции (карточки/кнопки/инпуты) — [P1][⛔]
Hover-lift и tap-scale карточек, состояния кнопок (loading/success), фокус-кольца, hover медиа-галереи, лайк-анимация. На основе UX-MOTION токенов.

### UX-SKELETON · Скелетоны-шиммер + оптимистичный UI — [P1][🟡]
Заменить пустые блоки на shimmer; оптимистичные лайки/избранное/отправка чата; согласовать с SSR (`PERF-01/04`).

### UX-SCREENS · Полировка по экранам (home/discover/search/ad/post/profile/chat) — [P1][🟡]
Пройтись по 7 редизайн-экранам с новым моушн-слоем; закрыть pixel/dark-mode-верификацию, которой не было (Chrome MCP без браузера — см. [[ui-redesign-handoff]]). **Гардрейл:** не фабриковать trust-claim, который данные не подтверждают (DSA Art.30).

### UX-A11Y · Доступность (WCAG AA) — [P1][🟡]
Контраст, фокус-менеджмент, ARIA (часть есть — role=switch/tabs), клавиатура, screen-reader на ключевых потоках; reduced-motion (UX-MOTION). Юридически усиливает trust-позиционирование.

---

# Блок OPS — Наблюдаемость, QA, релиз-инжиниринг

### OPS-ERR · Error tracking + performance monitoring — [P0][✅]
Sentry (или аналог) на клиент+сервер; Vercel Speed Insights/Analytics (CWV с прода). Без этого «медленно/сломалось» — вслепую. Behind FLAG + ключ.

**Реализовано 2026-07-04:** server-side Sentry инициализация в `instrumentation.ts` (автозагружается в Next.js 16); client-side Sentry + Vercel Analytics в `ErrorTrackingProvider`; capability флаги `error_tracking` и `analytics_insights` (AND-gated на env-ключи); трейсинг 100% в dev, 10% в prod. Активация: установить `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` и флаги в админке (когда FLAG-01 готов).

### OPS-HEALTH · Health-checks + uptime + алёрты — [P1][⛔]
`/api/health` (БД/Redis/Stripe-reachability), внешний uptime-мониторинг, алёрты в канал; связать с SEC-AUDIT.

### OPS-E2E · E2E-тесты критических потоков (Playwright) — [P1][⛔]
Регистрация→верификация→листинг→чат→репорт→billing. Сейчас есть vitest-юниты; e2e на happy+abuse-пути закрывает регрессии класса «весь чат был сломан».

### OPS-CI · Усилить CI-гейты — [P1][🟡]
К существующим typecheck/test/lint добавить: SEC-VALID-гард, SEC-AUTHZ-GUARD, SEC-DEP-audit, SEC-ENV secret-scan, env-схему, bundle-budget. Всё зелёное — условие мержа.

### OPS-STAGING · Staging + дисциплина preview-деплоев — [P1][🟡]
Отдельная среда с прод-подобной БД (или ветка) для проверки миграций/грантов до прода (учитывая drift-историю [[supabase-migration-drift-repair]]).

### OPS-BACKUP · Бэкапы/DR + безопасность миграций — [P1][🟡]
PITR/бэкап-политика Supabase, проверка восстановления, идемпотентные миграции (конвенция уже есть), «expand-then-contract» для рискованных схем.

### OPS-ANALYTICS · Продуктовые метрики — [P2][🟡]
`analytics_events` (F6) sink есть; собрать дашборд ключевых воронок (регистрация, публикация, контакт), не-PII.

---

# Блок LAUNCH — Готовность к запуску (активация + go/no-go)

### LAUNCH-KEYS · Founder-activation список (ключи/конфиг) — [P0]
Turnstile (free), `CRON_SECRET`, Stripe Pro Price + `CAPABILITY_PRO_SUBSCRIPTIONS`, `entity.ts` (legalName/KBO/VAT/controller), `LEGAL_CONTENT_APPROVED` после юриста, 6 processor-DPA (Supabase/Stripe/Twilio/Cloudflare/Upstash/Vercel), Stripe Tax регистрация (VAT-A). Все — через AND-gate тумблеры (FLAG).

### LAUNCH-LEGAL · Юр-контент + артефакты — [P0]
Финализировать privacy/terms/imprint (каркас есть), flip `LEGAL_CONTENT_APPROVED`; RoPA/DPIA (F4); DSA-роль/PoC (F5); VAT sign-off (VAT-LEGAL).

### LAUNCH-GONOGO · Go/No-Go чек-лист — [P0]
Зелёные: все SEC-P0, PERF-P0, FLAG-фундамент, OPS-ERR, LEGAL, KEYS. Красные money-flow (за F3) — **не блокер запуска contact-only**, но явно «выключено тумблером». Учебный прогон SEC-IR kill-switch.

---

## Приложение A — Сводка по приоритетам (P0 к запуску)

**P0 безопасность:** SEC-CSP, SEC-RL1, SEC-RL2, SEC-BOT, SEC-UPLOAD.
**P0 перформанс:** PERF-01, PERF-02.
**P0 фундамент/ключи:** FLAG-01, FLAG-02, FLAG-03; VAT-A (код).
**P0 внешние (старт сейчас):** PROD-F3, PROD-F4, PROD-F5, VAT-LEGAL.
**P0 ops/legal:** OPS-ERR, LAUNCH-KEYS, LAUNCH-LEGAL, LAUNCH-GONOGO.

## Приложение B — Что НЕ трогать (уже сделано)
RLS column-locks · SECURITY DEFINER-предикаты · webhook signature+F1 · service-role server-only гард · F8 IP-trust · F9 fraud-wiring · F10 itsme_sub · базовые заголовки · httpOnly/SameSite cookies · media path-ownership. Старые security-доки устарели — не чинить по ним.

## Приложение C — Открытые развилки для решения владельца
1. **VAT-B scope:** строим полный движок сейчас (display/invoice/DAC7) или ждём ближе к F3? (дефолт: строим data-model + резолвер сейчас, сбор — за F3).
2. **Кэш флагов:** DB+Redis (дефолт) vs добавить Vercel Edge Config для горячих.
3. **Motion-либа:** motion-one (дефолт, вес) vs framer-motion (богатые жесты для swipe).
4. **itsme/eID:** привязываемся к регистрации sole-proprietorship (см. [[marketplace-system-design]] §10) — влияет на Phase B.
5. **Money flow ② вообще:** делаем ли escrow/выплаты (детонатор DAC7/PSD2) или остаёмся contact-only дольше.

## Приложение D — Матрица «модель · мощность» по каждому ID

Проставлено калибровкой (8 параллельных агентов) + сквозной нормализацией на консистентность. **Ровно 8 `ultracode`-пунктов** (дорогой multi-agent режим — только самое рисковое): `SEC-CSP`, `SEC-UPLOAD`, `SEC-ATO`, `SEC-PENTEST`, `VAT-B`, `PROD-F2`, `PROD-MONEY`, `LAUNCH-GONOGO`.

| ID | Модель | Мощность | Почему |
|---|---|---|---|
| PERF-01 | Opus 4.8 | xhigh | ISR-кэш рядом с приватностью данных под кэшем |
| PERF-02 | Haiku 4.5 | low | механическая замена `img`→`next/image` |
| PERF-03 | Sonnet 5 | medium | рефактор подписантов, узкий радиус |
| PERF-04 | Opus 4.8 | high | клиент→SSR поиска, риск регрессий |
| PERF-05 | Sonnet 5 | medium | дедуп + `React.cache`, узкий радиус |
| PERF-06 | Haiku 4.5 | low | конфиг analyzer + dynamic imports |
| FLAG-01 | Opus 4.8 | high | sync→async фундамент, широкий радиус |
| FLAG-02 | Sonnet 5 | medium | реестр ключей, ясная спека |
| FLAG-03 | Sonnet 5 | medium | типовая admin-панель |
| FLAG-04 | Sonnet 5 | medium | append-only аудит, стандарт |
| FLAG-05 | Opus 4.8 | high | env-валидация трогает весь бутстрап |
| FLAG-06 | Opus 4.8 | xhigh | миграция ~13 гардов (fraud/auth/pay) |
| VAT-A | Opus 4.8 | high | Stripe Tax, налоговая корректность |
| **VAT-B** | **Workflow** | **ultracode** | движок НДС + margin scheme, юр-корректность |
| VAT-B2 | Opus 4.8 | xhigh | схема-фундамент для всего НДС |
| VAT-B3 | Opus 4.8 | xhigh | легальная последовательная нумерация |
| VAT-DAC7 | Opus 4.8 | xhigh | госотчётность FOD, юр-риск |
| VAT-FIX | Sonnet 5 | medium | свести 2 определения (есть эталон) |
| **SEC-CSP** | **Workflow** | **ultracode** | enforced CSP, топ-1 XSS→захват сессии |
| SEC-RL1 | Sonnet 5 | medium | применить готовый `withRateLimit` |
| SEC-RL2 | Opus 4.8 | high | fail-open→closed, риск доступности |
| SEC-BOT | Sonnet 5 | medium | виджет Turnstile по доке |
| **SEC-UPLOAD** | **Workflow** | **ultracode** | класс image-RCE/decompression-bomb |
| SEC-VALID | Sonnet 5 | medium | zod на роуты, широкий охват файлов |
| SEC-CSRF | Sonnet 5 | medium | небольшой Origin-helper |
| **SEC-ATO** | **Workflow** | **ultracode** | greenfield-аутентификация, макс. риск |
| SEC-ENV | Sonnet 5 | medium | restricted-ключи, денежный контекст |
| SEC-AUTHZ-GUARD | Opus 4.8 | high | SQL-интроспекция модели авторизации |
| SEC-WAF | Sonnet 5 | medium | edge-правила Vercel по доке |
| SEC-DoS | Sonnet 5 | medium | капы/cost-limits/кэш |
| SEC-AUDIT | Opus 4.8 | high | кросс-каттинг события + алёрты |
| SEC-ADMIN | Opus 4.8 | high | 2FA админам, широкий охват |
| SEC-DEP | Haiku 4.5 | low | Dependabot/audit/gitleaks конфиг |
| SEC-IR | — | n/a | документ + учение (внешнее) |
| **SEC-PENTEST** | **Workflow** | **ultracode** | adversarial-аудит по природе |
| PROD-F3 | — | n/a | юр-гейт PSD2/AML |
| **PROD-F2** | **Workflow** | **ultracode** | server-side money authz, кража средств |
| PROD-F4 | — | n/a | GDPR-артефакты (юрист/DPO) |
| PROD-F5 | — | n/a | DSA-роль (организационное) |
| **PROD-MONEY** | **Workflow** | **ultracode** | денежный поток, макс. фин/юр-риск |
| PROD-IDENT | Opus 4.8 | max | KYC/OIDC цепочка, one-shot верна |
| PROD-TRUST | Opus 4.8 | high | антифрод/pHash дизайн |
| PROD-DISCOVERY | Sonnet 5 | medium | swipe/alerts/push фича |
| PROD-COMPLIANCE | Sonnet 5 | medium | Recupel + тексты прав |
| PROD-BIZ | Sonnet 5 | medium | RBAC-паттерн |
| PROD-UX-MOBILE | Haiku 4.5 | low | CSS/layout доводка |
| UX-MOTION | Opus 4.8 | high | фундамент моушна + бандл-бюджет |
| UX-MICRO | Sonnet 5 | medium | локальные интеракции |
| UX-SKELETON | Sonnet 5 | medium | шиммер + optimistic UI |
| UX-SCREENS | Opus 4.8 | high | кросс-каттинг 7 экранов |
| UX-A11Y | Opus 4.8 | high | WCAG AA, юридический вес |
| OPS-ERR | Haiku 4.5 | low | подключить SDK по доке |
| OPS-HEALTH | Haiku 4.5 | low | типовой health + uptime |
| OPS-E2E | Sonnet 5 | medium | выбор сценариев Playwright |
| OPS-CI | Opus 4.8 | high | гейты трогают весь пайплайн |
| OPS-STAGING | Opus 4.8 | high | миграции/гранты, риск дрейфа |
| OPS-BACKUP | Opus 4.8 | xhigh | DR/данные, ошибка необратима |
| OPS-ANALYTICS | Sonnet 5 | medium | дашборд поверх F6-sink |
| LAUNCH-KEYS | — | n/a | активация founder-ом |
| LAUNCH-LEGAL | — | n/a | юр-контент (юрист) |
| **LAUNCH-GONOGO** | **Workflow** | **ultracode** | сквозной аудит запуска |

> Как использовать: перед проходом по ID бери его модель/мощность отсюда. `low`→Haiku (быстро/дёшево), `medium`→Sonnet, `high/xhigh/max`→Opus 4.8 (крути effort), `ultracode`→запусти multi-agent (`/code-review ultra` или Workflow-оркестрацию) с adversarial-верификацией. Для шага-связки в трекере тег = максимум по входящим ID (полный разброс — в этой таблице).

---

> Следующий шаг: пройтись **по каждому ID отдельно** — детальная спека (схема БД, роуты, тесты, критерии) на выбранный пункт.
