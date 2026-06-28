import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

// ── Mocks ──────────────────────────────────────────────────────────────────

const getUserMock   = vi.fn();
const maybeSingleMock = vi.fn();       // for advert lookup
const upsertMock    = vi.fn();         // service-role advert_views upsert
const rpcMock       = vi.fn();         // get_advert_view_count

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "adverts") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
        };
      }
      return {};
    },
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: () => ({
      upsert: upsertMock,
    }),
  }),
}));

// Disable rate-limit in tests: withRateLimit passes through
vi.mock("@/lib/rateLimiter", () => ({
  createRateLimiter: () => async () => ({ success: true, limit: 100, remaining: 99, reset: 0, retryAfterSec: 0 }),
  withRateLimit: (handler: (...a: unknown[]) => unknown) => handler,
  getClientIp: () => "1.2.3.4",
}));

const { POST } = await import("../route");

function makeCtx(id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") {
  return { params: Promise.resolve({ id }) };
}

function makeReq() {
  return new Request("https://x.test/api/adverts/x/view", {
    method: "POST",
    headers: { "user-agent": "test-agent" },
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  maybeSingleMock.mockReset();
  upsertMock.mockReset();
  rpcMock.mockReset();

  // Default: advert exists and is active
  maybeSingleMock.mockResolvedValue({
    data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "active" },
    error: null,
  });
  // Default: upsert succeeds
  upsertMock.mockResolvedValue({ data: null, error: null });
  // Default: view count = 1
  rpcMock.mockResolvedValue({ data: 1, error: null });
});

describe("POST /api/adverts/[id]/view — F11 dedup", () => {
  it("404 when advert not found", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(404);
  });

  it("inserts viewer_key = 'user:<id>' for authenticated users", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    await POST(makeReq(), makeCtx());

    // calls[0] = advert_views upsert; calls[1] = analytics_events upsert (F6)
    expect(upsertMock).toHaveBeenCalledTimes(2);
    const [row] = upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(row.viewer_key).toBe("user:user-uuid-1");
  });

  it("inserts viewer_key = 'ip:<md5>' for anonymous visitors with an IP", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    // getClientIp is mocked to return "1.2.3.4" globally
    const expectedHash = createHash("md5").update("1.2.3.4").digest("hex");
    await POST(makeReq(), makeCtx());

    const [row] = upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(row.viewer_key).toBe(`ip:${expectedHash}`);
  });

  it("uses onConflict ignoreDuplicates so duplicate views are no-ops", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-uuid-2" } } });
    await POST(makeReq(), makeCtx());

    const [, opts] = upsertMock.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(opts.ignoreDuplicates).toBe(true);
    expect(opts.onConflict).toBe("advert_id,viewer_key,view_hour");
  });

  it("includes view_hour as a positive integer (epoch / 3600)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-uuid-3" } } });
    await POST(makeReq(), makeCtx());

    const [row] = upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(typeof row.view_hour).toBe("number");
    expect(row.view_hour as number).toBeGreaterThan(0);
  });

  it("returns view_count from get_advert_view_count RPC", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    rpcMock.mockResolvedValue({ data: 42, error: null });
    const res = await POST(makeReq(), makeCtx());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.view_count).toBe(42);
  });

  it("returns success even when upsert fails (non-critical tracking)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    upsertMock.mockResolvedValue({ data: null, error: { message: "db error" } });
    const res = await POST(makeReq(), makeCtx());
    // view tracking failure must not break the page load (non-critical)
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.message).toMatch(/failed.*non-critical/i);
  });

  it("does not write raw ip_address to advert_views (B4 GDPR)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await POST(makeReq(), makeCtx());

    const [row] = upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(row).not.toHaveProperty("ip_address");
  });
});
