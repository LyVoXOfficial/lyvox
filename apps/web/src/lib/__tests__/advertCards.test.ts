import { describe, it, expect } from "vitest";
import { mapSearchItemToCard } from "@/lib/advertCards";

describe("mapSearchItemToCard", () => {
  it("maps snake_case API fields to camelCase card fields", () => {
    const card = mapSearchItemToCard({
      id: "x", title: "Sofa", price: 120, currency: "EUR", location: "Antwerp",
      image: "signed:x.jpg", created_at: "2026-06-01T00:00:00Z", seller_verified: true,
    });
    expect(card).toEqual({
      id: "x", title: "Sofa", price: 120, currency: "EUR", location: "Antwerp",
      image: "signed:x.jpg", createdAt: "2026-06-01T00:00:00Z", sellerVerified: true, likeCount: 0,
    });
  });

  it("normalizes missing optional fields to null/false", () => {
    const card = mapSearchItemToCard({ id: "y", title: "Chair" });
    expect(card).toEqual({
      id: "y", title: "Chair", price: null, currency: null, location: null,
      image: null, createdAt: null, sellerVerified: false, likeCount: 0,
    });
  });

  it("maps like_count to likeCount (default 0)", () => {
    expect(mapSearchItemToCard({ id: "x", title: "T", like_count: 5 }).likeCount).toBe(5);
    expect(mapSearchItemToCard({ id: "y", title: "T" }).likeCount).toBe(0);
  });
});
