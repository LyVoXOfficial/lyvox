/**
 * SEC-RL1 — rate-limit coverage for PATCH /api/adverts/[id] publish gate.
 *
 * Key behavioral guarantee: the publish rate limiter must be scoped to the
 * status:"active" transition only. A plain draft field edit must succeed
 * even when the publish limiter mock is set to deny, proving draft edits
 * are not throttled by the publish-only limiter.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const isVerifiedMock = vi.fn();
const checkBlockedMock = vi.fn();
const invokeFraudCheckMock = vi.fn();
const fromMock = vi.fn();
const serviceFromMock = vi.fn();

const ADVERT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));
vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: serviceFromMock,
    storage: { from: () => ({}) },
    rpc: async () => ({ data: null, error: null }),
  }),
}));
vi.mock("@/lib/auth/requireVerified", () => ({
  isViewerVerified: (...a: unknown[]) => isVerifiedMock(...(a as [])),
}));
vi.mock("@/lib/fraud/checkUserBlocked", () => ({
  checkUserBlocked: (...a: unknown[]) => checkBlockedMock(...(a as [])),
}));
vi.mock("@/lib/fraud/invokeFraudCheck", () => ({
  invokeFraudCheck: (...a: unknown[]) => invokeFraudCheckMock(...(a as [])),
}));
vi.mock("@/lib/translations/advertTranslations", () => ({
  markAdvertTranslationsStale: vi.fn(async () => null),
}));

const limiterMock = vi.fn(async () => ({
  success: true,
  limit: 10,
  remaining: 9,
  reset: 0,
  retryAfterSec: 0,
}));

vi.mock("@/lib/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimiter")>();
  return {
    ...actual,
    createRateLimiter: () => limiterMock,
  };
});

const { PATCH } = await import("../route");

function patchReq(body: unknown) {
  return new Request(`https://x.test/api/adverts/${ADVERT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx() {
  return { params: Promise.resolve({ id: ADVERT_ID }) };
}

/** Owned advert in "draft" status, with enough fields set to pass the publish gate. */
function makeOwnedDraftAdvert() {
  return (table: string) => {
    if (table === "adverts") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: ADVERT_ID,
                user_id: USER_ID,
                status: "draft",
                category_id: "cat-1",
                title: "Existing title",
                description: "Existing description long enough",
                price: 10,
                currency: "EUR",
                condition: "used",
                location: "Brussels",
                location_id: null,
                min_offer_cents: null,
                content_locale: "en",
              },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "media") {
      return {
        select: () => ({
          eq: () => Promise.resolve({ count: 3, error: null }),
        }),
      };
    }
    throw new Error("unexpected table " + table);
  };
}

function makeServiceClient() {
  return (table: string) => {
    if (table === "adverts") {
      return { update: () => ({ eq: async () => ({ error: null }) }) };
    }
    if (table === "logs") {
      return { insert: async () => ({ error: null }) };
    }
    throw new Error("unexpected service table " + table);
  };
}

describe("PATCH /api/adverts/[id] — SEC-RL1 publish rate limiting", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    isVerifiedMock.mockReset();
    checkBlockedMock.mockReset();
    invokeFraudCheckMock.mockReset();
    fromMock.mockReset();
    serviceFromMock.mockReset();

    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    fromMock.mockImplementation(makeOwnedDraftAdvert());
    serviceFromMock.mockImplementation(makeServiceClient());
    isVerifiedMock.mockResolvedValue(true);
    checkBlockedMock.mockResolvedValue({ isBlocked: false });
    invokeFraudCheckMock.mockResolvedValue({ blocked: false, flagged: false });

    limiterMock.mockClear();
    limiterMock.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: 0,
      retryAfterSec: 0,
    });
  });

  it("429 RATE_LIMITED when publishing (status:active) and the publish limiter denies", async () => {
    limiterMock.mockResolvedValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 600,
      retryAfterSec: 600,
    });

    const res = await PATCH(patchReq({ status: "active" }) as never, ctx());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("600");
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("RATE_LIMITED");
    // Verification gate must not have run — limiter check happens first.
    expect(isVerifiedMock).not.toHaveBeenCalled();
  });

  it("200 success when publishing and limiter allows", async () => {
    const res = await PATCH(patchReq({ status: "active" }) as never, ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("non-publishing PATCH (title edit) still succeeds even when the publish limiter mock denies", async () => {
    limiterMock.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 600,
      retryAfterSec: 600,
    });

    const res = await PATCH(patchReq({ title: "A brand new title" }) as never, ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Publish-only limiter must never be consulted for a non-publishing edit.
    expect(limiterMock).not.toHaveBeenCalled();
  });
});
