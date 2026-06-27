import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// --- mocks (hoisted before any import of the module under test) ---

const serviceFromMock = vi.fn();

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: serviceFromMock }),
}));

const runViesVerificationMock = vi.fn();
vi.mock("@/lib/verification/runViesVerification", () => ({
  runViesVerification: (...args: unknown[]) => runViesVerificationMock(...args),
}));

// We set CRON_SECRET before import so the module loads correctly.
// Tests that check "CRON_SECRET unset → 401" must delete and restore it.
process.env.CRON_SECRET = "testsecret";

const { GET } = await import("../route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req(auth?: string) {
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = auth;
  return new Request("https://x.test/api/cron/business-verify", { headers });
}

/** A chainable `.from("verifications").select(...).eq(...).or(...).limit(...)` mock */
function makeVerificationsMock(rows: Array<{ subject_id: string; evidence: Record<string, unknown> }>) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    or: () => chain,
    limit: async () => ({ data: rows, error: null }),
  };
  return chain;
}

beforeEach(() => {
  serviceFromMock.mockReset();
  runViesVerificationMock.mockReset();
});

afterEach(() => {
  // Restore CRON_SECRET in case a test deleted it
  process.env.CRON_SECRET = "testsecret";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/cron/business-verify", () => {
  // ── Auth checks ───────────────────────────────────────────────────────────

  it("401 with no Authorization header", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("401 with wrong bearer secret", async () => {
    const res = await GET(req("Bearer wrongsecret"));
    expect(res.status).toBe(401);
  });

  it("401 when CRON_SECRET env var is unset (fail-closed)", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("Bearer testsecret")); // even correct value → 401
    expect(res.status).toBe(401);
  });

  // ── Sweep logic ───────────────────────────────────────────────────────────

  it("returns 200 with counts when no pending rows", async () => {
    serviceFromMock.mockReturnValue(makeVerificationsMock([]));

    const res = await GET(req("Bearer testsecret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.processed).toBe(0);
    expect(body.data.verified).toBe(0);
    expect(body.data.failed).toBe(0);
    expect(body.data.pending).toBe(0);
    expect(runViesVerificationMock).not.toHaveBeenCalled();
  });

  it("calls runViesVerification once per pending row", async () => {
    const pendingRows = [
      { subject_id: "biz-1", evidence: {} },
      { subject_id: "biz-2", evidence: { retry_count: 1 } },
    ];
    serviceFromMock.mockReturnValue(makeVerificationsMock(pendingRows));

    runViesVerificationMock
      .mockResolvedValueOnce({
        method: "vies", status: "verified", entity_verified: true,
        business_status: "active", evidence: { name_match: "auto" },
      })
      .mockResolvedValueOnce({
        method: "vies", status: "pending", entity_verified: false,
        business_status: "active", evidence: { retry_count: 2, next_retry_at: "2026-06-28T00:00:00Z" },
      });

    const res = await GET(req("Bearer testsecret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.processed).toBe(2);
    expect(body.data.verified).toBe(1);
    expect(body.data.pending).toBe(1);
    expect(body.data.failed).toBe(0);
    expect(runViesVerificationMock).toHaveBeenCalledTimes(2);
    expect(runViesVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: serviceFromMock }),
      "biz-1",
    );
    expect(runViesVerificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: serviceFromMock }),
      "biz-2",
    );
  });

  it("counts failed rows correctly", async () => {
    serviceFromMock.mockReturnValue(
      makeVerificationsMock([{ subject_id: "biz-3", evidence: {} }]),
    );

    runViesVerificationMock.mockResolvedValueOnce({
      method: "vies", status: "failed", entity_verified: false,
      business_status: "suspended", evidence: { userError: "INVALID" },
    });

    const res = await GET(req("Bearer testsecret"));
    const body = await res.json();
    expect(body.data.failed).toBe(1);
    expect(body.data.verified).toBe(0);
    expect(body.data.pending).toBe(0);
  });

  it("continues processing subsequent rows even if one throws", async () => {
    serviceFromMock.mockReturnValue(
      makeVerificationsMock([
        { subject_id: "biz-4", evidence: {} },
        { subject_id: "biz-5", evidence: {} },
      ]),
    );

    runViesVerificationMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        method: "vies", status: "verified", entity_verified: true,
        business_status: "active", evidence: {},
      });

    const res = await GET(req("Bearer testsecret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.processed).toBe(2);
    expect(body.data.verified).toBe(1);
    expect(body.data.pending).toBe(1); // thrown → counted as pending
  });
});
