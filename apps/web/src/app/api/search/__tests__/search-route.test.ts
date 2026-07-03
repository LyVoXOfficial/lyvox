// apps/web/src/app/api/search/__tests__/search-route.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ rpc: rpcMock }),
}));

// Make rate limiting a passthrough so the handler runs without Redis.
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true, limit: 60, remaining: 59, reset: 0, retryAfterSec: 0 }),
  withRateLimit: (handler: unknown) => handler,
}));

const resolveFirstImagesMock = vi.fn(async () => new Map([["adv-1", "signed:adv-1/first.jpg"]]));
vi.mock("@/lib/advertMedia", () => ({
  resolveFirstImages: (...args: unknown[]) => resolveFirstImagesMock(...(args as [])),
}));

const resolveLikeCountsMock = vi.fn(async () => new Map([["adv-1", 3]]));
vi.mock("@/lib/likeCounts", () => ({ resolveLikeCounts: (...a: unknown[]) => resolveLikeCountsMock(...(a as [])) }));

const { GET } = await import("../route");

describe("GET /api/search", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    resolveFirstImagesMock.mockClear();
    resolveLikeCountsMock.mockClear();
  });

  it("attaches a signed image URL to each item", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { id: "adv-1", title: "Bike", price: 50, currency: "EUR", location: "Gent",
          condition: "used", status: "active", created_at: "2026-06-01T00:00:00Z",
          seller_verified: true, total_count: 1, relevance_rank: 0 },
      ],
      error: null,
    });

    const res = await GET(new Request("https://x.test/api/search?limit=24"));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.items[0].image).toBe("signed:adv-1/first.jpg");
    expect(body.data.items[0].seller_verified).toBe(true);
    expect(resolveFirstImagesMock).toHaveBeenCalledWith(["adv-1"], { cap: 24 });
  });

  it("sets image to null when no media is found", async () => {
    resolveFirstImagesMock.mockResolvedValueOnce(new Map());
    rpcMock.mockResolvedValue({
      data: [{ id: "adv-2", title: "Lamp", status: "active", total_count: 1 }],
      error: null,
    });

    const res = await GET(new Request("https://x.test/api/search"));
    const body = await res.json();
    expect(body.data.items[0].image).toBeNull();
  });

  it("attaches like_count to each item", async () => {
    rpcMock.mockResolvedValue({
      data: [{ id: "adv-1", title: "Bike", status: "active", total_count: 1 }],
      error: null,
    });
    const res = await GET(new Request("https://x.test/api/search?limit=24"));
    const body = await res.json();
    expect(body.data.items[0].like_count).toBe(3);
  });

  it("projects to card fields — strips bloat (description, etc.) but keeps deck fields", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "adv-1",
          user_id: "user-9",
          category_id: "cat-7",
          title: "Bike",
          description: "A long description that should never ship to the client",
          price: 50,
          currency: "EUR",
          condition: "used",
          status: "active",
          location_id: "loc-3",
          location: "Gent",
          created_at: "2026-06-01T00:00:00Z",
          updated_at: "2026-06-02T00:00:00Z",
          seller_verified: true,
          total_count: 1,
          relevance_rank: 0.5,
        },
      ],
      error: null,
    });

    const res = await GET(new Request("https://x.test/api/search?limit=24"));
    const body = await res.json();
    const item = body.data.items[0];

    // Bloat / internal shape stripped server-side.
    expect(item.description).toBeUndefined();
    expect(item.relevance_rank).toBeUndefined();
    expect(item.status).toBeUndefined();
    expect(item.condition).toBeUndefined();
    expect(item.updated_at).toBeUndefined();
    expect(item.location_id).toBeUndefined();
    expect(item.total_count).toBeUndefined();

    // Deck card (mapSearchItemToDeckCard) depends on these — must NOT be stripped.
    expect(item.user_id).toBe("user-9");
    expect(item.category_id).toBe("cat-7");

    // Card fields preserved.
    expect(item).toMatchObject({
      id: "adv-1",
      title: "Bike",
      price: 50,
      currency: "EUR",
      location: "Gent",
      created_at: "2026-06-01T00:00:00Z",
      seller_verified: true,
    });
  });

  it("passes existing geospatial params through to search_adverts", async () => {
    rpcMock.mockResolvedValue({
      data: [{ id: "adv-1", title: "Bike", status: "active", total_count: 1 }],
      error: null,
    });

    await GET(new Request("https://x.test/api/search?lat=51.165&lng=4.99&radius_km=20&limit=24"));

    expect(rpcMock).toHaveBeenCalledWith("search_adverts", expect.objectContaining({
      location_filter: undefined,
      location_lat: 51.165,
      location_lng: 4.99,
      radius_km: 20,
    }));
  });
});
