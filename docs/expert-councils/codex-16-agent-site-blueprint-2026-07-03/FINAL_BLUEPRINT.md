# Final Blueprint

## 1. Positioning

Use buyer-language positioning:

> Local Belgian listings with clearer seller signals before contact.

Alternative:

> Find local deals in Belgium and see who you are contacting.

Do not use:

- safe marketplace;
- protected buying;
- verified deal;
- fraud-free;
- secure transaction;
- buyer protection;
- escrow;
- payment protection;
- any phrasing that implies LyVoX processes item payments in the current contact-only phase.

## 2. Home Architecture

### Final order

1. Header with logo, persistent language switch, account/post entry and one canonical search pattern.
2. Compact hero with one search: query + category + location.
3. 2-4 SSR organic quality listing previews with fixed image boxes. No masonry. No client-only signed-image waterfall.
4. First organic quality grid. No paid slots. No weak stats.
5. Micro-legend near the grid: "Complete, recent, contactable ads shown first."
6. Category/location grid, not carousel.
7. Thin-inventory recovery: broaden radius/category, save search, all recent.
8. Seller CTA / post entry.
9. Recently viewed only if populated and bounded.
10. Lower trust/safety explanation and legal links.

### Current modules

Cut:

- weak stats card;
- `InfoCarousel`;
- `TopSellersCarousel`;
- upper `TopAdvertCard`;
- primary carousel stack.

Transform:

- `CategoriesCarousel` -> responsive category/location grid.
- `Recommended` -> SSR quality grid / "More to explore", or remove until data quality supports it.
- `RecentlyViewed` -> one bounded secondary rail only when populated.
- `FreeAds` -> "All recent" below quality inventory or lower seller CTA.

## 3. First Proof Grid

The first proof grid must be organic, quality-ranked and trust-aware.

Quality signals:

- real photo;
- title/detail quality;
- price where category expects price;
- location;
- freshness / non-stale;
- contactable seller;
- category relevance;
- locale relevance.

Trust/risk signals:

- seller/contact status;
- moderation state;
- account maturity;
- verification level;
- duplicate/scam risk;
- contact behavior;
- suspicious off-platform/payment/deposit patterns.

Do not pad the above-fold grid with weak listings. If inventory is thin, show fewer strong cards honestly and immediately offer:

- broaden radius;
- broaden category;
- save search;
- view all recent listings.

## 4. Trust Grammar

Home/search card contract:

- photo;
- price;
- title;
- location;
- freshness;
- seller/contact status;
- optional one meaningful text-labeled trust badge;
- save/report affordance.

Rules:

- Trust badge must be text-labeled and non-color-only.
- Max one trust badge on home/search cards.
- No "trusted seller" unless criteria are audited and legally reviewed.
- Full trust explanation lives in `/ad/[id]` contact panel.
- Verification label must answer: what was checked, by whom, and what it does not mean.

## 5. Disclosure And Safety

Disclosure should not be an H1 alarm. It must appear before action.

Required contact-only disclosure points:

- before contact/chat initiation;
- `/ad/[id]` contact panel;
- chat start;
- payment-risk prompts;
- safety pages;
- post confirmation.

Suggested base meaning:

> LyVoX connects buyers and sellers. Payment and handover are arranged between you.

Legal/localized copy must be professionally reviewed in `en/fr/nl/de/ru`.

`/ad/[id]` must disclose before contact:

- private seller vs trader;
- trader KYBC public fields where applicable;
- consumer-rights implications;
- contact-only/payment-handling limits.

Fraud controls:

- visible report/block on `/ad` contact panel and in chat;
- detect off-platform contact/payment/deposit language;
- show contextual warnings;
- throttle risky flows;
- send moderation hooks.

## 6. Search

`/search` is the buyer workhorse.

Requirements:

- SSR first page from URL query params;
- canonical query/category/location model;
- safety facets secondary, not default-on;
- facet counts cached or returned by same search response;
- disabled-empty states instead of silently hiding facets;
- result updates with polite live regions;
- paid results only later if relevance-gated, trust-gated, capped and labeled;
- paid result never above a clearly better organic result.

## 7. Ranking, Ads And Crawl Policy

### Ranking disclosure

Provide user-facing ranking disclosure for home, search and recommendations. It should explain that order can consider:

- relevance;
- freshness;
- completeness;
- contactability;
- trust/risk signals;
- locale/location relevance;
- paid placement when present.

