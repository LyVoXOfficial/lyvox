import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const serverFromMock = vi.fn();
const serviceFromMock = vi.fn();
const serviceRpcMock = vi.fn();
const isVerifiedMock = vi.fn();
const checkBlockedMock = vi.fn();
const invokeFraudCheckMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: serverFromMock }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: serviceFromMock, rpc: serviceRpcMock }),
}));

vi.mock("@/lib/auth/requireVerified", () => ({
  isViewerVerified: (...args: unknown[]) => isVerifiedMock(...args),
}));

vi.mock("@/lib/fraud/checkUserBlocked", () => ({
  checkUserBlocked: (...args: unknown[]) => checkBlockedMock(...args),
}));

vi.mock("@/lib/fraud/invokeFraudCheck", () => ({
  invokeFraudCheck: (...args: unknown[]) => invokeFraudCheckMock(...args),
}));

const { PATCH } = await import("../route");

const ADVERT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CATEGORY_ID = "33333333-3333-4333-8333-333333333333";
const BRUSSEL_LOCATION_ID = "44444444-4444-4444-8444-444444444444";

const makeRequest = (body: Record<string, unknown>) => new Request(
  `https://x.test/api/adverts/${ADVERT_ID}`,
  {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  },
) as NextRequest;

const makeContext = () => ({ params: Promise.resolve({ id: ADVERT_ID }) });

const makeSelectChain = (result: unknown) => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = async () => result;
  return chain;
};

const makeMediaCountChain = (count: number) => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = async () => ({ count, error: null });
  return chain;
};

const makeUpdateChain = (capture: (payload: Record<string, unknown>) => void) => {
  const chain: Record<string, unknown> = {};
  chain.update = (payload: Record<string, unknown>) => {
    capture(payload);
    return chain;
  };
  chain.eq = async () => ({ error: null });
  return chain;
};

const makeStaleTranslationsChain = (capture: (payload: Record<string, unknown>) => void) => {
  const chain: Record<string, unknown> = {};
  chain.update = (payload: Record<string, unknown>) => {
    capture(payload);
    return chain;
  };
  chain.eq = () => chain;
  chain.neq = async () => ({ error: null });
  return chain;
};

const makeInsertChain = () => ({ insert: async () => ({ error: null }) });

describe("PATCH /api/adverts/[id] geo resolve", () => {
  let capturedUpdate: Record<string, unknown> | null;
  let capturedStaleUpdate: Record<string, unknown> | null;

  beforeEach(() => {
    capturedUpdate = null;
    capturedStaleUpdate = null;
    getUserMock.mockReset().mockResolvedValue({ data: { user: { id: USER_ID } } });
    serverFromMock.mockReset();
    serviceFromMock.mockReset();
    serviceRpcMock.mockReset();
    isVerifiedMock.mockReset().mockResolvedValue(true);
    checkBlockedMock.mockReset().mockResolvedValue({ isBlocked: false });
    invokeFraudCheckMock.mockReset().mockResolvedValue({ blocked: false, flagged: false });

    serverFromMock.mockImplementation((table: string) => {
      if (table === "adverts") {
        return makeSelectChain({
          data: {
            id: ADVERT_ID,
            user_id: USER_ID,
            status: "draft",
            category_id: CATEGORY_ID,
            title: "Existing title",
            description: "Existing description",
            price: 10,
            currency: "EUR",
            condition: "used",
            location: null,
            location_id: null,
            content_locale: "en",
          },
          error: null,
        });
      }
      if (table === "media") return makeMediaCountChain(1);
      throw new Error(`Unexpected server table: ${table}`);
    });

    serviceFromMock.mockImplementation((table: string) => {
      if (table === "adverts") return makeUpdateChain((payload) => { capturedUpdate = payload; });
      if (table === "advert_translations") {
        return makeStaleTranslationsChain((payload) => { capturedStaleUpdate = payload; });
      }
      if (table === "logs") return makeInsertChain();
      throw new Error(`Unexpected service table: ${table}`);
    });
  });

  it("resolves a known Belgian city into location_id when publishing", async () => {
    serviceRpcMock.mockResolvedValue({ data: BRUSSEL_LOCATION_ID, error: null });

    const response = await PATCH(makeRequest({
      title: "City bike",
      description: "A city bike in good condition",
      condition: "used",
      location: "Brussel, 1000",
      status: "active",
    }), makeContext());

    expect(response.status).toBe(200);
    expect(serviceRpcMock).toHaveBeenCalledWith("resolve_location_id", {
      p_location: "Brussel, 1000",
    });
    expect(capturedUpdate).toMatchObject({
      location: "Brussel, 1000",
      location_id: BRUSSEL_LOCATION_ID,
      status: "active",
    });
    expect(capturedStaleUpdate).toEqual({ status: "stale" });
  });

  it("keeps publishing successful and stores null location_id for an unknown city", async () => {
    serviceRpcMock.mockResolvedValue({ data: null, error: null });

    const response = await PATCH(makeRequest({
      title: "Desk lamp",
      description: "A simple desk lamp",
      condition: "used",
      location: "Atlantis, 9999",
      status: "active",
    }), makeContext());

    expect(response.status).toBe(200);
    expect(capturedUpdate).toMatchObject({
      location: "Atlantis, 9999",
      location_id: null,
      status: "active",
    });
    expect(capturedStaleUpdate).toEqual({ status: "stale" });
  });
});
