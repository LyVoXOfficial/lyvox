import { describe, expect, it } from "vitest";
import {
  determineGeneration,
  extractReferencedOptionCategories,
  isTruthyOption,
  type VehicleGeneration,
} from "@/lib/advert/advertDetail";

describe("isTruthyOption", () => {
  it("treats explicit falsy markers as off", () => {
    for (const v of [null, undefined, false, 0, "false", "0", "no", ""]) {
      expect(isTruthyOption(v)).toBe(false);
    }
  });

  it("treats any other value as on", () => {
    for (const v of [true, 1, "true", "1", "yes", "x"]) {
      expect(isTruthyOption(v)).toBe(true);
    }
  });
});

describe("extractReferencedOptionCategories (PERF-01 vehicle_options filter)", () => {
  it("returns only the categories of TRUTHY option_* keys, de-duplicated", () => {
    const specifics = {
      make_id: "m1",
      year: 2018,
      option_comfort_heated_seats: true,
      option_comfort_ac: "yes", // same category → collapses to one
      option_safety_abs: "true",
      option_nav_builtin: false, // falsy → excluded
      not_an_option: true,
    };
    const cats = extractReferencedOptionCategories(specifics).sort();
    expect(cats).toEqual(["comfort", "safety"]);
  });

  it("returns [] when nothing is referenced (so the query is skipped entirely)", () => {
    expect(extractReferencedOptionCategories({})).toEqual([]);
    expect(extractReferencedOptionCategories(null)).toEqual([]);
    expect(extractReferencedOptionCategories({ make_id: "m", option_x_y: false })).toEqual([]);
  });
});

describe("determineGeneration (bug #1996 — no silent guess on overlap)", () => {
  const gen = (id: string, start: number | null, end: number | null): VehicleGeneration => ({
    id,
    model_id: "model",
    code: id,
    start_year: start,
    end_year: end,
    facelift: null,
    summary: null,
    production_countries: null,
  });

  const e34 = gen("e34", 1988, 1996);
  const e39 = gen("e39", 1996, 2003);

  it("prefers the normalized FK id when present", () => {
    expect(determineGeneration([e34, e39], { year: 1996 }, "e39")?.id).toBe("e39");
  });

  it("falls back to JSONB specifics.generation_id", () => {
    expect(determineGeneration([e34, e39], { generation_id: "e34" }, null)?.id).toBe("e34");
  });

  it("returns null on an ambiguous year overlap (does NOT guess the first match)", () => {
    expect(determineGeneration([e34, e39], { year: 1996 }, null)).toBeNull();
  });

  it("returns the unique year match when unambiguous", () => {
    expect(determineGeneration([e34, e39], { year: 2001 }, null)?.id).toBe("e39");
  });

  it("returns the only generation when there is exactly one", () => {
    expect(determineGeneration([e34], {}, null)?.id).toBe("e34");
  });

  it("returns null when there are no generations", () => {
    expect(determineGeneration([], { year: 2000 }, null)).toBeNull();
  });
});
