import { describe, it, expect, beforeEach, vi } from "vitest";

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({ from: fromMock, rpc: rpcMock }),
}));

process.env.CRON_SECRET = "testsecret";
const { GET } = await import("../route");

function req(auth?: string) {
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = auth;
  return new Request("https://x.test/api/cron/saved-search-alerts", { headers });
}

const savedSearchesMock = (rows: unknown[], onUpdate?: () => void) => ({
  select: () => ({ eq: async () => ({ data: rows, error: null }) }),
  update: () => ({ eq: async () => { onUpdate?.(); return { error: null }; } }),
});

beforeEach(() => {
  fromMock.mockReset();
  rpcMock.mockReset();
});

describe("GET /api/cron/saved-search-alerts", () => {
  it("401 without auth", async () => {
    expect((await GET(req())).status).toBe(401);
  });

  it("401 with the wrong secret", async () => {
    expect((await GET(req("Bearer nope"))).status).toBe(401);
  });

  it("notifies + advances watermark for a search with fresh matches", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    let updated = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "saved_searches")
        return savedSearchesMock(
          [{ id: "s1", user_id: "u1", name: "bikes", query: "bike", filters: {}, last_alerted_at: "2020-01-01T00:00:00.000Z" }],
          () => { updated++; },
        );
      if (table === "notifications") return { insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null }; } };
      throw new Error("unexpected table " + table);
    });
    // one advert inside (watermark, now], one older than the watermark
    rpcMock.mockResolvedValue({
      data: [{ created_at: "2020-06-01T00:00:00.000Z" }, { created_at: "2019-06-01T00:00:00.000Z" }],
      error: null,
    });

    const res = await GET(req("Bearer testsecret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.notified).toBe(1);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].type).toBe("saved_search");
    expect(inserts[0].channel).toBe("in_app");
    expect(String(inserts[0].body)).toContain("1");
    expect(updated).toBe(1); // watermark advanced
  });

  it("does not notify when nothing is newer than the watermark", async () => {
    let updated = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "saved_searches")
        return savedSearchesMock(
          [{ id: "s1", user_id: "u1", name: "x", query: null, filters: {}, last_alerted_at: "2026-06-26T00:00:00.000Z" }],
          () => { updated++; },
        );
      if (table === "notifications") return { insert: async () => ({ error: null }) };
      throw new Error("unexpected table " + table);
    });
    rpcMock.mockResolvedValue({ data: [{ created_at: "2026-06-25T00:00:00.000Z" }], error: null });

    const res = await GET(req("Bearer testsecret"));
    const body = await res.json();
    expect(body.data.notified).toBe(0);
    expect(updated).toBe(1); // still advances the watermark
  });

  it("does NOT advance the watermark on an RPC error (no silent skip)", async () => {
    let updated = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "saved_searches")
        return savedSearchesMock(
          [{ id: "s1", user_id: "u1", name: "x", query: null, filters: {}, last_alerted_at: "2020-01-01T00:00:00.000Z" }],
          () => { updated++; },
        );
      if (table === "notifications") return { insert: async () => ({ error: null }) };
      throw new Error("unexpected table " + table);
    });
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    const res = await GET(req("Bearer testsecret"));
    expect((await res.json()).data.notified).toBe(0);
    expect(updated).toBe(0); // watermark must NOT move forward on a transient scan failure
  });
});
