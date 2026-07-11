import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getIntegrationStatusMock = vi.fn();
const getUserMock = vi.fn();
const fromServerMock = vi.fn();
const fromServiceMock = vi.fn();
const sessionsCreateMock = vi.fn();
const sessionsExpireMock = vi.fn();
const checkUserBlockedMock = vi.fn();

vi.mock("@/lib/integrations/registry", () => ({
  getIntegrationStatus: (...args: unknown[]) => getIntegrationStatusMock(...args),
}));

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: fromServerMock }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: fromServiceMock }),
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: sessionsCreateMock, expire: sessionsExpireMock } },
  }),
}));

vi.mock("@/lib/fraud/checkUserBlocked", () => ({
  checkUserBlocked: (...args: unknown[]) => checkUserBlockedMock(...args),
}));

vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => vi.fn(),
  withRateLimit: (handler: unknown) => handler,
}));

vi.mock("@/lib/security/csrf", () => ({ withCsrfProtection: (handler: unknown) => handler }));

const { POST } = await import("../route");

function request(body: Record<string, unknown>) {
  return new Request("https://x.test/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function terminalEq<T>(result: T) {
  const chain = {
    eq: () => chain,
    maybeSingle: async () => result,
  };
  return chain;
}

describe("POST /api/billing/checkout", () => {
  const advertId = "11111111-1111-4111-8111-111111111111";
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.lyvox.be";
    process.env.STRIPE_SECRET_KEY = "sk_live_present_but_not_authoritative";
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    checkUserBlockedMock.mockResolvedValue({ isBlocked: false });
  });

  it("keeps Stripe, auth and financial DB writes unreachable when effective capability is off", async () => {
    getIntegrationStatusMock.mockResolvedValue({ effective: false });

    const response = await POST(request({ product_code: "boost_7d", advert_id: advertId }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("FEATURE_DISABLED");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(fromServiceMock).not.toHaveBeenCalled();
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("fails closed before auth or DB writes when the canonical site URL is missing", async () => {
    getIntegrationStatusMock.mockResolvedValue({ effective: true });
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const response = await POST(
      request({ product_code: "boost_7d", advert_id: advertId }),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("FEATURE_DISABLED");
    expect(getUserMock).not.toHaveBeenCalled();
    expect(fromServiceMock).not.toHaveBeenCalled();
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("creates the versioned purchase through service role before an exact Stripe session", async () => {
    getIntegrationStatusMock.mockResolvedValue({ effective: true });
    const product = {
      id: "product-1",
      code: "boost_7d",
      name: { en: "Listing benefit — 7 days" },
      price_cents: 500,
      currency: "EUR",
      capability: "paid_boosts",
      benefit_type: "boost",
      duration_days: 7,
      requires_advert: true,
      offer_version: 3,
      tax_behavior: "inclusive",
    };

    fromServerMock.mockImplementation((table: string) => {
      if (table === "products") return { select: () => terminalEq({ data: product, error: null }) };
      if (table === "adverts") {
        return {
          select: () => terminalEq({
            data: { id: advertId, user_id: "user-1", status: "active" },
            error: null,
          }),
        };
      }
      throw new Error(`Unexpected cookie-client table: ${table}`);
    });

    const insertMock = vi.fn(() => ({
      select: () => ({ single: async () => ({ data: { id: "purchase-1" }, error: null }) }),
    }));
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    fromServiceMock.mockImplementation((table: string) => {
      if (table !== "purchases") throw new Error(`Unexpected service table: ${table}`);
      return {
        insert: insertMock,
        update: () => ({ eq: updateEqMock }),
      };
    });
    sessionsCreateMock.mockResolvedValue({ id: "cs_exact", url: "https://checkout.stripe.test/cs_exact" });

    const response = await POST(request({ product_code: "boost_7d", advert_id: advertId }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.url).toBe("https://checkout.stripe.test/cs_exact");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        advert_id: advertId,
        product_code: "boost_7d",
        product_offer_version: 3,
        status: "pending",
      }),
    );
    expect(sessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        automatic_tax: { enabled: true },
        billing_address_collection: "required",
        client_reference_id: "purchase-1",
        metadata: expect.objectContaining({
          purchase_id: "purchase-1",
          user_id: "user-1",
          advert_id: advertId,
        }),
        success_url:
          "https://www.lyvox.be/profile/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://www.lyvox.be/profile/billing?checkout=cancel",
      }),
    );
    expect(updateEqMock).toHaveBeenCalledWith("id", "purchase-1");
  });

  it("expires and withholds a Checkout URL when the provider session cannot be journaled", async () => {
    getIntegrationStatusMock.mockResolvedValue({ effective: true });
    const product = {
      id: "product-1",
      code: "boost_7d",
      name: { en: "Listing benefit - 7 days" },
      price_cents: 500,
      currency: "EUR",
      capability: "paid_boosts",
      benefit_type: "boost",
      duration_days: 7,
      requires_advert: true,
      offer_version: 3,
      tax_behavior: "inclusive",
    };

    fromServerMock.mockImplementation((table: string) => {
      if (table === "products") return { select: () => terminalEq({ data: product, error: null }) };
      if (table === "adverts") {
        return {
          select: () =>
            terminalEq({
              data: { id: advertId, user_id: "user-1", status: "active" },
              error: null,
            }),
        };
      }
      throw new Error(`Unexpected cookie-client table: ${table}`);
    });

    const insertMock = vi.fn(() => ({
      select: () => ({ single: async () => ({ data: { id: "purchase-1" }, error: null }) }),
    }));
    const updateMock = vi.fn((data: Record<string, unknown>) => ({
      eq: async () => ({ error: data.provider_session_id ? { message: "db unavailable" } : null }),
    }));
    fromServiceMock.mockReturnValue({ insert: insertMock, update: updateMock });
    sessionsCreateMock.mockResolvedValue({
      id: "cs_unjournaled",
      url: "https://checkout.stripe.test/cs_unjournaled",
    });
    sessionsExpireMock.mockResolvedValue({ id: "cs_unjournaled", status: "expired" });

    const response = await POST(request({ product_code: "boost_7d", advert_id: advertId }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.data).toBeUndefined();
    expect(sessionsExpireMock).toHaveBeenCalledWith("cs_unjournaled");
    expect(updateMock).toHaveBeenCalledWith({ status: "failed" });
  });
});
