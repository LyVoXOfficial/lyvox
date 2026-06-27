/**
 * Tests for POST /api/phone/verify
 *
 * Key assertions (T2 security hardening):
 * - phone_otps SELECT, failed-attempt UPDATE, mark-used UPDATE → service-role client
 * - phones UPDATE (verified=true) → service-role client
 * - logs INSERT stays on cookie (supabaseServer) client
 * - Cookie (supabaseServer) client is NEVER called with phones or phone_otps writes
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "crypto";

// ---------------------------------------------------------------------------
// Mock setup (must be before any dynamic import of the route)
// ---------------------------------------------------------------------------

const getUserMock = vi.fn();
// Cookie client: auth only + logs insert
const cookieFromMock = vi.fn();
// Service-role client: phone_otps read+write, phones write
const serviceFromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ auth: { getUser: getUserMock }, from: cookieFromMock }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: serviceFromMock }),
}));

// Bypass the three rate-limiter wrappers so POST === baseHandler for testing.
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true }),
  withRateLimit: (h: unknown) => h,
  getClientIp: () => "1.2.3.4",
}));

// server-only guard is a no-op in test
vi.mock("server-only", () => ({}));

const { POST } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PHONE = "+32470123456"; // valid BE mobile
const USER_ID = "user-uuid-001";

const OTP_SALT = "aabbccdd11223344aabbccdd11223344";
const OTP_CODE = "123456";
const OTP_HASH = createHmac("sha256", OTP_SALT).update(OTP_CODE).digest("hex");

function makeOtpRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "otp-uuid-001",
    user_id: USER_ID,
    e164: VALID_PHONE,
    code_hash: OTP_HASH,
    code_salt: OTP_SALT,
    code_last_four: OTP_CODE.slice(-4),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min from now
    attempts: 0,
    used: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function jsonReq(body: unknown) {
  return new Request("https://x.test/api/phone/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * A chainable thenable mock for Supabase query chains.
 * Every method returns `this` so chains work; `.then` resolves to `resolveWith`
 * so the chain can be awaited at any point.
 */
function makeChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "limit", "update", "insert", "upsert", "maybeSingle", "single"];
  for (const m of methods) {
    chain[m] = () => chain;
  }
  // Make the chain itself awaitable (thenable)
  chain.then = (resolve: (v: unknown) => unknown, _reject?: unknown) =>
    Promise.resolve(resolveWith).then(resolve);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/phone/verify — service-role enforcement", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    cookieFromMock.mockReset();
    serviceFromMock.mockReset();

    // Cookie client: getUser succeeds + logs insert succeeds
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } } });
    cookieFromMock.mockReturnValue(makeChain({ data: null, error: null }));
  });

  it("401 when no user session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(jsonReq({ phone: VALID_PHONE, code: "000000" }));
    expect(res.status).toBe(401);
  });

  it("400 OTP_NOT_FOUND when service-role returns no rows", async () => {
    serviceFromMock.mockReturnValue(makeChain({ data: [], error: null }));
    const res = await POST(jsonReq({ phone: VALID_PHONE, code: "000000" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("OTP_NOT_FOUND");
    expect(serviceFromMock).toHaveBeenCalledWith("phone_otps");
  });

  it("400 OTP_EXPIRED when otp.expires_at is in the past", async () => {
    const expiredOtp = makeOtpRow({
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    serviceFromMock.mockReturnValue(makeChain({ data: [expiredOtp], error: null }));
    const res = await POST(jsonReq({ phone: VALID_PHONE, code: OTP_CODE }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("OTP_EXPIRED");
  });

  it("429 OTP_LOCKED when attempts >= 5", async () => {
    const lockedOtp = makeOtpRow({ attempts: 5 });
    serviceFromMock.mockReturnValue(makeChain({ data: [lockedOtp], error: null }));
    const res = await POST(jsonReq({ phone: VALID_PHONE, code: OTP_CODE }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("OTP_LOCKED");
  });

  it("400 OTP_INVALID + increments attempts on service-role when code is wrong", async () => {
    const otp = makeOtpRow();
    const serviceCallArgs: Array<{ table: string; op: string }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceFromMock as any).mockImplementation((table: string) => {
      serviceCallArgs.push({ table, op: "from" });
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = self;
      chain.order = self;
      chain.limit = self;
      chain.eq = self;
      chain.update = (payload: unknown) => {
        serviceCallArgs.push({ table, op: `update:${JSON.stringify(payload)}` });
        return chain;
      };
      chain.then = (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
        // Return different data for select vs update calls
        const isSelect = serviceCallArgs.filter(c => c.table === "phone_otps" && c.op === "from").length === 1;
        if (isSelect) {
          return Promise.resolve({ data: [otp], error: null }).then(resolve);
        }
        return Promise.resolve({ data: null, error: null }).then(resolve);
      };
      return chain;
    });

    const res = await POST(jsonReq({ phone: VALID_PHONE, code: "000000" })); // wrong code
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("OTP_INVALID");

    // The attempts increment must go through service-role, not cookie client
    const attemptsUpdate = serviceCallArgs.find(c =>
      c.op.includes(`"attempts":1`)
    );
    expect(attemptsUpdate).toBeDefined();
    // Cookie client must NOT have been called with "phones" or "phone_otps"
    expect(cookieFromMock).not.toHaveBeenCalledWith("phones");
    expect(cookieFromMock).not.toHaveBeenCalledWith("phone_otps");
  });

  it("200 success: verified=true written via service-role on correct code", async () => {
    const otp = makeOtpRow();

    // Track what each client is called with
    const serviceCalls: string[] = [];
    const cookieCalls: Array<string> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceFromMock as any).mockImplementation((table: string) => {
      serviceCalls.push(table);
      let callCount = serviceCalls.filter(t => t === table).length;

      const chain: Record<string, unknown> = {};
      const thenable = (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
        if (table === "phone_otps") {
          if (callCount === 1) {
            // First phone_otps call = SELECT
            return Promise.resolve({ data: [otp], error: null }).then(resolve);
          }
          // Subsequent = UPDATE (mark-used or attempts) — success, no error
          return Promise.resolve({ data: null, error: null }).then(resolve);
        }
        if (table === "phones") {
          // UPDATE phones SET verified=true
          return Promise.resolve({ data: null, error: null }).then(resolve);
        }
        return Promise.resolve({ data: null, error: null }).then(resolve);
      };
      const self = () => {
        callCount++;
        return chain;
      };
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.update = () => chain;
      chain.insert = () => chain;
      chain.then = thenable;
      return chain;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cookieFromMock as any).mockImplementation((table: string) => {
      cookieCalls.push(table);
      return makeChain({ data: null, error: null });
    });

    const res = await POST(jsonReq({ phone: VALID_PHONE, code: OTP_CODE }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // phones and phone_otps must ONLY have been touched through service-role
    expect(serviceCalls).toContain("phones");
    expect(serviceCalls).toContain("phone_otps");

    // Cookie client must NOT have written to phones or phone_otps
    expect(cookieCalls).not.toContain("phones");
    expect(cookieCalls).not.toContain("phone_otps");

    // Cookie client may only write to logs
    const nonLogCookieCalls = cookieCalls.filter(t => t !== "logs");
    expect(nonLogCookieCalls).toHaveLength(0);
  });

  it("200 success: logs insert stays on cookie client (not service-role)", async () => {
    const otp = makeOtpRow();
    const cookieCalls: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (serviceFromMock as any).mockImplementation((table: string) => {
      return makeChain({
        data: table === "phone_otps" ? [otp] : null,
        error: null,
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cookieFromMock as any).mockImplementation((table: string) => {
      cookieCalls.push(table);
      return makeChain({ data: null, error: null });
    });

    const res = await POST(jsonReq({ phone: VALID_PHONE, code: OTP_CODE }));
    expect(res.status).toBe(200);

    // logs must go through cookie client
    expect(cookieCalls).toContain("logs");
  });
});
