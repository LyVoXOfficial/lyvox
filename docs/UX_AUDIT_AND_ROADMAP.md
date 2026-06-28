> ⚠ УСТАРЕЛО — этот файл больше не ведётся. Единый источник правды: [docs/MASTER_TODO.md](./MASTER_TODO.md). Сведено туда; можно удалить.

# LyVoX UX audit and next-generation marketplace roadmap

Date: 2026-06-06

## UX bar

LyVoX should feel like a trust-first Belgian marketplace, not a generated demo. The product UI must be search-first, mobile-first, visually restrained, and explicit about trust, safety, seller quality, and active filters.

## Benchmarks used

- Modern marketplace search: clear query entry, obvious filters, applied-filter chips, sort controls, empty states, and quick removal of constraints.
- Trust-first marketplaces: seller verification, buyer/seller safety cues, report actions, and in-platform messaging surfaced near the buying decision.
- Recommerce marketplaces: image-led cards, fast category discovery, saved/favorite actions, compact mobile navigation, and category-specific structured data.

Reference sources:

- Baymard Institute ecommerce UX research on product lists/filtering.
- Nielsen Norman Group ecommerce/search UX guidance.
- Airbnb 2025 app direction: service/category-led discovery, redesigned app IA, richer messaging, integrated payments, and stronger profile/identity surfaces. Source: https://news.airbnb.com/product-releases/airbnb-2025-summer-release/
- Vinted buyer protection/shipping patterns for trust and transaction confidence. Source: https://www.vinted.com/help/550-buyer-protection
- OLX Group trust direction: trusted seller badges, reviews, safe chat, safety recommendations, ML moderation, and human review fallback. Source: https://www.olxgroup.com/trust/
- OLX India fraud guidance: keep communication in platform chat, avoid external messengers, avoid partial payments, verify user identity for high-value deals, and watch for urgency/scam signals. Source: https://help.olx.in/hc/en-us/articles/10918247205533-How-can-I-protect-myself-from-fraudsters
- Alibaba Xianyu direction: C2C resale as a community, with recycling, authentication, ratings, forums, and lifestyle/community layers. Source: https://www.alibabagroup.com/en-US/about-alibaba-businesses-1747081802473799680
- Xianyu pricing intelligence benchmark: LLM-based second-hand price suggestions deployed on Xianyu and designed around dynamic market retrieval and confidence filtering. Source: https://arxiv.org/abs/2510.09347
- Flipkart high-value transaction trust: open-box delivery lets buyers inspect eligible items before acceptance and return wrong/damaged items. Source: https://stories.flipkart.com/open-box-delivery-flipkart-customer-trust

## Changes shipped in this pass

- Global design tokens updated from neutral scaffold defaults to a product palette with stronger foreground, border, primary, secondary, and accent tokens.
- Layout width increased to `max-w-7xl` for marketplace density.
- Top strip changed from duplicate language controls to trust/safety signals.
- Main header refined: stronger sticky shell, better category dropdown, post CTA with icon, cleaner mobile drawer.
- Bottom nav active state fixed with relative positioning and safer fallback for "More".
- Homepage changed to a search-first action surface with quick category/trust actions and live listing stats.
- Listing cards redesigned: locale-aware currency/date formatting, stronger image ratio, price hierarchy, location/date icons, verified badge placement, and cleaner report affordance.
- Search input redesigned with improved focus state and autocomplete surface.
- Search filters improved with Belgian city suggestions, active filter chips, better mobile drawer count, and a cleaner sidebar.
- Search results page improved with applied filter chips, clearer result header, better loading/error surfaces, and sort copy.
- Category index and category pages moved away from Russian-only copy and `name_ru` display.
- Footer cleaned: removed dead `/about`, `/legal/gdpr`, `/safety`, `href="#"` links and replaced them with real routes.
- More page rebuilt into a real mobile utility surface instead of dead footer links.
- Public report flow copy changed from Russian-only to neutral English fallback.
- Detail-page gallery/details/seller card radii aligned to the 8px design rule.

