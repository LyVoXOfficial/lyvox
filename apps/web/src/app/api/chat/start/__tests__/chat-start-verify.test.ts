import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const isVerifiedMock = vi.fn();
const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
  }),
}));
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true }),
  withRateLimit: (h: unknown) => h,
}));
vi.mock("@/lib/auth/requireVerified", () => ({
  isViewerVerified: (...a: unknown[]) => isVerifiedMock(...(a as [])),
}));

const ADVERT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CONV_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

// Helper: build a request body
const makeBody = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ advert_id: ADVERT_ID, peer_id: PEER_ID, ...overrides });

// Default from() mock — returns an active advert from "adverts", and accepts logs insert
const makeFromMock = (advertOverride?: Partial<{ id: string; status: string }> | null) =>
  vi.fn().mockImplementation((table: string) => {
    if (table === "adverts") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: advertOverride !== undefined
                ? advertOverride
                : { id: ADVERT_ID, status: "active" },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "logs") {
      return { insert: async () => ({ error: null }) };
    }
    return { insert: async () => ({ error: null }) };
  });

const { POST } = await import("../route");

describe("POST /api/chat/start", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    isVerifiedMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  // ── Auth / verification gate (preserved) ─────────────────────────────────────

  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: makeBody(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("403 VERIFICATION_REQUIRED when signed in but unverified", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(false);
    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: JSON.stringify({ peer_id: PEER_ID }),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
  });

  // ── Input validation ──────────────────────────────────────────────────────────

  it("400 when advert_id is missing", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(true);
    fromMock.mockImplementation(makeFromMock());
    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: JSON.stringify({ peer_id: PEER_ID }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("404 when advert does not exist", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(true);
    fromMock.mockImplementation(makeFromMock(null));
    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: makeBody(),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("400 when advert is inactive", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(true);
    fromMock.mockImplementation(makeFromMock({ id: ADVERT_ID, status: "sold" }));
    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: makeBody(),
      }),
    );
    expect(res.status).toBe(400);
  });

  // ── Happy path: rpc called, conversation_id returned ─────────────────────────

  it("200 happy path — calls rpc start_conversation and returns conversation_id", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(true);
    fromMock.mockImplementation(makeFromMock());
    rpcMock.mockResolvedValue({ data: CONV_ID, error: null });

    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: makeBody(),
      }),
    );

    expect(res.status).toBe(200);

    // Verify rpc was called with the correct arguments
    expect(rpcMock).toHaveBeenCalledWith("start_conversation", {
      p_advert_id: ADVERT_ID,
      p_peer_id: PEER_ID,
    });

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.conversation_id).toBe(CONV_ID);
    // created flag is gone — rpc is idempotent, we don't fabricate it
    expect(body.data.created).toBeUndefined();
  });

  // ── RPC error mapping ─────────────────────────────────────────────────────────

  it("400 when rpc raises CANNOT_CHAT_SELF", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(true);
    fromMock.mockImplementation(makeFromMock());
    rpcMock.mockResolvedValue({ data: null, error: { message: "CANNOT_CHAT_SELF" } });

    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: makeBody(),
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("BAD_INPUT");
  });

  it("403 when rpc raises INVALID_PEER", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(true);
    fromMock.mockImplementation(makeFromMock());
    rpcMock.mockResolvedValue({ data: null, error: { message: "INVALID_PEER" } });

    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: makeBody(),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  it("404 when rpc raises ADVERT_NOT_FOUND", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(true);
    fromMock.mockImplementation(makeFromMock());
    rpcMock.mockResolvedValue({ data: null, error: { message: "ADVERT_NOT_FOUND" } });

    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: makeBody(),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("401 when rpc raises auth required", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(true);
    fromMock.mockImplementation(makeFromMock());
    rpcMock.mockResolvedValue({ data: null, error: { message: "auth required" } });

    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: makeBody(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("500 on unexpected rpc error", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    isVerifiedMock.mockResolvedValue(true);
    fromMock.mockImplementation(makeFromMock());
    rpcMock.mockResolvedValue({ data: null, error: { message: "unexpected db error" } });

    const res = await POST(
      new Request("https://x.test/api/chat/start", {
        method: "POST",
        body: makeBody(),
      }),
    );
    expect(res.status).toBe(500);
  });
});
