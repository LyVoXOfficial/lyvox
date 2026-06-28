# Security-ревью PRD LyVoX (зона: транзакции, идентичность, анти-фрод, GDPR, рефералы)

> **Ревьюер:** старший application-security инженер (маркетплейсы, платежи, fraud, Supabase RLS, Next.js)
> **Дата:** 2026-06-28
> **База:** аудит `features/audit/03-security-mobile-audit.md` (часть A) + сверка с кодом (`apps/web/next.config.ts`, `middleware.ts`, `supabase/migrations`, `apps/web/src/lib`, `apps/web/src/app/api`).
> **Зона PRD:** 10, 11, 13, 16, 17, 30, 35, 38, 41, 55.
> **Вердикты:** ✅ sign-off · 🔄 в ревью (нужны правки до airtight) · ⛔ блокер (нельзя строить/запускать без закрытия).

---

## 0. Сводка для занятых

Из 10 PRD: **0 готовы к sign-off**, **8 требуют доработки PRD (🔄)**, **2 блокированы (⛔)** — escrow (10) и in-chat payment (13) нельзя строить до письменного комплаенс-гейта (NBB/AML) **и** до фиксации в PRD требований идемпотентности на уровне Stripe event-id и authorization-проверок суммы/получателя.

Сквозные системные находки (наследуются всеми транзакционными/анти-фрод PRD и подтверждены в коде):
- **`getClientIp` доверяет клиентскому `x-forwarded-for` ПЕРВЫМ** (`rateLimiter.ts:195-197`) → все IP-rate-limit обходятся спуфингом. Это подрывает анти-абуз во всех PRD, которые ссылаются на rate-limit (13, 16, 35, 38, 55).
- **CSP — Report-Only + `unsafe-inline`/`unsafe-eval`** (`next.config.ts:10,73`) → XSS не блокируется. Для escrow/чата/платежей это = угон сессии. Ни один PRD платёжной зоны не должен получать sign-off, пока CSP не enforced с nonce.
- **`fraud-detection` Edge Function не вызывается из web-app** (grep: 0 call-site) → анти-фрод PRD (38) опираются на несуществующую проводку.
- **`checkUserBlocked` fail-open на `api/adverts/route.ts:31`** (без `failClosed`) — подтверждено.
- **Нет колонки `itsme_sub` в схеме** (`20251110000000_itsme_fields.sql` содержит только `itsme_verified`+`itsme_kyc_level`) → DoD PRD-30 «хард-реджект коллизии sub» физически не реализуем на текущей схеме.

---

## 1. PRD 10 — Escrow / Safe-deal

**Угрозы / уязвимости:**
1. **Платёжный фрод / replay вебхуков (Critical).** Деньги двигаются по вебхуку как source-of-truth. Текущий billing-webhook (`api/billing/webhook/route.ts`) идемпотентен только через статус строки `purchases` (`existingPurchase?.status === 'completed'`). Для escrow с состояниями paid → released → refunded этого мало: нет таблицы processed `event.id`, повтор `payment_intent.succeeded`/`charge.refunded`/`transfer.*` может задвоить payout или возврат. Подписочная ветка вообще без дедупликации (подтверждено в коде).
2. **IDOR / authorization на сумму и получателя (Critical).** PRD не требует серверной перепроверки, что `amount`/`seller_id` сделки совпадают с тем, что реально оплачено в PSP, и что payout уходит только на verified-KYC аккаунт продавца сделки. Без этого — манипуляция суммой/получателем через подмену параметров в `POST /api/deals` / `pay`.
3. **Race / двойной release (High).** «Подтверждение покупателя ИЛИ таймаут» — два конкурирующих триггера release; без блокировки на уровне строки сделки (`SELECT ... FOR UPDATE` / статус-машина с атомарным CAS) возможен двойной payout.
4. **RLS-обход (High).** Новые таблицы `deals/deal_events/deal_payments/payouts` — owner/participant-only. Урок из `20260627230000`: RLS даёт row-, не column-security; денежные/статусные колонки (`status`, `release_status`, `amount`, `seller_id`) должны быть **полностью** service-role-write (revoke insert/update у authenticated/anon), иначе участник self-release через PostgREST.
5. **AML / sanctions / NBB (Critical, регуляторный).** Холд средств — регулируемая активность. Остаточные обязанности на LyVoX: KYC продавца, transaction monitoring/SAR, sanctions screening. PRD это упоминает как гейт — корректно, но не как hard-blocker в DoD.
6. **PII-утечка в `deal_events.payload jsonb`** — риск складировать адрес доставки/полные данные в иммутабельном логе без retention.