### Paid placement

Rules:

- no paid slot in first home proof grid;
- no paid trust badge;
- paid placement must be labeled before card content;
- include "why shown";
- subject to same relevance, moderation and trust gates;
- Pro boost credits cannot bypass caps, labels or first-proof exclusion.

### Crawl/indexation

Index:

- active ad pages with canonical, hreflang and expired-state handling;
- category/location hubs only above inventory/quality threshold.

`noindex, follow`:

- arbitrary filters;
- saved searches;
- personalized feeds;
- thin category/location pages;
- low-value parameter combinations.

## 8. Post Flow

Posting should be draft-first:

1. Let seller create a draft before hard verification wall.
2. Improve listing quality with category-specific guidance.
3. Require minimum gates before public/contactable/indexable state.

Minimum gates:

- contactability;
- moderation state;
- prohibited item checks;
- trader/private declaration;
- business disclosure when applicable;
- high-risk category checks;
- required fields for title, category, condition, price when expected, city/location, photos and description.

Do not let imperfect but legal drafts die. Let them save, improve and return. Do not make compliance feel like paperwork before the seller has created value.

## 9. Pro And Monetization

Pro sells:

- inquiry management;
- seller tooling;
- analytics;
- business profile features;
- clearly labeled boost credits.

Pro does not sell:

- trust;
- KYBC verification;
- business verification without independent KYBC;
- first-proof home placement;
- bypass of relevance, moderation, labeling or trust gates.

Paid-product transparency before purchase and in receipts:

- VAT treatment;
- renewal;
- cancellation;
- boost duration and expiry;
- sponsored label;
- why shown;
- where boost can and cannot appear.

Primary Pro surfaces:

- `/pro`;
- account;
- seller dashboard;
- post-completion;
- post-publish upsell;
- factual business identity on ad pages when independently verified.

## 10. Visual System

### Typography

Keep Onest if QA passes in `en/fr/nl/de/ru`.

Rules:

- prices in Onest with tabular numerals;
- never use mono for prices;
- Geist Mono only for IDs, KBO/VIES, timestamps and system metadata;
- no negative letter-spacing;
- test long Dutch/German compounds, French accents and Russian Cyrillic.

### Geometry

Use a restrained radius system:

- 20px only for large shells, sheets, modals and drawers;
- 12-13px for cards and panels;
- 8-9px for controls;
- full pills only for chips/tabs.

Primary listing tiles must not feel soft, plush or lifestyle-editorial.

### Color and motion

- teal for primary action;
- mint as soft surface only;
- amber for caution and paid disclosure;
- no color-only states;
- no autoplay;
- no decorative motion above fold;
- transitions short and functional.

### Imagery

Product photos are the visual system. Use real listing imagery, fixed aspect ratios and reserved dimensions.

## 11. Accessibility, i18n And Performance Gates

### Accessibility

Acceptance criteria:

- WCAG 2.2 AA baseline;
- EAA-aware ecommerce design;
- visible focus;
- logical keyboard/focus order;
- 400% zoom/reflow;
- 44-48px preferred mobile touch targets;
- no color-only signals;
- no disabled zoom;
- no critical action available only by hover, swipe, drag or timed interaction.

### i18n

Required:

- persistent language switch in header and mobile nav;
- no hardcoded UI strings;
- locale QA for expansion, plural rules, counts, badges and contact-only disclosures;
- localized category/location slugs locked with canonical/hreflang rules;
- no untranslated duplicate locale pages.

### Performance

Release gate:

- p75 mobile LCP <= 2.5s;
- CLS <= 0.1;
- INP <= 200ms.

Above-fold budget:

- SSR shell;
- fixed `next/image` boxes;
- no client signing waterfall;
- no carousel library;
- skeletons, ads, facets and counts reserve final dimensions before render.

## 12. Implementation Priority

1. Remove duplicate search and weak stats.
2. Build SSR organic quality grid and listing-card contract.
3. Cut/transform current carousel modules.
4. Add ranking/ad disclosure and crawl/indexation rules.
5. Add contact-panel seller status, KYBC/trader/private notices and contact-only disclosure before contact.
6. Add report/block and suspicious contact/payment/deposit detection.
7. Make `/post` draft-first with publish/contact/index gates.
8. Add saved search and thin-inventory recovery.
9. Add Pro/boost transparency only after trust gates and paid disclosure rules exist.
10. Run multilingual, accessibility and CWV release checks.
