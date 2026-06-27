// Saved searches: server-backed for signed-in users (via /api/saved-searches); this module is the
// anonymous localStorage mirror + the pure matching predicate used in tests and (future) local
// new-count. Mirrors the search route's filter semantics. SSR/private-mode safe.

import { hasConsent } from "@/lib/cookieConsent/store";

export type SavedSearchFilters = {
  category_id?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  location?: string | null;
  verified_only?: boolean | null;
  condition?: string | null;
  sort_by?: string | null;
};

export type LocalSavedSearch = {
  id: string;
  name: string;
  query: string | null;
  filters: SavedSearchFilters;
  created_at: string;
};

export type MatchableAdvert = {
  categoryId?: string | null;
  price?: number | null;
  location?: string | null;
  condition?: string | null;
  sellerVerified?: boolean | null;
  title?: string | null;
  description?: string | null;
};

/**
 * Does an advert match a saved search (filters + free-text query)? Mirrors search_adverts:
 * category exact, price range includes null-priced (free) items, location case-insensitive
 * substring, condition exact, verified_only ⇒ sellerVerified, q ⇒ substring in title/description.
 */
export function savedSearchMatches(
  filters: SavedSearchFilters,
  query: string | null,
  advert: MatchableAdvert,
): boolean {
  if (filters.category_id && advert.categoryId !== filters.category_id) return false;

  const price = advert.price;
  if (filters.price_min != null && price != null && price < filters.price_min) return false;
  if (filters.price_max != null && price != null && price > filters.price_max) return false;

  if (filters.location) {
    const loc = (advert.location ?? "").toLowerCase();
    if (!loc.includes(filters.location.toLowerCase())) return false;
  }

  if (filters.condition && advert.condition !== filters.condition) return false;

  if (filters.verified_only && advert.sellerVerified !== true) return false;

  const q = (query ?? "").trim().toLowerCase();
  if (q) {
    const hay = `${advert.title ?? ""} ${advert.description ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  return true;
}

// ---- anonymous localStorage mirror ----

const KEY = "lyvox:savedSearches";
const CAP = 50;

function newId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function read(): LocalSavedSearch[] {
  if (typeof window === "undefined") return [];
  if (!hasConsent("functional")) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalSavedSearch[]) : [];
  } catch {
    return [];
  }
}

function write(items: LocalSavedSearch[]): void {
  if (typeof window === "undefined") return;
  if (!hasConsent("functional")) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* private mode / quota — degrade silently */
  }
}

export function getLocalSavedSearches(): LocalSavedSearch[] {
  return read();
}

export function addLocalSavedSearch(input: {
  name: string;
  query: string | null;
  filters: SavedSearchFilters;
}): LocalSavedSearch {
  const item: LocalSavedSearch = {
    id: newId(),
    name: input.name,
    query: input.query,
    filters: input.filters,
    created_at: new Date().toISOString(),
  };
  write([item, ...read()].slice(0, CAP));
  return item;
}

export function removeLocalSavedSearch(id: string): void {
  write(read().filter((s) => s.id !== id));
}
