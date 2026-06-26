import { describe, it, expect } from "vitest";
import { popularityScore } from "@/lib/popularity";

describe("popularityScore", () => {
  it("weights views·0.3 + likes·3 + favorites·5", () => {
    expect(popularityScore({ views: 10, likes: 2, favorites: 1 })).toBeCloseTo(10 * 0.3 + 2 * 3 + 1 * 5);
  });
  it("treats missing counts as 0", () => {
    expect(popularityScore({})).toBe(0);
  });
});
