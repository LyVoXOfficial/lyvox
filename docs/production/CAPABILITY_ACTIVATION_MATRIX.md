# LyVoX: матрица включения функций и внешних сервисов

Дата проверки: 2026-07-10
Статус: обязательная подчинённая спецификация к [MASTER_PRODUCTION_TZ.md](../MASTER_PRODUCTION_TZ.md)

## 1. Назначение

Этот документ фиксирует, как LyVoX доводит внешний функционал до состояния «вставить ключ, пройти проверку, включить в админке» без хранения секретов в базе и без ложного ощущения готовности.

Production-готовность функции означает не то, что тумблер виден. Она означает, что:

1. рабочий код и отказоустойчивый адаптер существуют;
2. контрактные, интеграционные и негативные тесты зелёные;
3. нужные секреты присутствуют в защищённом хранилище;
4. юридические и тарифные условия выполнены;
5. зависимые сервисы здоровы;
6. функция разрешена для текущего режима выпуска;
7. владелец осознанно включил её в админке;
8. есть проверенный kill-switch и понятный rollback.

## 2. Неподвижные правила

### 2.1 Effective capability

`effective(x) = implemented(x)
  AND adminEnabled(x)
  AND requiredSecretsPresent(x)
  AND externalGatesApproved(x)
  AND dependenciesHealthy(x)
  AND releaseModeAllows(x)
  AND NOT emergencyDisabled(x)`

Любой отрицательный операнд даёт `false`. UI, API, cron, webhook и фоновые задания обязаны использовать один серверный resolver. Спрятать кнопку, оставив доступный API, запрещено.

### 2.2 Где хранятся ключи

- Секреты хранятся только в Vercel/Supabase secret store или другом утверждённом vault.
- `platform_settings` содержит только не-секретный желаемый статус, безопасный конфиг и ссылки на юридические подтверждения.
- Админка показывает только факт наличия ключа, окружение, дату последней проверки и безопасный fingerprint. Значения ключей не читаются и не изменяются через браузер.
- Добавление или ротация ключа не требует изменения кода. При необходимости deploy используется только для доставки обновлённого secret в runtime.

### 2.3 Fail-safe

- Удалён ключ или не пройдена health-проверка: функция становится `BLOCKED_KEYS` или `DEGRADED`, пользователь получает честный fallback, 500 не возникает.
- Ошибка чтения настроек: денежные, identity и admin-функции fail closed. Низкорисковая декоративная функция использует документированный default.
- Emergency switch имеет приоритет над всеми остальными условиями.
- Webhook без валидной подписи никогда не считается health-check.

## 3. Две оси статуса

### Реализация

| Код             | Значение                                                               |
| --------------- | ---------------------------------------------------------------------- |
| `NOT_STARTED`   | Реального адаптера или потока нет                                      |
| `IN_PROGRESS`   | Код неполный или нет обязательных тестов                               |
| `CODE_COMPLETE` | Код, fallback, тесты и runbook готовы, но внешний smoke ещё невозможен |
| `VERIFIED`      | Проверено в разрешённой песочнице или staging реального провайдера     |

### Активация

| Код               | Значение                                                         |
| ----------------- | ---------------------------------------------------------------- |
| `OFF`             | Осознанно выключено владельцем                                   |
| `BLOCKED_KEYS`    | Нет секрета, тарифа, домена или provider account                 |
| `BLOCKED_LEGAL`   | Нет регистрации, договора или письменного sign-off               |
| `BLOCKED_RELEASE` | Функция не разрешена текущим release mode                        |
| `READY`           | Все автоматические и внешние условия выполнены, тумблер выключен |
| `ON`              | Функция реально доступна                                         |
| `DEGRADED`        | Провайдер или зависимость нестабильны, активирован fallback      |
| `EMERGENCY_OFF`   | Сработал аварийный запрет                                        |

`CODE_COMPLETE + BLOCKED_KEYS` является нормальным целевым состоянием до регистрации фирмы. Называть его `VERIFIED` или `ON` запрещено.

## 4. Серверный реестр

Целевой `CapabilityDefinition` содержит:

