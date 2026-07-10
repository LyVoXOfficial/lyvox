# LyVoX: Production release gates

Дата baseline: 2026-07-10
Статус: обязательная подчинённая спецификация к [MASTER_PRODUCTION_TZ.md](../MASTER_PRODUCTION_TZ.md)

## 1. Что означает Production

У LyVoX нет одного двусмысленного статуса «готово». Есть пять последовательных режимов выпуска.

| Режим                          | Результат                                                                             | Можно до регистрации компании                                 |
| ------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `R0 Technical Ready`           | Код, staging, gates, админка, тесты, monitoring и выключенные adapters готовы         | Да                                                            |
| `R1 Contact-only Production`   | Объявления, поиск, профиль, чат, жалобы и ручная модерация для реальных пользователей | Только после утверждения оператора, privacy/terms и поддержки |
| `R2 Own Revenue`               | Pro, boost и собственные сборы LyVoX                                                  | Нет: company/VAT/accounting/Stripe/terms                      |
| `R3 Contracted Integrations`   | itsme, Stripe Identity, WhatsApp, KYBC, Bpost и подобные сервисы                      | Обычно нет: provider contract/DPA/company                     |
| `R4 Transactional Marketplace` | Оплата товара, escrow, payout, disputes, связанная доставка                           | Нет: F2/F3, PSD2/AML/KYC и письменный sign-off                |

R0 является целью технической работы до регистрации. R1-R4 активируются без архитектурной переделки, но только после своих внешних gates.

## 2. Baseline-аудит 2026-07-10

| Область            | Факт                                                                                                     | Статус  |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------- |
| Локальная сборка   | typecheck, 974 теста, build и lint без errors проходят; lint даёт 213 warnings                           | Жёлтый  |
| GitHub CI          | Workflow исправлен локально; exact-SHA remote run ещё не завершён, history secret scan остаётся красным  | Жёлтый  |
| Защита main        | Активен ruleset: PR + strict `CI Success` + Preview + no force/delete; второй reviewer ещё отсутствует   | Жёлтый  |
| Supply chain       | Production и полный workspace audit: 0 известных advisory; два Google API keys требуют ротации           | Красный |
| CSP                | Рабочий код есть, production остаётся report-only                                                        | Красный |
| Debug/test routes  | `/debug/auth` и `/profile/test-auth` входят в production build и доступны любому вошедшему пользователю  | Красный |
| Health             | `/api/health` отсутствует                                                                                | Красный |
| E2E                | Один stale Playwright spec без dependency/config/script/CI                                               | Красный |
| Staging/restore    | Нет воспроизводимого staging rehearsal и доказанного restore drill                                       | Красный |
| Legal truth        | Публичные legal pages являются draft; operator data pending                                              | Красный |
| Public claims      | Registration обещает identity verification и human support при disabled adapters                         | Красный |
| Capability control | `platform_settings` есть, но production call sites используют sync env flags; admin UI/audit отсутствуют | Красный |
| Email              | Для `lyvox.be` не обнаружены MX/SPF/DMARC, хотя опубликованы contact/privacy адреса                      | Красный |
| Cron               | Конфликтующий root config удалён; канонический `apps/web/vercel.json` сохраняет два ежедневных cron      | Жёлтый  |
| Design             | Есть хорошие tokens/Radix/Onest, но система перегружена gradient/glass/pill/card шаблонами               | Жёлтый  |
| Security proof     | Shannon runbook есть, разрешённый pre-customer run ещё не выполнен                                       | Красный |

Локальная зелёная сборка не перекрывает красные release gates.

## 3. Правило закрытия gate

Gate закрыт только если одновременно:

1. acceptance выполнен;
2. evidence воспроизводится из clean checkout;
3. независимый verifier подтвердил результат;
4. CI на том же commit SHA зелёный;
5. rollback или emergency-off проверен;
6. остаточный риск записан и принят владельцем, если он вообще допустим.

