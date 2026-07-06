import { describe, it, expect, beforeEach, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ rpc: rpcMock }),
}));

const resolveFirstImagesMock = vi.fn(async () => new Map([["adv-1", "signed:adv-1/first.jpg"]]));
vi.mock("@/lib/advertMedia", () => ({
  resolveFirstImages: (...args: unknown[]) => resolveFirstImagesMock(...(args as [])),
}));

const resolveLikeCountsMock = vi.fn(async () => new Map([["adv-1", 3]]));
vi.mock("@/lib/likeCounts", () => ({
  resolveLikeCounts: (...a: unknown[]) => resolveLikeCountsMock(...(a as [])),
}));

import { executeSearch } from "../executeSearch";
import { searchAdvertsQuerySchema } from "@/lib/validations/search";

// Helper: validate raw query params the way the route/RSC do before calling executeSearch.
const validated = (raw: Record<string, string>) => searchAdvertsQuerySchema.parse(raw);

describe("executeSearch", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    resolveFirstImagesMock.mockClear();
    resolveLikeCountsMock.mockClear();
  });

  it("returns a projected payload with images + like counts", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "adv-1",
          user_id: "user-9",
          category_id: "cat-7",
          title: "Bike",
          description: "should never ship",
          price: 50,
          currency: "EUR",
          condition: "used",
          status: "active",
          location: "Gent",
          created_at: "2026-06-01T00:00:00Z",
          seller_verified: true,
          total_count: 1,
          relevance_rank: 0.5,
        },
      ],
      error: null,
    });

    const result = await executeSearch(validated({ limit: "24" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const item = result.payload.items[0];
    expect(item.image).toBe("signed:adv-1/first.jpg");
    expect(item.like_count).toBe(3);
    expect(item.seller_verified).toBe(true);
    // Deck fields kept.
    expect(item.user_id).toBe("user-9");
    expect(item.category_id).toBe("cat-7");
    // Bloat stripped (not part of SearchResultItem).
    expect((item as Record<string, unknown>).description).toBeUndefined();
    expect((item as Record<string, unknown>).relevance_rank).toBeUndefined();
    expect(resolveFirstImagesMock).toHaveBeenCalledWith(["adv-1"], { cap: 24 });
    expect(result.payload.total).toBe(1);
    expect(result.payload.hasMore).toBe(false);
  });

  it("sets image to null when no media is found", async () => {
    resolveFirstImagesMock.mockResolvedValueOnce(new Map());
    rpcMock.mockResolvedValue({
      data: [{ id: "adv-2", title: "Lamp", total_count: 1 }],
      error: null,
    });

    const result = await executeSearch(validated({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.items[0].image).toBeNull();
  });

  it("passes geospatial params through to search_adverts", async () => {
    rpcMock.mockResolvedValue({ data: [{ id: "adv-1", title: "Bike", total_count: 1 }], error: null });

    await executeSearch(validated({ lat: "51.165", lng: "4.99", radius_km: "20", limit: "24" }));

    expect(rpcMock).toHaveBeenCalledWith(
      "search_adverts",
      expect.objectContaining({
        location_filter: undefined,
        location_lat: 51.165,
        location_lng: 4.99,
        radius_km: 20,
      }),
    );
  });

  it("computes hasMore + offset for a deep page", async () => {
    // page 1, limit 24 → offset 24; 30 total, 6 rows on this page → no more.
    rpcMock.mockResolvedValue({
      data: Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, title: `t${i}`, total_count: 30 })),
      error: null,
    });
    resolveFirstImagesMock.mockResolvedValueOnce(new Map());
    resolveLikeCountsMock.mockResolvedValueOnce(new Map());

    const result = await executeSearch(validated({ page: "1", limit: "24" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.page).toBe(1);
    expect(result.payload.total).toBe(30);
    expect(result.payload.hasMore).toBe(false); // 30 > 24 + 6 === false
  });

  it("returns ok:false with the supabase error on RPC failure", async () => {
    const supabaseError = { message: "boom", details: "", hint: "", code: "500" };
    rpcMock.mockResolvedValue({ data: null, error: supabaseError });

    const result = await executeSearch(validated({}));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.supabaseError).toEqual(supabaseError);
    // No image/like resolution attempted on the error path.
    expect(resolveFirstImagesMock).not.toHaveBeenCalled();
  });
});
