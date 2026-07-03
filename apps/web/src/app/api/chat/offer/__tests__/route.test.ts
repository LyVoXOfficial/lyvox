import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserMock = vi.fn();
const serverFromMock = vi.fn();
const serviceFromMock = vi.fn();
const limiterMock = vi.fn();
const trackServerEventMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    from: serverFromMock,
  }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: serviceFromMock,
  }),
}));

vi.mock("@/lib/rateLimiter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rateLimiter")>();
  return {
    ...actual,
    createRateLimiter: () => limiterMock,
  };
});

vi.mock("@/lib/analytics/trackServerEvent", () => ({
  trackServerEvent: (...args: unknown[]) => trackServerEventMock(...args),
}));

const { PATCH, POST } = await import("../route");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SELLER_ID = "22222222-2222-4222-8222-222222222222";
const ADVERT_ID = "33333333-3333-4333-8333-333333333333";
const CONVERSATION_ID = "44444444-4444-4444-8444-444444444444";
const OFFER_ID = "55555555-5555-4555-8555-555555555555";

const baseOffer = {
  id: OFFER_ID,
  advert_id: ADVERT_ID,
  conversation_id: CONVERSATION_ID,
  sender_id: USER_ID,
  amount_cents: 4500,
  currency: "EUR",
  message: null,
  status: "sent",
  created_at: "2026-07-04T10:00:00.000Z",
  responded_at: null,
};

const makeRequest = (body: Record<string, unknown>) =>
  new Request("https://x.test/api/chat/offer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const makeValidBody = (overrides: Record<string, unknown> = {}) => ({
  advert_id: ADVERT_ID,
  conversation_id: CONVERSATION_ID,
  amount_cents: 4500,
  currency: "EUR",
  ...overrides,
});

function setDefaultServerFrom(options: {
  participant?: unknown | null;
  conversation?: { id: string; advert_id: string } | null;
  patchOffer?: typeof baseOffer | null;
} = {}) {
  const participant = options.participant ?? { conversation_id: CONVERSATION_ID };
  const conversation = options.conversation ?? { id: CONVERSATION_ID, advert_id: ADVERT_ID };
  const patchOffer = options.patchOffer;

  serverFromMock.mockImplementation((table: string) => {
    if (table === "conversation_participants") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: participant, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "conversations") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: conversation, error: null }),
          }),
        }),
      };
    }
    if (table === "chat_offers") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: patchOffer ?? baseOffer, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: { ...(patchOffer ?? baseOffer), ...payload },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected server table ${table}`);
  });
}

function setDefaultServiceFrom(options: {
  advert?: { id: string; user_id: string; status: string; currency: string; min_offer_cents: number | null };
  offer?: typeof baseOffer;
  messageError?: { message: string; code?: string } | null;
} = {}) {
  const advert = options.advert ?? {
    id: ADVERT_ID,
    user_id: SELLER_ID,
    status: "active",
    currency: "EUR",
    min_offer_cents: null,
  };
  const insertedOffer = options.offer ?? baseOffer;

  serviceFromMock.mockImplementation((table: string) => {
    if (table === "adverts") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: advert, error: null }),
          }),
        }),
      };
    }
    if (table === "chat_offers") {
      return {
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: async () => ({
              data: { ...insertedOffer, ...payload, id: OFFER_ID, created_at: insertedOffer.created_at },
              error: null,
            }),
          }),
        }),
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    }
    if (table === "messages") {
      return {
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: async () => ({
              data: {
                id: 99,
                conversation_id: CONVERSATION_ID,
                author_id: USER_ID,
                body: payload.body,
                created_at: "2026-07-04T10:00:01.000Z",
                updated_at: null,
              },
              error: options.messageError ?? null,
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected service table ${table}`);
  });
}

describe("POST /api/chat/offer", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    serverFromMock.mockReset();
    serviceFromMock.mockReset();
    limiterMock.mockReset();
    trackServerEventMock.mockReset();
    limiterMock.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Math.floor(Date.now() / 1000) + 3600,
      retryAfterSec: 0,
    });
  });

  it("401 when not signed in", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const res = await POST(makeRequest(makeValidBody()));
    expect(res.status).toBe(401);
  });

  it("400 when amount is invalid", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });

    const res = await POST(makeRequest(makeValidBody({ amount_cents: 0 })));
    expect(res.status).toBe(400);
    expect(limiterMock).not.toHaveBeenCalled();
  });

  it("429 when the per-user advert limiter denies the request", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    limiterMock.mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 3600,
      retryAfterSec: 3600,
    });

    const res = await POST(makeRequest(makeValidBody()));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("RATE_LIMITED");
    expect(serverFromMock).not.toHaveBeenCalled();
  });

  it("auto-declines below the seller threshold without inserting a chat message", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setDefaultServerFrom();
    setDefaultServiceFrom({
      advert: {
        id: ADVERT_ID,
        user_id: SELLER_ID,
        status: "active",
        currency: "EUR",
        min_offer_cents: 5000,
      },
    });

    const res = await POST(makeRequest(makeValidBody({ amount_cents: 4500 })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.autoDeclined).toBe(true);
    expect(body.data.offer.status).toBe("declined");
    expect(body.data.message).toBeNull();
    expect(serviceFromMock).not.toHaveBeenCalledWith("messages");
    expect(trackServerEventMock).toHaveBeenCalledWith(
      "offer_declined_auto",
      expect.objectContaining({ offer_id: OFFER_ID, amount_cents: 4500 }),
      expect.objectContaining({ userId: USER_ID }),
    );
  });

  it("creates a sent offer and ordinary marker message when the threshold passes", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setDefaultServerFrom();
    setDefaultServiceFrom({
      advert: {
        id: ADVERT_ID,
        user_id: SELLER_ID,
        status: "active",
        currency: "EUR",
        min_offer_cents: 4000,
      },
    });

    const res = await POST(makeRequest(makeValidBody({ amount_cents: 4500 })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.autoDeclined).toBe(false);
    expect(body.data.offer.status).toBe("sent");
    expect(body.data.message.body).toBe(`lyvox:chat_offer:${OFFER_ID}`);
    expect(trackServerEventMock).toHaveBeenCalledWith(
      "offer_sent",
      expect.objectContaining({ offer_id: OFFER_ID, amount_cents: 4500 }),
      expect.objectContaining({ userId: USER_ID }),
    );
  });
});

describe("PATCH /api/chat/offer", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    serverFromMock.mockReset();
  });

  it("403 when the sender tries to respond to their own offer", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    setDefaultServerFrom({ patchOffer: baseOffer });

    const res = await PATCH(makeRequest({ offer_id: OFFER_ID, status: "declined" }));
    expect(res.status).toBe(403);
  });

  it("lets the recipient accept an open offer in chat", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: SELLER_ID } } });
    setDefaultServerFrom({ patchOffer: baseOffer });

    const res = await PATCH(makeRequest({ offer_id: OFFER_ID, status: "accepted_in_chat" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.offer.status).toBe("accepted_in_chat");
    expect(body.data.offer.responded_at).toBeTruthy();
  });
});
