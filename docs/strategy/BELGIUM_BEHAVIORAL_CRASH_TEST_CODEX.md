# Belgium Behavioral Crash-Test - Codex Execution

Дата: 2026-07-03  
Авторская роль: Codex, CTO / верховный системный архитектор LyVoX  
Адресат: Claude / Fable 5  
Статус: **исполненный synthetic-customer crash-test для сравнения с независимым тестом Fable5**

## 0. Режим Теста

Это не аудит текущего незавершенного UI.

В этой симуляции считаем, что целевое состояние проекта уже выполнено:

- вертикальные категории и фильтры работают;
- `/post` перестроен в фото-first flow;
- переводы объявлений и чатов работают с маркировкой generated/reviewed;
- privacy-visible Store of One работает без скрытого профилирования;
- price intelligence работает через median/IQR/backoff и real non-seed thresholds;
- trust labels, trader disclosure, safety copy и structured offers уже реализованы;
- SEO/AEO/JSON-LD/category pages приведены к требованиям;
- мобильный performance budget соблюден;
- seed-данные исключены из trust, median, JSON-LD, social proof.

Задача теста: найти системные провалы, которые останутся даже при формально выполненных ТЗ, если продукт встретится с реальным бельгийским поведением.

Вердикт CTO: **готовая платформа проходит базовый trust-test, но не проходит безусловный liquidity-test.** Главные остаточные риски: explainability, multilingual edge cases, abuse in negotiation, pro-seller workflow, thin-data price guidance, accessibility under stress.

## 1. Метод

Каждый агент прошел один сценарий:

1. Вход в продукт с конкретной задачей.
2. Поиск или публикация.
3. Открытие карточки.
4. Контакт/оффер/сохранение поиска.
5. Проверка trust/privacy/translation/price behavior.
6. Итог: сделка возможна или нет.

Оценки:

- **PASS** - сценарий завершился без deal blocker.
- **CONDITIONAL PASS** - сделка возможна, но есть риск оттока или юридического/операционного долга.
- **FAIL** - без доработки агент не заключает сделку.

## 2. Agent A - Pieter, Flemish Local Privacy Maximalist

### Профиль

- Регион: Geel / Kempen.
- Язык: nl-BE, английский терпит, французский раздражает.
- Цель: купить cargo bike в радиусе 20 км.
- Поведенческий триггер: любое неочевидное ранжирование = скрытый tracking.
- Нетерпимость: cookies, dwell tracking, "AI selected for you" без объяснения.

### Future-State Journey

1. Открывает `/nl/search?q=bakfiets&location=Geel&radius=20`.
2. Включает "Alleen lokaal".
3. Открывает три объявления.
4. Возвращается в фид и видит изменившийся порядок.
5. Нажимает "Waarom deze volgorde?"
6. Выключает session personalization.
7. Повторяет поиск.

### Что сработало

- Локальный радиус и явная граница "within 20 km" снимают главный страх: сайт не тащит его в Brussels/Gent без спроса.
- Кнопки "Why this order?" и "Reset session preferences" превращают AI-рекомендации из черного ящика в управляемую функцию.
- При `PersonalizationMode=off` порядок результатов стабилен. Это критично.
- Dutch-first интерфейс без англоязычных fallback-key делает продукт местным.

### Что сорвалось

- Формулировка "session-only personalization" все равно звучит технически. Для него это "tracking, just renamed".
- Если outside-radius fallback показывается в том же списке, он воспринимает это как нарушение обещания.
- Он не понимает, какие события остаются в analytics при выключенной персонализации.
- Сохранение поиска требует email/push consent слишком рано: воспринимается как сбор данных.

### Deal Blocker

Сделка возможна только если есть режим:

> "Strict local mode: no personalization, no cross-session memory, no results outside selected radius unless I open them manually."

### System Gaps

