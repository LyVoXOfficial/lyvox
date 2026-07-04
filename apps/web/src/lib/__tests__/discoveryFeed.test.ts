import { describe, it, expect } from "vitest";
import { appendUnique } from "@/lib/discoveryFeed";
import type { AdvertCard } from "@/lib/advertCards";

const card = (id: string): AdvertCard => ({
  id, categoryId: null, title: id, price: null, currency: null, location: null, image: null,
  createdAt: null, sellerVerified: false, likeCount: 0,
});

describe("appendUnique", () => {
  it("appends new items preserving order", () => {
    const out = appendUnique([card("a"), card("b")], [card("c"), card("d")]);
    expect(out.map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops incoming items whose id already exists (seam dedup)", () => {
    const out = appendUnique([card("a"), card("b")], [card("b"), card("c")]);
    expect(out.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("returns prev unchanged when incoming is empty", () => {
    const prev = [card("a")];
    expect(appendUnique(prev, []).map((c) => c.id)).toEqual(["a"]);
  });
});