| Поле                   | Смысл                                                          |
| ---------------------- | -------------------------------------------------------------- |
| `id`                   | Стабильный идентификатор из union-типа                         |
| `group`                | Core, Trust, Communication, Revenue, Money, Growth, Operations |
| `risk`                 | low, medium, high, regulated                                   |
| `implementationStatus` | Статус реализации с evidence                                   |
| `requiredEnvAll`       | Все обязательные переменные                                    |
| `requiredEnvAny`       | Хотя бы один допустимый provider-набор                         |
| `externalGates`        | Company, legal, DPA, VAT, PSD2/AML, provider contract          |
| `allowedReleaseModes`  | R0/R1/R2/R3/R4                                                 |
| `healthCheck`          | Безопасная server-only проверка                                |
| `fallback`             | Что видит пользователь при недоступности                       |
| `killSwitch`           | Способ немедленного отключения                                 |
| `runbook`              | Ссылка на активацию и rollback                                 |

Обязательные guard-тесты:

- каждый `Capability` из `apps/web/src/lib/capabilities.ts` присутствует в реестре;
- каждый обязательный env описан в `.env.example` и `apps/web/src/lib/env.ts`;
- прямые production-вызовы `isCapabilityEnabled()` вне нового resolver-слоя запрещены;
- server route и UI используют один effective status;
- все регулируемые capability по умолчанию выключены.

## 5. Текущая матрица

### 5.1 Базовая платформа

| ID                   | Назначение                        | Текущая реальность                              | Цель до R0                                                   | Условие коммерческого запуска                                                  |
| -------------------- | --------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `core_supabase`      | Auth, Postgres, Storage, Realtime | Работает, не является тумблером                 | Readiness-check, backup policy, restore drill, quota alerts  | Production-план с резервными копиями и подтверждённым восстановлением          |
| `core_vercel`        | Hosting, functions, deploy        | Сайт развёрнут                                  | Один канонический config, staging, rollback, deployment gate | Не Hobby: официальный Hobby разрешён только для personal/non-commercial        |
| `rate_limits`        | Upstash Redis                     | Обязателен и fail closed в production           | Health, quota alert, outage exercise                         | План/архитектура с приемлемыми SLA, HA и encryption-at-rest                    |
| `bot_protection`     | Cloudflare Turnstile              | Код есть, ключи обязательны для реальной защиты | Hostname-bound keys, server verification, negative E2E       | Free plan допустим для большинства production apps по официальной документации |
| `error_tracking`     | Sentry errors/tracing             | Код есть, включение capability                  | PII scrub, release tags, alert routing, quota-loss alert     | Тариф выбирается по retention, alerting и командному доступу                   |
| `analytics_insights` | Vercel/product analytics          | Частично                                        | Consent-aware events, data dictionary, no fake KPI           | DPA/consent/retention подтверждены                                             |
| `scheduled_jobs`     | Vercel cron                       | Конфиги расходятся                              | Один config, `CRON_SECRET`, idempotency, cron monitor        | Тариф поддерживает нужную частоту и длительность                               |

### 5.2 Бесплатно или без компании можно подготовить сейчас

| ID                      | Provider/механизм             | Можно сделать до фирмы                                                     | Нельзя считать готовым без                                                      |
| ----------------------- | ----------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `bot_protection`        | Cloudflare Turnstile          | Создать widget, подключить site/secret keys, проверить login/register/OTP  | hostname verification и production smoke                                        |
| `error_tracking`        | Sentry Developer              | Подключить проект, scrub PII, release/source maps, один uptime monitor     | alert ownership и контроль квоты                                                |
| `email_inbound`         | Cloudflare Email Routing      | Настроить входящие `contact@`/`privacy@` на подтверждённый ящик            | MX/SPF/DKIM/DMARC и end-to-end reply test                                       |
| `email_outbound`        | Resend free/dev               | Подтвердить домен, отправить test/staging письма, проверить bounce webhook | юридический sender, production volume, suppression/unsubscribe и deliverability |
| `business_vies`         | EU VIES                       | Проверять VAT без API key, с retry и audit evidence                        | корректная юридическая интерпретация результата                                 |
| `web_push`              | Web Push/VAPID                | Сгенерировать ключи, реализовать subscription lifecycle                    | consent UX, expiry cleanup, browser E2E                                         |
| `integration_contracts` | Local fakes/official fixtures | Полностью проверить adapters, timeouts, retries, signatures                | реальный provider sandbox smoke                                                 |

Это не юридическая гарантия доступности аккаунта физлицу. Условия provider проверяются владельцем ещё раз в день активации.

