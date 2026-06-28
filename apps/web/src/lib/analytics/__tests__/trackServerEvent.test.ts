import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock supabaseService ────────────────────────────────────────────────────

const upsertMock = vi.fn();

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: () => ({ upsert: upsertMock }),
  }),
}));

// server-only guard is a no-op in the test environment
vi.mock("server-only", () => ({}));

const { trackServerEvent } = await import("../trackServerEvent");
import { ANALYTICS_EVENTS } from "../events";

beforeEach(() => {
  upsertMock.mockReset();
  upsertMock.mockResolvedValue({ data: null, error: null });
});

describe("trackServerEvent", () => {
  it("calls supabaseService.from('analytics_events').upsert with the event", async () => {
    await trackServerEvent(ANALYTICS_EVENTS.ADVERT_VIEWED, { advert_id: "abc" }, {
      userId: "user-123",
      dedupKey: "view:abc:user-123:12345",
    });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [row, opts] = upsertMock.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(row.event_name).toBe("advert_viewed");
    expect(row.user_id).toBe("user-123");
    // B3: server dedup_keys are stored with 's:' prefix
    expect(row.dedup_key).toBe("s:view:abc:user-123:12345");
    expect((row.props as Record<string, unknown>).advert_id).toBe("abc");
    expect(opts.ignoreDuplicates).toBe(true);
    expect(opts.onConflict).toBe("dedup_key");
  });

  it("sets user_id and dedup_key to null when not provided", async () => {
    await trackServerEvent(ANALYTICS_EVENTS.SEARCH_PERFORMED, { query: "bike" });

    const [row] = upsertMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(row.user_id).toBeNull();
    expect(row.dedup_key).toBeNull();
    expect(row.session_id).toBeNull();
  });

  it("does not throw when supabase returns an error (best-effort)", async () => {
    upsertMock.mockResolvedValue({ data: null, error: { message: "DB error" } });
    await expect(
      trackServerEvent(ANALYTICS_EVENTS.CONTACT_START, {}, { userId: "u1" }),
    ).resolves.toBeUndefined();
  });

  it("does not throw when supabase throws unexpectedly", async () => {
    upsertMock.mockRejectedValue(new Error("network failure"));
    await expect(
      trackServerEvent(ANALYTICS_EVENTS.ADVERT_LIKED, {}),
    ).resolves.toBeUndefined();
  });
});
