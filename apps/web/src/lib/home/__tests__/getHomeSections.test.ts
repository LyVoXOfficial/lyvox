import { describe, it, expect, vi, beforeEach } from "vitest";

// PERF-05: proves getFreeAds/getLatestAds-derived sections dedupe their
// downstream media/profile/like-count fetches across the union of advert ids
// instead of re-fetching per section (the old code hit `media`/`profiles`
// once per section, doubling work for any advert present in both lists).

vi.mock("@/lib/errorLogger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

const signMediaUrlsMock = vi.fn(async (items: Array<{ advert_id: string; sort?: number | null }>) =>
  items.map((item) => ({ ...item, signedUrl: `signed:${item.advert_id}`, previewUrl: null })),
);
vi.mock("@/lib/media/signMediaUrls", () => ({
  signMediaUrls: (...args: unknown[]) => signMediaUrlsMock(...(args as [Array<{ advert_id: string }>])),
}));

import { getHomeSections } from "@/lib/home/getHomeSections";

type Row = {
  id: string;
  category_id: string | null;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  created_at: string | null;
  user_id: string | null;
};

function tableBuilder(finalData: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or", "order", "limit", "in"]) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve({ data: finalData, error: null });
  return builder;
}

function makeSupabase(opts: { freeRows: Row[]; latestRows: Row[]; profileRows: unknown[]; mediaRows: unknown[] }) {
  const callCounts: Record<string, number> = {};
  let advertsCall = 0;

  const from = vi.fn((table: string) => {
    callCounts[table] = (callCounts[table] ?? 0) + 1;
    if (table === "adverts") {
      advertsCall += 1;
      // getHomeSections issues the free-ads query first, then the latest-ads
      // query — both are constructed synchronously before either resolves.
      return tableBuilder(advertsCall === 1 ? opts.freeRows : opts.latestRows);
    }
    if (table === "profiles") return tableBuilder(opts.profileRows);
    if (table === "media") return tableBuilder(opts.mediaRows);
    if (table === "advert_likes") return tableBuilder([]);
    throw new Error(`unexpected table: ${table}`);
  });

  return { supabase: { from } as never, callCounts };
}

describe("getHomeSections (PERF-05 dedup)", () => {
  beforeEach(() => {
    signMediaUrlsMock.mockClear();
  });

  it("fetches media/profiles exactly once for the union of ids across both sections", async () => {
    // adv-1 is free AND in the latest-24 window — a realistic overlap.
    const freeRows: Row[] = [
      { id: "adv-1", category_id: "c1", title: "Free bike", price: 0, currency: "EUR", location: "Gent", created_at: "2026-07-01T00:00:00Z", user_id: "u1" },
    ];
    const latestRows: Row[] = [
      { id: "adv-1", category_id: "c1", title: "Free bike", price: 0, currency: "EUR", location: "Gent", created_at: "2026-07-01T00:00:00Z", user_id: "u1" },
      { id: "adv-2", category_id: "c2", title: "Sofa", price: 50, currency: "EUR", location: "Antwerp", created_at: "2026-07-02T00:00:00Z", user_id: "u2" },
    ];
    const profileRows = [
      { id: "u1", verified_email: true, verified_phone: true },
      { id: "u2", verified_email: false, verified_phone: false },
    ];
    const mediaRows = [
      { advert_id: "adv-1", url: null, preview_url: null, sort: 0 },
      { advert_id: "adv-2", url: null, preview_url: null, sort: 0 },
    ];

    const { supabase, callCounts } = makeSupabase({ freeRows, latestRows, profileRows, mediaRows });

    const { freeAds, latestAds } = await getHomeSections(supabase);

    // Two independent `adverts` queries are unavoidable (different filters).
    expect(callCounts.adverts).toBe(2);
    // But media/profiles are fetched ONCE for the union of ids — this is the
    // dedup PERF-05 requires (old code fetched each once PER section).
    expect(callCounts.media).toBe(1);
    expect(callCounts.profiles).toBe(1);
    expect(signMediaUrlsMock).toHaveBeenCalledTimes(1);
    // signMediaUrls got both advert ids in one batch, not two separate calls.
    const signedBatch = signMediaUrlsMock.mock.calls[0][0] as Array<{ advert_id: string }>;
    expect(signedBatch.map((row) => row.advert_id).sort()).toEqual(["adv-1", "adv-2"]);

    expect(freeAds).toEqual([
      expect.objectContaining({ id: "adv-1", image: "signed:adv-1", sellerVerified: true, likeCount: 0 }),
    ]);
    expect(latestAds.map((ad) => ad.id)).toEqual(["adv-1", "adv-2"]);
    expect(latestAds[1]).toEqual(
      expect.objectContaining({ id: "adv-2", image: "signed:adv-2", sellerVerified: false, likeCount: 0 }),
    );
  });

  it("skips profile/media/like fetches entirely when both sections are empty", async () => {
    const { supabase, callCounts } = makeSupabase({ freeRows: [], latestRows: [], profileRows: [], mediaRows: [] });

    const { freeAds, latestAds } = await getHomeSections(supabase);

    expect(freeAds).toEqual([]);
    expect(latestAds).toEqual([]);
    expect(callCounts.profiles).toBeUndefined();
    expect(callCounts.media).toBeUndefined();
    expect(signMediaUrlsMock).not.toHaveBeenCalled();
  });
});