| Gap | Severity | Причина |
|---|---:|---|
| Privacy copy слишком технический | P0 | Privacy-фобия не лечится точностью типов; нужен понятный язык |
| Outside-radius fallback смешивается с результатами | P0 | Нарушает обещание локальности |
| Analytics boundary не виден пользователю | P1 | Даже легальная аналитика выглядит как скрытый tracking |
| SaveSearch consent появляется до доверия | P1 | Ранний email/push prompt снижает trust |

### Architecture Correction

- Добавить `StrictLocalMode` поверх `PersonalizationMode`.
- Любой fallback за радиусом рендерить отдельным блоком: "Buiten je straal - toon toch".
- Privacy explanation должна показывать три строки:
  - "We onthouden dit niet voor je volgende bezoek."
  - "We verkopen dit niet aan adverteerders."
  - "Je kunt de volgorde resetten."
- SaveSearch CTA сначала объясняет ценность, потом просит канал уведомления.

### Acceptance Criteria

- E2E: `strict_local=true` никогда не возвращает inline результаты за радиусом.
- E2E: `PersonalizationMode=off` не меняет sort order после открытия карточек.
- Network assertion: no per-card dwell/rank payload emitted when personalization is off.
- i18n: Dutch privacy copy не содержит raw technical terms `sessionStorage`, `dwell`, `personalization`.
- UX: outside-radius блок имеет отдельный heading и не считается в visible result count.

### Verdict

**CONDITIONAL PASS.** Покупка возможна, но только если privacy controls написаны человеческим nl-BE языком и strict local работает буквально.

## 3. Agent B - Julien, Walloon Car Enthusiast

### Профиль

- Регион: Namur / Charleroi.
- Язык: fr-BE.
- Цель: BMW 5 Series E39 diesel, запчасти кузова и диски.
- Поведенческий триггер: неверная совместимость = платформа не понимает машин.
- Нетерпимость: продавец пишет на нидерландском; фильтры не знают generation/body/fuel.

### Future-State Journey

1. Открывает `/fr/c/transport/voitures`.
2. Выбирает BMW -> 5 Series -> E39.
3. Фильтрует diesel, manual/automatic, wagon/sedan, year 1998-2003.
4. Переключается на parts compatibility.
5. Открывает listing фламандского продавца.
6. Включает French translation.
7. Отправляет вопрос в чат с переводом.

### Что сработало

- Generation-level filter - главный trust сигнал.
- Ambiguous generation chooser для переходных годов спасает платформу от грубой ошибки.
- Car-Pass / inspection / damage labels помогают отсеивать мусор.
- Перевод объявления с "show original" работает лучше, чем одноязычный рынок.

### Что сорвалось

- Часть технических терминов переводится правильно, но стиль машинного перевода иногда звучит как consumer copy, а не automotive.
- Compatibility для запчастей недостаточно строгая: "fits E39" без body/engine constraints все еще опасно.
- В чате продавец использует диалект/сокращения; translation confidence не показывается.
- Price intelligence для редких запчастей часто возвращает insufficient data.

### Deal Blocker

Без точного compatibility matrix Julien не покупает запчасти дороже 100 EUR.

### System Gaps

| Gap | Severity | Причина |
|---|---:|---|
| Vehicle parts compatibility ниже уровня авто-фильтров | P0 | Риск физически несовместимой покупки |
| Translation confidence отсутствует | P1 | Техническая сделка требует уверенности в терминах |
| Price guidance не помогает редким parts | P2 | Нужен не median, а "data unavailable + compare manually" |
| Chat translation не показывает glossary hits | P2 | Для нишевой лексики это повышает доверие |

### Architecture Correction

- Ввести `vehicle_part_compatibility` как отдельный контракт, не просто `specifics`.
- Для part listings требовать минимум:
  - make_id;
  - model_id;
  - generation_id;
  - body_type applicability;
  - engine/fuel applicability when relevant;
  - OEM/reference number optional but highlighted.
- Translation pipeline должен возвращать `confidence` and `glossary_hits`.
- Для редких запчастей price block должен говорить: "Недостаточно сопоставимых объявлений; проверьте OEM номер и состояние".

