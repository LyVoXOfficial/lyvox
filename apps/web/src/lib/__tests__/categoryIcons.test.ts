import { describe, it, expect } from "vitest";
import { Car, Layers, Tag, Smartphone, House } from "lucide-react";
import { getCategoryIcon } from "@/lib/categoryIcons";

// PERF-06: guards the curated named-import map that replaced the
// `import * as Icons from "lucide-react"` wildcard (which shipped all ~1560
// icons to every page). Behaviour must stay identical: known names resolve to
// their icon; unknown/wrong-case names fall back exactly as before.
describe("getCategoryIcon", () => {
  it("resolves a known DB icon name to its lucide component", () => {
    expect(getCategoryIcon("Car", 2)).toBe(Car);
    expect(getCategoryIcon("Smartphone", 2)).toBe(Smartphone);
    expect(getCategoryIcon("House", 2)).toBe(House);
  });

  it("falls back to Layers for unknown names at root level (level <= 1)", () => {
    expect(getCategoryIcon("DefinitelyNotAnIcon", 0)).toBe(Layers);
    expect(getCategoryIcon("DefinitelyNotAnIcon", 1)).toBe(Layers);
  });

  it("falls back to Tag for unknown names at deeper levels (level > 1)", () => {
    expect(getCategoryIcon("DefinitelyNotAnIcon", 2)).toBe(Tag);
    expect(getCategoryIcon("DefinitelyNotAnIcon", 5)).toBe(Tag);
  });

  it("falls back for null/undefined/empty icon names", () => {
    expect(getCategoryIcon(null, 0)).toBe(Layers);
    expect(getCategoryIcon(undefined, 0)).toBe(Layers);
    expect(getCategoryIcon("", 2)).toBe(Tag);
  });

  it("keeps the 6 known-invalid DB values falling back (wrong-case / non-existent), unchanged behaviour", () => {
    // These appear in the DB but are not valid lucide exports, so the old
    // wildcard lookup already rendered a fallback. The map must NOT resolve them.
    for (const bad of ["home", "smartphone", "hanger", "BabyBottle", "Broom", "Soap"]) {
      expect(getCategoryIcon(bad, 0)).toBe(Layers);
      expect(getCategoryIcon(bad, 2)).toBe(Tag);
    }
  });
});
