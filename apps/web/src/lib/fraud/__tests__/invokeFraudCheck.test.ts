import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    functions: { invoke: invokeMock },
  }),
}));

import { invokeFraudCheck } from "@/lib/fraud/invokeFraudCheck";

beforeEach(() => invokeMock.mockReset());

describe("invokeFraudCheck", () => {
  it("returns fallback when Edge Function returns an error", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("unavailable") });
    const r = await invokeFraudCheck({ check_type: "user", user_id: "u1" });
    expect(r).toEqual({ blocked: false, flagged: false });
  });

  it("returns fallback when ok is false", async () => {
    invokeMock.mockResolvedValue({ data: { ok: false }, error: null });
    const r = await invokeFraudCheck({ check_type: "user", user_id: "u1" });
    expect(r).toEqual({ blocked: false, flagged: false });
  });

  it("returns blocked:true when actions_taken contains 'blocked'", async () => {
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        data: { results: [], actions_taken: [{ action: "blocked" }] },
      },
      error: null,
    });
    const r = await invokeFraudCheck({ check_type: "user", user_id: "u1" });
    expect(r.blocked).toBe(true);
    expect(r.flagged).toBe(false);
  });

  it("returns flagged:true when actions_taken contains 'flagged'", async () => {
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        data: { results: [], actions_taken: [{ action: "flagged" }] },
      },
      error: null,
    });
    const r = await invokeFraudCheck({ check_type: "advert", advert_id: "a1" });
    expect(r.flagged).toBe(true);
    expect(r.blocked).toBe(false);
  });

  it("returns both blocked and flagged when both actions are present", async () => {
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        data: {
          results: [],
          actions_taken: [{ action: "flagged" }, { action: "blocked" }],
        },
      },
      error: null,
    });
    const r = await invokeFraudCheck({ check_type: "user", user_id: "u1" });
    expect(r.blocked).toBe(true);
    expect(r.flagged).toBe(true);
  });

  it("returns fallback when actions_taken is empty (no rules matched)", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, data: { results: [], actions_taken: [] } },
      error: null,
    });
    const r = await invokeFraudCheck({ check_type: "user", user_id: "u1" });
    expect(r).toEqual({ blocked: false, flagged: false });
  });

  it("passes the correct body shape to Edge Function for user check", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, data: { results: [], actions_taken: [] } },
      error: null,
    });
    await invokeFraudCheck({ check_type: "user", user_id: "u42" });
    expect(invokeMock).toHaveBeenCalledWith("fraud-detection", {
      body: { check_type: "user", user_id: "u42" },
    });
  });

  it("passes the correct body shape to Edge Function for advert check", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true, data: { results: [], actions_taken: [] } },
      error: null,
    });
    await invokeFraudCheck({ check_type: "advert", advert_id: "advert-123" });
    expect(invokeMock).toHaveBeenCalledWith("fraud-detection", {
      body: { check_type: "advert", advert_id: "advert-123" },
    });
  });
});