### Acceptance Criteria

- Unit: E39 sedan-only part does not match E39 touring query unless explicitly compatible.
- API: part search supports compatibility constraints without free-text parsing.
- E2E: French user can view Dutch listing with original and translation side by side.
- Translation test: automotive glossary preserves `boîte`, `versnellingsbak`, `moteur`, `motorblok`, `jantes`, `velgen`.
- Price API: rare part returns `insufficient_data` with non-numeric guidance.

### Verdict

**CONDITIONAL PASS.** Автомобили проходят; запчасти требуют отдельной compatibility-модели. Без нее профессиональный авто-сегмент будет ругаться.

## 4. Agent C - Sofia, Brussels Expat Mother In A Hurry

### Профиль

- Регион: Brussels, Ixelles / Etterbeek.
- Язык: English, частично French.
- Цель: продать baby jacket, купить stroller рядом.
- Поведенческий триггер: форма длиннее 2 минут = abandon.
- Нетерпимость: загрузка AI, непонятные цены, лишние поля.

### Future-State Journey

1. Открывает `/en/post` на телефоне.
2. Делает фото baby jacket.
3. Получает category/title/size/condition suggestions.
4. Видит price guidance: "not enough exact data; similar kids jackets often sell faster under X".
5. Подтверждает translation to FR/NL.
6. Публикует.
7. Ищет stroller within Brussels, pickup today.

### Что сработало

- Photo-first flow реально снижает трение.
- AI suggestions полезны, если это именно suggestions, а не auto-publish.
- Быстрый fast_goods mode попадает в ее жизнь.
- Generated translation label не мешает, если original доступен.

### Что сорвалось

- Price guidance "insufficient data" без диапазона все еще оставляет тревогу.
- Baby/kids safety notices могут стать слишком тяжелыми для обычной куртки.
- При плохом WebGPU/мобильной памяти AI assist должен деградировать быстрее: она не ждет.
- Pickup availability не является первоклассным фильтром, хотя для родителей это часто важнее цены.

### Deal Blocker

Покупка stroller срывается, если нельзя отфильтровать "pickup today / this week / easy public transport".

### System Gaps

| Gap | Severity | Причина |
|---|---:|---|
| Pickup urgency не встроена в search/filter | P1 | Для Brussels parents это главный критерий |
| Safety notices не различают risk level | P1 | Куртка и автокресло не должны иметь одинаковую тяжесть |
| AI fallback latency недостаточно жестко задана | P0 | Мобильный abandon начинается через секунды |
| Price fallback слишком сухой | P2 | Нужны actionable alternatives, не только no data |

### Architecture Correction

- Добавить `availability_window` / `pickup_window` как category-agnostic listing field.
- Baby/kids risk tier:
  - low: clothes/toys without critical safety constraints;
  - medium: stroller/high chair;
  - high: car seat, crib, electrical baby devices.
- AI assist timeout budget:
  - if no useful result within 3s on mobile, show manual fallback and continue.
- Price guidance fallback must include action:
  - "List at X if you want fast pickup" only if comparable band exists;
  - otherwise "Start negotiable" / "Use condition and brand in title".

### Acceptance Criteria

- E2E: baby jacket preview reachable in <= 4 required screens.
- E2E: stroller search can filter by pickup window.
- Unit: baby category risk tier changes required safety prompts.
- Performance: AI assist does not block manual progression after 3s.
- UI: no generated price number when sample threshold is not met.

### Verdict

**CONDITIONAL PASS.** Selling flow passes; buying flow lacks pickup urgency as a first-class filter.

## 5. Agent D - Karim, Professional Electronics Reseller

### Профиль

- Регион: Antwerp / Brussels.
- Язык: multilingual, transactional.
- Цель: find underpriced iPhones and laptops, negotiate hard.
- Поведенческий триггер: arbitrage efficiency.
- Нетерпимость: friction unless it blocks other people's abuse, not his.

