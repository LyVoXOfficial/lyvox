import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const isVerifiedMock = vi.fn();
const canSellMock = vi.fn();
const checkBlockedMock = vi.fn();
const invokeFraudCheckMock = vi.fn();
// fromMock controls the cookie supabase `.from()` behaviour per-test (categories lookup)
const fromMock = vi.fn(() => ({}));
// serviceFromMock controls the service-role supabase `.from()` (adverts insert)
const serviceFromMock = vi.fn(() => ({}));

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: serviceFromMock }),
}));
vi.mock("@/lib/auth/requireVerified", () => ({ isViewerVerified: (...a: unknown[]) => isVerifiedMock(...(a as [])) }));
vi.mock("@/lib/auth/canSellAsBusiness", () => ({ canSellAsBusiness: (...a: unknown[]) => canSellMock(...(a as [])) }));
vi.mock("@/lib/fraud/checkUserBlocked", () => ({ checkUserBlocked: (...a: unknown[]) => checkBlockedMock(...(a as [])) }));
vi.mock("@/lib/fraud/invokeFraudCheck", () => ({ invokeFraudCheck: (...a: unknown[]) => invokeFraudCheckMock(...(a as [])) }));

const { POST } = await import("../route");

// Helper to create a JSON Request with optional body
function jsonReq(body?: unknown) {
  if (body === undefined) {
    return new Request("https://x.test/api/adverts", { method: "POST" });
  }
  return new Request("https://x.test/api/adverts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// A chainable Supabase query mock that resolves with no data (categories → null → CATEGORY_LOOKUP_FAILED)
function makeChainable(result = { data: null, error: null }) {
  const c: Record<string, unknown> = {};
  c.select = () => c;
  c.eq = () => c;
  c.order = () => c;
  c.limit = () => c;
  c.maybeSingle = async () => result;
  c.insert = async () => result;
  c.single = async () => result;
  return c;
}

describe("POST /api/adverts verification gate", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    isVerifiedMock.mockReset();
    canSellMock.mockReset();
    checkBlockedMock.mockReset();
    fromMock.mockReset().mockReturnValue({});
    serviceFromMock.mockReset().mockReturnValue({});
  });

  it("allows draft creation for signed-in but unverified user (verification is gated at publish only)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    isVerifiedMock.mockResolvedValue(false);
    checkBlockedMock.mockResolvedValue({ isBlocked: false });
    // Route proceeds past verification; categories lookup returns null → CATEGORY_LOOKUP_FAILED (not 403)
    fromMock.mockReturnValue(makeChainable());
    const res = await POST(jsonReq());
    // Unverified user must NOT get 403 VERIFICATION_REQUIRED for draft creation
    expect(res.status).not.toBe(403);
    const body = await res.json();
    expect(body.error).not.toBe("VERIFICATION_REQUIRED");
  });

  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(jsonReq());
    expect(res.status).toBe(401);
  });
});

