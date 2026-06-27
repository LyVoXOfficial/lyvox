import { describe, it, expect, beforeEach, vi } from "vitest";

// --- mocks (must be hoisted before imports) ---

const getUserMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
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
  getClientIp: () => "1.2.3.4",
}));

const isViewerVerifiedMock = vi.fn();
vi.mock("@/lib/auth/requireVerified", () => ({
  isViewerVerified: (...args: unknown[]) => isViewerVerifiedMock(...args),
}));

// --- import route AFTER mocks ---
const { POST } = await import("../route");

// --- helpers ---

const VALID_BODY = {
  legal_name: "Test BV",
  kbo_number: "0203201340", // NBB — known-good MOD-97 number
  vat_number: "0203201340",
  vat_liable: true,
  address_line: "Rue Test 1",
  postcode: "1000",
  city: "Brussels",
  country: "BE",
  email: "test@example.com",
  withdrawal_terms: "14-day right of withdrawal applies.",
  self_certified: true as const,
};

const VALID_BODY_NO_VAT = {
  ...VALID_BODY,
  vat_liable: false,
  vat_number: undefined,
};

function jsonReq(body: unknown) {
  return new Request("https://x.test/api/business", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Build a chainable Supabase mock for .from(table).update(...).eq(...)
function makeUpdateChain(error: unknown = null) {
  return {
    update: () => ({
      eq: async () => ({ error }),
    }),
  };
}

function makeInsertChain(error: unknown = null) {
  return {
    insert: vi.fn(async () => ({ error })),
  };
}

beforeEach(() => {
  getUserMock.mockReset();
  fromMock.mockReset();
  rpcMock.mockReset();
  isViewerVerifiedMock.mockReset();
});

// --- test cases ---

describe("POST /api/business", () => {
  it("(a) 401 when no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTHENTICATED");
  });

  it("(b) 403 with detail 'phone' when user is not phone-verified", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    isViewerVerifiedMock.mockResolvedValue(false);
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("VERIFICATION_REQUIRED");
    expect(body.detail).toBe("phone");
  });

  it("(c) 400 on invalid body (bad kbo)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    isViewerVerifiedMock.mockResolvedValue(true);
    const res = await POST(
      jsonReq({ ...VALID_BODY, kbo_number: "0000000000" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_PAYLOAD");
  });

  it("(d) 409 KBO_IN_USE when create_business returns 23505 on kbo key", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    isViewerVerifiedMock.mockResolvedValue(true);
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "businesses_kbo_number_key"',
      },
    });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("KBO_IN_USE");
  });

  it("(d2) 409 VAT_IN_USE when create_business returns 23505 on vat key", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    isViewerVerifiedMock.mockResolvedValue(true);
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "businesses_vat_number_key"',
      },
    });
    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("VAT_IN_USE");
  });

  it("(d3) 401 (not 400) when unauthenticated request has invalid body", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(
      jsonReq({ kbo_number: "bad", vat_liable: "not-a-bool" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTHENTICATED");
  });

  it("(e) 200 happy path vat_liable=true: business_id, status active, vies pending, verifications insert called", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    isViewerVerifiedMock.mockResolvedValue(true);
    rpcMock.mockResolvedValue({ data: "biz-uuid-1", error: null });

    const verificationsInsert = vi.fn(async () => ({ error: null }));

    fromMock.mockImplementation((table: string) => {
      if (table === "businesses") {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === "verifications") {
        return { insert: verificationsInsert };
      }
      throw new Error("unexpected table: " + table);
    });

    const res = await POST(jsonReq(VALID_BODY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.business_id).toBe("biz-uuid-1");
    expect(body.data.status).toBe("active");
    expect(body.data.entity_verified).toBe(false);
    expect(body.data.verification.vies).toBe("pending");
    expect(verificationsInsert).toHaveBeenCalledOnce();
  });

  it("(f) 200 happy path vat_liable=false: vies n/a, no verifications insert", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    isViewerVerifiedMock.mockResolvedValue(true);
    rpcMock.mockResolvedValue({ data: "biz-uuid-2", error: null });

    const verificationsInsert = vi.fn(async () => ({ error: null }));

    fromMock.mockImplementation((table: string) => {
      if (table === "businesses") {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === "verifications") {
        return { insert: verificationsInsert };
      }
      throw new Error("unexpected table: " + table);
    });

    const res = await POST(jsonReq(VALID_BODY_NO_VAT));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.business_id).toBe("biz-uuid-2");
    expect(body.data.status).toBe("active");
    expect(body.data.entity_verified).toBe(false);
    expect(body.data.verification.vies).toBe("n/a");
    expect(verificationsInsert).not.toHaveBeenCalled();
  });
});
