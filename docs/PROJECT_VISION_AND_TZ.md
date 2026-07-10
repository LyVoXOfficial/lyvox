> [!NOTE]
> **Исторический стратегический снимок от 2026-06-05.** Он сохраняет исходную продуктовую гипотезу, но не определяет текущий scope, приоритеты, готовность функций или порядок запуска. Единственный актуальный источник по этим вопросам: [`docs/MASTER_PRODUCTION_TZ.md`](./MASTER_PRODUCTION_TZ.md).

# LyVoX: видение проекта, market fit и техническое задание

Дата: 2026-06-05

## 1. Короткое решение

LyVoX стоит развивать, но не как "ещё одну доску объявлений". В Бельгии уже есть 2dehands/2ememain, Facebook Marketplace, Vinted, bol.com и сильные вертикальные игроки. Свободная ниша не в самом факте публикации объявлений, а в доверенной локальной сделке: проверенный продавец, понятный статус товара, безопасная оплата, встроенная коммуникация, категория с правильными бельгийскими документами и DSA/GPSR/WEEE-compliance по умолчанию.

Рабочая формула продукта:

> LyVoX = trust-first marketplace для Бельгии: C2C/B2C объявления с верификацией, безопасной сделкой, локальными платежами, структурированными категориями и автоматизированным compliance.

Ключевая правка идеи: не запускать сразу весь "универсальный маркетплейс". Запускать узкий MVP на категориях, где доверие и локальные документы дают реальное преимущество: транспорт, электроника, детские/дом/мода как вторичная простая группа. Недвижимость, вакансии, животные, услуги и полноценный B2C лучше выводить позже, потому что там выше юридическая и операционная сложность.

## 2. Что уже есть в проекте

Кодовая база уже ближе к продукту, чем старые README/TODO показывают.

Реализовано или частично реализовано:

- Web app на `Next.js 16`, `React 19`, TypeScript, Tailwind 4, Supabase SSR.
- Публичные страницы: главная, поиск, категории, карточка объявления, профиль продавца, auth/onboarding/legal.
- Защищённые страницы: профиль, мои объявления, избранное, безопасность, биллинг, чат, верификация.
- Admin/moderation: очереди, жалобы, review-эндпоинты.
- API: объявления, медиа, каталог, auth, phone OTP, reports, moderation, chat, favorites, billing, notifications, profile.
- Supabase schema: `adverts`, `media`, `categories`, `profiles`, `phones`, `reports`, `trust_score`, `favorites`, `advert_views`, `conversations`, `messages`, `notifications`, `products`, `purchases`, `benefits`, `moderation_logs`, `fraud_rules`, category-specific tables.
- Бельгийские функции/данные: postcode/region, VAT/CBE, IBAN, IMEI, vehicle/property/job/electronics specifics, safety standards, pet species rules.
- AI/rule-based moderation и fraud detection через Supabase Edge Functions.
- Тесты уже есть, но статус полного прохождения нужно подтвердить после синхронизации документации.

Вывод: проект не на стадии "только идея". Главная проблема сейчас - рассинхрон документации, roadmap и реального кода, плюс несколько критичных продуктовых пробелов.

## 3. Что поправлено сразу

В рамках этого аудита уже внесены низкорисковые исправления:

- Публичный base URL теперь берётся из `NEXT_PUBLIC_SITE_URL` с fallback на старый `NEXT_PUBLIC_BASE_URL`, чтобы совпадать с `.env.example`.
- SEO canonical для category-specific объявлений исправлен с несуществующего `/adverts/...` на реальный маршрут `/ad/...`.
- Из Stripe Checkout убран принудительный `payment_method_types: ["card"]`, чтобы Checkout мог показывать релевантные методы из Stripe Dashboard, включая Bancontact, если он включён и доступен для сессии.
- Добавлена миграция, исправляющая VAT/CBE validator: бельгийский номер с ведущим `0` теперь не ломается.

Проверка после правок: `pnpm typecheck`, `pnpm test` и `pnpm lint` проходят. Остаются предупреждения React `act(...)` в component tests и freshness warning по `baseline-browser-mapping`.