**Контрмеры / требования в PRD (добавить):**
- **Идемпотентность на уровне Stripe `event.id`:** отдельная таблица `processed_webhook_events { event_id pk, type, processed_at }`; обработка события — в одной транзакции с записью event_id; повтор → no-op. Это требование вынести в §5 и DoD (сейчас только «идемпотентно» без механизма).
- **Server-side authorization денежных переходов (fail-closed):** перед release/refund/payout сервер сверяет (a) сумму в PSP == `deals.amount`, (b) получатель payout == `deals.seller_id` с пройденным KYC, (c) текущий статус допускает переход (явная статус-машина). Любая рассинхронизация → блок + алерт, не авто-проход.
- **Атомарная статус-машина** сделки (enum-переходы + row-lock), release идемпотентен по `deal_id`.
- **Column-lock RLS** для всех денежных таблиц: `revoke insert,update on deals,deal_payments,payouts from authenticated,anon`; запись только service-role; участникам — `select` своих строк через `is_deal_participant()` SECURITY DEFINER (по образцу `is_conversation_participant`).
- **Аудит-лог** всех денежных событий в иммутабельную таблицу с actor (user/service/webhook), причиной, before/after-статусом.
- **KYC-гейт payout:** payout только на Stripe Connect аккаунт с `charges_enabled`/`payouts_enabled`; verified-tier (itsme) для high-value (связь с PRD-30 tiering).
- **`checkUserBlocked(..., {failClosed:true})`** на создании сделки и на pay.
- **DoD-блокер:** письменное подтверждение модели (Stripe + бельгийский юрист по NBB/AML) — сделать **hard gate** перед любым кодом.

**Риск:** **Critical** · **Вердикт: ⛔** (комплаенс-гейт + отсутствие в PRD механизма идемпотентности/authorization денежных переходов).

---

## 2. PRD 11 — Dispute-движок

**Угрозы / уязвимости:**
1. **Authorization роли модератора (High).** `POST /api/disputes/[id]/resolve` двигает деньги (refund/release/split). PRD говорит «роль модератор», но не специфицирует, КАК проверяется роль. Урок из прошлого аудита: анти-эскалация admin — через `app_metadata`, не через user-editable поле. Resolve должен сверять роль из `app_metadata`/серверного источника, не из profiles-колонки.
2. **IDOR на доказательства (High).** `dispute_evidence.media_path` + доступ только сторон+модератора. Если evidence отдаётся подписанным URL — тот же класс, что og signed-URL утечка (A-2): TTL/путь раскрывают структуру и UUID. Доступ к чужим evidence через прямой media-path.
3. **Refund/return abuse (Med).** «Возврат без возврата товара», повторные споры одного юзера, фрод-кольца. PRD упоминает, но без конкретного контроля (велосити-лимит споров на пользователя/IP, привязка к trust-score).
4. **Заморозка средств — race с release escrow (High).** Открытие спора должно атомарно заблокировать release в PRD-10; если release и open-dispute конкурируют — деньги уйдут до заморозки. Нужна общая статус-машина сделки.
5. **Дефолтное решение по таймауту (Med).** «Молчание продавца → дефолт-решение» — вектор абуза: покупатель-фрод провоцирует таймаут. Нужен баланс + аудит авто-решений.

