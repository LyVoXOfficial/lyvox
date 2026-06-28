import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true, limit: 120, remaining: 119, reset: 0, retryAfterSec: 0 }),
  withRateLimit: (handler: (...a: unknown[]) => unknown) => handler,
  getClientIp: () => "1.2.3.4",
}));

const upsertMock = vi.fn();

const { POST } = await import("../route");

function makeReq(body: unknown) {
  return new Request("https://x.test/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: null } });
  fromMock.mockReset().mockReturnValue({ upsert: upsertMock });
  upsertMock.mockReset().mockResolvedValue({ data: null, error: null });
});

describe("POST /api/analytics/track — F6", () => {
  it("400 on missing event_name", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("400 on unknown event_name", async () => {
    const res = await POST(makeReq({ event_name: "not_a_real_event" }));
    expect(res.status).toBe(400);
  });

  it("200 tracked:true for a valid event", async () => {
    const res = await POST(makeReq({ event_name: "advert_viewed", props: { advert_id: "abc" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.tracked).toBe(true);
  });

  it("200 tracked:false for a stub deal event (F3-gated)", async () => {
    const res = await POST(makeReq({ event_name: "deal_created" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tracked).toBe(false);
    expect(body.data.reason).toBe("event_not_live");
    // Stub events must NOT hit the DB
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("passes user_id from auth session", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-abc" } } });
    await POST(makeReq({ event_name: "search_performed", props: { query: "bike" } }));
    const [row] = upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(row.user_id).toBe("user-abc");
  });

  it("passes session_id and dedup_key through", async () => {
    await POST(makeReq({
      event_name: "swipe_right",
      session_id: "sess-123",
      dedup_key: "swipe:abc:sess-123",
      props: { advert_id: "abc" },
    }));
    const [row] = upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(row.session_id).toBe("sess-123");
    expect(row.dedup_key).toBe("swipe:abc:sess-123");
  });
});