## 4. Market analysis: Бельгия

Гипотеза "Бельгия отстаёт в IT" слишком грубая. Европейская комиссия в Digital Decade 2025 описывает Бельгию как страну с сильной цифровой инфраструктурой, cybersecurity и eID/public services, но с проблемами FTTP в отдельных районах, SME digital uptake и дефицитом продвинутых digital/ICT skills. Значит, рынок не пустой; он скорее консервативный, фрагментированный по языкам и чувствительный к доверию.

Факты рынка:

- У Бельгии высокий уровень цифрового использования: Statbel фиксирует активное ежедневное онлайн-поведение населения и отдельную статистику e-commerce.
- Бельгийские предприятия активно цифровизуются, но SME-уровень неравномерен; AI/cloud/data растут быстрее у крупных компаний.
- На second-hand и marketplace-сделках есть реальный trust gap: Safeonweb прямо предупреждает о fake payment links и second-hand scams.
- Локальные платежи критичны. Bancontact - базовое ожидание для бельгийского checkout; Stripe и Mollie поддерживают Bancontact, а Stripe рекомендует dynamic payment methods для Checkout.
- Регуляторика для marketplace усилилась: DSA требует traceability of traders, GPSR требует интерфейс для product safety/traceability, Recupel с 2025-03-29 вводит явные обязанности online marketplaces по sellers of electronics/EPR.

Практический вывод: LyVoX должен выигрывать не количеством категорий, а качеством безопасной сделки и локальным соответствием правилам.

## 5. Competitor/benchmark analysis

### Бельгия и EU

2dehands/2ememain:

- Сильная сторона: узнаваемость, трафик, бизнес-портал, рекламные пакеты, automotive vertical.
- Слабость/окно: опыт доверия и защиты сделки воспринимается как ограниченный; продукт больше похож на classifieds + ads, чем на managed transaction.
- Что брать: paid placement, business seller tools, category verticals.
- Что не копировать: "объявление и дальше разбирайтесь сами" как основную модель.

Facebook Marketplace:

- Сильная сторона: мгновенная аудитория и social identity.
- Слабость/окно: много scam-паттернов, уход в WhatsApp/фейковые ссылки, слабая локальная compliance-логика.
- Что брать: лёгкий старт, social discovery.
- Что не копировать: сделки вне платформы без доказуемого audit trail.

Vinted:

- Сильная сторона: buyer protection, integrated shipping, release payment после события доставки/окна dispute.
- Слабость/окно: узкая категория, seller protection часто воспринимается спорно.
- Что брать: встроенную доставку, обязательную buyer protection fee, dispute window, payment release rules.

bol.com:

- Сильная сторона: trust, logistics, partner rules, quality teams, AI/data для качества каталога.
- Слабость/окно: это B2C retail, не P2P classifieds.
- Что брать: партнёрские правила, логистику как сервис, quality gates.

### Россия: Avito

Avito показывает, как classifieds превращается в transactional marketplace: доставка, рейтинги, seller service quality, AI/moderation, вертикальные сценарии. Для LyVoX важна не география, а паттерн: покупатель должен видеть не только цену, но и вероятность безопасной сделки.

Что брать:

- Рейтинг продавца как набор сигналов, а не простые звёзды.
- Quality/service score: скорость ответа, отмены, жалобы, подтверждённые сделки, документы.
- Встроенная доставка/оплата и запрет опасных off-platform сценариев.
- AI moderation до публикации + human review.

### Китай: Xianyu/Alibaba ecosystem

Xianyu позиционируется Alibaba как крупнейший C2C marketplace second-hand goods в Китае; важные элементы: community, recycling, authentication, user rating, переход от "товаров" к interactions/services.

Что брать:

- Сделать marketplace не только списком товаров, а потоком доверенных взаимодействий.
- Authentication/verification для дорогих товаров.
- Recommerce/circular economy как часть позиционирования.
- Категорийные product intelligence: подсказки, признаки подделок, типовые риски.

### Индия: OLX/UPI patterns

