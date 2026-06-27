import { describe, it, expect } from "vitest";
import {
  STORAGE_INVENTORY,
  GATED_KEYS,
  type ConsentCategory,
} from "@/lib/cookieConsent/inventory";

const VALID_CATEGORIES: ConsentCategory[] = ["necessary", "functional", "analytics"];

describe("inventory — classification completeness", () => {
  it("every item has a valid category", () => {
    for (const entry of STORAGE_INVENTORY) {
      expect(VALID_CATEGORIES).toContain(entry.category);
    }
  });

  it("every item has a non-empty key, purpose, and lib", () => {
    for (const entry of STORAGE_INVENTORY) {
      expect(entry.key.length).toBeGreaterThan(0);
      expect(entry.purpose.length).toBeGreaterThan(0);
      expect(entry.lib.length).toBeGreaterThan(0);
    }
  });

  it("GATED_KEYS contains the exact lyvox:recentlyViewed key", () => {
    expect(GATED_KEYS).toContain("lyvox:recentlyViewed");
  });

  it("GATED_KEYS contains the exact lyvox:taste key", () => {
    expect(GATED_KEYS).toContain("lyvox:taste");
  });

  it("GATED_KEYS contains the exact lyvox:recentSearches key", () => {
    expect(GATED_KEYS).toContain("lyvox:recentSearches");
  });

  it("GATED_KEYS contains the exact lyvox:savedSearches key", () => {
    expect(GATED_KEYS).toContain("lyvox:savedSearches");
  });

  it("GATED_KEYS contains the exact lyvox:seenAdverts key", () => {
    expect(GATED_KEYS).toContain("lyvox:seenAdverts");
  });

  it("GATED_KEYS has exactly 5 entries (one per functional lib)", () => {
    expect(GATED_KEYS).toHaveLength(5);
  });

  it("all GATED_KEYS appear in STORAGE_INVENTORY as functional category", () => {
    const functionalInInventory = STORAGE_INVENTORY
      .filter((e) => e.category === "functional")
      .map((e) => e.key);

    for (const k of GATED_KEYS) {
      expect(functionalInInventory).toContain(k);
    }
  });

  it("STORAGE_INVENTORY has at least 9 entries (4 necessary + 5 functional)", () => {
    expect(STORAGE_INVENTORY.length).toBeGreaterThanOrEqual(9);
  });

  it("has at least 4 necessary entries", () => {
    const necessary = STORAGE_INVENTORY.filter((e) => e.category === "necessary");
    expect(necessary.length).toBeGreaterThanOrEqual(4);
  });
});
