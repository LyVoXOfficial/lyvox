import { describe, it, expect } from "vitest";
import { isPro } from "../proStatus";

const NOW = new Date("2026-06-27T12:00:00.000Z");
const FUTURE = "2026-12-31T23:59:59.000Z"; // after NOW
const PAST = "2026-01-01T00:00:00.000Z";   // before NOW

describe("isPro", () => {
  it("returns true when pro_until is in the future", () => {
    expect(isPro({ pro_until: FUTURE }, NOW)).toBe(true);
  });

  it("returns false when pro_until is in the past", () => {
    expect(isPro({ pro_until: PAST }, NOW)).toBe(false);
  });

  it("returns false when pro_until is null", () => {
    expect(isPro({ pro_until: null }, NOW)).toBe(false);
  });

  it("returns false when pro_until is undefined", () => {
    expect(isPro({ pro_until: undefined }, NOW)).toBe(false);
  });

  it("returns false when pro_until is absent (key omitted)", () => {
    expect(isPro({}, NOW)).toBe(false);
  });

  it("uses the passed now parameter for boundary comparison", () => {
    // Exactly at the boundary: pro_until equals now — should be false (not strictly greater)
    const boundary = "2026-06-27T12:00:00.000Z";
    expect(isPro({ pro_until: boundary }, new Date(boundary))).toBe(false);
  });

  it("uses the system clock when now is omitted (future date is pro)", () => {
    // Far future — always true regardless of when this test runs
    expect(isPro({ pro_until: "2099-01-01T00:00:00.000Z" })).toBe(true);
  });

  it("uses the system clock when now is omitted (past date is not pro)", () => {
    // Deep past — always false
    expect(isPro({ pro_until: "2000-01-01T00:00:00.000Z" })).toBe(false);
  });
});