Индийский рынок полезен как негативный benchmark: быстрые P2P-платежи и WhatsApp/UPI-сценарии дают удобство, но создают высокий fraud pressure. Для LyVoX это аргумент не в пользу "давайте просто дадим Payconiq link", а в пользу in-platform checkout, антифишинговых предупреждений и запрета внешних payment links в чате.

Что брать:

- Mobile-first UX.
- Простое создание объявления.
- Агрессивные антискам-подсказки на момент риска.

Что не брать:

- Свободный обмен payment links/QR без платформенной проверки.
- Сделки, где платформа не видит ни оплату, ни доставку, ни dispute evidence.

## 6. Product vision

### Позиционирование

LyVoX - бельгийский trust-first marketplace для частных и профессиональных продавцов, где каждая категория имеет свои правила, документы и защитные сценарии.

### Целевая аудитория

- Частные продавцы и покупатели в Бельгии, включая экспатов и multilingual users.
- Малые бизнесы и zelfstandigen/independants, которым нужна простая витрина без сложного e-commerce.
- Покупатели дорогих second-hand товаров, которым важны документы, репутация и безопасная оплата.

### Языки

MVP: NL, FR, EN. RU и DE можно поддерживать как интерфейсные языки, но юридические/compliance тексты сначала должны быть качественно готовы на NL/FR/EN. Для Бельгии нельзя ставить RU как один из основных публичных языков продукта, иначе brand perception может сузиться.

### Пять продуктовых столпов

1. Verification: email, phone, optional Itsme/eID, business KBO/CBE/VAT, Recupel для electronics sellers.
2. Safe deal: оплата внутри платформы, dispute window, release rules, evidence trail.
3. Structured categories: транспорт, электроника, недвижимость, jobs и другие категории с обязательными атрибутами.
4. Trust & safety: fraud score, AI moderation, reports, human review, anti-phishing UX.
5. Belgian compliance: DSA trader traceability, GPSR product safety fields, Recupel/WEEE, Car-Pass, EPC/PEB, GDPR retention/DSAR.

## 7. Scope strategy

### Не делать в MVP

- Полный универсальный marketplace на все 9 категорий с одинаковым приоритетом.
- Escrow для всех категорий с первого дня без legal/payment-provider дизайна.
- Jobs как полноценную HR-платформу.
- Недвижимость как конкурент Immoweb с первого релиза.
- Публичное обещание AI-гарантий качества. AI должен помогать модерации, но финальная ответственность и appeal flow должны быть человеческими.

### Делать в MVP

- Публичный каталог и поиск.
- Создание объявления с медиа и category-specific обязательными полями.
- Email + phone verification.
- Профиль продавца, trust score, жалобы.
- Чат внутри платформы.
- Favorites/comparison.
- Billing для paid visibility/boosts.
- Admin moderation + fraud rules.
- Local payments для paid products: Bancontact/card через Stripe dynamic methods или Mollie.
- Явные anti-scam предупреждения: не переходить по внешним payment/shipping links.

## 8. Рекомендуемый roadmap

### Phase 0: Stabilization, 1-2 недели

Цель: убрать риск "зависнуть в плохой идее" и синхронизировать продукт с реальным кодом.

- ~~Зафиксировать этот документ как source of truth.~~ Отменено: актуальный source of truth — `docs/MASTER_PRODUCTION_TZ.md`.
- Обновить README/PLAN/TODO под текущий статус.
- Прогнать `pnpm typecheck`, `pnpm test`, Playwright smoke для ключевых flows.
- Исправить известные тестовые/ESLint blockers.
- Закрыть быстрые несоответствия env/payment/VAT/canonical.
- Составить backlog только из задач, которые ведут к trust-first MVP.

Acceptance:

- Документация не противоречит структуре репозитория.
- Основные проверки либо проходят, либо есть список конкретных failures.
- MVP scope заморожен.

### Phase 1: Trust-first MVP, 4-6 недель

Категории:

- Transport/cars.
- Electronics.
- Home/kids/fashion как низкорисковые простые категории.

Функции:

- Listing creation с обязательными полями и фото.
- Search/filter/sort.
- Chat с rate limiting и report message.
- Seller profile + trust score.
- Phone/email verification.
- Admin moderation.
- Paid boosts через Checkout.
- Bancontact/card/wallets via dynamic payment methods.
- Anti-scam UX в чате и checkout.

Acceptance:

- Покупатель может найти товар, написать продавцу и видеть уровень доверия.
- Продавец может создать объявление без ручной помощи.
- Модератор может снять объявление и обработать жалобу.
- Платёж за boost успешно проходит в test mode.

### Phase 2: Safe Deal, 6-10 недель

Цель: перейти от classifieds к managed transaction.

- Orders/deals layer: `deals`, `deal_events`, `deal_payments`, `deal_shipments`.
- Payment hold/release design с PSP: Stripe Connect/Mollie Connect/другой EU PSP после legal review.
- Dispute workflow: buyer issue window, seller evidence, moderator decision.
- Integrated shipping labels: bpost, Mondial Relay, DPD, DHL depending on cost/API access.
- Rating only after verified transaction.
- No external payment links policy in chat.

Acceptance:

- Деньги не уходят продавцу до fulfilment/release condition.
- Dispute имеет audit trail.
- Рейтинг нельзя накрутить без сделки.

### Phase 3: Belgian compliance & identity, 6-8 недель

- Itsme/eID verification для high-risk sellers.
- KBO/CBE business verification и business profile.
- DSA trader traceability flow.
- GPSR fields для professional product listings.
- Recupel/EPR membership checks for electronics professional sellers.
- Car-Pass fields и документный checklist для used vehicles.
- EPC/PEB checklist для real estate leads, если категория активируется.

Acceptance:

- Business seller не может публиковать regulated listings без нужных данных.
- Marketplace хранит private compliance data безопасно и показывает public trader info там, где нужно.
- Для электроники есть Recupel/EPR decision path.

### Phase 4: Growth & intelligence

- Recommendations/search relevance.
- AI assistant для заполнения объявления, но с human-editable output.
- Fraud model с network features.
- PWA/push notifications.
- Seller analytics.
- Category-specific price insights.

## 9. Техническое задание

### 9.1 Роли

Guest:

- Просматривает каталог, категории, карточки, профили.
- Может начать регистрацию/login.

Registered user:

- Имеет профиль.
- Может добавлять favorites/comparison.
- Может писать в чат только после базовой верификации.

Verified seller:

- Email + phone verified.
- Может публиковать private listings.
- Получает trust score.

Business seller:

- Имеет KBO/CBE/VAT profile.
- Для regulated categories проходит дополнительные проверки.
- Может покупать business/boost products.

Moderator:

- Видит moderation queue, reports, AI/fraud signals.
- Может approve/reject/hide/flag.

Admin:

- Управляет users, roles, products, fraud rules, compliance settings.

Support:

- Видит disputes и limited user context без лишнего доступа к sensitive data.

### 9.2 Functional requirements

Authentication/onboarding:

- Email/password или magic link.
- Phone OTP с rate limit.
- Consent capture: terms, privacy, marketing optional.
- Optional Itsme/eID after MVP.
- User locale stored and used for UI/notifications.

Listing creation:

- Category tree selection.
- Required base fields: title, description, price, currency, location/postcode, condition, seller contact policy.
- Media upload with signed storage and moderation status.
- Category-specific forms.
- Draft/autosave.
- AI helper optional, never auto-publish without user confirmation.

Search/browse:

- Full-text search.
- Filters by category, price, location, condition, seller verification, delivery/safe-deal availability.
- Sort by relevance, newest, price, trusted sellers.
- SEO metadata and canonical routes.

Listing detail:

- Gallery.
- Structured details.
- Seller profile card.
- Trust score explanation.
- Report button.
- Start chat.
- Safety/compliance badges.

Chat:

- Only authenticated users.
- Participant membership enforced server-side.
- Rate limit on send.
- External payment/shipping links detected and warned/blocked based on risk.
- Message reporting.
- Read state and notifications.