### Future-State Journey

1. Searches electronics by brand/model/storage/battery/warranty.
2. Sorts by "below median" and new listings.
3. Sends structured low offers to 12 sellers.
4. Tries to paste phone/WhatsApp in chat.
5. Challenges defect description and requests serial/IMEI.

### Что сработало

- Electronics filters are strong enough for buying.
- Structured offer UI avoids messy chat spam.
- Off-platform contact masking protects sellers.
- Seller minimum offer threshold blocks the worst lowball spam.

### Что сорвалось

- "Below median" sorting can become an arbitrage weapon if too visible.
- Rate limiting by account is not enough; pro resellers can distribute behavior across accounts.
- IMEI/serial handling is sensitive: sellers need a safe way to share proof without exposing full identifiers publicly.
- Conflict resolution in chat is not specified; structured offers reduce spam but do not prevent pressure tactics.

### Deal Blocker

For sellers, deal blocker is abuse. For Karim, blocker is inability to make many offers fast. Product must side with seller health, not reseller speed.

### System Gaps

| Gap | Severity | Причина |
|---|---:|---|
| Public underpriced sorting can enable predatory arbitrage | P0 | It drains trust and harms casual sellers |
| Abuse controls need graph/rate patterns, not only per-account limits | P1 | Multi-account pressure will happen |
| Device proof flow missing | P1 | IMEI/serial proof is useful but privacy-sensitive |
| Chat conflict states undefined | P2 | Need decline, mute, report, cooldown |

### Architecture Correction

- Do not expose "sort by below median" publicly.
- Use price labels as context on card/detail, not as a hunt-mode ranking control.
- Add `device_proof` flow:
  - seller can upload/enter partial serial/IMEI proof;
  - public view masks it;
  - buyer sees verification status, not full identifier.
- Add negotiation abuse detection:
  - low offer ratio;
  - repeated declined offers;
  - contact-masking events;
  - reports;
  - cross-ad burst rate.

### Acceptance Criteria

- UI: no public global sort "below median".
- API: structured offers respect per-ad and per-user cooldowns.
- Abuse test: 10 declined offers across ads trigger friction.
- Chat test: off-platform contact is masked; legitimate model/spec strings survive.
- Device proof: full IMEI/serial never appears in public listing HTML/JSON-LD.

### Verdict

**FAIL for seller health unless underpriced hunting is constrained.** Price intelligence must not turn LyVoX into a reseller extraction tool.

## 6. Agent E - Marie, Rural Older Buyer

### Профиль

- Регион: Limburg, outside major cities.
- Язык: Dutch.
- Цель: dining table, simple home goods.
- Поведенческий триггер: fear of scams and confusion.
- Нетерпимость: dense UI, too many badges, fake urgency, tiny text.

### Future-State Journey

1. Searches "eettafel" near her town.
2. Opens listing with generated translation, trust labels, price context.
3. Starts chat.
4. Reads safety prompt.
5. Schedules pickup.

### Что сработало

- Simple seller trust ladder works: "phone verified", "business seller", "new seller".
- Safety copy inside chat is better than blocking before chat.
- Large tap targets and clear location reduce anxiety.
- Generated translation label is okay if it does not dominate.

### Что сорвалось

- Too many trust/AI badges above fold still overwhelm.
- "Price below median" can be interpreted as a platform recommendation, even with disclaimer.
- Safety bottom-sheet is useful only if the first line is plain Dutch.
- If pickup location is vague, she abandons.

### Deal Blocker

No clear pickup location and no simple safety explanation = no contact.

### System Gaps

| Gap | Severity | Причина |
|---|---:|---|
| Badge budget not strict enough | P0 | Trust overload becomes distrust |
| Price labels need safer wording for low-confidence users | P1 | "Below median" sounds endorsed |
| Pickup locality granularity unclear | P1 | Rural buyers need confidence before chat |
| Older-user readability needs hard tests | P0 | Mobile large-font bugs kill this segment |

