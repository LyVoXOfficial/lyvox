import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from "@/lib/recentSearches";
import { writeConsent } from "@/lib/cookieConsent/store";

const KEY = "lyvox:recentSearches";

function clearConsentCookie() {
  document.cookie = "lyvox_cookie_consent=; path=/; max-age=0";
}

describe("recentSearches — consent gate (no consent)", () => {
  beforeEach(() => {
    clearConsentCookie();
    clearRecentSearches();
  });

  it("write path: addRecentSearch does NOT persist to localStorage without functional consent", () => {
    addRecentSearch("bike");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("write path: removeRecentSearch does NOT write to localStorage without functional consent", () => {
    addRecentSearch("bike"); // no-op write
    removeRecentSearch("bike"); // must not persist either
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("read path: getRecentSearches returns [] without functional consent", () => {
    // Seed stale data
    window.localStorage.setItem(KEY, JSON.stringify(["stale"]));
    expect(getRecentSearches()).toEqual([]);
  });
});

describe("recentSearches — with functional consent granted", () => {
  beforeEach(() => {
    clearConsentCookie();
    writeConsent({ functional: true, analytics: false });
    clearRecentSearches();
  });

  it("returns [] initially", () => {
    expect(getRecentSearches()).toEqual([]);
  });

  it("adds most-recent-first and ignores blank queries", () => {
    addRecentSearch("bike");
    addRecentSearch("  ");
    addRecentSearch("sofa");
    expect(getRecentSearches()).toEqual(["sofa", "bike"]);
  });

  it("dedupes case-insensitively, moving to front", () => {
    addRecentSearch("Bike");
    addRecentSearch("sofa");
    addRecentSearch("bike");
    expect(getRecentSearches()).toEqual(["bike", "sofa"]);
  });

  it("caps at 8", () => {
    for (let i = 0; i < 12; i++) addRecentSearch(`q${i}`);
    expect(getRecentSearches().length).toBe(8);
    expect(getRecentSearches()[0]).toBe("q11");
  });

  it("removes a specific query", () => {
    addRecentSearch("a");
    addRecentSearch("b");
    expect(removeRecentSearch("a")).toEqual(["b"]);
  });
});