Скриншот, устное утверждение агента или локальный результат на другом SHA не являются достаточным evidence.

## 4. R0 Technical Ready: обязательные P0 gates

### G0. Source of truth

- [ ] `docs/MASTER_PRODUCTION_TZ.md` является единственным статусным мастером.
- [ ] Vision, feature specs, audits и legacy checklists не объявляют собственный текущий статус.
- [ ] Каждый открытый пункт имеет стабильный ID, owner, verifier, acceptance и evidence.

Evidence: link check, repository search по фразам «единый источник», review документации.

### G1. Repository и deploy governance

- [x] Все GitHub Actions используют существующие immutable SHA.
- [x] Gitleaks CLI закреплён version + SHA256, mutable action/tag отсутствует.
- [x] Required CI checks защищают `main`.
- [ ] Production deployment не идёт при красном required check.
- [x] PR, запрет force-push/delete, strict checks и Preview настроены для `main`.
- [ ] Независимый approval обязателен после добавления второго GitHub reviewer.
- [ ] Emergency hotfix procedure сохраняет audit trail и обязательный post-review.

Evidence: успешный CI URL, ruleset export/screenshot, тестовый red-check, который блокирует merge/deploy.

### G2. Dependencies и supply chain

- [x] Нет critical/high production advisory в локальном structured audit.
- [ ] Исключение возможно только с owner, сроком, компенсирующим контролем и доказанной недостижимостью; для critical исключение не допускается.
- [x] Lockfile immutable в CI; Dependabot security updates включены.
- [x] Audit job проверяет structured JSON result, а не grep по слову `next`.
- [ ] Secret scan проходит по истории и текущему diff.

Evidence: `pnpm audit --prod`, CI artifacts, dependency diff и security review.

### G3. Security

- [ ] CSP реально enforced в production; report endpoint остаётся наблюдаемым.
- [ ] Debug/test routes удалены из production либо доступны только admin в non-production.
- [ ] RLS/grants live audit зелёный; sensitive column writes отдельно проверены.
- [ ] Admin требует MFA/step-up; изменения audit-логируются.
- [ ] Rate limit и Turnstile fail closed на risk surfaces.
- [ ] Upload, CSRF, validation, SSRF/redirect и webhook signature regression tests зелёные.
- [ ] Secrets не попадают в browser bundle, logs, HTML, API или Sentry.
- [ ] Incident kill-switch exercise выполнен.

Evidence: focused tests, live-safe headers/smoke, authz report, incident exercise record.

### G4. Shannon pre-customer gate

- [ ] Shannon настроен по `docs/security/shannon-precustomer-runbook.md`.
- [ ] Run выполнен только на LyVoX-owned local/staging с disposable data и явной авторизацией.
- [ ] Каждая находка воспроизведена вручную или отклонена с доказательством.
- [ ] Подтверждённых exploitable critical/high нет.

Shannon запрещён против production, реальных клиентов и payment data.

### G5. Capability и launch-mode safety

- [ ] `platform.launch_mode` существует; default до внешних gates: `contact_only`.
- [ ] В `contact_only` Stripe/escrow/payout API физически недостижимы даже при случайных live keys.
- [ ] Registry и effective resolver соответствуют [CAPABILITY_ACTIVATION_MATRIX.md](CAPABILITY_ACTIVATION_MATRIX.md).
- [ ] Admin settings, blocking reasons, health, audit и emergency off работают.
- [ ] Нет production business call sites с прямым sync env flag.
- [ ] Public copy зависит от effective capability.

Evidence: unit/contract/E2E на OFF, missing key, legal block, provider down, ON и emergency off.

### G6. Product core

Критические потоки должны работать без ручного вмешательства разработчика:

- [ ] registration, login, logout, reset/magic link, consent;
- [ ] profile view/edit, privacy export, account deletion;
- [ ] create, draft, upload, edit, publish, remove listing;
- [ ] category/search/filter/sort/pagination/detail;
- [ ] favourite/saved search;
- [ ] contact/chat, reconnect, send retry, block/report;
- [ ] moderation queue, approve/reject, user appeal/contact;
- [ ] admin operator can handle a full abuse case;
- [ ] all expected email/in-app notifications have delivery/fallback.

Нет «happy-path only»: permission, offline, timeout, duplicate, stale data и partial failure проверены.

### G7. Automated quality

- [ ] `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` зелёные в CI.
- [ ] Lint warnings имеют budget и не растут; high-risk files не содержат new warnings.
- [ ] Playwright установлен, имеет config, scripts, deterministic fixtures и CI job.
- [ ] E2E покрывает G6 минимум в Chromium; critical auth/listing/chat/admin smoke также в Firefox/WebKit.
- [ ] Flaky test автоматически не ретраится до зелёного без отдельного отчёта.
- [ ] DB migrations проверяются на empty и production-like schema.

### G8. Accessibility, localisation и design truth

- [ ] Выполнен [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md), включая anti-AI запреты.
- [ ] Axe: 0 critical/serious на критических страницах.
- [ ] Keyboard-only, focus, dialogs, 44px touch targets и 400% zoom проверены.
- [ ] Нет horizontal scroll при 320px.
- [ ] EN/FR/NL/DE/RU имеют key parity, нет raw keys и случайного English.
- [ ] Visual baselines есть на 390x844, 768x1024, 1440x900, light/dark.
- [ ] UI не обещает trust, identity, disputes или payments, которых нет.

### G9. Reliability и observability

- [ ] Public liveness endpoint не раскрывает конфиг.
- [ ] Private/admin readiness различает core failure и optional degradation.
- [ ] Uptime monitor проверяет реальный public journey, а не только HTTP 200.
- [ ] Sentry release tags, source maps, PII scrub и alert ownership работают.
- [ ] Error, latency, saturation, queue/cron lag и quota dashboards существуют.
- [ ] Alert проверен test event; есть escalation и quiet-hours policy.
- [ ] Target SLO и error budget утверждены после baseline, не выдуманы заранее.

### G10. Cron и background jobs

- [ ] Один канонический manifest расписаний; конфликтующие Vercel configs устранены.
- [ ] Каждый job: auth, distributed lock, idempotency, timeout, retry policy и last-success.
- [ ] `maintenance-cleanup` не доступен анонимно и проверяет job secret/identity.
- [ ] Translation, saved alerts, VIES и cleanup имеют видимость в admin/monitoring.
- [ ] Частичный сбой не теряет работу молча и не рассылает дубликаты.

### G11. Staging, migrations, backup и disaster recovery

- [ ] Staging изолирован от production, использует disposable synthetic data.
- [ ] Preview/staging не отправляет реальные emails/SMS/payments.
- [ ] Migration forward и documented rollback/roll-forward rehearsed.
- [ ] Database backup policy покрывает RPO/RTO.
- [ ] Restore drill восстановил БД в отдельное окружение, затем прошёл smoke.
- [ ] Storage objects и critical configs включены в recovery scope.
- [ ] Один Vercel config определяет cron и deployment behavior.

### G12. Performance и SEO

- [ ] p75 mobile targets: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 на ключевых templates.
- [ ] Bundle budgets блокируют regression.
- [ ] Search/detail/home не делают unbounded expensive queries.
- [ ] Canonical, hreflang, sitemap, robots и JSON-LD валидны и не ведут на 404.
- [ ] Draft/private/sold visibility и indexing rules проверены.
- [ ] Cache invalidation доказана после edit/moderation/delete.

### G13. Privacy, legal truth и support readiness

Для R0 код и шаблоны готовы; для R1 данные должны быть реально утверждены.

