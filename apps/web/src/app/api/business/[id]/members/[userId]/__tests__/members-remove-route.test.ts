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

const serviceFromMock = vi.fn();

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: serviceFromMock,
  }),
}));

// Import after mocks
const { DELETE } = await import("../route");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BIZ_ID = "biz-1";
const REQUESTER_ID = "requester-uuid";
const TARGET_ID = "target-uuid";

function makeRequest(bizId = BIZ_ID, userId = TARGET_ID) {
  return new Request(`https://x.test/api/business/${bizId}/members/${userId}`, {
    method: "DELETE",
  });
}

function makeContext(bizId = BIZ_ID, userId = TARGET_ID) {
  return { params: Promise.resolve({ id: bizId, userId }) };
}

/**
 * Cookie-client admin gate:
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
 * Service-client for target load + delete.
 * from("business_members").select("role").eq(...).eq(...).maybeSingle() — load target
 * from("business_members").delete().eq(...).eq(...) — delete
 */
function makeServiceClient(targetRow: { role: string } | null, deleteError: unknown = null) {
  const deleteFn = vi.fn().mockReturnValue({
    eq: (_col: string, _val: unknown) => ({
      eq: (_col2: string, _val2: unknown) => Promise.resolve({ error: deleteError }),
    }),
  });
  return {
    fromMock: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          eq: (_col2: string, _val2: unknown) => ({
            maybeSingle: async () => ({ data: targetRow, error: null }),
          }),
        }),
      }),
      delete: deleteFn,
    }),
    deleteFn,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DELETE /api/business/[id]/members/[userId] (remove)", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    cookieFromMock.mockReset();
    serviceFromMock.mockReset();
  });

  it("(a) no user → 401 UNAUTH", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(makeRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTH");
  });

  it("(b) non-admin requester → 403 FORBIDDEN", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    // Admin gate: null = not admin/owner
    cookieFromMock.mockImplementation(makeCookieAdminGate(null));

    const res = await DELETE(makeRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FORBIDDEN");
  });

  it("(c) target user not found → 404 NOT_FOUND", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    cookieFromMock.mockImplementation(makeCookieAdminGate({ role: "admin" }));
    const { fromMock } = makeServiceClient(null);
    serviceFromMock.mockImplementation(fromMock);

    const res = await DELETE(makeRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("(d) removing an owner → 403 FORBIDDEN", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    cookieFromMock.mockImplementation(makeCookieAdminGate({ role: "admin" }));
    const { fromMock } = makeServiceClient({ role: "owner" });
    serviceFromMock.mockImplementation(fromMock);

    const res = await DELETE(makeRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FORBIDDEN");
    expect(body.detail).toContain("owner");
  });

  it("(e) removing self (non-owner admin removing own row) → 400 BAD_INPUT", async () => {
    // Requester IS also the target (userId == requester.id), but requester is admin not owner
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    cookieFromMock.mockImplementation(makeCookieAdminGate({ role: "admin" }));
    // Target row has role 'admin' (not owner, so owner-check passes, then self-check fires)
    const { fromMock } = makeServiceClient({ role: "admin" });
    serviceFromMock.mockImplementation(fromMock);

    const res = await DELETE(makeRequest(BIZ_ID, REQUESTER_ID), makeContext(BIZ_ID, REQUESTER_ID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("BAD_INPUT");
  });

  it("(f) happy path → 200 removed:true; deletes via service-role", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: REQUESTER_ID } } });
    cookieFromMock.mockImplementation(makeCookieAdminGate({ role: "admin" }));
    const { fromMock, deleteFn } = makeServiceClient({ role: "member" });
    serviceFromMock.mockImplementation(fromMock);

    const res = await DELETE(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.removed).toBe(true);

    // Assert delete was called via service-role
    expect(deleteFn).toHaveBeenCalledOnce();
  });
});
