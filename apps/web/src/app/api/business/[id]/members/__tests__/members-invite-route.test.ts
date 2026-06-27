import { describe, it, expect, beforeEach, vi } from "vitest";

// --- mocks (must be hoisted before imports) ---

const getUserMock = vi.fn();
const cookieFromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    from: cookieFromMock,
  }),
}));

const serviceRpcMock = vi.fn();
const serviceFromMock = vi.fn();

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    rpc: serviceRpcMock,
    from: serviceFromMock,
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
  getClientIp: () => "1.2.3.4",
}));

// Import after mocks
const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BIZ_ID = "biz-1";
const REQUESTER_ID = "requester-uuid";
const INVITEE_ID = "invitee-uuid";

function makeRequest(body: unknown, id = BIZ_ID) {
  return new Request(`https://x.test/api/business/${id}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext(id = BIZ_ID) {
  return { params: Promise.resolve({ id }) };
}

/**
 * Builds the mock chain for the cookie-client admin gate query:
 * from("business_members").select("role").eq("business_id",id).eq("user_id",uid).not(...).in(...).maybeSingle()
 */
function makeCookieAdminGate(adminRow: unknown) {
  return (_table: string) => ({
    select: (_cols: string) => ({
      eq: (_col: string, _val: unknown) => ({
        eq: (_col2: string, _val2: unknown) => ({
          not: (_col3: string, _op: string, _val3: unknown) => ({
            in: (_col4: string, _vals: unknown[]) => ({
              maybeSingle: async () => ({ data: adminRow, error: null }),
            }),
          }),
        }),
      }),
    }),
  });
}

/**
 * Builds the mock chain for the service-client existence guard:
 * from("business_members").select("user_id").eq("business_id",id).eq("user_id",inviteeId).maybeSingle()
 */
function makeServiceExistenceCheck(existingRow: unknown) {
  return (_table: string) => ({
    select: (_cols: string) => ({
      eq: (_col: string, _val: unknown) => ({
        eq: (_col2: string, _val2: unknown) => ({
          maybeSingle: async () => ({ data: existingRow, error: null }),
        }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/business/[id]/members (invite)", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    cookieFromMock.mockReset();
    serviceRpcMock.mockReset();
    serviceFromMock.mockReset();
  });

  it("(a) no user → 401 UNAUTH", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest({ email: "a@b.com", role: "member" }), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTH");
  });

  it("(b) non-admin requester → 403 FORBIDDEN", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    // Admin gate: no row (not admin/owner)
    cookieFromMock.mockImplementation(makeCookieAdminGate(null));

    const res = await POST(makeRequest({ email: "a@b.com", role: "member" }), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FORBIDDEN");
  });

  it("(c) invalid role → 400 INVALID_PAYLOAD (gate passes, body validation fails)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    cookieFromMock.mockImplementation(makeCookieAdminGate({ role: "admin" }));

    const res = await POST(makeRequest({ email: "a@b.com", role: "owner" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_PAYLOAD");
  });

  it("(d) email not found → 404 USER_NOT_FOUND", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    cookieFromMock.mockImplementation(makeCookieAdminGate({ role: "admin" }));
    serviceRpcMock.mockResolvedValue({ data: null, error: null });

    const res = await POST(makeRequest({ email: "unknown@b.com", role: "member" }), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("USER_NOT_FOUND");
    expect(body.detail).toBe("invitee must register first");
  });

  it("(e) self-invite → 400 BAD_INPUT", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    cookieFromMock.mockImplementation(makeCookieAdminGate({ role: "admin" }));
    serviceRpcMock.mockResolvedValue({ data: REQUESTER_ID, error: null });

    const res = await POST(makeRequest({ email: "self@b.com", role: "member" }), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("BAD_INPUT");
    expect(body.detail).toContain("yourself");
  });

  it("(f) already a member → 409 ALREADY_MEMBER", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    cookieFromMock.mockImplementation(makeCookieAdminGate({ role: "admin" }));
    serviceRpcMock.mockResolvedValue({ data: INVITEE_ID, error: null });
    // Existence check returns an existing row
    serviceFromMock.mockImplementation(makeServiceExistenceCheck({ user_id: INVITEE_ID }));

    const res = await POST(makeRequest({ email: "existing@b.com", role: "member" }), makeContext());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ALREADY_MEMBER");
  });

  it("(g) happy path → 200; row inserted via service-role with accepted_at:null, invited_by=requester, correct role", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    cookieFromMock.mockImplementation(makeCookieAdminGate({ role: "admin" }));
    serviceRpcMock.mockResolvedValue({ data: INVITEE_ID, error: null });

    // Service-role: existence check returns null, then insert succeeds
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "business_members") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: unknown) => ({
              eq: (_col2: string, _val2: unknown) => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: insertMock,
        };
      }
      return {};
    });

    const res = await POST(makeRequest({ email: "new@b.com", role: "member" }), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.invited).toBe(true);

    // Assert insert was called via service-role with correct fields
    expect(insertMock).toHaveBeenCalledOnce();
    const insertArg = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.business_id).toBe(BIZ_ID);
    expect(insertArg.user_id).toBe(INVITEE_ID);
    expect(insertArg.role).toBe("member");
    expect(insertArg.invited_by).toBe(REQUESTER_ID);
    expect(insertArg.accepted_at).toBeNull();
  });
});
