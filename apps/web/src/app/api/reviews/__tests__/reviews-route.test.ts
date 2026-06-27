import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock setup ────────────────────────────────────────────────────────────────
const getUserMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({
    success: true,
    limit: 10,
    remaining: 9,
    reset: 0,
    retryAfterSec: 0,
  }),
  withRateLimit: (handler: unknown) => handler,
}));

// Dynamic import AFTER mocks are set up
const { POST } = await import("../route");

// ── Helpers ───────────────────────────────────────────────────────────────────
function jsonReq(body: unknown) {
  return new Request("https://x.test/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  advert_id: "11111111-1111-4111-8111-111111111111",
  rating: 4,
  comment: "Great seller!",
};

describe("POST /api/reviews", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────
  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  it("400 when rating is 6 (out of range)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(jsonReq({ ...VALID_BODY, rating: 6 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("400 when advert_id is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(jsonReq({ rating: 3 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("400 when advert_id is not a UUID", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(jsonReq({ advert_id: "not-a-uuid", rating: 3 }));
    expect(res.status).toBe(400);
  });

  // ── RPC error mapping ──────────────────────────────────────────────────────
  it("403 NO_CONVERSATION → must contact seller first", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: null, error: { message: "NO_CONVERSATION" } });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("NO_CONVERSATION");
    expect(body.detail).toBeTruthy();
  });

  it("409 ALREADY_REVIEWED", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: null, error: { message: "ALREADY_REVIEWED" } });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("ALREADY_REVIEWED");
  });

  it("403 CANNOT_REVIEW_SELF", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: null, error: { message: "CANNOT_REVIEW_SELF" } });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CANNOT_REVIEW_SELF");
  });

  it("404 ADVERT_NOT_FOUND", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: null, error: { message: "ADVERT_NOT_FOUND" } });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("NOT_FOUND");
  });

  it("400 INVALID_RATING from rpc", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: null, error: { message: "INVALID_RATING" } });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("BAD_INPUT");
  });

  it("500 on unknown rpc error", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: null, error: { message: "some unexpected db error" } });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────
  it("200 success → returns review_id, rpc called with correct args", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const fakeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    rpcMock.mockResolvedValue({ data: fakeId, error: null });

    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.review_id).toBe(fakeId);

    // Assert rpc was called with the correct argument shape
    expect(rpcMock).toHaveBeenCalledWith("create_review", {
      p_advert_id: VALID_BODY.advert_id,
      p_rating: VALID_BODY.rating,
      p_comment: VALID_BODY.comment,
    });
  });

  it("200 success without comment → p_comment is null", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: "some-uuid", error: null });

    const res = await POST(jsonReq({ advert_id: VALID_BODY.advert_id, rating: 5 }));
    expect(res.status).toBe(200);

    expect(rpcMock).toHaveBeenCalledWith("create_review", {
      p_advert_id: VALID_BODY.advert_id,
      p_rating: 5,
      p_comment: null,
    });
  });
});
