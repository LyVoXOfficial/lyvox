import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase server client so we can drive the profiles read result.
const maybeSingleMock = vi.fn();
vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: maybeSingleMock }),
      }),
    }),
  }),
}));

import { checkUserBlocked } from "@/lib/fraud/checkUserBlocked";

beforeEach(() => maybeSingleMock.mockReset());

describe("checkUserBlocked", () => {
  it("fails OPEN by default on a read error (low-risk paths keep prior behaviour)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "db down" } });
    expect((await checkUserBlocked("u1")).isBlocked).toBe(false);
  });

  it("fails CLOSED on a read error when failClosed is set (publish/checkout)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "db down" } });
    const r = await checkUserBlocked("u1", { failClosed: true });
    expect(r.isBlocked).toBe(true);
    expect(r.reason).toMatch(/unavailable/i);
  });

  it("fails closed when a high-risk path finds no profile row", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const result = await checkUserBlocked("u1", { failClosed: true });
    expect(result.isBlocked).toBe(true);
    expect(result.reason).toMatch(/incomplete/i);
  });

  it("keeps low-risk reads backward-compatible when no profile row exists", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    expect((await checkUserBlocked("u1")).isBlocked).toBe(false);
  });

  it("blocks while blocked_until is in the future and surfaces the flag reason", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { blocked_until: "2999-01-01T00:00:00Z", flags: { fraud_suspected: true } },
      error: null,
    });
    const r = await checkUserBlocked("u1");
    expect(r.isBlocked).toBe(true);
    expect(r.reason).toMatch(/fraud/i);
  });

  it("does not block once blocked_until is in the past", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { blocked_until: "2000-01-01T00:00:00Z", flags: {} },
      error: null,
    });
    expect((await checkUserBlocked("u1")).isBlocked).toBe(false);
  });
});