### 5.3 Коммуникации

| Capability            | Реализация сейчас                                            | Обязательные секреты                                     | Внешние гейты                      | Цель                                                                       |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `email_notifications` | Resend/SendGrid HTTP sender есть, env и эксплуатация неполны | Один provider key + `EMAIL_FROM`; DNS records            | privacy/retention, sender identity | `VERIFIED + READY` до R1                                                   |
| `saved_search_alerts` | Cron и sender существуют                                     | Email provider + `CRON_SECRET`                           | consent/preferences                | `VERIFIED + READY` до R1                                                   |
| `whatsapp_otp`        | Только disabled adapter                                      | Provider account/keys/template config                    | contract, privacy, messaging rules | `CODE_COMPLETE + BLOCKED_KEYS` до фирмы                                    |
| `sms_otp`             | Twilio-вызовы существуют напрямую                            | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | sender/number, DPA, budget         | Перевести в adapter, `VERIFIED + READY` перед обещанием phone verification |
| `web_push`            | Capability объявлена, поток неполный                         | VAPID public/private                                     | consent, browser support           | `CODE_COMPLETE` до R0, activation после E2E                                |

### 5.4 Trust и identity

| Capability        | Реализация сейчас                                       | Обязательные секреты                                | Внешние гейты                               | Разрешённый release                                            |
| ----------------- | ------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| `stripe_identity` | Disabled adapter, реального клиента нет                 | Stripe Identity credentials/webhook                 | company/account, DPA, identity legal basis  | R3                                                             |
| `itsme`           | Флаг и модель данных частично, OIDC adapter отсутствует | Client ID/secret, redirect config, signing metadata | itsme contract, company, DPA, approved copy | R3                                                             |
| `whatsapp_otp`    | Disabled adapter                                        | Provider credentials                                | contract/company as required                | R3                                                             |
| `business_vies`   | Реальный keyless VIES client есть                       | Нет                                                 | KYBC process and human fallback             | R1 для информационной проверки, R3 для verified-business claim |
| `trust_score`     | Формула/данные частично                                 | Нет                                                 | fairness/explainability review              | R1 только без ложного identity claim                           |

Публичные слова «verified identity», «одна личность на человека» и аналогичные обещания рендерятся только из effective capability и доказанного уровня пользователя.

### 5.5 Доход LyVoX

| Capability          | Реализация сейчас                                 | Обязательные секреты                            | Внешние гейты                                     | Разрешённый release |
| ------------------- | ------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------- | ------------------- |
| `pro_subscriptions` | Stripe route/webhook есть, async gate не завершён | restricted Stripe key, webhook secret, price ID | company, VAT/accounting, approved terms/refunds   | R2                  |
| `boost_ranking`     | Флаг есть, billing/ranking требуют общей проверки | Stripe product/price + webhook                  | company, VAT, transparent paid-ranking disclosure | R2                  |
| `stripe_tax`        | Планируется                                       | Stripe Tax config                               | VAT registration and tax sign-off                 | R2                  |

До R2 UI и API недостижимы. Тестовые Stripe keys используются только в staging/test; live keys не делают функцию разрешённой без legal gates.

### 5.6 Деньги между покупателем и продавцом

| Capability            | Реализация сейчас                              | Ключи                                  | Внешние гейты                                                | Разрешённый release            |
| --------------------- | ---------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ | ------------------------------ |
| `payments_escrow`     | Disabled `PaymentsAdapter`                     | Connect/provider credentials, webhooks | F2, F3, PSD2/AML, KYC, disputes, sanctions, written sign-off | Только R4                      |
| `seller_payouts`      | Контракт слишком узкий, live provider запрещён | Provider payout credentials            | те же F2/F3 + server-side recipient authorization            | Только R4                      |
| `integrated_delivery` | Спецификация, нет production adapter           | Bpost/PUDO credentials                 | contract, liability, returns/refunds                         | R4 или отдельный R3 без оплаты |

До закрытия F3 допускаются schema, state machine, provider interface, deterministic simulator и contract tests. Live money movement и код, который можно случайно включить одним ключом, запрещены.

### 5.7 Growth и AI

