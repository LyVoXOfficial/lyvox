import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true, limit: 10, remaining: 9, reset: 0, retryAfterSec: 0 }),
  withRateLimit: (handler: (...a: unknown[]) => unknown) => handler,
  getClientIp: () => "1.2.3.4",
}));

vi.mock("server-only", () => ({}));

const upsertMock = vi.fn();
const selectMock = vi.fn();

// factory-per-table setup
function makeSelectChain(result: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    // for count queries (head:true)
    then: undefined as unknown,
  };
  return chain;
}

const { POST } = await import("../route");

function makeReq() {
  return new Request("https://x.test/api/trust/refresh", { method: "POST" });
}

const MOCK_PROFILE = {
  verified_email: true,
  verified_phone: true,
  itsme_verified: false,
  created_at: new Date(Date.now() - 90 * 86_400_000).toISOString(), // 90 days ago
  flags: null,
};

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "user-abc" } } });
  fromMock.mockReset();
  upsertMock.mockReset().mockResolvedValue({ data: null, error: null });
  selectMock.mockReset();

  fromMock.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
      };
    }
    if (table === "adverts") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        // resolves with count
        then: undefined,
        // count query chain — vitest awaits the chain object via Thenable trick
        // easier: just return a plain resolved promise via select chaining
      };
    }
    if (table === "trust_score") {
      return { upsert: upsertMock };
    }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
  });
});

describe("POST /api/trust/refresh — F14", () => {
  // Rate limit is keyed by authenticated user ID (not IP) — see withRateLimit getUserId option in route.ts.
  // The rateLimiter mock here bypasses the rate limit entirely; the per-user key logic is an integration
  // concern tested implicitly by the withRateLimit + rateLimiter unit tests in lib/rateLimiter.test.ts.
  it("401 when not authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("404 when profile not found", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === "adverts") {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      }
      return { upsert: upsertMock };
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
  });

  it("500 when profile fetch errors", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
  });

  it("returns components breakdown on success", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { ...MOCK_PROFILE, verified_email: true, verified_phone: true },
            error: null,
          }),
        };
      }
      if (table === "adverts") {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          count: 3,
        };
        // Return a thenable that resolves with count
        return Object.assign(chain, {
          [Symbol.iterator]: undefined,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
            }),
          }),
        });
      }
      return { upsert: upsertMock };
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.components).toBeDefined();
    expect(typeof body.data.components.total).toBe("number");
    expect(body.data.components.identity).toBeGreaterThanOrEqual(0);
    expect(body.data.components.activity).toBeGreaterThanOrEqual(0);
    expect(body.data.components.deals).toBe(0); // F3-gated
  });

  it("counts true-valued flags as risk penalties", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { ...MOCK_PROFILE, flags: { fraud_suspect: true, spam_reports: false } },
            error: null,
          }),
        };
      }
      if (table === "adverts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        };
      }
      return { upsert: upsertMock };
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    // 1 active risk flag → riskPenalty = -5
    expect(body.data.components.riskPenalty).toBe(-5);
  });

  it("upserts score and components into trust_score table", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
        };
      }
      if (table === "adverts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        };
      }
      return { upsert: upsertMock };
    });

    await POST(makeReq());

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [row, opts] = upsertMock.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(row.user_id).toBe("user-abc");
    expect(typeof row.score).toBe("number");
    expect(row.components).toBeDefined();
    expect(row.last_computed_at).toBeDefined();
    expect(opts.onConflict).toBe("user_id");
  });
});
