import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock } }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ rpc: rpcMock }),
}));

const limiterMock = vi.fn(async () => ({
  success: true,
  limit: 30,
  remaining: 29,
  reset: 0,
  retryAfterSec: 0,
}));

vi.mock("@/lib/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimiter")>();
  return {
    ...actual,
    createRateLimiter: () => limiterMock,
  };
});

const { GET } = await import("../route");

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";

function priceSuggestionReq(query = `categoryId=${CATEGORY_ID}&condition=used`) {
  return new Request(`https://x.test/api/price-suggestion?${query}`, { method: "GET" });
}

describe("GET /api/price-suggestion", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
    limiterMock.mockClear();
    limiterMock.mockResolvedValue({
      success: true,
      limit: 30,
      remaining: 29,
      reset: 0,
      retryAfterSec: 0,
    });
  });

  it("401 UNAUTHENTICATED for anonymous requests", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });

    const res = await GET(priceSuggestionReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("200 ready response with median/IQR payload", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    rpcMock.mockResolvedValue({
      data: [
        {
          sample_size: 24,
          p25: "100.125",
          median: "150",
          p75: "225.499",
          backoff_level: "category_condition",
        },
      ],
      error: null,
    });

    const res = await GET(priceSuggestionReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      data: {
        status: "ready",
        currency: "EUR",
        low: 100.13,
        median: 150,
        high: 225.5,
        label: "ok",
        confidence: "medium",
        sampleSize: 24,
        backoffLevel: "category_condition",
        explanationKey: "priceSuggestion.ready",
      },
    });
    expect(rpcMock).toHaveBeenCalledWith("estimate_price", {
      p_category_id: CATEGORY_ID,
      p_condition: "used",
    });
  });

  it("200 insufficient_data when RPC returns null quantiles", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    rpcMock.mockResolvedValue({
      data: [
        {
          sample_size: 7,
          p25: null,
          median: null,
          p75: null,
          backoff_level: "parent_category",
        },
      ],
      error: null,
    });

    const res = await GET(priceSuggestionReq(`categoryId=${CATEGORY_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      data: { status: "insufficient_data", reason: "too_few_comparables" },
    });
    expect(rpcMock).toHaveBeenCalledWith("estimate_price", {
      p_category_id: CATEGORY_ID,
      p_condition: null,
    });
  });
});