- [ ] Operator entity model не содержит fake placeholder в public release.
- [ ] Terms/privacy/imprint не называют себя draft.
- [ ] RoPA, DPIA trigger, DPA register, retention и deletion jobs связаны с кодом.
- [ ] DSA notice/action/appeal flow и point of contact определены.
- [ ] Cookie consent действительно управляет optional analytics.
- [ ] `contact@`/`privacy@` принимают и отправляют письма; MX/SPF/DKIM/DMARC проверены.
- [ ] Support owner, moderation hours, abuse SLA и escalation описаны честно.

### G14. Release rehearsal

- [ ] Clean staging deployment с production-like config.
- [ ] Все migrations, smoke, E2E, visual/a11y и security gates прошли на одном SHA.
- [ ] Rollback deployment и emergency switches отрепетированы.
- [ ] Release owner заполнил Go/No-Go, verifier повторил evidence.
- [ ] Post-deploy smoke и наблюдение завершены без stop-ship.

## 5. R1 Contact-only Production

R1 требует все G0-G14 плюс:

- [ ] юридически идентифицированный и одобренный оператор;
- [ ] approved terms/privacy/imprint для активного scope;
- [ ] реальные support/privacy channels;
- [ ] operational moderator и incident owner;
- [ ] no-money invariant проверен из UI и прямыми API requests;
- [ ] все static trust claims заменены фактическими;
- [ ] public launch smoke на production SHA зелёный.

F3/escrow не блокирует R1, потому что money capability выключена и недостижима.

## 6. R2 Own Revenue

R2 требует R1 плюс:

- [ ] company/self-employed registration и bank/tax data;
- [ ] VAT/accounting sign-off, утверждённые цены и refund policy;
- [ ] Vercel/Supabase/provider commercial plans;
- [ ] restricted Stripe live key, webhook secret и products/prices;
- [ ] webhook idempotency, reconciliation и finance audit;
- [ ] paid-ranking disclosure и consumer-facing receipts/invoices;
- [ ] canary activation, rollback и first-real-payment manual reconciliation.

## 7. R3 Contracted Integrations

Каждая интеграция проходит собственный gate:

- [ ] provider contract/account;
- [ ] DPA, data region, retention and subprocessor review;
- [ ] production credentials and callback allowlist;
- [ ] sandbox certification and live-safe smoke;
- [ ] degraded mode and support escalation;
- [ ] exact public claim approved;
- [ ] capability canary and rollback.

itsme/Stripe Identity/WhatsApp/Bpost не включаются одним общим «all integrations» toggle.

## 8. R4 Transactional Marketplace

R4 требует:

- [ ] F2 server-side amount/recipient authorization;
- [ ] F3 written PSD2/AML/provider/NBB conclusion;
- [ ] KYC/KYB, sanctions/AML, retention and incident obligations;
- [ ] escrow/deal/dispute/delivery state machine invariant tests;
- [ ] webhook journal, double-delivery and out-of-order tests;
- [ ] reconciliation, refunds, chargebacks and payout failure operations;
- [ ] support staffing and dispute evidence handling;
- [ ] no confirmed critical/high security finding;
- [ ] controlled real-money pilot with caps and manual review.

## 9. Stop-ship

Любое из ниже означает NO-GO:

- красный required CI или deploy обходит CI;
- critical/high exploitable dependency or Shannon finding;
- production CSP report-only;
- доступный debug/test route;
- незащищённый admin или отсутствующий audit;
- неизвестный backup restore result;
- неработающий support/privacy mailbox;
- public legal placeholder/draft;
- capability обещается, но adapter/keys/legal gate выключены;
- деньги доступны в `contact_only`;
- migration без проверенного recovery path;
- alerting не доставляет тестовое событие владельцу.

## 10. Release evidence record

Для каждого выпуска хранится:

`release mode:
commit SHA:
deployment URL:
owner:
independent verifier:
CI URL:
migrations:
automated evidence:
manual evidence:
open accepted risks:
activation changes:
rollback tested:
Go/No-Go decision and timestamp:`

Статус в master обновляется в том же commit, где добавлено evidence. «Почти зелёный» не является отдельным состоянием.