Payments/billing:

- Phase 1: payments only for platform products such as boosts/highlight packages.
- Checkout should use dynamic payment methods and support Bancontact where PSP config allows.
- Phase 2: deal payments with hold/release, dispute, refund.
- Webhook idempotency required.

Moderation/fraud:

- AI pre-screen for title/description/media metadata.
- Rule-based fraud scoring.
- Manual review queue.
- Reports from users.
- Audit log for moderator/admin actions.
- Appeal/review path for rejected listings.

Notifications:

- In-app notifications.
- Email for important events.
- Push after PWA phase.
- Quiet hours and unsubscribe/consent logic.

Admin:

- Dashboard for reports, moderation, users, fraud logs.
- Product/benefit configuration.
- Business seller verification status.
- Compliance review queue.

Compliance:

- GDPR: export/delete/anonymise flows, retention schedule.
- DSA: trader traceability data, public trader info where required, complaint/appeal process.
- GPSR: responsible person/manufacturer/warnings fields for professional product listings.
- Recupel: electronics seller EPR membership check or marketplace-assumed obligation decision.
- Car-Pass: used vehicle checklist and evidence field.

### 9.3 Data model additions

Recommended next tables:

- `business_profiles`: `user_id`, `company_number`, `vat_number`, `legal_name`, `address`, `nace_codes`, `verified_at`, `verification_source`.
- `seller_compliance_status`: per category, status, reason, expires_at.
- `verification_events`: method, provider, result, metadata, created_at.
- `compliance_documents`: owner, category, type, storage path, status, expiry.
- `deals`: advert_id, buyer_id, seller_id, status, price, protection_fee, created_at.
- `deal_events`: immutable timeline for payment/shipping/dispute/release.
- `deal_payments`: provider, session/payment intent, status, amount, release status.
- `deal_shipments`: carrier, label, tracking, delivery status.
- `disputes`: deal_id, opened_by, reason, status, resolution.
- `message_risk_flags`: message_id, flag_type, score, action.
- `seller_ratings`: only from completed deals.

### 9.4 Architecture

Current stack remains valid:

- Next.js App Router for web.
- Supabase Postgres/Auth/Storage.
- Supabase Edge Functions for AI/fraud/cron tasks.
- Upstash Redis for rate limiting where already planned/used.
- Stripe for current billing, with a provider abstraction before safe-deal payments.
- Vercel deployment.

Implementation methods:

- Keep service-role Supabase access only inside server-only guarded modules.
- Use database RLS as the last line of defense, not only API checks.
- Treat payment webhooks as source of truth for payment state.
- Use immutable event tables for deals/disputes/moderation.
- Use feature flags for safe deal rollout per category.
- Build compliance checks as category gates before publishing.
- Add provider abstraction before introducing Mollie/Stripe Connect so product logic is not tied to one PSP.

### 9.5 Non-functional requirements

Security:

- RLS on all user-owned tables.
- Rate limits for auth, OTP, chat send, media upload, reports, checkout creation.
- Audit logs for admin/moderation/compliance/payment events.
- No sensitive data in client bundles.

Privacy:

- Explicit consent history.
- Data export/delete.
- Retention schedule for OTP/logs/chat.
- Access control for compliance documents.

Performance:

- Listing/search pages should render quickly with indexed queries.
- Images served via signed/public URLs with optimized sizes.
- Search queries paginated and bounded.

Reliability:

- Idempotent webhooks.
- Retry-safe edge functions.
- Monitoring for failed moderation/payment/notification jobs.

Accessibility/i18n:

- NL/FR/EN first-class.
- DE/RU optional interface language after core flows.
- No hardcoded Russian-only production strings in public flows.

Testing:

- Unit tests for validators and helpers.
- API tests for auth/listing/chat/billing/moderation.
- Playwright smoke for browse -> detail -> login -> post -> chat.
- SQL tests or migration checks for Belgian validators.

## 10. Top risks and decisions

### Risk: too broad category scope

Decision: freeze MVP to 2-3 categories. Treat other categories as inactive or beta.