| Capability            | Реализация сейчас                                  | Ключи                       | Гейты                                         | Цель                                  |
| --------------------- | -------------------------------------------------- | --------------------------- | --------------------------------------------- | ------------------------------------- |
| `discover_v2`         | Частично                                           | Нет                         | product/visual E2E                            | R1 после core flows                   |
| `advert_translations` | Cron есть, provider/config не канонизированы       | approved model/provider key | cost cap, privacy, quality sampling           | `CODE_COMPLETE + READY`               |
| `ai_moderation`       | Edge/function элементы есть, runtime truth неполна | model/provider key          | human appeal, false-positive review, DPA/DPIA | assistive only до доказанной точности |
| `ai_listing`          | Будущее                                            | model/provider key          | consent, provenance, cost cap                 | P2                                    |
| `ai_price`            | Будущее                                            | model/provider key          | explainability, no guarantee copy             | P2                                    |

AI никогда не используется как декоративное обещание. Если результат может ограничить пользователя, обязателен human review/appeal и audit trail.

## 6. Требования к `/admin/settings`

Для каждой capability администратор видит:

- понятное имя и один абзац влияния на пользователя;
- implementation и activation status отдельно;
- желаемый toggle и effective status;
- недостающие условия без раскрытия секретов;
- разрешённые release modes;
- last health check, latency и безопасное сообщение об ошибке;
- дату и автора последнего изменения;
- ссылку на runbook, evidence и provider dashboard;
- кнопку smoke-check, если она не совершает необратимое действие;
- emergency off для high/regulated функций.

Правила изменения:

- только server-side admin authorization;
- MFA/step-up для high/regulated;
- append-only audit log before/after/reason/actor/request ID;
- подтверждение для включения revenue/identity;
- legal gate нельзя выставить обычным toggle без ссылки на подписанный артефакт;
- bulk enable запрещён;
- секретные значения, access tokens и webhook payloads в UI не выводятся.

## 7. Founder activation runbook

1. Зарегистрировать оператора и заполнить канонический `legal/entity`.
2. Утвердить legal/privacy/terms и применимые DPA/DPIA/DSA/VAT документы.
3. Перевести Vercel и Supabase на production-подходящие планы.
4. Настроить рабочие входящие адреса, outbound domain, SPF, DKIM и DMARC.
5. Создать provider accounts и ограниченные production keys.
6. Внести ключи в secret store для staging, затем production; в БД ключи не копировать.
7. Запустить env audit и увидеть ожидаемые статусы `READY`.
8. Прогнать provider sandbox/live-safe smoke и webhook signature tests.
9. Проверить audit log, emergency off и fallback удалением тестового ключа.
10. Включить одну capability на canary-аудиторию или минимальный scope.
11. Наблюдать ошибки, latency, delivery и бизнес-метрики установленное окно.
12. Расширить доступ либо выполнить rollback по runbook.

## 8. Acceptance criteria для FLAG-блока

- [ ] `FLAG-02`: декларативный registry покрывает 100% capability и обязательных env.
- [ ] `FLAG-06`: production call sites не читают sync env-флаг напрямую.
- [ ] `FLAG-03`: админка показывает обе оси и все blocking reasons.
- [ ] `FLAG-04`: каждое изменение имеет неизменяемый audit record.
- [ ] OFF и missing-key проверены E2E: ни один скрытый API не активен.
- [ ] Удаление optional key не вызывает 500 и создаёт alert.
- [ ] Money/identity не активируются без external gate record.
- [ ] Runtime-изменение распространяется на все instances не позднее 60 секунд.
- [ ] Публичные claims зависят от effective capability.
- [ ] Для каждой high/regulated функции существует activation и rollback runbook.

## 9. Проверенные внешние источники

Условия меняются; ниже зафиксирован срез на 2026-07-10:

- Vercel Hobby: personal/non-commercial only: https://vercel.com/docs/plans/hobby
- Supabase pricing и наличие backup на Pro: https://supabase.com/pricing
- Supabase backups: https://supabase.com/docs/guides/platform/backups
- Upstash Redis free tier и production add-ons: https://upstash.com/pricing
- Cloudflare Turnstile Free: https://developers.cloudflare.com/turnstile/plans/
- Cloudflare Email Routing: https://developers.cloudflare.com/dns/manage-dns-records/how-to/email-records/
- Resend free/dev limits и domain auth: https://resend.com/pricing
- Sentry Developer plan: https://sentry.io/pricing/

Перед коммерческой активацией владелец повторно проверяет актуальные Terms, DPA, регион хранения, лимиты и допустимость использования.
