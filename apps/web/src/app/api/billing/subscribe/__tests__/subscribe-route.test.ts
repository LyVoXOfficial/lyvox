import { describe, it, expect, beforeEach, vi } from "vitest";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE dynamic import of the route
// ---------------------------------------------------------------------------

const getUserMock = vi.fn();
const fromServerMock = vi.fn();
const fromServiceMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    from: fromServerMock,
  }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: fromServiceMock,
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
}));

const customersCreateMock = vi.fn();
const sessionsCreateMock = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  getStripe: (): Pick<Stripe, "customers" | "checkout"> =>
    ({
      customers: {
        create: customersCreateMock,
      },
      checkout: {
        sessions: {
          create: sessionsCreateMock,
        },
      },
    }) as unknown as Stripe,
}));

vi.mock("@/lib/capabilities", () => ({
  isCapabilityEnabled: vi.fn(),
}));

// Import after mocks are registered
import { isCapabilityEnabled } from "@/lib/capabilities";
const isCapabilityEnabledMock = vi.mocked(isCapabilityEnabled);

const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq() {
  return new Request("https://x.test/api/billing/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

// Supabase fluent builder for profiles.select
function makeProfileSelectChain(stripe_customer_id: string | null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: { stripe_customer_id },
          error: null,
        }),
      }),
    }),
  };
}

// Supabase fluent builder for profiles.update (service-role)
function makeProfileUpdateChain(error: { message: string } | null = null) {
  return {
    update: () => ({
      eq: async () => ({ error }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/billing/subscribe", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.STRIPE_PRO_PRICE_ID;
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.lyvox.be";
  });

  // (a) Flag OFF → 404 FEATURE_DISABLED, Stripe NOT called
  it("(a) returns 404 FEATURE_DISABLED when capability flag is OFF", async () => {
    isCapabilityEnabledMock.mockReturnValue(false);

    const res = await POST(makeReq());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FEATURE_DISABLED");
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  // (b) Flag ON but STRIPE_PRO_PRICE_ID unset → 404
  it("(b) returns 404 FEATURE_DISABLED when STRIPE_PRO_PRICE_ID is not set", async () => {
    isCapabilityEnabledMock.mockReturnValue(true);
    // STRIPE_PRO_PRICE_ID is already deleted in beforeEach

    const res = await POST(makeReq());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FEATURE_DISABLED");
    expect(customersCreateMock).not.toHaveBeenCalled();
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  // (c) Flag ON + price set + no user → 401
  it("(c) returns 401 when not signed in", async () => {
    isCapabilityEnabledMock.mockReturnValue(true);
    process.env.STRIPE_PRO_PRICE_ID = "price_test_123";

    getUserMock.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeReq());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTH");
  });

  // (d) Happy path — user HAS an existing stripe_customer_id → reuse, no customers.create
  it("(d) reuses existing stripe_customer_id and returns 200 with url", async () => {
    isCapabilityEnabledMock.mockReturnValue(true);
    process.env.STRIPE_PRO_PRICE_ID = "price_test_pro_456";

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "seller@example.com" } },
    });

    fromServerMock.mockImplementation((table: string) => {
      if (table === "profiles") return makeProfileSelectChain("cus_existing_789");
      throw new Error("unexpected table: " + table);
    });

    sessionsCreateMock.mockResolvedValue({
      id: "cs_test_session_id",
      url: "https://checkout.stripe.com/pay/cs_test_session_id",
    });

    const res = await POST(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.url).toBe("https://checkout.stripe.com/pay/cs_test_session_id");

    // Must NOT create a new customer
    expect(customersCreateMock).not.toHaveBeenCalled();

    // Must call checkout.sessions.create with the correct params
    expect(sessionsCreateMock).toHaveBeenCalledOnce();
    const callArg = sessionsCreateMock.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(callArg.mode).toBe("subscription");
    expect(callArg.customer).toBe("cus_existing_789");
    expect(callArg.line_items).toHaveLength(1);
    const lineItem = callArg.line_items![0] as Stripe.Checkout.SessionCreateParams.LineItem;
    expect(lineItem.price).toBe("price_test_pro_456");
    expect(lineItem.quantity).toBe(1);
  });

  // (e) Happy path — user has NO stripe_customer_id → create customer + persist via service-role
  it("(e) creates stripe customer, persists via service-role, returns 200 with url", async () => {
    isCapabilityEnabledMock.mockReturnValue(true);
    process.env.STRIPE_PRO_PRICE_ID = "price_test_pro_456";

    getUserMock.mockResolvedValue({
      data: { user: { id: "user-2", email: "new@example.com" } },
    });

    fromServerMock.mockImplementation((table: string) => {
      if (table === "profiles") return makeProfileSelectChain(null);
      throw new Error("unexpected server table: " + table);
    });

    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          update: () => ({
            eq: updateEqMock,
          }),
        };
      }
      throw new Error("unexpected service table: " + table);
    });

    customersCreateMock.mockResolvedValue({ id: "cus_new_created_abc" });

    sessionsCreateMock.mockResolvedValue({
      id: "cs_test_new_session",
      url: "https://checkout.stripe.com/pay/cs_test_new_session",
    });

    const res = await POST(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.url).toBe("https://checkout.stripe.com/pay/cs_test_new_session");

    // Must create a Stripe customer
    expect(customersCreateMock).toHaveBeenCalledOnce();
    expect(customersCreateMock.mock.calls[0][0]).toMatchObject({
      email: "new@example.com",
      metadata: { user_id: "user-2" },
    });

    // Must persist stripe_customer_id via service-role
    expect(fromServiceMock).toHaveBeenCalledWith("profiles");
    expect(updateEqMock).toHaveBeenCalledWith("id", "user-2");

    // Must call checkout.sessions.create with mode:subscription + new customer id
    expect(sessionsCreateMock).toHaveBeenCalledOnce();
    const callArg = sessionsCreateMock.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(callArg.mode).toBe("subscription");
    expect(callArg.customer).toBe("cus_new_created_abc");
    expect(callArg.client_reference_id).toBe("user-2");
    expect(callArg.metadata).toMatchObject({ user_id: "user-2", plan: "pro" });
    const lineItem = callArg.line_items![0] as Stripe.Checkout.SessionCreateParams.LineItem;
    expect(lineItem.price).toBe("price_test_pro_456");
  });
});
