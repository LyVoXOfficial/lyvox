import { describe, it, expect, beforeEach, vi } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ from: fromMock }),
}));

const limiterMock = vi.fn(async () => ({
  success: true,
  limit: 60,
  remaining: 59,
  reset: 0,
  retryAfterSec: 0,
}));

vi.mock("@/lib/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimiter")>();
  return { ...actual, createRateLimiter: () => limiterMock };
});

const { GET } = await import("../route");

type EqSpy = (...args: unknown[]) => void;

// Minimal chainable + thenable stand-in for a PostgREST query builder.
function makeQuery(result: unknown, eqSpy: EqSpy) {
  const q: Record<string, unknown> = {};
  q.select = vi.fn(() => q);
  q.range = vi.fn(() => q);
  q.eq = vi.fn((...args: unknown[]) => {
    eqSpy(...args);
    return q;
  });
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return q;
}

function topSellersReq(query = "limit=8") {
  return new Request(`https://x.test/api/top-sellers?${query}`, { method: "GET" });
}

describe("GET /api/top-sellers (T18 seed switch)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    limiterMock.mockClear();
  });

  it("does NOT filter is_seed when the flag is OFF — showcase preserved", async () => {
    const eqSpy = vi.fn();
    fromMock
      .mockReturnValueOnce(makeQuery({ data: [{ id: "s1" }], error: null }, eqSpy))
      .mockReturnValueOnce(makeQuery({ count: 1 }, eqSpy));

    const res = await GET(topSellersReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      data: { sellers: [{ id: "s1" }], total: 1, limit: 8, offset: 0 },
    });
    expect(eqSpy).not.toHaveBeenCalled();
  });

  it("filters is_seed=false on both data and count queries when the flag is ON", async () => {
    const eqSpy = vi.fn();
    fromMock
      .mockReturnValueOnce(makeQuery({ data: [{ id: "s1" }], error: null }, eqSpy))
      .mockReturnValueOnce(makeQuery({ count: 1 }, eqSpy));

    const prev = process.env.EXCLUDE_SEED_FROM_AGGREGATES;
    process.env.EXCLUDE_SEED_FROM_AGGREGATES = "true";
    try {
      const res = await GET(topSellersReq());
      expect(res.status).toBe(200);
      expect(eqSpy).toHaveBeenCalledWith("is_seed", false);
      expect(eqSpy).toHaveBeenCalledTimes(2);
    } finally {
      if (prev === undefined) delete process.env.EXCLUDE_SEED_FROM_AGGREGATES;
      else process.env.EXCLUDE_SEED_FROM_AGGREGATES = prev;
    }
  });
});