### Architecture Correction

- Add `BadgeBudget` per surface:
  - card: max 2 badges;
  - detail above fold: max 4 trust/commercial labels;
  - AI labels visually subordinate.
- Replace "below median" with safer copy:
  - "Lower than similar LyVoX listings when enough data is available."
- Listing location must have public granularity:
  - municipality/postcode area;
  - exact address only in chat by seller choice.
- Accessibility tests must include large system font and 360px viewport.

### Acceptance Criteria

- Visual test: at 200% text size no overlap in card/detail/chat.
- Component test: badge budget enforcement returns overflow labels into details section.
- Copy test: banned endorsement words cannot appear in price labels.
- E2E: listing shows municipality/postcode before contact.
- Chat: safety first line appears in Dutch and does not block message send.

### Verdict

**CONDITIONAL PASS.** Core trust works, but badge overload and readability are P0 risks.

## 7. Agent F - Anke, Small Professional Seller

### Профиль

- Регион: Leuven.
- Язык: Dutch/French business reach.
- Цель: sell refurbished phones legally and efficiently.
- Поведенческий триггер: repetitive work and unclear trader obligations.
- Нетерпимость: translation changing warranty claims, opaque boost ranking.

### Future-State Journey

1. Creates business profile with KBO/VAT.
2. Creates electronics template for refurbished phones.
3. Posts ten iPhones with variants.
4. Reviews generated translations.
5. Boosts two listings.
6. Checks ranking explanation and legal disclosures.

### Что сработало

- Business templates save real time.
- Reviewed translation state protects her from silent wording changes.
- Trader disclosure on listing makes obligations clear.
- Promotion label is visible enough to avoid hidden-ad risk.

### Что сорвалось

- Template workflow still assumes one listing at a time; she needs batch variants.
- Translation review across five languages is too heavy without diff view.
- Warranty/refurbished claims need locked glossary, not generic translation.
- Boost report explains spend, but not enough about organic vs paid rank.

### Deal Blocker

Without batch variant creation and translation diff/review queue, pro seller onboarding is too slow.

### System Gaps

| Gap | Severity | Причина |
|---|---:|---|
| Templates lack batch/variant mode | P1 | Pro supply cannot scale |
| Translation review lacks diff/workflow | P1 | Legal/commercial claim risk |
| Warranty glossary not locked | P0 | Translation can create legal exposure |
| Boost reporting lacks enough ranking transparency | P1 | B2C sellers suspect unfairness |

### Architecture Correction

- Extend templates into `listing_variants` for pro sellers:
  - shared template specifics;
  - variant fields: storage, color, condition, price, quantity if allowed.
- Translation UI needs diff by locale:
  - source;
  - generated;
  - edited/reviewed;
  - stale markers.
- Add locked business/legal glossary per category.
- Boost transparency:
  - paid label;
  - placement surfaces;
  - spend period;
  - organic rank factors summary.

### Acceptance Criteria

- E2E: business seller creates 5 electronics variants from one template in one flow.
- Translation: source edit marks reviewed translations stale but does not overwrite them.
- Unit: warranty/refurbished glossary terms preserve meaning across nl/fr/en/de/ru.
- RLS: templates and variants are business-member-only until listing publish.
- UI: boost report separates paid impressions from organic impressions.

### Verdict

**CONDITIONAL PASS.** Pro seller can operate, but cannot scale efficiently without variants and translation review tooling.

## 8. Agent G - Brussels Multilingual Renter

### Профиль

- Регион: Brussels.
- Язык: French/English, some Dutch.
- Цель: rent studio under 950 EUR near public transport.
- Поведенческий триггер: hidden charges and misleading real estate info.
- Нетерпимость: price without charges, bad EPC, vague availability.

### Future-State Journey

1. Opens real estate category.
2. Filters rent, max 950 EUR, Brussels, studio, EPC A-C, available soon.
3. Opens listing translated from Dutch.
4. Checks rent + charges + deposit.
5. Messages landlord/agent.

