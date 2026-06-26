# Machine-translated strings — pending native review

**Added:** 2026-06-26 · **Branch/commit:** i18n-completeness remediation
([record](../superpowers/plans/2026-06-26-i18n-completeness.md))

The 99 i18n keys below were added to all 5 locale files to close English-leak gaps. **Russian (`ru`)
is native-quality.** The **`nl` (Flemish/Belgium), `fr` (Belgium), and `de` drafts are
machine-generated** and should be reviewed by a native/professional translator before they're
considered final. English (`en`) is the source of truth.

How to review: open `apps/web/src/i18n/locales/{nl,fr,de}.json`, find each key below, and compare
against the `en.json` value. Belgium-specific terminology matters (e.g. EPC/PEB, CP-code/Paritair
Comité). Placeholders like `{count}` must stay verbatim.

**Top priority for the nl reviewer — register consistency.** The nl drafts mix informal **"je"**
(e.g. `advert.trust.body`, `advert.trust.inspect.body`, `chat.no_messages_body`,
`chat.realtime_warning`, `chat.safety.tip_two`, `billing.subtitle`) with formal **"u"** (e.g.
`search.empty*`, `post.signin_intro`, `post.verify_title`, `post.not_found_or_not_owner`). Pick one
convention and apply it throughout. (The listing-noun term was already standardized to **"advertentie"**
across these keys; ru is impersonal-consistent, fr uniformly "vous", de uniformly "Sie".)

> Note: the `catalog.*` namespace (~233 keys, listing-form fields) was integrated in the same change
> from pre-existing `catalog-*.json` files described as "professional translations" — not re-authored
> here, but also not independently verified this session.

## Keys to review (nl/fr/de)

### admin (24)
- `admin.moderation.ai_score`
- `admin.moderation.all`
- `admin.moderation.analyze`
- `admin.moderation.analyze_error`
- `admin.moderation.approve`
- `admin.moderation.confirm_approve`
- `admin.moderation.confirm_description`
- `admin.moderation.confirm_flag`
- `admin.moderation.confirm_reject`
- `admin.moderation.created_at`
- `admin.moderation.description`
- `admin.moderation.detail_description`
- `admin.moderation.empty`
- `admin.moderation.flag`
- `admin.moderation.flagged`
- `admin.moderation.pending`
- `admin.moderation.pending_review`
- `admin.moderation.price`
- `admin.moderation.reason`
- `admin.moderation.reason_placeholder`
- `admin.moderation.reject`
- `admin.moderation.review_error`
- `admin.moderation.title`
- `admin.moderation.view`

### advert (14)
- `advert.seller_checks_pending`
- `advert.trust.anti_phishing`
- `advert.trust.body`
- `advert.trust.email.pending`
- `advert.trust.email.title`
- `advert.trust.email.verified`
- `advert.trust.inspect.body`
- `advert.trust.inspect.title`
- `advert.trust.messaging.body`
- `advert.trust.messaging.title`
- `advert.trust.phone.pending`
- `advert.trust.phone.title`
- `advert.trust.phone.verified`
- `advert.trust.title`

### billing (15)
- `billing.active_until`
- `billing.boost_listing`
- `billing.empty.choose_listing`
- `billing.empty.manage_adverts`
- `billing.metrics.active_benefits`
- `billing.metrics.paid_total`
- `billing.metrics.purchases`
- `billing.no_benefits_title`
- `billing.no_purchases_title`
- `billing.not_available`
- `billing.not_linked`
- `billing.purchase`
- `billing.purchase_id`
- `billing.subtitle`
- `billing.trust_badge`

### category (1)
- `category.no_categories`

### chat (21)
- `chat.back`
- `chat.direct_conversation`
- `chat.empty.badge`
- `chat.empty.find_listing`
- `chat.empty.post_listing`
- `chat.find_listing`
- `chat.history_error`
- `chat.listing_context`
- `chat.no_messages_body`
- `chat.no_messages_title`
- `chat.realtime_warning`
- `chat.safety.body`
- `chat.safety.tip_one`
- `chat.safety.tip_three`
- `chat.safety.tip_two`
- `chat.safety.title`
- `chat.safety_badge`
- `chat.send`
- `chat.send_error`
- `chat.subtitle`
- `chat.view_listing`

### common (2)
- `common.close`
- `common.recent`

### comparison (3)
- `comparison.error_inactive`
- `comparison.error_min_items`
- `comparison.location_unknown`

### post (9)
- `post.draft_created`
- `post.email_missing`
- `post.goto_verify`
- `post.not_found_or_not_owner`
- `post.phone_missing`
- `post.review_profile`
- `post.signin_intro`
- `post.verify_body`
- `post.verify_title`

### profile (5)
- `profile.active_listings`
- `profile.login`
- `profile.not_verified`
- `profile.user_listings`
- `profile.verified`

### search (5)
- `search.browseCategories`
- `search.clearFilters`
- `search.emptyBrowse`
- `search.emptyTitle`
- `search.emptyWithFilters`

### discover (23) — added 2026-06-26 with Phase 3 swipe mode
The whole `discover.*` namespace (incl. `discover.drop.*` and `discover.offer_template`) — ru native,
nl/fr/de machine-drafted. Review against `en.json`. `discover.offer_template` is a user-sent chat
message, so its tone matters most.

### saved (18) — added 2026-06-26 with Phase 4 saved searches + Stage 5 alerts
The whole `saved.*` namespace (incl. `saved.alert_title`/`saved.alert_body` for cron-delivered
notifications) — ru native, nl/fr/de machine-drafted. Review against `en.json`. `saved.new_count`,
`saved.alert_title` ({name}) and `saved.alert_body` ({count}) carry placeholders that must stay verbatim.
