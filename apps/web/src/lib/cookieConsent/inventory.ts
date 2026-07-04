// Cookie / localStorage inventory for LyVoX ePrivacy compliance.
// Belgian Act 13 Jun 2005 Art.129 / ePrivacy 2002/58 Art.5(3).
// This file is the single source of truth for the cookie policy page (§1.6).

export type ConsentCategory = "necessary" | "functional" | "analytics";

export const STORAGE_INVENTORY: {
  key: string;
  category: ConsentCategory;
  purpose: string;
  lib: string;
}[] = [
  // ── Necessary ────────────────────────────────────────────────────────────
  {
    key: "sb-*",
    category: "necessary",
    purpose: "Supabase authentication session (access + refresh tokens)",
    lib: "lib/supabaseClient.ts",
  },
  {
    key: "cf-turnstile-*",
    category: "necessary",
    purpose: "Cloudflare Turnstile bot-protection challenge state",
    lib: "Cloudflare Turnstile (external)",
  },
  {
    key: "lyvox_cookie_consent",
    category: "necessary",
    purpose: "Stores the visitor's cookie consent preferences (this consent record itself)",
    lib: "lib/cookieConsent/store.ts",
  },
  {
    key: "app_logs",
    category: "necessary",
    purpose: "Operational error logging (sessionStorage, development-only) — legitimate interest, no production persistence",
    lib: "lib/errorLogger.ts",
  },
  {
    key: "comparison-instructions-dismissed",
    category: "necessary",
    purpose: "Remembers the visitor dismissed the favourites-comparison help hint (UI preference)",
    lib: "components/comparison/ComparisonInstructions.tsx",
  },
  // ── Functional ───────────────────────────────────────────────────────────
  {
    key: "lyvox:recentlyViewed",
    category: "functional",
    purpose: "Recently viewed adverts for the discovery feed (personalisation)",
    lib: "lib/recentlyViewed.ts",
  },
  {
    key: "lyvox:taste",
    category: "functional",
    purpose: "Anonymous taste model weights (likes/passes) for swipe-deck ranking",
    lib: "lib/taste.ts",
  },
  {
    key: "lyvox:recentSearches",
    category: "functional",
    purpose: "Recent search queries shown in the search bar dropdown",
    lib: "lib/recentSearches.ts",
  },
  {
    key: "lyvox:savedSearches",
    category: "functional",
    purpose: "Locally saved searches for anonymous visitors",
    lib: "lib/savedSearches.ts",
  },
  {
    key: "lyvox:seenAdverts",
    category: "functional",
    purpose: "Set of advert IDs already shown in the swipe deck (deduplication)",
    lib: "lib/seenAdverts.ts",
  },
  {
    key: "lyvox:sessionIntent",
    category: "functional",
    purpose: "Session-only feed ordering signals kept in sessionStorage and never sent to LyVoX",
    lib: "lib/discovery/sessionIntent.ts",
  },
  {
    key: "lyvox:discover:prefs",
    category: "functional",
    purpose: "Discover swipe settings (mode, haptics, etc.) for anonymous visitors",
    lib: "components/discover/SwipeDeck.tsx",
  },
  {
    key: "lyvox:discover:lessCount",
    category: "functional",
    purpose: "Counter for how many times the visitor has used 'Less like this' (reason-prompt personalisation)",
    lib: "components/discover/SwipeDeck.tsx",
  },
  {
    key: "lyvox:discover:session",
    category: "analytics",
    purpose: "Session identifier (sessionStorage) for Discover analytics event batching",
    lib: "lib/discover/discoverTrack.ts",
  },
  {
    key: "lyvox:nav-help",
    category: "necessary",
    purpose: "Onboarding coach-mark state per section (offered/completed/skipped) — prevents repeat prompts",
    lib: "lib/discover/navHelp.ts",
  },
];

/**
 * The exact localStorage keys used by the 5 functional discovery libs.
 * Any `localStorage.setItem` call for these keys must be gated on `hasConsent("functional")`.
 * Keep in sync with the KEY constants in each lib file.
 */
export const GATED_KEYS: string[] = [
  "lyvox:recentlyViewed", // lib/recentlyViewed.ts
  "lyvox:taste",          // lib/taste.ts
  "lyvox:recentSearches", // lib/recentSearches.ts
  "lyvox:savedSearches",  // lib/savedSearches.ts
  "lyvox:seenAdverts",    // lib/seenAdverts.ts
];