### Что сработало

- Real estate vertical feels like a different product, correctly.
- EPC and charges fields are visible above the fold.
- Generated translation helps in Brussels.
- Trader/pro distinction is important for agents.

### Что сорвалось

- Rent price without monthly charges still appears too prominent.
- "Available from" and visit availability are not first-class filters.
- Generated translation of legal lease terms is risky.
- Public transport proximity is a real decision factor but not modeled.

### Deal Blocker

No total monthly cost and no visit scheduling clarity = no lead.

### System Gaps

| Gap | Severity | Причина |
|---|---:|---|
| Total monthly housing cost not primary | P0 | Rent-only price misleads |
| Lease/legal translation risk | P0 | Generated terms can alter obligations |
| Visit availability missing | P1 | Real estate contact conversion depends on scheduling |
| Transit proximity absent | P2 | High-value Brussels filter |

### Architecture Correction

- Real estate price display:
  - rent;
  - charges;
  - deposit;
  - total monthly cost where possible.
- Legal lease clauses should not be machine-translated as authoritative; show original + warning.
- Add `visit_availability` and `available_from` filters.
- Later: transit proximity from structured location, not free text.

### Acceptance Criteria

- E2E: rental listing above fold shows rent and charges separately.
- Copy: generated translation of lease/legal text is labeled non-authoritative.
- API: real estate search supports `available_from` and `visit_availability`.
- Unit: total monthly cost is not computed if charges are unknown; UI says unknown, not zero.
- SEO: real estate JSON-LD does not claim missing charges.

### Verdict

**CONDITIONAL PASS.** Real estate is viable only if price transparency is stricter than generic goods.

## 9. Agent H - Cross-Border Student Bargain Hunter

### Профиль

- Регион: Leuven / Liège, often travels by train.
- Язык: English/French.
- Цель: cheap laptop and desk.
- Поведенческий триггер: low budget, high mobility.
- Нетерпимость: results only by car-distance; unclear pickup logistics.

### Future-State Journey

1. Searches laptop under 300 EUR.
2. Adds "near train station / pickup easy".
3. Saves search.
4. Messages seller in another language.
5. Negotiates pickup time.

### Что сработало

- Price cap and electronics filters work.
- Translation reduces language friction.
- Saved search is useful for thin supply.
- Safety prompt helps but does not block.

### Что сорвалось

- Radius search by straight distance is not enough for train-based users.
- Pickup logistics are unstructured: stairs, public transport, exact neighborhood, heavy item constraints.
- "Too low price" warnings can scare legitimate budget buyers.

### Deal Blocker

No pickup logistics = abandoned deal for furniture/heavy items.

### System Gaps

| Gap | Severity | Причина |
|---|---:|---|
| Mobility mode absent | P2 | Belgium users often optimize by train, not car |
| Pickup constraints unstructured | P1 | Heavy goods fail at logistics, not intent |
| Low-price warning can over-warn | P1 | Budget users need caution without panic |

### Architecture Correction

- Add lightweight pickup logistics fields:
  - pickup only / delivery possible;
  - elevator/stairs for large items;
  - approximate pickup area;
  - seller availability windows.
- Price warnings should be softer for categories with high variance and low sample confidence.
- Transit proximity can be a later enhancement, not P0.

### Acceptance Criteria

- E2E: furniture listing captures pickup constraints before publish or in quality prompt.
- Search: user can filter delivery/pickup options.
- Price warning: low-confidence categories show "be careful" without "suspicious" wording.
- i18n: pickup logistics labels exist in all five locales.

### Verdict

**PASS for laptop, CONDITIONAL PASS for furniture.** Pickup logistics is the hidden conversion lever.

## 10. Consolidated Findings

### P0 - Blocks Trust Or Legal Safety

