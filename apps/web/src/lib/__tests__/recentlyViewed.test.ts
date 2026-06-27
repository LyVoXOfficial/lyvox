import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentlyViewed,
  addRecentlyViewed,
  clearRecentlyViewed,
  type RecentAdvert,
} from "@/lib/recentlyViewed";
import { writeConsent } from "@/lib/cookieConsent/store";

const KEY = "lyvox:recentlyViewed";

const mk = (id: string): RecentAdvert => ({
  id, title: `T${id}`, price: 1, currency: "EUR", location: "Gent", image: null,
});

function clearConsentCookie() {
  document.cookie = "lyvox_cookie_consent=; path=/; max-age=0";
}

describe("recentlyViewed — consent gate (no consent)", () => {
  beforeEach(() => {
    clearConsentCookie();
    clearRecentlyViewed();
  });

  it("write path: addRecentlyViewed does NOT persist to localStorage without functional consent", () => {
    addRecentlyViewed(mk("a"));
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("read path: getRecentlyViewed returns [] without functional consent (even if stale data exists)", () => {
    // Seed raw data as if stale from a prior consent period
    window.localStorage.setItem(KEY, JSON.stringify([mk("stale")]));
    expect(getRecentlyViewed()).toEqual([]);
  });
});

describe("recentlyViewed — with functional consent granted", () => {
  beforeEach(() => {
    clearConsentCookie();
    writeConsent({ functional: true, analytics: false });
    clearRecentlyViewed();
  });

  it("returns [] initially", () => {
    expect(getRecentlyViewed()).toEqual([]);
  });

  it("adds most-recent-first", () => {
    addRecentlyViewed(mk("a"));
    addRecentlyViewed(mk("b"));
    expect(getRecentlyViewed().map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("dedupes by id, moving the re-viewed item to front", () => {
    addRecentlyViewed(mk("a"));
    addRecentlyViewed(mk("b"));
    addRecentlyViewed(mk("a"));
    expect(getRecentlyViewed().map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) addRecentlyViewed(mk(`id${i}`));
    const all = getRecentlyViewed();
    expect(all.length).toBe(20);
    expect(all[0].id).toBe("id24");
  });
});
