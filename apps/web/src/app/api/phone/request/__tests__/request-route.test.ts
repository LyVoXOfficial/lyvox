/**
 * Tests for POST /api/phone/request
 *
 * Key assertions (T2 security hardening):
 * - phones.upsert → service-role client
 * - phone_otps deactivate (update{used:true}) → service-role client
 * - phone_otps insert → service-role client
 * - logs INSERT stays on cookie (supabaseServer) client
 * - Cookie (supabaseServer) client is NEVER called with phones or phone_otps writes
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock setup (must be before any dynamic import of the route)
// ---------------------------------------------------------------------------

const getUserMock = vi.fn();
// Cookie client: auth only + logs insert
const cookieFromMock = vi.fn();
// Service-role client: pre-check SELECT + phones upsert + phone_otps writes
const serviceFromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: cookieFromMock }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: serviceFromMock }),
}));

// Bypass rate-limiter wrappers so POST === baseHandler for testing.
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true }),
  withRateLimit: (h: unknown) => h,
  getClientIp: () => "1.2.3.4",
}));

// server-only guard is a no-op in test
vi.mock("server-only", () => ({}));

// Mock verifyTurnstile — default to ok (simulates no TURNSTILE_SECRET_KEY configured)
// so existing tests are unaffected. Tests that need it to fail override this mock.
const verifyTurnstileMock = vi.fn();
vi.mock("@/lib/antifraud/turnstile", () => ({
  verifyTurnstile: verifyTurnstileMock,
}));

// Intercept global fetch so no real Twilio call is made.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PHONE = "+32470123456"; // valid BE mobile
const USER_ID = "user-uuid-001";

function jsonReq(body: unknown) {
  return new Request("https://x.test/api/phone/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * A chainable thenable mock for Supabase query chains.
 * Every method returns `this`; `.then` resolves to `resolveWith`.
 */
function makeChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "limit", "update", "insert", "upsert", "maybeSingle", "single"];
  for (const m of methods) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve);
  return chain;
}

/** Twilio success response mock */
function twilioOk() {
  return Promise.resolve({ ok: true, status: 200 } as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/phone/request — service-role enforcement", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    cookieFromMock.mockReset();
    serviceFromMock.mockReset();
    fetchMock.mockReset();
    verifyTurnstileMock.mockReset();

    // Default: user is logged in
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    // Default: cookie client only used for logs
    cookieFromMock.mockReturnValue(makeChain({ data: null, error: null }));
    // Default: Twilio succeeds
    fetchMock.mockResolvedValue(twilioOk());
    // Default: Turnstile returns ok (simulates no-secret / skipped path)
    verifyTurnstileMock.mockResolvedValue({ ok: true, skipped: true });
  });

  it("403 CAPTCHA_FAILED when Turnstile verification fails", async () => {
    verifyTurnstileMock.mockResolvedValue({ ok: false, codes: ["invalid-input-response"] });
    const res = await POST(jsonReq({ phone: VALID_PHONE, turnstileToken: "bad-token" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CAPTCHA_FAILED");
  });

  it("401 when no user session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(jsonReq({ phone: VALID_PHONE }));
    expect(res.status).toBe(401);
  });

  it("400 PHONE_NOT_BELGIAN_MOBILE for non-BE number", async () => {
    const res = await POST(jsonReq({ phone: "+31612345678" })); // NL number
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("PHONE_NOT_BELGIAN_MOBILE");
  });

  it("200 success: phones upsert + phone_otps deactivate + insert all go via service-role", async () => {
    const serviceCalls: string[] = [];
    const cookieCalls: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceFromMock as any).mockImplementation((table: string) => {
      serviceCalls.push(table);
      // maybeSingle for pre-check: no existing phone (returns null data)
      return makeChain({ data: null, error: null });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cookieFromMock as any).mockImplementation((table: string) => {
      cookieCalls.push(table);
      return makeChain({ data: null, error: null });
    });

    const res = await POST(jsonReq({ phone: VALID_PHONE }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Service-role must touch phones (pre-check + upsert) and phone_otps (deactivate + insert)
    expect(serviceCalls).toContain("phones");
    expect(serviceCalls).toContain("phone_otps");

    // Cookie client must NOT write to phones or phone_otps
    expect(cookieCalls).not.toContain("phones");
    expect(cookieCalls).not.toContain("phone_otps");
  });

  it("200 success: logs insert goes through cookie client (not service-role)", async () => {
    const serviceCalls: string[] = [];
    const cookieCalls: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceFromMock as any).mockImplementation((table: string) => {
      serviceCalls.push(table);
      return makeChain({ data: null, error: null });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cookieFromMock as any).mockImplementation((table: string) => {
      cookieCalls.push(table);
      return makeChain({ data: null, error: null });
    });

    const res = await POST(jsonReq({ phone: VALID_PHONE }));
    expect(res.status).toBe(200);

    // logs must go through cookie client
    expect(cookieCalls).toContain("logs");
    // Service-role should NOT be writing logs
    expect(serviceCalls).not.toContain("logs");
  });

  it("409 PHONE_ALREADY_REGISTERED when pre-check finds number owned by another user", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceFromMock as any).mockImplementation((table: string) => {
      if (table === "phones") {
        // Pre-check: someone else owns this number
        return makeChain({ data: { user_id: "other-user-id" }, error: null });
      }
      return makeChain({ data: null, error: null });
    });

    const res = await POST(jsonReq({ phone: VALID_PHONE }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("PHONE_ALREADY_REGISTERED");
  });

  it("502 SMS_SEND_FAIL when Twilio returns non-ok", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ code: 21614, message: "Twilio error" }),
    } as Response);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceFromMock as any).mockImplementation(() =>
      makeChain({ data: null, error: null })
    );

    const res = await POST(jsonReq({ phone: VALID_PHONE }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("SMS_SEND_FAIL");
  });
});