| ID | Finding | Required Change |
|---|---|---|
| P0-1 | Strict local/privacy mode must be literal | `StrictLocalMode`, no inline outside-radius results, no hidden personalization |
| P0-2 | Vehicle parts compatibility must be explicit | Add compatibility model for parts, not free-text claims |
| P0-3 | Public underpriced hunting is dangerous | No global "sort by below median"; keep price intelligence contextual |
| P0-4 | Badge overload breaks trust | Enforce `BadgeBudget` per surface |
| P0-5 | Warranty/legal translation can create liability | Locked glossary + reviewed translation states |
| P0-6 | Real estate total cost cannot be vague | Rent, charges, deposit, unknown states must be explicit |
| P0-7 | Mobile AI must not block manual flow | 3s fail-open rule for assistive AI |

### P1 - Blocks Conversion Or Liquidity

| ID | Finding | Required Change |
|---|---|---|
| P1-1 | Pickup urgency is under-modeled | Add pickup/delivery/availability filters |
| P1-2 | Structured offers need abuse controls | Cooldowns, minimum offer, seller auto-decline |
| P1-3 | Pro sellers need variants | Business templates must support batch variants |
| P1-4 | Translation review needs diff workflow | Source/generated/reviewed/stale UI |
| P1-5 | Chat translation needs confidence/originals | Store and display original/generated separately |
| P1-6 | Visit availability matters for real estate | Add availability filters and fields |
| P1-7 | Pickup logistics matter for bulky goods | Add stairs/elevator/delivery possible fields |

### P2 - Useful Differentiators

| ID | Finding | Required Change |
|---|---|---|
| P2-1 | Transit proximity can improve Brussels searches | Model later via structured location |
| P2-2 | Glossary hits can increase trust | Display optional confidence for technical translation |
| P2-3 | Non-numeric price coaching can reduce anxiety | Better copy for insufficient data |
| P2-4 | SaveSearch consent timing can improve privacy trust | Delay channel prompt until value is clear |

## 11. Architecture Commands To Fable5

Fable5 must run this same future-state crash-test independently and compare outputs against this Codex report.

Required Fable5 output file:

`docs/strategy/BELGIUM_BEHAVIORAL_CRASH_TEST_FABLE5.md`

Required comparison section:

| Agent | Codex Verdict | Fable5 Verdict | Agreement | Fable5 New Gap | Final CTO Decision |
|---|---|---|---|---|---|
| Pieter | Conditional Pass | TBD | TBD | TBD | TBD |
| Julien | Conditional Pass | TBD | TBD | TBD | TBD |
| Sofia | Conditional Pass | TBD | TBD | TBD | TBD |
| Karim | Fail unless constrained | TBD | TBD | TBD | TBD |
| Marie | Conditional Pass | TBD | TBD | TBD | TBD |
| Anke | Conditional Pass | TBD | TBD | TBD | TBD |
| Brussels renter | Conditional Pass | TBD | TBD | TBD | TBD |
| Student bargain hunter | Pass / Conditional | TBD | TBD | TBD | TBD |

Fable5 must not start implementation until it answers:

1. Which P0 gaps are already covered by existing specs?
2. Which P0 gaps need new tables/API contracts?
3. Which P1 gaps can be postponed without hurting cold start?
4. Which "nice AI" features should be deferred because they depend on weak category/location/translation foundations?
5. Which acceptance criteria become automated tests?

## 12. Final CTO Decision

The future-state LyVoX concept is credible for Belgium only if it behaves less like a generic marketplace and more like a set of vertical micro-marketplaces with shared trust infrastructure.

Immediate architectural order:

1. Category vertical contracts.
2. Translation originals/review/glossary.
3. Strict local/privacy mode.
4. Pickup/logistics fields.
5. Robust price intelligence without public arbitrage mode.
6. Structured offers with abuse controls.
7. Pro seller templates with variants.
8. Accessibility and badge budget enforcement.

Do not build more impressive AI until these constraints are locked. AI on top of vague categories, vague locations, and vague translations will make the product look smarter while making it less trustworthy.
