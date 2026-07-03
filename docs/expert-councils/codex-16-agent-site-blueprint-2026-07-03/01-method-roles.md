# Method And Roles

## Исходный бриф

Пользователь попросил провести тот же тип экспертного совета, который начал Claude Code, но в отдельной папке, чтобы потом сравнить результаты. Уточнение пользователя:

- проверку на Samsung не делать;
- нужен только экспертный совет, где Codex дирижирует;
- для каждого агента использовать модель `GPT 5.5 very high`;
- специалисты должны спорить между собой до решения;
- обсуждать не только структуру и маркетинг, но и дизайн вплоть до шрифта.

## Контекст проекта

LyVoX MarketPlace - Belgium-focused multilingual C2C/B2C trust-first marketplace. Текущая фаза - contact-only: нельзя обещать escrow, payment protection, buyer protection или platform-handled payment до закрытия PSD2/AML/legal gates.

Ключевые вводные из проекта и аудитов:

- low liquidity, seed inventory;
- текущая home страница содержит hero/search/stats/carousel stack;
- duplicate search и weak stats вредят доверию;
- product inventory слишком поздно или слишком рассеяно;
- `/search` должен быть buyer workhorse;
- `/ad/[id]` и contact panel - core trust/conversion surface;
- `/post` не должен начинаться с тяжелой verification wall, но publish/contact/index gates обязательны;
- `en/fr/nl/de/ru` должны быть first-class locales;
- дизайн сейчас использует Onest + Geist Mono, teal/mint/amber tokens.

## Модель совета

Использован 16-agent council:

1. Growth / CRO
2. SEO / Information Architecture
3. Mobile UX / Buyer Task Flow
4. Trust Psychology / Behavioral Design
5. Legal / DSA / GDPR / Consumer Rights
6. Marketplace Liquidity / Cold Start
7. Visual Brand / High-end Product Design
8. Typography
9. Design System
10. Performance / Core Web Vitals
11. Accessibility / EAA / WCAG
12. i18n / Localization / Belgium Regions
13. Fraud / Trust & Safety
14. Monetization / Pro / Paid Placement
15. UX Copy / Trust Messaging
16. Competitive Strategy

Каждый агент работал на `gpt-5.5` с `xhigh` reasoning effort.

## Фазы

1. **Independent positions** - 16 независимых позиций без взаимного якорения.
2. **Debate** - агенты получили общий digest и спорили по конфликтам:
   - Onest vs IBM Plex/Geist/Noto;
   - 6-8px radii vs текущая 20/13/9 система;
   - trust strip до listings vs listings first;
   - no-escrow disclosure в hero vs decision points;
   - safety filters и риск over-fragmentation;
   - paid placement и Pro при low liquidity;
   - какие текущие home modules cut/transform.
3. **Synthesis** - дирижерский синтез в один blueprint.
4. **Vote + required fixes** - агенты голосовали `approve`, `approve with required fixes`, `block`. Блокеров не было. Required fixes внесены в финальный blueprint.

## Что изменилось после дебатов

Первичный консенсус "trust-first" был сильно уточнен. Совет отклонил вариант "trust explainer with listings attached". Финальная формула:

- trust-first значит credible/contactable listings first;
- trust не отдельный billboard, а ranking, metadata, seller status, report/block, contact panel и chat safety;
- first proof grid organic и quality-ranked;
- contact-only/no payment disclosure не H1 alarm, но обязательно до contact/chat/payment expectation;
- safety filters не default-on на тонком рынке;
- Pro и paid placement не должны загрязнять первый proof grid.
