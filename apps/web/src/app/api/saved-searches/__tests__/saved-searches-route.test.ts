import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromMock, rpc: rpcMock }),
}));
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true, limit: 30, remaining: 29, reset: 0, retryAfterSec: 0 }),
  withRateLimit: (handler: unknown) => handler,
}));

const { GET, POST } = await import("../route");
const { DELETE, PATCH } = await import("../[id]/route");

const UUID = "11111111-1111-4111-8111-111111111111";

function jsonReq(body: unknown, method = "POST") {
  return new Request("https://x.test/api/saved-searches", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const plainReq = (method = "GET") => new Request("https://x.test/api/saved-searches", { method });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  getUserMock.mockReset();
  fromMock.mockReset();
  rpcMock.mockReset();
});

describe("/api/saved-searches list+create", () => {
  it("GET 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect((await GET(plainReq())).status).toBe(401);
  });

  it("POST 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect((await POST(jsonReq({ name: "x", filters: {} }))).status).toBe(401);
  });

  it("POST 409 when at the 50 cap", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: async () => ({ count: 50, error: null }) }),
    }));
    const res = await POST(jsonReq({ name: "x", filters: {} }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBeTruthy();
  });

  it("POST 201 inserts under the cap", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation(() => ({
      select: (_cols: string, opts?: { head?: boolean }) =>
        opts?.head
          ? { eq: async () => ({ count: 2, error: null }) }
          : { single: async () => ({ data: { id: UUID, name: "x" }, error: null }) },
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: UUID, name: "x" }, error: null }) }) }),
    }));
    const res = await POST(jsonReq({ name: "x", query: "bike", filters: { category_id: UUID } }));
    expect(res.status).toBe(201);
    expect((await res.json()).ok).toBe(true);
  });

  it("POST rejects an unsupported instant cadence", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await POST(jsonReq({ name: "x", filters: {}, alert_frequency: "instant" }));

    expect(res.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("GET returns rows with computed new_count", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    const lastSeen = "2026-06-26T00:00:00.000Z";
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: UUID, query: null, filters: {}, last_seen_at: lastSeen }], error: null }) }) }),
    }));
    // two adverts, one created after last_seen → new_count 1
    rpcMock.mockResolvedValue({
      data: [{ created_at: "2026-06-27T00:00:00.000Z" }, { created_at: "2026-06-25T00:00:00.000Z" }],
      error: null,
    });
    const res = await GET(plainReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items[0].new_count).toBe(1);
  });
});

describe("/api/saved-searches/[id] delete+patch", () => {
  it("DELETE 401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect((await DELETE(plainReq("DELETE"), ctx(UUID))).status).toBe(401);
  });

  it("DELETE removes an owned row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation(() => ({
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null, count: 1 }) }) }),
    }));
    const res = await DELETE(plainReq("DELETE"), ctx(UUID));
    expect(res.status).toBe(200);
  });

  it("PATCH seen=true updates last_seen_at", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    let captured: Record<string, unknown> | null = null;
    fromMock.mockImplementation(() => ({
      update: (u: Record<string, unknown>) => {
        captured = u;
        return { eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: UUID }, error: null }) }) }) }) };
      },
    }));
    const res = await PATCH(jsonReq({ seen: true }, "PATCH"), ctx(UUID));
    expect(res.status).toBe(200);
    expect(captured).not.toBeNull();
    expect(captured!.last_seen_at).toBeTruthy();
  });

  it("PATCH alert_frequency=off disables alerts", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    let captured: Record<string, unknown> | null = null;
    fromMock.mockImplementation(() => ({
      update: (u: Record<string, unknown>) => {
        captured = u;
        return { eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: UUID }, error: null }) }) }) }) };
      },
    }));
    const res = await PATCH(jsonReq({ alert_frequency: "off" }, "PATCH"), ctx(UUID));
    expect(res.status).toBe(200);
    expect(captured).toEqual({ alert_frequency: "off", alert_enabled: false });
  });

  it("PATCH rejects an unsupported instant cadence", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });

    const res = await PATCH(jsonReq({ alert_frequency: "instant" }, "PATCH"), ctx(UUID));

    expect(res.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("PATCH 400 with an empty body", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect((await PATCH(jsonReq({}, "PATCH"), ctx(UUID))).status).toBe(400);
  });
});
