import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentlyViewed,
  addRecentlyViewed,
  clearRecentlyViewed,
  type RecentAdvert,
} from "@/lib/recentlyViewed";

const mk = (id: string): RecentAdvert => ({
  id, title: `T${id}`, price: 1, currency: "EUR", location: "Gent", image: null,
});

describe("recentlyViewed", () => {
  beforeEach(() => clearRecentlyViewed());

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
