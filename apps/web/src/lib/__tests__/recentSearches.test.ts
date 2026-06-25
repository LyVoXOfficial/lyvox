import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from "@/lib/recentSearches";

describe("recentSearches", () => {
  beforeEach(() => clearRecentSearches());

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
