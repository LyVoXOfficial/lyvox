import { describe, it, expect, beforeEach, vi } from "vitest";

// Thenable query builder: every chained method returns the builder;
// awaiting it resolves to { data, error }.
function builder(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "in", "eq", "order"]) b[m] = () => b;
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
}

const tableResults: Record<string, { data: unknown; error: unknown }> = {};

const signMediaUrlsMock = vi.fn(
  async (items: Array<{ advert_id: string; url: string; preview_url?: string | null }>) =>
    items.map((item) => ({
      ...item,
      signedUrl: /^https?:\/\//i.test(item.url) ? item.url : `signed:${item.url}`,
      previewUrl: null,
    })),
);

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({
    from: (table: string) => builder(tableResults[table] ?? { data: [], error: null }),
  }),
}));

vi.mock("@/lib/media/signMediaUrls", () => ({
  signMediaUrls: (...args: unknown[]) => signMediaUrlsMock(...(args as [Array<{ advert_id: string; url: string }>])),
}));

const { resolveFirstImages } = await import("@/lib/advertMedia");

describe("resolveFirstImages", () => {
  beforeEach(() => {
    signMediaUrlsMock.mockClear();
    tableResults.adverts = {
      data: [
        { id: "a1", status: "active" },
        { id: "a2", status: "active" },
        { id: "a3", status: "draft" }, // inactive -> excluded
      ],
      error: null,
    };
    tableResults.media = {
      data: [
        { advert_id: "a1", url: "a1/first.jpg", sort: 0 },
        { advert_id: "a1", url: "a1/second.jpg", sort: 1 }, // not first
        { advert_id: "a2", url: "https://cdn.example/a2.jpg", sort: 0 }, // legacy absolute
      ],
      error: null,
    };
  });

  it("returns a signed first-image URL per active advert with media", async () => {
    const map = await resolveFirstImages(["a1", "a2", "a3"]);
    expect(map.get("a1")).toBe("signed:a1/first.jpg");
    expect(map.get("a2")).toBe("https://cdn.example/a2.jpg"); // legacy passthrough
    expect(map.has("a3")).toBe(false); // inactive
  });

  it("signs only the first (lowest-sort) media row per advert, via the shared batch signer", async () => {
    await resolveFirstImages(["a1", "a2"]);
    expect(signMediaUrlsMock).toHaveBeenCalledTimes(1);
    const batch = signMediaUrlsMock.mock.calls[0][0] as Array<{ advert_id: string; url: string }>;
    expect(batch).toHaveLength(2);
    expect(batch.find((i) => i.advert_id === "a1")?.url).toBe("a1/first.jpg");
  });

  it("dedupes and caps the id list before querying", async () => {
    const map = await resolveFirstImages(["a1", "a1", "a1"], { cap: 1 });
    expect(map.get("a1")).toBe("signed:a1/first.jpg");
  });

  it("returns an empty map for empty input", async () => {
    const map = await resolveFirstImages([]);
    expect(map.size).toBe(0);
    expect(signMediaUrlsMock).not.toHaveBeenCalled();
  });
});
