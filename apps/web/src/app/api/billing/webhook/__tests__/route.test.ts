import { describe, it, expect, beforeEach, vi } from "vitest";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE dynamic import of the route
// ---------------------------------------------------------------------------

const constructEventMock = vi.fn();
const subscriptionsRetrieveMock = vi.fn();
const fromServiceMock = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  getStripe: (): Pick<Stripe, "webhooks" | "subscriptions"> =>
    ({
      webhooks: {
        constructEvent: constructEventMock,
      },
      subscriptions: {
        retrieve: subscriptionsRetrieveMock,
      },
    }) as unknown as Stripe,
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: fromServiceMock,
  }),
}));

// Import the route after mocks are registered
const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest-compatible Request for the webhook route */
function makeWebhookReq(body = "raw-body") {
  return new Request("https://x.test/api/billing/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": "valid-sig",
      "Content-Type": "application/json",
    },
    body,
  });
}

/**
 * Build a minimal Stripe.Subscription stub with the fields our code uses.
 * current_period_end lives on items.data[0] in Stripe SDK v19.
 */
function makeSubscriptionStub(
  overrides: {
    id?: string;
    customer?: string;
    status?: Stripe.Subscription.Status;
    current_period_end?: number;
  } = {}
): Stripe.Subscription {
  const {
    id = "sub_test123",
    customer = "cus_test_customer",
    status = "active",
    current_period_end = 1800000000, // arbitrary future unix timestamp
  } = overrides;

  return {
    id,
    object: "subscription",
    customer,
    status,
    items: {
      object: "list",
      data: [
        {
          id: "si_test",
          object: "subscription_item",
          current_period_end,
          current_period_start: 1700000000,
        } as unknown as Stripe.SubscriptionItem,
      ],
      has_more: false,
      url: "",
    },
  } as unknown as Stripe.Subscription;
}

/**
 * Fluent update chain for supabase service — records calls and returns no error.
 */