describe("POST /api/adverts — business gate (T17)", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    isVerifiedMock.mockReset();
    canSellMock.mockReset();
    checkBlockedMock.mockReset();
    invokeFraudCheckMock.mockReset();
    fromMock.mockReset();
    serviceFromMock.mockReset();
    // Default: user is verified, not blocked, fraud check passes
    isVerifiedMock.mockResolvedValue(true);
    checkBlockedMock.mockResolvedValue({ isBlocked: false });
    invokeFraudCheckMock.mockResolvedValue({ blocked: false, flagged: false });
  });

  it("403 VERIFICATION_REQUIRED with detail=membership when canSellAsBusiness returns membership", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    canSellMock.mockResolvedValue({ ok: false, reason: "membership" });
    const res = await POST(jsonReq({ business_id: "aaaaaaaa-1111-4111-8111-111111111111" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
    expect(body.detail).toBe("membership");
  });

  it("403 VERIFICATION_REQUIRED with detail=not_active when business is not active", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    canSellMock.mockResolvedValue({ ok: false, reason: "not_active" });
    const res = await POST(jsonReq({ business_id: "bbbbbbbb-2222-4222-8222-222222222222" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
    expect(body.detail).toBe("not_active");
  });

  it("403 VERIFICATION_REQUIRED with detail=phone when canSellAsBusiness returns phone", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    canSellMock.mockResolvedValue({ ok: false, reason: "phone" });
    const res = await POST(jsonReq({ business_id: "cccccccc-3333-4333-8333-333333333333" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
    expect(body.detail).toBe("phone");
  });

  it("no canSellAsBusiness call for personal advert (no business_id in body)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    // Provide a chainable from-mock so the route can proceed past the gate check
    fromMock.mockReturnValue(makeChainable());
    await POST(jsonReq({}));
    expect(canSellMock).not.toHaveBeenCalled();
  });

  it("no canSellAsBusiness call when req is undefined (legacy no-body call)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue(makeChainable());
    await POST(jsonReq(undefined));
    expect(canSellMock).not.toHaveBeenCalled();
  });

  it("proceeds to INSERT with business_id when canSellAsBusiness returns ok:true — INSERT is on service-role client", async () => {
    const USER_ID = "u-biz-ok";
    const BIZ_ID = "dddddddd-4444-4444-8444-444444444444";

    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    canSellMock.mockResolvedValue({ ok: true });

    // Capture the row passed to insert so we can assert business_id is included
    let capturedInsertRow: Record<string, unknown> | null = null;
    const advertsChain: Record<string, unknown> = {};
    advertsChain.insert = (row: Record<string, unknown>) => {
      capturedInsertRow = row;
      return advertsChain;
    };
    advertsChain.select = () => advertsChain;
    advertsChain.single = async () => ({
      data: { id: "advert-new-1", status: "draft", category_id: "cat-1" },
      error: null,
    });

    // Cookie client (fromMock): only categories lookup — returns a category row, NOT adverts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fromMock as any).mockImplementation((table: string) => {
      // The cookie client should NEVER be called with "adverts" after this change
      if (table === "adverts") throw new Error("BUG: adverts insert must use service-role client, not cookie client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return makeChainable({ data: { id: "cat-1" } as any, error: null });
    });

    // Service-role client (serviceFromMock): handles adverts insert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceFromMock as any).mockImplementation((table: string) => {
      if (table === "adverts") return advertsChain;
      return makeChainable();
    });

    const res = await POST(jsonReq({ business_id: BIZ_ID }));

    // Gate was called with the right arguments
    expect(canSellMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      BIZ_ID,
    );

    // The insert went through the service-role client
    expect(serviceFromMock).toHaveBeenCalledWith("adverts");

    // The inserted draft carried business_id
    expect(capturedInsertRow).not.toBeNull();
    expect(capturedInsertRow!.business_id).toBe(BIZ_ID);

    // Route returned success
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.advert.id).toBe("advert-new-1");
  });
});

describe("POST /api/adverts — F9 fraud gate", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    isVerifiedMock.mockReset();
    canSellMock.mockReset();
    checkBlockedMock.mockReset();
    invokeFraudCheckMock.mockReset();
    fromMock.mockReset();
    serviceFromMock.mockReset();
    isVerifiedMock.mockResolvedValue(true);
    invokeFraudCheckMock.mockResolvedValue({ blocked: false, flagged: false });
  });

  it("403 FORBIDDEN when user is blocked (failClosed scenario)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    checkBlockedMock.mockResolvedValue({
      isBlocked: true,
      blockedUntil: "2999-01-01T00:00:00Z",
      reason: "Account flagged for fraud",
    });
    const res = await POST(jsonReq());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
    // detail is the reason string returned by checkUserBlocked
    expect(body.detail).toBe("Account flagged for fraud");
  });

  it("calls checkUserBlocked with failClosed:true on every create", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u-fc" } } });
    checkBlockedMock.mockResolvedValue({ isBlocked: false });
    // categories lookup → null → route returns CATEGORY_LOOKUP_FAILED, but checkBlocked was already called
    fromMock.mockReturnValue(makeChainable());
    await POST(jsonReq(undefined));
    expect(checkBlockedMock).toHaveBeenCalledWith("u-fc", { failClosed: true });
  });
});
