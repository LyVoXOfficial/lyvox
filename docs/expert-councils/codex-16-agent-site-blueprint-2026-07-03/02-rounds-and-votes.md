# Rounds And Votes

## Round 1 - Independent Positions

### 1. Growth / CRO

LyVoX не должен притворяться большим classifieds-сайтом. Основной promise: меньше рискованный контакт в Бельгии. Home: compact hero, one search, early product grid, trust mechanics, categories, saved search, seller activation. Remove weak stats.

### 2. SEO / IA

Home должна быть crawlable marketplace directory, не carousel-heavy landing. `/search` arbitrary filters noindex; curated category/location hubs index only when there is enough real inventory. `/discover` noindex if personalized/thin.

### 3. Mobile UX

Mobile first question: "есть ли здесь что-то, что я хочу?" Product must appear in first mobile viewport. Trust copy must not crowd out photos, price and contact. `/post` draft-first, not verification wall.

### 4. Trust Psychology

Trust-first can become warning-first if done badly. Stronger model: show credible listings and embed seller signals. No escrow limitation should be clear at contact/payment moments, not shouted as first impression.

### 5. Legal

Never claim "safe", "protected", "guaranteed", "verified deal" or escrow/payment protection. Add trader/private distinction, paid placement labels, KYBC where applicable, ranking disclosure, consumer-rights implications.

### 6. Marketplace Liquidity

Low-liquidity marketplaces survive by repeated buyer intent loops. Show best inventory first, then route thinness: broaden radius/category, save search, all recent. Do not hide scarcity behind carousels.

### 7. Visual Brand

High-end here means restraint, legibility, real product photos and credible marketplace density. Not fintech gloss, not compliance paperwork, not generic AI-gradient visuals.

### 8. Typography

Keep Onest if multilingual QA passes. Do not migrate to IBM Plex just for "institutional trust". Prices are never mono; use Onest with tabular numerals. Geist Mono only for IDs/KBO/VIES/timestamps/system metadata.

### 9. Design System

One listing-card contract across home/search/discover/related. Trust badges must be semantic and limited. Cut card-inside-card and uncontrolled softness. Convert categories to grid.

### 10. Performance

Home/search/ad must be SSR-first. First viewport cannot be heavy mosaic/masonry. Fixed image boxes, `next/image`, no client signing waterfall, no carousel library above fold. CWV release gate required.

### 11. Accessibility

Accessibility is IA, not polish. WCAG 2.2 AA, EAA-aware ecommerce expectations. No autoplay carousels, no color-only risk signals, visible focus, 400% zoom/reflow, logical keyboard order.

### 12. i18n / Localization

Belgium-first means `nl` and `fr` are especially important, but `en/de/ru` remain first-class. Ranking must be locale-aware without faking supply. Persistent language switch in header/mobile nav required.

### 13. Fraud / Trust & Safety

Credible listing is not just nice photo + freshness. It must include risk state, account maturity, verification level, duplicate/scam risk, contact behavior, moderation confidence. Report/block must be visible at high-risk moments.

### 14. Monetization

Monetize seller tooling, inquiry management, analytics, business profile features and labeled boost credits. Do not monetize trust. Paid slots must be capped, labeled, relevance-gated and trust-gated. No paid first proof grid.

### 15. UX Copy

Copy is trust architecture. "Contact seller", "business checked", "phone verified", "payment not handled", "report listing" define the product boundaries. Use short literal strings across locales.

### 16. Competitive Strategy

Do not say "Belgian Vinted" or "better 2dehands". Vinted has buyer protection and shipping; LyVoX cannot claim that. Wedge: local Belgian listings with clearer seller signals before contact.

## Round 2 - Major Debate Resolutions

### Trust billboard rejected

Several agents objected that the early consensus risked making LyVoX a trust explainer with listings attached. Final resolution: product proof first, trust embedded in product mechanics.

### Organic quality grid replaces raw latest

"Show listings early" was corrected to "show organic quality inventory early." Raw latest can surface stale, photo-poor or risky listings. First grid must be eligible, not just recent.

### Quality gating must not hide low liquidity

Binary hiding was rejected. Final model: tiered ranking. If strong inventory is thin, show fewer cards honestly and offer broaden radius/category, saved search, and all recent below.

### Trust metadata is strict

Agents rejected both badge sprawl and invisible trust. Final grammar:

- card: price, title, location, freshness, seller/contact status;
- optional one meaningful text-labeled trust badge;
- save/report;
- full details in `/ad` contact panel.

### No-escrow disclosure moved to decision points

Disclosure is mandatory, but not as H1 alarm. It appears before contact/chat initiation and near payment-risk moments.

### Type and radii settled

Final typography: Onest if QA passes; prices never mono.  
Final radii: 20px only large shells/sheets, 12-13px cards, 8-9px controls, pills only chips/tabs.

### Paid placement delayed/restrained

No paid placement in first home proof grid. Search paid placement only later, capped/labeled/relevance-gated/trust-gated and never above a clearly better organic result.

## Vote

No agent blocked the final synthesis.

Initial vote produced required fixes:

- replace "Pro sells leads" with "Pro sells inquiry management, seller tooling, analytics, business profile features and clearly labeled boost credits";
- add seller-status disclosure before contact: private vs trader, KYBC public fields, consumer-rights implications;
- add user-facing ranking/ad disclosure;
- require one text-labeled non-color-only trust badge max per card;
- require keyboard/focus order and 400% zoom/reflow criteria;
- require contact-only disclosure before contact/chat initiation;
- require visible report/block on `/ad` contact panel and chat;
- add off-platform contact/payment/deposit detection with warnings, throttling and moderation hooks;
- add crawl/indexation policy;
- add persistent language switch and locale QA gates;
- add paid-product transparency: VAT, renewal, cancellation, boost duration/expiry, sponsored label, why shown, receipts;
- add CWV release gate and above-fold JS/image budget.

Final accepted status:

- Approve: 11 agents after revisions.
- Approve with required fixes: 5 agents, all fixes incorporated.
- Block: 0 agents.