**Контрмеры / требования в PRD:**
- Роль модератора/support проверять серверно из `app_metadata` (не из user-writable колонки); resolve — service-role + audit с обоснованием (DSA Art.20 — и так в PRD).
- Evidence-медиа — короткий signed-URL, генерируемый per-request только для авторизованной стороны/модератора; путь не раскрывать в публичных метаданных; RLS на `dispute_evidence` через `is_deal_participant() OR is_moderator()`.
- Заморозка release — атомарно в статус-машине сделки (open dispute → status=`disputed`, release заблокирован на уровне БД-constraint, не только в коде).
- Велосити-лимит открытия споров (per-user/per-IP с серверным IP), фрод-скоринг повторных споров → trust-score.
- Аудит всех решений (actor, обоснование, before/after) — иммутабельно.
- Server-side IP (после фикса `getClientIp`) для всех лимитов открытия.

**Риск:** **High** · **Вердикт: 🔄**.

---

## 3. PRD 13 — In-chat оплата Bancontact

**Угрозы / уязвимости:**
1. **Authorization суммы/получателя (Critical).** «Запрос оплаты создаёт escrow-deal». Кто угодно из участников создаёт `payment_request` с произвольной суммой/привязкой к чужому объявлению? Нужен серверный контроль: продавец запроса == владелец объявления; сумма в допустимых границах; buyer == второй участник чата.
2. **Replay/идемпотентность (Critical).** «Один запрос = один payment intent; статус от вебхука» — наследует механизм из PRD-10 (processed event-id). Без него — двойная оплата/задвоение холда.
3. **Фишинг внешних payment-ссылок (High → бизнес-ядро).** Контроль = `scrubContacts` + предупреждение. Но scrub тривиально обходится (A-5): слитные цифры `0612345678` не маскируются, unicode look-alikes, дробление по сообщениям. Внешняя payment-ссылка через сокращатель/без `http` префикса частично проходит `URL_RE`.
4. **Спуфинг карточки оплаты в чате (Med).** Если «нативная карточка оплаты» рендерится из message-payload, злоумышленник может подделать сообщение, выглядящее как карточка. Карточка должна рендериться ТОЛЬКО из серверной сущности `payment_request`, не из произвольного текста сообщения.
5. **Rate-limit на создание запросов (Med).** PRD требует rate-limit, но он будет обходим до фикса `getClientIp`.

**Контрмеры / требования в PRD:**
- Server-side authorization: создатель payment_request == owner объявления (или явное правило, кто инициирует); сумма ≤ потолок; привязка buyer/seller к участникам conversation (verified server-side, не из клиента).
- Идемпотентность Stripe event-id (общий механизм с PRD-10) — в §5 и DoD.
- Native-карточка рендерится строго из `payment_requests` (typed event), сообщение-«самозванец» невозможно (server-controlled message kind).
- Усилить `scrubContacts` как **сигнал** (NFKC-нормализация, маскирование слитных BE-номеров `0xxxxxxxxx`, агрегация по conversation) — но в PRD честно зафиксировать: реальный контроль = escrow, scrub = deterrent.
- Rate-limit `POST /api/chat/payment-request` (per-user + per-IP), серверный IP.
- Dynamic payment methods через Stripe Dashboard (не форсить `payment_method_types`) — уже в PRD, ок.

**Риск:** **Critical** · **Вердикт: ⛔** (наследует комплаенс-гейт PRD-10 + отсутствие в PRD требований authorization суммы/получателя и механизма идемпотентности).

---

## 4. PRD 16 — Защита от угона аккаунта (ATO)