## Additional changes shipped in the follow-up pass

- User menu rebuilt with stable English fallbacks, icon-led actions, cleaner account avatar, and stronger dropdown hierarchy.
- Login, registration, recovery, and auth callback flows redesigned around a trust-first account access pattern.
- Register form copy, legal consent states, email availability indicators, and tests updated to the new account creation UX.
- Contact page replaced the placeholder screen with real support routes and safety guidance.
- Onboarding rebuilt as an account-readiness checklist with profile and phone-verification next actions.
- Account verification page and email/SMS verification clients redesigned with clear trust status, action cards, and `/contact` support path.
- Profile edit page now has a real Server Action save path for display name and phone instead of a non-functional "future version" note.
- Profile favorites and the main profile settings fallbacks were cleaned of old Russian/mojibake copy in the touched areas.
- Legacy `components/header.tsx` now delegates to the current `MainHeader` to avoid accidental reintroduction of stale UX.
- Language switcher no longer depends on fragile emoji flags and uses stable language code/name labels.

## Publication flow follow-up pass

- `/post` no-auth gate replaced with a trust-first card that explains why sign-in is required and no longer leaks missing translation keys.
- `/post` verification gate cleaned of mojibake and rebuilt around email/phone trust requirements with clear next actions.
- Post form additional-phone OTP flow no longer uses `prompt()`; it now sends the code and verifies it inside a first-party dialog.
- Post form delete action no longer uses `confirm()`; it now uses a destructive confirmation dialog with explicit irreversible-action copy.
- Post form draft/loading fallbacks cleaned of mojibake in the touched publication path.
- Boost checkout and admin moderation errors no longer use browser `alert()`; they now surface through app toasts.

## Account security follow-up pass

- `/profile/security` metadata and page copy cleaned of mojibake and rebuilt around account protection rather than generic demo text.
- TOTP settings and enrollment now use first-party trust copy, clear enabled/disabled states, app setup guidance, safer destructive removal copy, and English fallback toasts.
- Passkey/biometric button and settings components now use consistent passkey terminology with clean fallback messages across supported locale keys.
- WebAuthn helper error messages now return clean passkey-oriented descriptions so toast details do not leak old Russian/mojibake copy.

## Detail page follow-up pass

- `/ad/[id]` now uses a decision-first layout: title, location, posted date, gallery, description, seller profile, trust timeline, and a sticky contact panel.
- The new contact panel exposes the actual transaction action instead of a placeholder: owners manage the listing, signed-in buyers open/create a LyVoX chat through `/api/chat/start`, and guests are sent to login with a return path.
- Listing trust is now explained as a timeline: email check, phone check, in-platform messaging, inspection-before-payment, and anti-phishing guidance.
- Detail page fallbacks now use clean English copy instead of Russian/mojibake strings when translation keys are missing.
- Vehicle option/category fallbacks prefer English/Belgian-market labels before Russian data so mixed-language leakage is less likely.
- Guest favorites loading no longer emits a public-page 401 console error; unauthenticated GET requests now return an empty favorites payload with `authenticated: false`, while write actions remain protected.

## Chat and billing follow-up pass

- Chat list now has a trust-first empty state with next actions to find listings or post an advert instead of relying on raw translation keys.
- Conversation cards now surface advert context, price, unread state, and safer in-platform deal framing.
- Chat window rebuilt into a conversation workspace with listing context, anti-phishing guidance, multiline composer, immediate sent-message rendering, reconnect status, and user-visible send/history errors instead of console-only failures.
- Billing page rebuilt into a commercial account surface with purchase/benefit metrics, clean status labels, active-benefit cards, empty-state next actions, and English fallbacks for missing billing translation keys.
- Guest redirects for `/chat`, `/chat/[conversationId]`, and `/profile/billing` now preserve the intended destination through the login `next` parameter.

## Market benchmark conclusions

