import { describe, it, expect, beforeEach, vi } from "vitest";

// --- mocks (hoisted before any import of the module under test) ---

const getUserMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
  }),
}));

const serviceClientMock = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => serviceClientMock,
}));

vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({
    success: true, limit: 10, remaining: 9, reset: 0, retryAfterSec: 0,
  }),
  withRateLimit: (handler: unknown) => handler,
  getClientIp: () => "1.2.3.4",
}));

const runViesVerificationMock = vi.fn();
vi.mock("@/lib/verification/runViesVerification", () => ({
  runViesVerification: (...args: unknown[]) => runViesVerificationMock(...args),
}));

// Import after mocks
const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(id = "biz-uuid-1") {
  return new Request(`https://x.test/api/business/${id}/verify`, {
    method: "POST",
  });
}

function makeContext(id = "biz-uuid-1") {
  return { params: Promise.resolve({ id }) };
}

const VERIFIED_RESULT = {
  method: "vies" as const,
  status: "verified" as const,
  entity_verified: true,
  business_status: "active",
  evidence: { name_match: "auto", requestDate: "2026-06-27" },
};

beforeEach(() => {
  getUserMock.mockReset();
  rpcMock.mockReset();
  runViesVerificationMock.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/business/[id]/verify", () => {
  it("401 when no user session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTHENTICATED");
  });

  it("403 when user is not admin of the business", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: false, error: null });

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FORBIDDEN");

    // Verify rpc was called with correct args
    expect(rpcMock).toHaveBeenCalledWith("is_business_member", {
      b_id: "biz-uuid-1",
      min_role: "admin",
    });
  });

  it("404 when business does not exist (core returns not_found)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: true, error: null });
    runViesVerificationMock.mockResolvedValue({
      method: "vies",
      status: "failed",
      entity_verified: false,
      business_status: "not_found",
      evidence: {},
    });

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("BUSINESS_NOT_FOUND");
  });

  it("200 with full result when admin calls on existing vat_liable business", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: true, error: null });
    runViesVerificationMock.mockResolvedValue(VERIFIED_RESULT);

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.method).toBe("vies");
    expect(body.data.status).toBe("verified");
    expect(body.data.entity_verified).toBe(true);
    expect(body.data.business_status).toBe("active");
    expect(body.data.evidence).toMatchObject({ name_match: "auto" });

    // Core was called with the service client and the correct id
    expect(runViesVerificationMock).toHaveBeenCalledWith(serviceClientMock, "biz-uuid-1");
  });

  it("200 with pending result for non-VAT business (kbo path)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpcMock.mockResolvedValue({ data: true, error: null });
    runViesVerificationMock.mockResolvedValue({
      method: "kbo",
      status: "pending",
      entity_verified: false,
      business_status: "active",
      evidence: { note: "awaiting_admin_no_vat" },
    });

    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.method).toBe("kbo");
    expect(body.data.status).toBe("pending");
  });
});