function makeUpdateChain(
  updateSpy: ReturnType<typeof vi.fn>,
  eqSpy: ReturnType<typeof vi.fn>
) {
  return {
    update: (data: unknown) => {
      updateSpy(data);
      return {
        eq: (col: string, val: unknown) => {
          eqSpy(col, val);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

/**
 * F1: webhook_events table mock.
 *
 * @param isFirstDelivery  true  → upsert returns [{event_id}] (first delivery)
 *                         false → upsert returns [] (conflict / duplicate)
 * @param alreadyProcessed true  → existing row has processed_at set (skip)
 *                         false → processed_at is null (retry of failed event)
 */
function makeWebhookEventsChain(
  options: { isFirstDelivery?: boolean; alreadyProcessed?: boolean } = {}
) {
  const { isFirstDelivery = true, alreadyProcessed = false } = options;
  return {
    // Called as: supabase.from("webhook_events").upsert({...}, {...}).select("event_id")
    upsert: (_data: unknown, _opts: unknown) => ({
      select: (_cols: string) =>
        Promise.resolve({
          data: isFirstDelivery ? [{ event_id: "evt_test" }] : [],
          error: null,
        }),
    }),
    // Called as: supabase.from("webhook_events").select("processed_at").eq(...).maybeSingle()
    // (only reached when isFirstDelivery = false)
    select: (_cols: string) => ({
      eq: (_col: string, _val: unknown) => ({
        maybeSingle: () =>
          Promise.resolve({
            data: {
              processed_at: alreadyProcessed
                ? new Date(1000000000000).toISOString()
                : null,
            },
            error: null,
          }),
      }),
    }),
    // Called as: supabase.from("webhook_events").update({...}).eq("event_id", ...)
    update: (_data: unknown) => ({
      eq: (_col: string, _val: unknown) => Promise.resolve({ error: null }),
    }),
  };
}

/**
 * Build the full supabase fluent chain needed by the boost (payment) path.
 * Now includes webhook_events table support (F1).
 */
function makeBoostSupabaseImpl() {
  const purchaseSelectMaybeSingleCalled: unknown[] = [];
  const purchaseSelectSingleCalled: unknown[] = [];
  let selectCallCount = 0;

  return (table: string) => {
    if (table === "webhook_events") {
      return makeWebhookEventsChain();
    }
    if (table === "purchases") {
      return {
        select: (_cols: string) => {
          selectCallCount++;
          const callIndex = selectCallCount;
          return {
            eq: (_col: string, _val: unknown) => {
              if (callIndex === 1) {
                // idempotency check
                return {
                  maybeSingle: async () => {
                    purchaseSelectMaybeSingleCalled.push(_val);
                    return { data: { id: _val, status: "pending" }, error: null };
                  },
                };
              }
              // fetch details
              return {
                single: async () => {
                  purchaseSelectSingleCalled.push(_val);
                  return {
                    data: {
                      user_id: "user-boost",
                      product_code: "boost_7d",
                      amount_cents: 500,
                      currency: "eur",
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
        update: (_data: unknown) => ({
          eq: async () => ({ error: null }),
        }),
      };
    }
    if (table === "products") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { code: "boost_7d" },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "benefits") {
      return {
        insert: async () => ({ error: null }),
      };
    }
    if (table === "logs") {
      return {
        insert: async () => ({ error: null }),
      };
    }
    throw new Error("Unexpected table in boost test: " + table);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
  });

  // ── Bad signature → 400 ───────────────────────────────────────────────────
  it("(a) returns 400 when signature verification fails", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const req = makeWebhookReq();
    const res = await POST(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("BAD_INPUT");
  });

  // ── Missing stripe-signature header → 400 ────────────────────────────────
  it("(b) returns 400 when stripe-signature header is missing", async () => {
    const req = new Request("https://x.test/api/billing/webhook", {
      method: "POST",
      body: "body",
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  // ── checkout.session.completed (mode=subscription) → sets pro_until ──────
  it("(c) checkout.session.completed with mode=subscription sets pro_until and stripe_customer_id", async () => {
    const periodEnd = 1800000000;
    const sub = makeSubscriptionStub({
      customer: "cus_pro_123",
      status: "active",
      current_period_end: periodEnd,
    });

    constructEventMock.mockReturnValue({
      id: "evt_c",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          client_reference_id: "user-pro-1",
          customer: "cus_pro_123",
          subscription: "sub_test123",
          metadata: {},
        } as Partial<Stripe.Checkout.Session>,
      },
    } as Stripe.Event);

    subscriptionsRetrieveMock.mockResolvedValue(sub);

    const updateSpy = vi.fn();
    const eqSpy = vi.fn();
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "webhook_events") return makeWebhookEventsChain();
      if (table === "profiles") return makeUpdateChain(updateSpy, eqSpy);
      throw new Error("Unexpected table: " + table);
    });

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);

    // Must retrieve the subscription
    expect(subscriptionsRetrieveMock).toHaveBeenCalledWith("sub_test123");

    // Must update profiles with pro_until and stripe_customer_id
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: "cus_pro_123",
        pro_until: new Date(periodEnd * 1000).toISOString(),
      })
    );
    expect(eqSpy).toHaveBeenCalledWith("id", "user-pro-1");
  });

  // ── customer.subscription.updated (active) → sets pro_until ──────────────
  it("(d) customer.subscription.updated with status=active sets pro_until", async () => {
    const periodEnd = 1800000001;
    const sub = makeSubscriptionStub({
      customer: "cus_updated_456",
      status: "active",
      current_period_end: periodEnd,
    });

    constructEventMock.mockReturnValue({
      id: "evt_d",
      type: "customer.subscription.updated",
      data: { object: sub },
    } as Stripe.Event);

    const updateSpy = vi.fn();
    const eqSpy = vi.fn();
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "webhook_events") return makeWebhookEventsChain();
      if (table === "profiles") return makeUpdateChain(updateSpy, eqSpy);
      throw new Error("Unexpected table: " + table);
    });

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        pro_until: new Date(periodEnd * 1000).toISOString(),
      })
    );
    expect(eqSpy).toHaveBeenCalledWith("stripe_customer_id", "cus_updated_456");
  });

  // ── customer.subscription.updated (past_due) → clears pro_until ──────────
  it("(e) customer.subscription.updated with status=past_due clears pro_until", async () => {
    const sub = makeSubscriptionStub({
      customer: "cus_past_due_789",
      status: "past_due",
    });

    constructEventMock.mockReturnValue({
      id: "evt_e",
      type: "customer.subscription.updated",
      data: { object: sub },
    } as Stripe.Event);

    const updateSpy = vi.fn();
    const eqSpy = vi.fn();
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "webhook_events") return makeWebhookEventsChain();
      if (table === "profiles") return makeUpdateChain(updateSpy, eqSpy);
      throw new Error("Unexpected table: " + table);
    });

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({ pro_until: null });
    expect(eqSpy).toHaveBeenCalledWith(
      "stripe_customer_id",
      "cus_past_due_789"
    );
  });

  // ── customer.subscription.deleted → clears pro_until ─────────────────────
  it("(f) customer.subscription.deleted clears pro_until", async () => {
    const sub = makeSubscriptionStub({
      customer: "cus_deleted_abc",
      status: "canceled",
    });

    constructEventMock.mockReturnValue({
      id: "evt_f",
      type: "customer.subscription.deleted",
      data: { object: sub },
    } as Stripe.Event);

    const updateSpy = vi.fn();
    const eqSpy = vi.fn();
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "webhook_events") return makeWebhookEventsChain();
      if (table === "profiles") return makeUpdateChain(updateSpy, eqSpy);
      throw new Error("Unexpected table: " + table);
    });

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({ pro_until: null });
    expect(eqSpy).toHaveBeenCalledWith("stripe_customer_id", "cus_deleted_abc");
  });

  // ── invoice.paid → renews pro_until ──────────────────────────────────────
  it("(g) invoice.paid with subscription updates pro_until for renewal", async () => {
    const periodEnd = 1900000000;
    const sub = makeSubscriptionStub({
      customer: "cus_renewal_xyz",
      status: "active",
      current_period_end: periodEnd,
    });

    constructEventMock.mockReturnValue({
      id: "evt_g",
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_renewal_xyz",
          parent: {
            subscription_details: {
              subscription: "sub_renewal_999",
            },
          },
        } as Partial<Stripe.Invoice>,
      },
    } as Stripe.Event);

    subscriptionsRetrieveMock.mockResolvedValue(sub);

    const updateSpy = vi.fn();
    const eqSpy = vi.fn();
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "webhook_events") return makeWebhookEventsChain();
      if (table === "profiles") return makeUpdateChain(updateSpy, eqSpy);
      throw new Error("Unexpected table: " + table);
    });

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);
    expect(subscriptionsRetrieveMock).toHaveBeenCalledWith("sub_renewal_999");
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        pro_until: new Date(periodEnd * 1000).toISOString(),
      })
    );
    expect(eqSpy).toHaveBeenCalledWith("stripe_customer_id", "cus_renewal_xyz");
  });

  // ── invoice.paid without subscription → no-op ────────────────────────────
  it("(h) invoice.paid without subscription reference is a no-op", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_h",
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_noop",
          parent: null,
        } as Partial<Stripe.Invoice>,
      },
    } as Stripe.Event);

    fromServiceMock.mockImplementation((table: string) => {
      // webhook_events is always accessed by F1 gate — allow it
      if (table === "webhook_events") return makeWebhookEventsChain();
      throw new Error("Should not touch supabase for non-subscription invoice: " + table);
    });

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);
    expect(subscriptionsRetrieveMock).not.toHaveBeenCalled();
  });

  // ── customer.subscription.updated (active, empty items) → 200, no DB write ─
  it("(j) customer.subscription.updated with empty items.data returns 200 and skips pro_until write", async () => {
    const emptyItemsSub = {
      id: "sub_empty_items",
      object: "subscription",
      customer: "cus_empty_items",
      status: "active" as Stripe.Subscription.Status,
      items: {
        object: "list",
        data: [],
        has_more: false,
        url: "",
      },
    } as unknown as Stripe.Subscription;

    constructEventMock.mockReturnValue({
      id: "evt_j",
      type: "customer.subscription.updated",
      data: { object: emptyItemsSub },
    } as Stripe.Event);

    const updateSpy = vi.fn();
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "webhook_events") return makeWebhookEventsChain();
      if (table === "profiles") {
        return {
          update: (data: unknown) => {
            updateSpy(data);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }
      throw new Error("Unexpected table: " + table);
    });

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);
    // profiles.update must NOT be called when current_period_end is missing
    expect(updateSpy).not.toHaveBeenCalled();
  });

  // ── Existing boost path (mode=payment) still works ───────────────────────
  it("(i) checkout.session.completed with mode=payment runs boost logic (existing path)", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_i",
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          client_reference_id: "purchase-boost-id-001",
          customer: "cus_boost",
          payment_intent: "pi_boost_123",
          subscription: null,
          metadata: { advert_id: "advert-xyz" },
        } as Partial<Stripe.Checkout.Session>,
      },
    } as Stripe.Event);

    fromServiceMock.mockImplementation(makeBoostSupabaseImpl());

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);
    expect(subscriptionsRetrieveMock).not.toHaveBeenCalled();
  });

  // ── F1: Duplicate delivery of already-processed event → 200 skipped ───────
  it("(k) skips business logic and returns skipped:true when event already has processed_at", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_k_duplicate",
      type: "customer.subscription.updated",
      data: {
        object: makeSubscriptionStub({ customer: "cus_dup", status: "active" }),
      },
    } as Stripe.Event);

    const profilesUpdateSpy = vi.fn();
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        // Simulate: conflict on upsert (not first delivery), and processed_at is set
        return makeWebhookEventsChain({ isFirstDelivery: false, alreadyProcessed: true });
      }
      // profiles should NOT be touched for a skipped event
      if (table === "profiles") {
        return {
          update: (data: unknown) => {
            profilesUpdateSpy(data);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error("Unexpected table for duplicate event: " + table);
    });

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);
    expect(resBody.data.skipped).toBe(true);
    // Business logic (profiles update) must NOT have run
    expect(profilesUpdateSpy).not.toHaveBeenCalled();
  });

  // ── F1: Retry of failed delivery (processed_at=null) → re-runs business logic
  it("(l) re-runs business logic when event_id exists but processed_at is null (prior failure)", async () => {
    const periodEnd = 1800000099;
    const sub = makeSubscriptionStub({
      customer: "cus_retry",
      status: "active",
      current_period_end: periodEnd,
    });

    constructEventMock.mockReturnValue({
      id: "evt_l_retry",
      type: "customer.subscription.updated",
      data: { object: sub },
    } as Stripe.Event);

    const updateSpy = vi.fn();
    const eqSpy = vi.fn();
    fromServiceMock.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        // Simulate: conflict on upsert (not first delivery), but processed_at is NULL
        // (prior delivery failed) → gate returns "process" so business logic runs
        return makeWebhookEventsChain({ isFirstDelivery: false, alreadyProcessed: false });
      }
      if (table === "profiles") return makeUpdateChain(updateSpy, eqSpy);
      throw new Error("Unexpected table: " + table);
    });

    const res = await POST(
      makeWebhookReq() as unknown as import("next/server").NextRequest
    );
    const resBody = await res.json();

    expect(res.status).toBe(200);
    expect(resBody.ok).toBe(true);
    expect(resBody.data.skipped).toBeUndefined();
    // Business logic DID run
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pro_until: new Date(periodEnd * 1000).toISOString() })
    );
    expect(eqSpy).toHaveBeenCalledWith("stripe_customer_id", "cus_retry");
  });
});