### Risk: compliance debt

Decision: DSA/GPSR/Recupel gates must be product flows, not only legal text.

### Risk: unsafe P2P payments

Decision: Phase 1 payments only for boosts; Phase 2 safe deal only after PSP/legal design.

### Risk: fake trust score

Decision: ratings/reputation should be based on verified events: completed deals, reports, cancellations, response metrics, verification level.

### Risk: AI overpromising

Decision: AI assists moderation and listing quality; human review remains required for blocking/dispute decisions.

### Risk: multilingual Belgium

Decision: NL/FR/EN quality beats five half-translated languages. RU/DE can exist, but not as the launch positioning.

## 11. Immediate backlog

P0:

- Keep `pnpm typecheck`, `pnpm test` and `pnpm lint` green in CI/release checks.
- Update stale docs/TODO to reflect chat/billing/notifications/fraud already present.
- Replace hardcoded Russian UI strings in production flows.
- Replace `prompt()` OTP UX in post form with a proper modal/component.
- Implement full IBAN mod97 if IBAN is used for seller payouts or verification.
- Add tests for Belgian VAT/CBE validator.

P1:

- Add `business_profiles` and KBO/CBE verification flow.
- Add Recupel/EPR gate for professional electronics sellers.
- Add DSA trader traceability fields and display rules.
- Add message-level anti-phishing detection.
- Add payment provider abstraction.
- Add Playwright smoke for listing creation and chat.

P2:

- Safe deal design and PSP selection.
- Shipping provider integration.
- Itsme/eID onboarding.
- GPSR responsible person/safety fields for professional sellers.
- Seller analytics and recommendations.

## 12. Sources used

- European Commission: [Belgium 2025 Digital Decade Country Report](https://digital-strategy.ec.europa.eu/en/factpages/belgium-2025-digital-decade-country-report)
- Statbel: [ICT and e-commerce in enterprises](https://statbel.fgov.be/en/themes/enterprises/ict-and-e-commerce-enterprises)
- Statbel: [ICT usage in households](https://statbel.fgov.be/en/themes/households/ict-usage-households)
- EUR-Lex: [Regulation (EU) 2022/2065, Digital Services Act](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
- FPS Economy: [CBE Public Search](https://economie.fgov.be/en/themes/enterprises/crossroads-bank-enterprises/services-everyone/consultation-and-research-data/cbe-public-search)
- Safeonweb: [Look out for scammers on online second-hand platforms](https://safeonweb.be/en/news/look-out-scammers-online-second-hand-platforms-0)
- Stripe Docs: [Accept Bancontact payments](https://docs.stripe.com/payments/bancontact/accept-a-payment)
- Stripe Docs: [Manage Checkout payment methods](https://docs.stripe.com/payments/checkout/payment-methods)
- Mollie Docs: [Bancontact](https://docs.mollie.com/docs/bancontact)
- Recupel: [Legal obligations](https://www.recupel.be/en/place-appliances-market/legal-obligations)
- European Commission Safety Gate: [GPSR business obligations presentation](https://webgate.ec.europa.eu/safety/consumers/consumers_safety_gate/obligationsForBusinesses/documents/GPSR-Presentation-website.pdf)
- Car-Pass: [Obligation to provide a Car-Pass](https://www.car-pass.be/en/private-individuals/i-want-to-sell-a-used-vehicle/you-are-obliged-to-provide-a-car-pass-to-the-buyer)
- FPS Economy: [Car-Pass FAQ](https://economie.fgov.be/en/car-pass-frequently-asked)
- Alibaba Group: [Xianyu](https://www.alibabagroup.com/en-US/about-alibaba-businesses-1747081802473799680)
- Vinted: [Buyer Protection](https://www.vinted.com/help/550-kopersbescherming)
- Vinted Belgium: [Shipping methods](https://www.vinted.be/help/234)
- 2dehands Zakelijk: [Business portal](https://www.2dehandszakelijk.be/business-portaal/)
- bol.com: [Background: bol as a platform](https://over.bol.com/en/news/background-bol-as-a-platform/)
