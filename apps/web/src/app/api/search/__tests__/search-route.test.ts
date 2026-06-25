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

const { GET } = await import("../route");

describe("GET /api/search", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    resolveFirstImagesMock.mockClear();
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
    expect(resolveFirstImagesMock).toHaveBeenCalledWith(["adv-1"]);
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
});
