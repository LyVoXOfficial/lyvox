import { describe, it, expect, beforeEach, vi } from "vitest";

// --- mocks (must be hoisted before imports) ---

const getUserMock = vi.fn();
const cookieRpcMock = vi.fn();
const cookieUpdateMock = vi.fn();
const cookieFromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    rpc: cookieRpcMock,
    from: cookieFromMock,
  }),
}));

const serviceFromMock = vi.fn();
vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: serviceFromMock }),
}));

// Import after mocks
const { PATCH } = await import("../route");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BIZ_ID = "biz-1";

/** Simulates service-role existence check: from("businesses").select("id").eq("id", id).maybeSingle() */
function makeExistenceFetch(found = true) {
  const row = found ? { id: BIZ_ID } : null;
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: row, error: null }),
      }),
    }),
  };
}

/** Simulates cookie-client update chain: from("businesses").update(obj).eq("id", id) */
function makeCookieFrom(updateFn: typeof cookieUpdateMock) {
  return (_table: string) => ({
    update: updateFn,
  });
}

function makeRequest(body: unknown, id = BIZ_ID) {
  return new Request(`https://x.test/api/business/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext(id = BIZ_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getUserMock.mockReset();
  cookieRpcMock.mockReset();
  cookieUpdateMock.mockReset();
  cookieFromMock.mockReset();
  serviceFromMock.mockReset();

  // Default: update succeeds
  cookieUpdateMock.mockReturnValue({
    eq: async () => ({ error: null }),
  });
  cookieFromMock.mockImplementation(makeCookieFrom(cookieUpdateMock));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/business/[id]", () => {
  it("(a) no user → 401 UNAUTH", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const res = await PATCH(makeRequest({ trade_name: "New Name" }), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTH");
  });

  it("(b) signed-in non-owner (is_business_member=false) → 403 FORBIDDEN", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "non-owner-user" } } });
    // Existence check passes
    serviceFromMock.mockReturnValue(makeExistenceFetch(true));
    // Not an owner
    cookieRpcMock.mockResolvedValue({ data: false, error: null });

    const res = await PATCH(makeRequest({ trade_name: "New Name" }), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FORBIDDEN");
  });

  it("(c) owner → 200 and businesses.update called with only allowed fields", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "owner-user" } } });
    serviceFromMock.mockReturnValue(makeExistenceFetch(true));
    cookieRpcMock.mockResolvedValue({ data: true, error: null });

    const res = await PATCH(
      makeRequest({ trade_name: "New Trade Name", city: "Ghent", country: "BE" }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.ok).toBe(true);

    // Assert update was called and received correct fields
    expect(cookieUpdateMock).toHaveBeenCalledOnce();
    const updateArg = cookieUpdateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.trade_name).toBe("New Trade Name");
    expect(updateArg.city).toBe("Ghent");
    expect(updateArg.country).toBe("BE");
  });

  it("(d) owner sends locked field kbo_number — stripped; trade_name applied; kbo_number absent in update", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "owner-user" } } });
    serviceFromMock.mockReturnValue(makeExistenceFetch(true));
    cookieRpcMock.mockResolvedValue({ data: true, error: null });

    const res = await PATCH(
      makeRequest({ kbo_number: "9999999999", trade_name: "Cleaned Name" }),
      makeContext(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(cookieUpdateMock).toHaveBeenCalledOnce();
    const updateArg = cookieUpdateMock.mock.calls[0][0] as Record<string, unknown>;
    // Allowed field applied
    expect(updateArg.trade_name).toBe("Cleaned Name");
    // Locked field NOT present in update
    expect(updateArg).not.toHaveProperty("kbo_number");
    // Other locked fields also not present
    expect(updateArg).not.toHaveProperty("legal_name");
    expect(updateArg).not.toHaveProperty("vat_number");
    expect(updateArg).not.toHaveProperty("status");
    expect(updateArg).not.toHaveProperty("entity_verified");
    expect(updateArg).not.toHaveProperty("created_by");
  });

  it("(e) owner sends invalid postcode → 400 INVALID_PAYLOAD", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "owner-user" } } });
    serviceFromMock.mockReturnValue(makeExistenceFetch(true));
    cookieRpcMock.mockResolvedValue({ data: true, error: null });

    const res = await PATCH(
      makeRequest({ postcode: "0123" }), // starts with 0 — invalid Belgian postcode
      makeContext(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_PAYLOAD");
  });

  it("business not found → 404 BUSINESS_NOT_FOUND", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "owner-user" } } });
    // Existence check: not found
    serviceFromMock.mockReturnValue(makeExistenceFetch(false));

    const res = await PATCH(makeRequest({ trade_name: "X" }), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("BUSINESS_NOT_FOUND");
  });
});
