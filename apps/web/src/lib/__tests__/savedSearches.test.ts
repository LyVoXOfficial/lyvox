import { describe, it, expect, beforeEach } from "vitest";
import {
  savedSearchMatches,
  getLocalSavedSearches,
  addLocalSavedSearch,
  removeLocalSavedSearch,
  type SavedSearchFilters,
  type MatchableAdvert,
} from "../savedSearches";
import { writeConsent } from "@/lib/cookieConsent/store";

const KEY = "lyvox:savedSearches";

const advert = (over: Partial<MatchableAdvert> = {}): MatchableAdvert => ({
  categoryId: "cat1",
  price: 100,
  location: "Brussels",
  condition: "used",
  sellerVerified: true,
  title: "Vintage road bike",
  description: "Lightweight aluminium frame",
  ...over,
});

function clearConsentCookie() {
  document.cookie = "lyvox_cookie_consent=; path=/; max-age=0";
}

// Pure predicate — no localStorage, no consent needed
describe("savedSearchMatches", () => {
  it("matches when all filters are empty", () => {
    expect(savedSearchMatches({}, null, advert())).toBe(true);
  });

  it("category exact match", () => {
    expect(savedSearchMatches({ category_id: "cat1" }, null, advert())).toBe(true);
    expect(savedSearchMatches({ category_id: "other" }, null, advert())).toBe(false);
  });

  it("price range, with free (null-price) items always included", () => {
    expect(savedSearchMatches({ price_min: 50, price_max: 150 }, null, advert({ price: 100 }))).toBe(true);
    expect(savedSearchMatches({ price_min: 200 }, null, advert({ price: 100 }))).toBe(false);
    expect(savedSearchMatches({ price_max: 50 }, null, advert({ price: 100 }))).toBe(false);
    expect(savedSearchMatches({ price_min: 200, price_max: 300 }, null, advert({ price: null }))).toBe(true);
  });

  it("location case-insensitive substring", () => {
    expect(savedSearchMatches({ location: "brus" }, null, advert({ location: "Brussels" }))).toBe(true);
    expect(savedSearchMatches({ location: "Gent" }, null, advert({ location: "Brussels" }))).toBe(false);
  });

  it("condition exact", () => {
    expect(savedSearchMatches({ condition: "used" }, null, advert({ condition: "used" }))).toBe(true);
    expect(savedSearchMatches({ condition: "new" }, null, advert({ condition: "used" }))).toBe(false);
  });

  it("verified_only requires sellerVerified", () => {
    expect(savedSearchMatches({ verified_only: true }, null, advert({ sellerVerified: true }))).toBe(true);
    expect(savedSearchMatches({ verified_only: true }, null, advert({ sellerVerified: false }))).toBe(false);
    expect(savedSearchMatches({ verified_only: false }, null, advert({ sellerVerified: false }))).toBe(true);
  });

  it("free-text query matches title/description substring (case-insensitive)", () => {
    expect(savedSearchMatches({}, "bike", advert())).toBe(true);
    expect(savedSearchMatches({}, "ALUMINIUM", advert())).toBe(true);
    expect(savedSearchMatches({}, "kayak", advert())).toBe(false);
  });

  it("combines filters (AND)", () => {
    const f: SavedSearchFilters = { category_id: "cat1", price_max: 150, verified_only: true };
    expect(savedSearchMatches(f, "bike", advert())).toBe(true);
    expect(savedSearchMatches(f, "bike", advert({ price: 999 }))).toBe(false);
  });
});

describe("local saved searches store — consent gate (no consent)", () => {
  beforeEach(() => {
    clearConsentCookie();
    window.localStorage.clear();
  });

  it("write path: addLocalSavedSearch does NOT persist to localStorage without functional consent", () => {
    addLocalSavedSearch({ name: "A", query: "a", filters: {} });
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("write path: removeLocalSavedSearch does NOT write to localStorage without functional consent", () => {
    removeLocalSavedSearch("any-id");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("read path: getLocalSavedSearches returns [] without functional consent", () => {
    // Seed stale data
    window.localStorage.setItem(KEY, JSON.stringify([{ id: "x", name: "Old", query: null, filters: {}, created_at: "" }]));
    expect(getLocalSavedSearches()).toEqual([]);
  });
});

describe("local saved searches store — with functional consent granted", () => {
  beforeEach(() => {
    clearConsentCookie();
    writeConsent({ functional: true, analytics: false });
    window.localStorage.clear();
    // Re-grant after clear (writeConsent sets a cookie, not localStorage, so it survives clear)
  });

  it("adds and lists newest-first", () => {
    addLocalSavedSearch({ name: "A", query: "a", filters: {} });
    addLocalSavedSearch({ name: "B", query: "b", filters: { category_id: "c" } });
    const items = getLocalSavedSearches();
    expect(items.map((s) => s.name)).toEqual(["B", "A"]);
    expect(items[0].id).toBeTruthy();
    expect(items[0].created_at).toBeTruthy();
  });

  it("caps at 50", () => {
    for (let i = 0; i < 55; i++) addLocalSavedSearch({ name: `s${i}`, query: null, filters: {} });
    expect(getLocalSavedSearches()).toHaveLength(50);
  });

  it("removes by id", () => {
    const a = addLocalSavedSearch({ name: "A", query: null, filters: {} });
    addLocalSavedSearch({ name: "B", query: null, filters: {} });
    removeLocalSavedSearch(a.id);
    expect(getLocalSavedSearches().map((s) => s.name)).toEqual(["B"]);
  });
});