**Угрозы / уязвимости:**
1. **fail-open `checkUserBlocked` (Med, подтверждено в коде).** PRD корректно требует fail-closed на high-risk — но на `api/adverts/route.ts:31` всё ещё fail-open.
2. **Гео/IP-аномалии на спуфабельном IP (High).** Вся гео-аномалия и «невозможная скорость» строятся на IP. Пока `getClientIp` берёт первый `x-forwarded-for` — атакующий подделает IP/гео → правила step-up не сработают или сработают ложно. Это делает ключевой контроль PRD-16 бесполезным.
3. **Step-up на payout-change (Critical для связки с escrow).** Смена payout-реквизитов — классический ATO-монетизатор. PRD требует задержку+верификацию+алерт — корректно; нужно сделать это серверным гейтом fail-closed (нельзя сменить payout без пройденного step-up), не UI-баннером.
4. **Device fingerprint / профайлинг — PII/GDPR (Med).** Внешний fraud-API получает device/email/phone enrichment → APD/GBA профайлинг. PRD упоминает минимизацию — нужно конкретизировать DPIA и legal basis.
5. **Перечисление аккаунтов (Med).** `check-email` rate-limited, но IP-bucket обходим (см. #2). Step-up/alert-флоу не должны раскрывать существование аккаунта.

**Контрмеры / требования в PRD:**
- Зафиксировать как **предусловие PRD-16**: фикс `getClientIp` (доверять только последнему доверенному hop / `x-vercel-forwarded-for`), иначе гео-правила недостоверны.
- `checkUserBlocked` fail-closed на всех high-risk путях (логин-sensitive, payout, publish, create-deal) — добавить explicit-список путей в PRD.
- Payout-change — серверный fail-closed gate: step-up (WebAuthn/TOTP/OTP) + cooling-off + алерт «это не я»; до прохождения — payout-реквизиты не применяются.
- `user_sessions`/`auth_events` — RLS owner-only (+admin read через `app_metadata`-роль), retention/GDPR-экспорт.
- DPIA для device-fingerprint вендора; минимизация; privacy-нотис (APD/GBA).

**Риск:** **High** · **Вердикт: 🔄**.

---

## 5. PRD 17 — Проверка фото (reverse-image / pHash)

**Угрозы / уязвимости:**
1. **Загрузка медиа без rate-limit (Med, подтверждено A-4).** Хук pHash вешается на `/api/media/complete`, но `media/sign|complete|list|public` НЕ обёрнуты в `withRateLimit`. pHash-вычисление на каждый upload + спам upload = DoS/cost-abuse усилится.
2. **Серверная обработка изображений — RCE/decompression bomb (High).** Парсинг произвольных загруженных изображений (pHash, отправка в reverse-image API) — классический вектор image-library RCE / pixel-flood / SSRF (если reverse-image API дёргается по URL картинки). PRD говорит «обработка на сервере» — нужно: лимиты размера/размерности, sandbox/таймаут, обработка только из доверенного storage-пути (не по user-supplied URL).
3. **PII в изображениях / EXIF-гео (Med).** Фото могут нести EXIF-геолокацию владельца → утечка адреса. Нужен strip EXIF при обработке + GDPR-retention `media_hashes`.
4. **False-positive → ущерб честным (Med).** PRD корректно выбирает «мягкая задержка, не блок». Хорошо.
5. **Утечка через reverse-image вендора (Med).** Отправка пользовательских фото третьей стороне — GDPR processor-agreement + минимизация.

**Контрмеры / требования в PRD:**
- Rate-limit на `media/sign`+`complete` (per-user) до включения pHash-хука — иначе фича усиливает A-4.
- Image-processing: hard-лимиты (max bytes, max megapixels), таймаут, изоляция; обрабатывать ТОЛЬКО объект из своего storage по серверному пути, никогда по URL из запроса (анти-SSRF).
- Strip EXIF; не хранить лишнего; retention `media_hashes/media_flags`; DPA с reverse-image вендором.
- RLS на `media_hashes/media_flags` — модерация/админ (через `app_metadata`-роль), не участники.

**Риск:** **High** (из-за image-processing RCE/SSRF) · **Вердикт: 🔄**.

---

## 6. PRD 30 — Идентичность и аккаунт

**Угрозы / уязвимости:**
1. **`sub`-uniqueness нереализуем на текущей схеме (High, подтверждено в коде).** Миграция `20251110000000_itsme_fields.sql` добавляет только `itsme_verified` (bool) + `itsme_kyc_level` (text). **Колонки `itsme_sub` нет**, unique-constraint нет. DoD «хард-реджект второго аккаунта по коллизии sub» физически невозможен — это пробел в PRD: нужно явно потребовать колонку `itsme_sub text unique` + серверную проверку коллизии при OIDC-callback.
2. **itsme OIDC callback — replay / state / nonce (High).** PRD «itsme закодирован, не прод-тестирован». OIDC-флоу требует: проверка `state` (CSRF), `nonce` (replay id-token), валидация подписи id-token, exact redirect_uri. PRD это не специфицирует.
3. **Account-takeover через linking (High).** Привязка itsme к существующему аккаунту: если verified itsme `sub` можно привязать к уже-залогиненному аккаунту без step-up — угонщик привязывает свой itsme к чужому аккаунту или наоборот. Linking — только с подтверждением владельца.
4. **PII / Art.9 GDPR (Med).** «Verify, don't warehouse» — корректно (не хранить скан ID). Закрепить как hard-requirement: хранить только атрибуты (`sub`, name, `age_gte_18`), не raw KYC-документы.
5. **Tiering обход (Med).** Throwaway-аккаунты в low-trust лейн — корректно; нельзя оверселлить «structurally can't re-register» (PRD честен — ок).

**Контрмеры / требования в PRD:**
- Добавить в §6 Data model: `profiles.itsme_sub text` + `unique index` (или отдельная `identity_links { provider, sub unique, user_id }`); в §5/DoD — серверная коллизия-проверка, хард-реджект.
- OIDC-hardening в §8: state/nonce/signature/redirect_uri validation; id-token не доверять без проверки.
- Account-linking только после step-up владельца; запрет силового re-link.
- Запрет хранения raw KYC-доков (Art.9) — explicit в DoD.

**Риск:** **High** · **Вердикт: 🔄**.

---

## 7. PRD 35 — Чат + чат-антифрод

**Угрозы / уязвимости:**
1. **scrubContacts обходится (Low→Med, подтверждено A-5/код).** Слитные `0612345678` не маскируются (нет separator/intl-prefix); unicode look-alikes; дробление по сообщениям; IBAN с пробелом после первой буквы. PRD честно называет это deterrent — корректно. Но как **сигнал** недокручен.
2. **XSS через message body (High при enforced-рендере).** `messages.body` рендерится в UI. При CSP Report-Only любой прорыв экранирования = stored XSS в приватном чате → угон. Зависит от enforced CSP+nonce (сквозная находка).
3. **Realtime authorization (Med).** Supabase Realtime на `messages`/`conversations` — подписки должны быть закрыты теми же RLS, что REST; иначе участник слушает чужой канал. PRD ссылается на RLS — подтверждено, что RLS-рекурсия чинилась (`is_conversation_participant`). Закрепить, что Realtime-канал тоже RLS-gated.
4. **Off-platform сигнал не агрегируется (Med).** PRD-roadmap: risk-flags в trust-score. Сейчас только per-message log (`chat_contact_masked`). Нужна агрегация по conversation/пользователю для авто-mute.
5. **DSAR-экспорт чата / retention (Med, GDPR).** Roadmap — но без TTL чат копит PII бессрочно.

**Контрмеры / требования в PRD:**
- Усилить scrub как сигнал: NFKC-нормализация, BE-номер `^0\d{9}$` слитный, агрегация по сессии → trust-score (уже в roadmap — поднять приоритет, т.к. PRD-13 анти-фишинг опирается на это).
- Подтвердить в §8: Realtime-подписки gated теми же RLS-политиками; никаких service-role в клиентских Realtime.
- Stored-XSS: вывести зависимость от enforced CSP+nonce явно (как acceptance для PRD-35).
- Retention/TTL `messages` + cron-очистка + DSAR-экспорт чата (из roadmap в DoD до escrow-запуска, т.к. чат станет каналом сделок).

**Риск:** **Med** (как сигнал; High-компонент = stored XSS наследует CSP) · **Вердикт: 🔄**.

---

## 8. PRD 38 — Модерация и жалобы

**Угрозы / уязвимости:**
1. **Fraud-engine не подключён (High, подтверждено: 0 call-site `fraud-detection`).** PRD верно констатирует «проводка не подключена». `checkUserBlocked` — единственный рантайм-контроль, и он fail-open на create-advert. Анти-фрод декларативен.
2. **fail-open `checkUserBlocked` (Med).** Тот же дефект; PRD требует fail-closed — закрепить explicit-пути.
3. **Authorization модератор/админ (High).** `/api/moderation/{review}` и `/api/reports/update` двигают статусы. Роль должна проверяться из `app_metadata` (анти-эскалация уже сделана в прошлом — закрепить, что новые модераторские эндпойнты следуют тому же паттерну).
4. **Brigading / массовые жалобы (Med).** Reports rate-limited, но IP-bucket обходим (getClientIp). N жалоб от sockpuppet'ов → авто-hide честного. Нужен серверный IP + дедуп по reporter+target.
5. **DSA-комплаенс (Med, регуляторный).** Art.16 (statement of reasons), Art.20 (апелляция человеком), Art.23 (повторные нарушители), GPSR 3-дневная обработка. PRD это покрывает — хорошо; нужен аудит решений модераторов (иммутабельно).

**Контрмеры / требования в PRD:**
- **Реально вызвать `fraud-detection` Edge Function** из листинг/checkout/create-deal флоу (рядом с `checkUserBlocked`) — это hard-requirement DoD, а не «подключить».
- `checkUserBlocked` fail-closed на create-advert и всех модерируемых write-путях.
- Роль модератора/админа — только `app_metadata`-источник; service-role на mutate; аудит каждого решения (actor/reason/before-after).
- Анти-brigading: серверный IP, дедуп reporter+target, велосити-порог, ручной разбор при массовости.
- Хранить statement-of-reasons и решения иммутабельно (DSA Art.16/24 transparency).

**Риск:** **High** · **Вердикт: 🔄**.

---

## 9. PRD 41 — GDPR / юр-страницы / cookies

**Угрозы / уязвимости:**
1. **Полнота DSAR/erasure по новым сущностям (High).** Export/delete сейчас покрывают профиль/объявления (as-built ✅). С приходом escrow/disputes/chat/payment_requests/referrals/media_hashes — экспорт/удаление их НЕ охватывают. Неполный DSAR = нарушение GDPR. PRD это упоминает в roadmap, но должно стать hard-gate: каждая новая PII-таблица регистрируется в DSAR-реестре.
2. **Erasure vs юр-обязательное хранение платежей (Med).** Удаление при активных сделках/спорах — PRD корректно блокирует; но финансовые записи (AML/налоги) хранятся юр-обязательно → нужна анонимизация, не удаление, с явным retention-расписанием по типам.
3. **Cookie-consent до загрузки скриптов (Med, ePrivacy).** Analytics/marketing скрипты не должны грузиться до consent. Проверить, что Stripe/аналитика gated по `functional/analytics`.
4. **DSAR-аутентификация (Med).** Export/delete должны требовать re-auth/step-up (иначе при ATO угонщик выкачивает/удаляет данные). Связь с PRD-16.
5. **Аудит DSAR-операций (Low→Med).** Кто/когда экспортировал/удалил — иммутабельный лог.

**Контрмеры / требования в PRD:**
- DSAR-реестр сущностей: каждая новая PII-таблица (deals, disputes, messages, payment_requests, referrals, media_hashes, user_sessions, auth_events) обязана попасть в export+delete — это acceptance-критерий для PRD 10/11/13/16/17/55.
- Retention-расписание по типам (OTP, логи, чат, финансы) с явными TTL; финансы → анонимизация по юр-сроку, не удаление.
- Cookie-gating скриптов по категориям до consent (ePrivacy).
- Export/delete за re-auth/step-up (связка с ATO).
- Иммутабельный аудит DSAR.

**Риск:** **High** (полнота DSAR при росте сущностей) · **Вердикт: 🔄**.

---

## 10. PRD 55 — Рефералы

**Угрозы / уязвимости:**
1. **Реферал-фрод / self-referral / мульти-аккаунт (High — главный риск фичи).** Награда после «квалифицирующего действия». Без серверной уникальности по verified identity (itsme `sub`) — фарм через throwaway-аккаунты. Но `sub`-uniqueness ещё не существует в схеме (см. PRD-30) → анти-абуз рефералов не на чём строить.
2. **Clawback при отмене сделки (Med).** PRD корректно требует clawback; нужен атомарный механизм (награда условна до финализации сделки/невозвратности).
3. **Фрод-кольца (Med).** Кольца взаимных рефералов; нужен граф-детект / device+IP-кластеризация (серверный IP).
4. **IDOR на чужой реф-код / самоназначение referrer (Med).** Привязка referee→referrer должна фиксироваться серверно при регистрации, не редактироваться клиентом.
5. **Реварды как денежный переход (Med).** Protection-fee-кредит/буст — через тот же authorization/аудит, что billing.

**Контрмеры / требования в PRD:**
- **Жёсткая зависимость:** анти-абуз рефералов невозможен без `itsme_sub` uniqueness (PRD-30) — зафиксировать как блокирующую зависимость; квалификация = verified-tier действие, не регистрация.
- Clawback атомарно при отмене/возврате сделки; награда «pending» до невозвратности.
- Серверный IP + device-кластеризация для детекта колец; лимиты наград/период.
- referrer-привязка фиксируется сервером при регистрации (RLS owner-only, не клиент-editable).
- Начисление наград — через billing-authorization+аудит.

**Риск:** **High** (фрод-rate — KPI самой фичи) · **Вердикт: 🔄** (но P2 — строить после доказанного trust-loop, как в PRD).

---

## 11. Сквозные security-требования (наследуются всеми PRD зоны)

Эти требования должны быть добавлены/подтверждены в §8 каждого затронутого PRD как acceptance-критерии:

| # | Требование | Откуда | Затрагивает PRD |
|---|-----------|--------|-----------------|
| S-1 | **Серверный IP:** `getClientIp` доверяет только последнему доверенному hop (`x-vercel-forwarded-for`/инфра-заголовок), НЕ первому `x-forwarded-for`. Иначе все IP-лимиты/гео-правила обходятся. | A-7, `rateLimiter.ts:195` | 11,13,16,35,38,55 |
| S-2 | **CSP enforced + nonce:** перейти с Report-Only на `Content-Security-Policy`, убрать `unsafe-inline`/`unsafe-eval` (nonce + strict-dynamic). До этого — stored/reflected XSS = угон сессии в чате/платежах. | A-1, `next.config.ts:10,73` | 13,30,35 (+все) |
| S-3 | **Идемпотентность вебхуков по `event.id`:** таблица processed-events; обработка в одной транзакции с записью id; повтор → no-op. Текущая идемпотентность billing держится на статусе строки — для escrow/refund/payout недостаточно. | webhook-код | 10,13 |
| S-4 | **fail-closed `checkUserBlocked`** на всех high-risk write-путях (create-advert, create-deal, pay, payout, publish, moderation-mutate). | A-3, код | 10,13,16,38 |
| S-5 | **Column-lock RLS:** все денежные/статусные/trust-колонки новых таблиц — service-role-write only (revoke insert/update у authenticated/anon); доступ участников через SECURITY DEFINER predicate. RLS = row-, не column-security. | `20260627230000` | 10,11,13,55 |
| S-6 | **Роли модератор/админ — только из `app_metadata`** (анти-эскалация), service-role на mutate, иммутабельный аудит решений. | прошлый аудит C1 | 11,38,17 |
| S-7 | **Server-side authorization денежных переходов:** сверка суммы/получателя/статус-перехода с PSP; payout только на verified-KYC seller сделки. | — | 10,11,13,55 |
| S-8 | **Signed-URL не утекает:** evidence/media отдаются коротким per-request signed-URL только авторизованной стороне; путь объекта не публикуется в метаданных/OG (урок A-2). | A-2 | 11,17 |
| S-9 | **DSAR-реестр:** каждая новая PII-таблица регистрируется в export+delete; retention-расписание по типам; финансы → анонимизация. | — | 10,11,13,16,17,55 → 41 |
| S-10 | **Image-processing safety:** лимиты bytes/megapixels, таймаут, изоляция, обработка только из доверенного storage (анти-SSRF), strip EXIF. | — | 17 |
| S-11 | **Rate-limit на media-роуты** (`sign`/`complete` per-user, `public` per-IP). | A-4, код | 17 |
| S-12 | **OIDC-hardening itsme** (state/nonce/signature/redirect_uri) + `itsme_sub` unique + коллизия-реджект + linking за step-up. | код (нет sub-колонки) | 30,55 |

---

## 12. Таблица рисков и вердиктов

| PRD | Главные угрозы | Макс. риск | Вердикт | Блокер до sign-off |
|-----|----------------|-----------|---------|--------------------|
| 10 Escrow | replay вебхуков, authorization суммы/получателя, AML/NBB | **Critical** | **⛔** | Комплаенс-гейт (письм.) + механизм идемпотентности event-id + server-side authorization денег в PRD |
| 11 Disputes | роль модератора, IDOR evidence, race заморозки, refund-abuse | **High** | **🔄** | Атомарная заморозка release + RLS evidence + `app_metadata`-роль |
| 13 In-chat pay | authorization суммы/получателя, replay, фишинг-ссылки, спуф-карточки | **Critical** | **⛔** | Наследует гейт PRD-10 + authorization + native-card только из server-entity |
| 16 ATO | спуфабельный IP-гео, fail-open block, payout-change | **High** | **🔄** | S-1 (серверный IP) как предусловие + payout fail-closed gate |
| 17 Image-verif | image RCE/SSRF, нет rate-limit media, EXIF-PII | **High** | **🔄** | S-10 + S-11 в PRD |
| 30 Identity | нет `itsme_sub` в схеме, OIDC replay, link-ATO | **High** | **🔄** | S-12: добавить `itsme_sub` unique + OIDC-hardening в PRD |
| 35 Chat | scrub-обход (сигнал), stored XSS, retention | **Med** (High=XSS) | **🔄** | Зависимость от S-2 (CSP) + Realtime-RLS подтвердить |
| 38 Moderation | fraud-engine не подключён, fail-open, brigading | **High** | **🔄** | Реальный call-site `fraud-detection` + fail-closed + `app_metadata`-роль |
| 41 GDPR | неполнота DSAR при росте сущностей, DSAR-auth | **High** | **🔄** | S-9: DSAR-реестр как acceptance для новых PII-таблиц |
| 55 Referrals | self-referral/мульти-акк, кольца, clawback | **High** | **🔄** | Зависит от S-12 (sub-uniqueness) + clawback + серверный IP |

**Итог:** ✅ — 0; 🔄 — 8 (11,16,17,30,35,38,41,55); ⛔ — 2 (10,13).

---

## 13. Приоритет правок (для довода PRD до airtight)

1. **Блокеры комплаенса/денег (до любого кода escrow):** PRD-10 §8 — письменный NBB/AML-гейт как hard-gate; §5/DoD — механизм идемпотентности по `event.id` + server-side authorization денежных переходов; то же отразить в PRD-13.
2. **Сквозные предусловия (чинить в коде до фич зоны):** S-1 (серверный IP), S-2 (CSP enforced+nonce), S-3 (processed-events), S-4 (fail-closed). Без них PRD 13/16/35/38 строятся на дырявом фундаменте.
3. **Схемные пробелы:** S-12 — добавить `itsme_sub` unique (PRD-30), иначе PRD-30 DoD и PRD-55 анти-абуз нереализуемы.
4. **Проводка анти-фрода:** PRD-38 — реальный вызов `fraud-detection` (сейчас 0 call-site).
5. **DSAR-реестр (PRD-41):** сделать acceptance-критерием для каждой новой PII-таблицы.
