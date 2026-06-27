import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const isVerifiedMock = vi.fn();
const canSellMock = vi.fn();
const checkBlockedMock = vi.fn();
// fromMock controls the supabase `.from()` behaviour per-test
const fromMock = vi.fn(() => ({}));

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
vi.mock("@/lib/auth/requireVerified", () => ({ isViewerVerified: (...a: unknown[]) => isVerifiedMock(...(a as [])) }));
vi.mock("@/lib/auth/canSellAsBusiness", () => ({ canSellAsBusiness: (...a: unknown[]) => canSellMock(...(a as [])) }));
vi.mock("@/lib/fraud/checkUserBlocked", () => ({ checkUserBlocked: (...a: unknown[]) => checkBlockedMock(...(a as [])) }));

const { POST } = await import("../route");

// Helper to create a JSON Request with optional body
function jsonReq(body?: unknown) {
  if (body === undefined) return undefined;
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
  });

  it("403 VERIFICATION_REQUIRED when signed in but unverified", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    isVerifiedMock.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
  });

  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/adverts — business gate (T17)", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    isVerifiedMock.mockReset();
    canSellMock.mockReset();
    checkBlockedMock.mockReset();
    fromMock.mockReset();
    // Default: user is verified, not blocked
    isVerifiedMock.mockResolvedValue(true);
    checkBlockedMock.mockResolvedValue({ isBlocked: false });
  });

  it("403 VERIFICATION_REQUIRED with detail=membership when canSellAsBusiness returns membership", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    canSellMock.mockResolvedValue({ ok: false, reason: "membership" });
    const res = await POST(jsonReq({ business_id: "biz-uuid-1" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
    expect(body.detail).toBe("membership");
  });

  it("403 VERIFICATION_REQUIRED with detail=not_active when business is not active", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    canSellMock.mockResolvedValue({ ok: false, reason: "not_active" });
    const res = await POST(jsonReq({ business_id: "biz-uuid-2" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("VERIFICATION_REQUIRED");
    expect(body.detail).toBe("not_active");
  });

  it("403 VERIFICATION_REQUIRED with detail=phone when canSellAsBusiness returns phone", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    canSellMock.mockResolvedValue({ ok: false, reason: "phone" });
    const res = await POST(jsonReq({ business_id: "biz-uuid-3" }));
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
    await POST(undefined);
    expect(canSellMock).not.toHaveBeenCalled();
  });

  it("proceeds to INSERT with business_id when canSellAsBusiness returns ok:true", async () => {
    const USER_ID = "u-biz-ok";
    const BIZ_ID = "biz-uuid-ok";

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

    // Table-aware from() mock: adverts chain captures insert args; other tables return a category row.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fromMock as any).mockImplementation((table: string) =>
      table === "adverts"
        ? advertsChain
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : makeChainable({ data: { id: "cat-1" } as any, error: null }),
    );

    const res = await POST(jsonReq({ business_id: BIZ_ID }));

    // Gate was called with the right arguments
    expect(canSellMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      BIZ_ID,
    );

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
