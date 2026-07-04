import { describe, it, expect } from "vitest";
import { excludeSeedFromAggregates } from "../excludeSeedFromAggregates";

describe("excludeSeedFromAggregates (T18 launch-gate)", () => {
  it("is OFF when the env var is unset — showcase preserved by default", () => {
    expect(excludeSeedFromAggregates({})).toBe(false);
  });

  it('turns ON only for the literal string "true"', () => {
    expect(excludeSeedFromAggregates({ EXCLUDE_SEED_FROM_AGGREGATES: "true" })).toBe(true);
  });

  it("fails safe to OFF for any other value", () => {
    for (const value of ["false", "1", "TRUE", "True", "yes", "", undefined]) {
      expect(excludeSeedFromAggregates({ EXCLUDE_SEED_FROM_AGGREGATES: value })).toBe(false);
    }
  });
});
