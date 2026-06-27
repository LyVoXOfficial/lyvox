import { describe, it, expect, beforeEach, vi } from "vitest";

// --- mocks (must be hoisted before imports) ---

const getUserMock = vi.fn();
const cookieRpcMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    rpc: cookieRpcMock,
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
const { GET } = await import("../route");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTIVE_BUSINESS = {
  id: "biz-1",
  legal_name: "Test BV",
  trade_name: "Tester",
  legal_form: "BV",
  address_line: "Rue Test 1",
  postcode: "1000",
  city: "Brussels",
  country: "BE",
  kbo_number: "0203201340",
  vat_number: "0203201340",
  vat_liable: true,
  email: "test@example.com",
  phone_e164: "+32470000000",
  withdrawal_terms: "14-day right of withdrawal.",
  self_certified_at: "2026-06-27T00:00:00.000Z",
  self_certified_ip: "1.2.3.4",
  entity_verified: true,
  status: "active",
  created_by: "user-secret-uuid",
  returns_url: null,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-27T00:00:00.000Z",
};

const DRAFT_BUSINESS = {
  ...ACTIVE_BUSINESS,
  id: "biz-draft",
  status: "draft",
  entity_verified: false,
};

function makeContext(id = "biz-1") {
  return { params: Promise.resolve({ id }) };
}

function makeGet(id = "biz-1") {
  return new Request(`https://x.test/api/business/${id}`, { method: "GET" });
}

// Build a chainable mock: from("businesses").select("*").eq("id", id).maybeSingle()
function makeBusinessFetch(row: unknown | null, error = null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: row, error }),
      }),
    }),
  };
}

// Build verification fetch chain: from("verifications").select(...).eq().eq().order()
function makeVerificationFetch(rows: unknown[] = []) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          order: async () => ({ data: rows, error: null }),
        }),
      }),
    }),
  };
}

beforeEach(() => {
  getUserMock.mockReset();
  cookieRpcMock.mockReset();
  serviceFromMock.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/business/[id]", () => {
  it("(a) 404 BUSINESS_NOT_FOUND when business does not exist", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    serviceFromMock.mockReturnValue(makeBusinessFetch(null));

    const res = await GET(makeGet("no-such-id"), makeContext("no-such-id"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("BUSINESS_NOT_FOUND");
  });

  it("(b) anon + active → public subset; created_by absent; badges present", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    serviceFromMock.mockImplementation((table: string) => {
      if (table === "businesses") return makeBusinessFetch(ACTIVE_BUSINESS);
      throw new Error("unexpected table: " + table);
    });

    const res = await GET(makeGet(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const biz = body.data.business;
    // Public subset fields present
    expect(biz.legal_name).toBe("Test BV");
    expect(biz.kbo_number).toBe("0203201340");
    expect(biz.withdrawal_terms).toBe("14-day right of withdrawal.");
    expect(biz.entity_verified).toBe(true);

    // Forbidden fields absent
    expect(biz.created_by).toBeUndefined();
    expect(biz.self_certified_ip).toBeUndefined();
    expect(biz.created_at).toBeUndefined();

    // Badges present
    expect(body.data.badges).toEqual({
      verified_business: true,
      vat_registered: true,
    });
  });

  it("(c) anon + draft → 404 (don't reveal draft)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    serviceFromMock.mockImplementation((table: string) => {
      if (table === "businesses") return makeBusinessFetch(DRAFT_BUSINESS);
      throw new Error("unexpected table: " + table);
    });

    const res = await GET(makeGet("biz-draft"), makeContext("biz-draft"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("BUSINESS_NOT_FOUND");
  });

  it("(d) member → full row incl. status, withdrawal_terms, verifications", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "member-user" } } });
    // is_business_member returns true for this user
    cookieRpcMock.mockResolvedValue({ data: true, error: null });

    const verificationRows = [
      { method: "vies", status: "verified", verified_at: "2026-06-27T00:00:00.000Z", created_at: "2026-06-27T00:00:00.000Z" },
    ];

    serviceFromMock.mockImplementation((table: string) => {
      if (table === "businesses") return makeBusinessFetch(ACTIVE_BUSINESS);
      if (table === "verifications") return makeVerificationFetch(verificationRows);
      throw new Error("unexpected table: " + table);
    });

    const res = await GET(makeGet(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Full row: status and withdrawal_terms present
    const biz = body.data.business;
    expect(biz.status).toBe("active");
    expect(biz.withdrawal_terms).toBe("14-day right of withdrawal.");
    // created_by still present in full row
    expect(biz.created_by).toBe("user-secret-uuid");

    // Verifications summary
    expect(body.data.verifications).toHaveLength(1);
    expect(body.data.verifications[0].method).toBe("vies");
    expect(body.data.verifications[0].status).toBe("verified");

    // Badges
    expect(body.data.badges.verified_business).toBe(true);
    expect(body.data.badges.vat_registered).toBe(true);
  });

  it("(d2) admin → full row without is_business_member check", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-user", app_metadata: { role: "admin" } } },
    });
    // rpc should NOT be called for admin
    cookieRpcMock.mockResolvedValue({ data: null, error: null });

    const verificationRows: unknown[] = [];

    serviceFromMock.mockImplementation((table: string) => {
      if (table === "businesses") return makeBusinessFetch(ACTIVE_BUSINESS);
      if (table === "verifications") return makeVerificationFetch(verificationRows);
      throw new Error("unexpected table: " + table);
    });

    const res = await GET(makeGet(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.business.status).toBe("active");

    // Admin path skips the member RPC
    expect(cookieRpcMock).not.toHaveBeenCalled();
  });
});
