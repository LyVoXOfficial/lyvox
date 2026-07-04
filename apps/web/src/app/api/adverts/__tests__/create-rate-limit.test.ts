/**
 * SEC-RL1 — rate-limit coverage for POST /api/adverts (draft creation).
 *
 * Mirrors the pattern in ../../media/sign/__tests__/route.test.ts: keep the
 * real rateLimiter module (via importOriginal) but replace createRateLimiter
 * so both the per-user and per-IP limiters resolve to one controllable mock.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const checkBlockedMock = vi.fn();
const invokeFraudCheckMock = vi.fn();
const fromMock = vi.fn(() => ({}));
const serviceFromMock = vi.fn(() => ({}));

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: serviceFromMock }),
}));
vi.mock("@/lib/fraud/checkUserBlocked", () => ({
  checkUserBlocked: (...a: unknown[]) => checkBlockedMock(...(a as [])),
}));
vi.mock("@/lib/fraud/invokeFraudCheck", () => ({
  invokeFraudCheck: (...a: unknown[]) => invokeFraudCheckMock(...(a as [])),
}));

const limiterMock = vi.fn(async () => ({
  success: true,
  limit: 5,
  remaining: 4,
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

const { POST } = await import("../route");

function makeChainable(result: { data: unknown; error: unknown } = { data: { id: "cat-1" }, error: null }) {
  const c: Record<string, unknown> = {};
  c.select = () => c;
  c.eq = () => c;
  c.order = () => c;
  c.limit = () => c;
  c.maybeSingle = async () => result;
  c.insert = () => c;
  c.single = async () => ({ data: { id: "advert-new-1", status: "draft", category_id: "cat-1" }, error: null });
  return c;
}

function postReq(body?: unknown) {
  if (body === undefined) {
    return new Request("https://x.test/api/adverts", { method: "POST" });
  }
  return new Request("https://x.test/api/adverts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/adverts — SEC-RL1 rate limiting", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    checkBlockedMock.mockReset();
    invokeFraudCheckMock.mockReset();
    fromMock.mockReset().mockReturnValue(makeChainable());
    serviceFromMock.mockReset().mockReturnValue(makeChainable());
    limiterMock.mockClear();
    limiterMock.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
      retryAfterSec: 0,
    });
    checkBlockedMock.mockResolvedValue({ isBlocked: false });
    invokeFraudCheckMock.mockResolvedValue({ blocked: false, flagged: false });
  });

  it("200 success when limiter allows the request", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await POST(postReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.advert.id).toBe("advert-new-1");
  });

  it("429 RATE_LIMITED with Retry-After header when a limiter denies the request", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    limiterMock.mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 600,
      retryAfterSec: 600,
    });

    const res = await POST(postReq());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("600");
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("RATE_LIMITED");
    // Handler must not have run past the limiter gate.
    expect(checkBlockedMock).not.toHaveBeenCalled();
  });
});
