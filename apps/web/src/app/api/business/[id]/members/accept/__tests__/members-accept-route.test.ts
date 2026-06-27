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

// Import after mocks
const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BIZ_ID = "biz-1";
const USER_ID = "user-uuid";

function makeRequest(id = BIZ_ID) {
  return new Request(`https://x.test/api/business/${id}/members/accept`, {
    method: "POST",
  });
}

function makeContext(id = BIZ_ID) {
  return { params: Promise.resolve({ id }) };
}

/**
 * Builds the mock chain for the cookie-client accept update:
 * from("business_members").update({...}).eq("business_id",id).eq("user_id",uid).is("accepted_at",null).select("user_id")
 */
function makeCookieUpdate(returnedRows: unknown[] | null, error: unknown = null) {
  return (_table: string) => ({
    update: (_patch: Record<string, unknown>) => ({
      eq: (_col: string, _val: unknown) => ({
        eq: (_col2: string, _val2: unknown) => ({
          is: (_col3: string, _val3: null) => ({
            select: (_cols: string) => Promise.resolve({ data: returnedRows, error }),
          }),
        }),
      }),
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/business/[id]/members/accept", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    cookieFromMock.mockReset();
  });

  it("(a) no user → 401 UNAUTH", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTH");
  });

  it("(b) no pending invite (0 rows updated) → 404 NOT_FOUND", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    // Update returns empty array — no pending invite
    cookieFromMock.mockImplementation(makeCookieUpdate([]));

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NOT_FOUND");
  });

  it("(c) happy path → 200 accepted:true; update targets accepted_at is null", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    // Update returns one row (pending invite was found and updated)
    cookieFromMock.mockImplementation(makeCookieUpdate([{ user_id: USER_ID }]));

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.accepted).toBe(true);
  });
});
