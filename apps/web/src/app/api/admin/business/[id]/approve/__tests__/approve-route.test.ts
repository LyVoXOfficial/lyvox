import { describe, it, expect, beforeEach, vi } from "vitest";

// --- mocks (must be hoisted before imports) ---

const getUserMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
  }),
}));

const serviceFromMock = vi.fn();
vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: serviceFromMock }),
}));

vi.mock("@/lib/adminRole", () => ({
  hasAdminRole: (user: unknown) => {
    if (!user) return false;
    const u = user as { app_metadata?: { role?: string } };
    return u.app_metadata?.role === "admin";
  },
}));

// Import after mocks
const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_USER = { id: "admin-user", app_metadata: { role: "admin" } };
const NON_ADMIN_USER = { id: "plain-user", app_metadata: { role: "user" } };
const BIZ_ID = "biz-uuid-1";

function makeContext(id = BIZ_ID) {
  return { params: Promise.resolve({ id }) };
}

function makePost(id = BIZ_ID) {
  return new Request(`https://x.test/api/admin/business/${id}/approve`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// chainable mock builders
// ---------------------------------------------------------------------------

// from("businesses").select("id").eq("id",id).maybeSingle()  → business exists
function makeBizExistsFetch(exists: boolean) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: exists ? { id: BIZ_ID } : null,
          error: null,
        }),
      }),
    }),
  };
}

// from("verifications").select("id").eq().eq().eq().in().maybeSingle()
function makeVerFetch(existingId: string | null) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            in: () => ({
              maybeSingle: async () => ({
                data: existingId ? { id: existingId } : null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

// from("verifications").update(...).eq(...)
function makeVerUpdate(error: unknown = null) {
  return {
    update: vi.fn(() => ({
      eq: async () => ({ error }),
    })),
  };
}

// from("verifications").insert(...)
function makeVerInsert(insertFn: ReturnType<typeof vi.fn>) {
  return {
    insert: insertFn,
  };
}

// from("businesses").update({status:'active'}).eq(...)
function makeBizUpdate(error: unknown = null) {
  return {
    update: () => ({
      eq: async () => ({ error }),
    }),
  };
}

beforeEach(() => {
  getUserMock.mockReset();
  serviceFromMock.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/admin/business/[id]/approve", () => {
  it("(a) 403 FORBIDDEN when user is not admin", async () => {
    getUserMock.mockResolvedValue({ data: { user: NON_ADMIN_USER } });

    const res = await POST(makePost(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FORBIDDEN");
  });

  it("(a2) 401 UNAUTH when no user session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const res = await POST(makePost(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTH");
  });

  it("(b) 404 BUSINESS_NOT_FOUND when business does not exist", async () => {
    getUserMock.mockResolvedValue({ data: { user: ADMIN_USER } });

    serviceFromMock.mockImplementation((table: string) => {
      if (table === "businesses") return makeBizExistsFetch(false);
      throw new Error("unexpected table: " + table);
    });

    const res = await POST(makePost(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("BUSINESS_NOT_FOUND");
  });

  it("(c) admin + existing business → inserts method='kbo' (NOT 'manual') and sets active", async () => {
    getUserMock.mockResolvedValue({ data: { user: ADMIN_USER } });

    const insertMock = vi.fn(async () => ({ error: null }));

    let bizCallCount = 0;
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "businesses") {
        bizCallCount++;
        if (bizCallCount === 1) {
          // First call: existence check
          return makeBizExistsFetch(true);
        }
        // Second call: update status='active'
        return makeBizUpdate(null);
      }
      if (table === "verifications") {
        // First verifications call: select existing row → none found (insert path)
        // Second call would be insert
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: insertMock,
        };
      }
      throw new Error("unexpected table: " + table);
    });

    const res = await POST(makePost(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.entity_verified).toBe(true);
    expect(body.data.business_status).toBe("active");
    expect(body.data.method).toBe("kbo");

    // Assert insert was called with method='kbo' NOT 'manual'
    expect(insertMock).toHaveBeenCalledOnce();
    const insertArg = (insertMock.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0];
    expect(insertArg.method).toBe("kbo");
    expect(insertArg.method).not.toBe("manual");
    expect(insertArg.status).toBe("verified");
    expect(insertArg.subject_type).toBe("business");
    expect(insertArg.subject_id).toBe(BIZ_ID);
  });

  it("(c2) admin + existing kbo pending row → updates existing row to verified", async () => {
    getUserMock.mockResolvedValue({ data: { user: ADMIN_USER } });

    const updateMock = vi.fn(() => ({
      eq: async () => ({ error: null }),
    }));

    let bizCallCount = 0;
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "businesses") {
        bizCallCount++;
        if (bizCallCount === 1) return makeBizExistsFetch(true);
        return makeBizUpdate(null);
      }
      if (table === "verifications") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    maybeSingle: async () => ({
                      data: { id: "ver-existing-1" },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: updateMock,
        };
      }
      throw new Error("unexpected table: " + table);
    });

    const res = await POST(makePost(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.method).toBe("kbo");

    // update should have been called with status:'verified'
    expect(updateMock).toHaveBeenCalledOnce();
    const updateArg = (updateMock.mock.calls as unknown as Array<[Record<string, unknown>]>)[0][0];
    expect(updateArg.status).toBe("verified");
  });
});
