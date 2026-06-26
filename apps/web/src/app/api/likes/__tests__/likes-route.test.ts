import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true, limit: 30, remaining: 29, reset: 0, retryAfterSec: 0 }),
  withRateLimit: (handler: unknown) => handler,
}));

const { POST } = await import("../route");

function jsonReq(body: unknown) {
  return new Request("https://x.test/api/likes", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/likes", () => {
  beforeEach(() => { getUserMock.mockReset(); fromMock.mockReset(); });

  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(jsonReq({ advert_id: "11111111-1111-4111-8111-111111111111" }));
    expect(res.status).toBe(401);
  });

  it("inserts a like for an active advert (201)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "adverts") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "adv-1", status: "active" }, error: null }) }) }),
      };
      if (table === "advert_likes") return { insert: async () => ({ error: null }) };
      throw new Error("unexpected table " + table);
    });
    const res = await POST(jsonReq({ advert_id: "11111111-1111-4111-8111-111111111111" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("is idempotent on duplicate (23505 → ok)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "adverts") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "adv-1", status: "active" }, error: null }) }) }),
      };
      if (table === "advert_likes") return { insert: async () => ({ error: { code: "23505" } }) };
      throw new Error("unexpected table " + table);
    });
    const res = await POST(jsonReq({ advert_id: "11111111-1111-4111-8111-111111111111" }));
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
