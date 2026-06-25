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
      image: "signed:x.jpg", createdAt: "2026-06-01T00:00:00Z", sellerVerified: true,
    });
  });

  it("normalizes missing optional fields to null/false", () => {
    const card = mapSearchItemToCard({ id: "y", title: "Chair" });
    expect(card).toEqual({
      id: "y", title: "Chair", price: null, currency: null, location: null,
      image: null, createdAt: null, sellerVerified: false,
    });
  });
});
