import { describe, it, expect, beforeEach } from "vitest";
import { mapSearchItemToDeckCard, rerankByTaste, filterUnseen, DROPS, type DeckCard } from "../deck";
import { recordSignal, resetTaste } from "@/lib/taste";
import { addSeenAdverts, clearSeenAdverts } from "@/lib/seenAdverts";

const dc = (over: Partial<DeckCard>): DeckCard => ({
  id: "x",
  title: "t",
  price: null,
  currency: null,
  location: null,
  image: null,
  createdAt: null,
  sellerVerified: false,
  likeCount: 0,
  sellerId: null,
  categoryId: null,
  ...over,
});

describe("deck", () => {
  beforeEach(() => {
    resetTaste();
    clearSeenAdverts();
  });

  it("maps a raw search item (incl sellerId/categoryId) to camelCase", () => {
    const card = mapSearchItemToDeckCard({
      id: "1",
      title: "Bike",
      price: 100,
      currency: "EUR",
      location: "Gent",
      image: "http://img",
      created_at: "2026-01-01",
      seller_verified: true,
      like_count: 3,
      user_id: "u9",
      category_id: "c5",
    });
    expect(card).toMatchObject({
      id: "1",
      title: "Bike",
      price: 100,
      currency: "EUR",
      location: "Gent",
      image: "http://img",
      createdAt: "2026-01-01",
      sellerVerified: true,
      likeCount: 3,
      sellerId: "u9",
      categoryId: "c5",
    });
  });

  it("cold-start rerank preserves source order", () => {
    const cards = [dc({ id: "a" }), dc({ id: "b" }), dc({ id: "c" })];
    expect(rerankByTaste(cards).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("floats higher-taste cards up, stable on ties", () => {
    recordSignal({ categoryId: "hot", sellerId: null, location: null, price: null }, "like");
    const cards = [dc({ id: "a" }), dc({ id: "liked", categoryId: "hot" }), dc({ id: "b" })];
    expect(rerankByTaste(cards).map((c) => c.id)).toEqual(["liked", "a", "b"]);
  });

  it("filterUnseen drops already-seen ids", () => {
    addSeenAdverts(["a"]);
    expect(filterUnseen([dc({ id: "a" }), dc({ id: "b" })]).map((c) => c.id)).toEqual(["b"]);
  });

  it("every Drop preset has a non-empty query", () => {
    expect(DROPS.length).toBeGreaterThanOrEqual(3);
    for (const d of DROPS) expect(Object.keys(d.query).length).toBeGreaterThan(0);
  });
});
