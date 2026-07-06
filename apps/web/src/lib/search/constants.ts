// Shared search-rendering constants. These are consumed by BOTH the server
// component (app/search/page.tsx — SSR first paint + fallback orchestration)
// and the client island (app/search/SearchClient.tsx — pagination/filter
// re-fetching), so they must live in one place: if the SSR fallback logic and
// the client fallback logic disagree on a threshold, the hydration seed and the
// client re-fetch would diverge.

/** Page size for a single search results page. */
export const SEARCH_PAGE_LIMIT = 24;

/**
 * Below this many exact-radius matches (on a geo search), we also surface a
 * "farther from you" section built from a widened-radius query.
 */
export const OUTSIDE_RADIUS_THRESHOLD = 6;

/** How many rows to pull for the widened-radius / relaxed fallback queries. */
export const OUTSIDE_RADIUS_LIMIT = 12;

/**
 * Below this many total results we show "All results" instead of the
 * "Showing X–Y of N" range (UI-only; a small catalog reads better that way).
 */
export const ANTI_SOCIAL_THRESHOLD = 10;
