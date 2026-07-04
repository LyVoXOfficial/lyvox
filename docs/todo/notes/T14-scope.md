# T14 — scope decisions

Empty-states pass + /search polish (SITE_BLUEPRINT wave 4). Notes on deliberate
scope calls so a reviewer sees decisions, not omissions.

## Empty-state coverage (item 1)
The unified rule (`MarketplaceEmptyState`, aliased `EmptyState`, now with a
`children` action slot) was applied to the **dead-end** empty states that showed
bare text with no way forward:

- `/c/[...path]` no-listings → "Search with filters" + "Post a listing" CTAs.
- `/saved` empty → "Start a search" CTA.

Deliberately left as-is (already compliant / would regress):

- **`/c` index "categories unavailable"** — this is a *system error*, not an empty
  state. Per the empty-vs-error split, the right action is retry, not a create-CTA;
  leaving the existing message avoids mislabelling a failure as "nothing here".
- **`/discover` deck exhaustion** (`SwipeDeck`) — already offers Reset + Back-to-feed
  actions, fires the `discover_empty` analytics event, and is absolutely-positioned
  inside the deck. Routing it through the shared component risks layout regression
  for no behavioural gain.
- **`/favorites` empty** (`profile/favorites`) — already title + hint + "Search
  adverts" CTA. Compliant; left on its Card layout.

## Verified chip (item 4)
- `seller_verified` in `search_adverts` = `verified_email AND verified_phone` only.
  The tooltip states exactly that (email + phone). It does **not** claim KBO/VIES
  business verification, which the filter does not actually gate on — avoiding an
  unbacked trust claim (DSA Art.30).
- The chip **coexists** with the rail's "Verified sellers only" toggle; both bind to
  the same `verified_only` URL param, so they stay in sync. This is intentional
  (promote the control without removing the rail filter), not a duplicate.
- "N of M" preview uses two real counts (`limit=1`, `?instant=1` bucket) — never an
  estimate. Toggle logs `verified_filter_toggled` to `analytics_events` (F6).

## Zero-result relaxation (item 2)
- Precedence: exact → exact + outside-radius (geo) → relaxed (drop
  price/condition/verified) → true-empty. Relaxation only fires when the exact query
  is empty **and** the geo expansion found nothing, so the two "nearby" paths never
  double-render.
- All relaxed rows are real results of the loosened query; the "+N" comes from that
  query's real `total`. Nothing is fabricated (red line).

## /search remains noindex — robots meta untouched.
