import { describe, it, expect } from "vitest";
import { searchAdvertsQuerySchema } from "@/lib/validations/search";

describe("searchAdvertsQuerySchema condition", () => {
  it("accepts a valid condition", () => {
    const r = searchAdvertsQuerySchema.safeParse({ condition: "used" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.condition).toBe("used");
  });

  it("normalizes a missing condition to null", () => {
    const r = searchAdvertsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.condition).toBeNull();
  });

  it("rejects an invalid condition", () => {
    const r = searchAdvertsQuerySchema.safeParse({ condition: "broken" });
    expect(r.success).toBe(false);
  });
});