- Next-generation marketplace UX is moving from static listing pages to guided decision surfaces: price, trust, seller quality, and next action must be visible together.
- Trust copy has to be embedded at the moment of action, not buried in a help page. The detail page should keep chat/payment guidance beside the CTA.
- In-platform messaging is a safety feature, not just communication. LyVoX should increasingly treat chat as the controlled transaction record.
- High-value categories need inspection flows and category-specific proof points. For vehicles this means Car-Pass, VIN, maintenance, and inspection prompts; for electronics it means serial/IMEI, condition, warranty, and receipt prompts.
- AI should be used where it removes seller friction and improves market accuracy: description assistance, price suggestions, suspicious-link detection, image quality checks, and category-specific listing completeness.

## Remaining high-priority UX work

P0:

- Replace remaining hardcoded/fallback Russian or mixed-language text in category-specific components, debug surfaces, and legacy helper comments where they affect UX.
- Add skeleton states for home/search/category grids instead of spinner-only states.
- Add actual marketplace empty states with next actions.

P1:

- Continue redesigning profile, comparison, billing, chat, security, and moderation surfaces to the same density and token system.
- Add saved-search and filter chip UX.
- Add seller quality explanation: verified phone/email, response time, completed deals, report history.
- Add anti-phishing cues in chat and listing contact surfaces.

P2:

- Introduce category-specific visual modules for transport/electronics/property/jobs.
- Add image quality guidance in post flow.
- Add Belgian compliance badges: KBO/CBE, Recupel/EPR, Car-Pass, GPSR where applicable.
- Add PWA/mobile polish: swipeable media, sticky bottom actions, and safer thumb-zone placement.

## Verification status

- `pnpm typecheck`: passing after the follow-up UX pass.
- `pnpm lint`: passing after the follow-up UX pass. Only warning: `baseline-browser-mapping` data is older than two months.
- `pnpm test`: passing after the follow-up UX pass, 5 files / 78 tests. Existing React `act(...)` warnings remain in catalog component tests.
- In-app Browser smoke: `/`, `/login`, `/register`, `/onboarding`, `/contact`, `/verify`, `/profile/edit`, and `/profile/favorites` load without `__next_error__` or application error. Protected routes redirect to login when no session is present.
- HTTP smoke: `/`, `/login`, `/register`, `/onboarding`, `/contact`, `/verify`, `/profile/edit`, and `/profile/favorites` return 200 with cache-busting query params and no stale `/promo` carousel markup.
- Publication flow verification on 2026-06-06: `pnpm typecheck`, `pnpm lint`, and `pnpm test` passed. `/post` returns 200, has no mojibake or leaked `profile.login` key in HTTP output, and in-app Browser smoke shows the sign-in gate with no console errors.
- Account security verification on 2026-06-06: `pnpm typecheck`, `pnpm lint`, and `pnpm test` passed. Security/TOTP/passkey components scan clean for user-facing mojibake; only non-rendered Russian comments remain in `webauthn.ts`.
- Detail page verification on 2026-06-06: `pnpm typecheck`, `pnpm lint`, and `pnpm test` passed after the sticky contact/trust timeline pass. `/ad/[id]` and `AdvertContactPanel` scan clean for user-facing Russian/mojibake fallback strings. HTTP smoke on a real listing returned 200 with the trust/contact panel and no broken encoding. Playwright browser smoke on the same listing confirmed trust/contact/checklist content, no application error, no broken encoding, and no console errors after the guest favorites fix.
- Chat/billing verification on 2026-06-06: `pnpm typecheck`, `pnpm lint`, and `pnpm test` passed after the chat and billing surface rebuild. Chat/billing components scan clean for user-facing Russian/mojibake fallback strings and leaked `t(...) || key` patterns. HTTP smoke confirmed `/chat` redirects to `/login?next=/chat` and `/profile/billing` redirects to `/login?next=/profile/billing`. Playwright smoke in fresh browser sessions confirmed both redirects render login without application errors, broken encoding, or console errors.

Full multi-route screenshot regression is not yet complete. In-app Browser DOM and screenshot smoke were used for the routes touched in this pass.
