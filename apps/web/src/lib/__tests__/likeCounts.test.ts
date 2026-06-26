import { describe, it, expect, beforeEach, vi } from "vitest";

const tableData: { data: unknown; error: unknown } = { data: [], error: null };
function builder() {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "in"]) b[m] = () => b;
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(tableData);
  return b;
}
vi.mock("@/lib/supabaseServer", () => ({ supabaseServer: async () => ({ from: () => builder() }) }));

const { resolveLikeCounts } = await import("@/lib/likeCounts");

describe("resolveLikeCounts", () => {
  beforeEach(() => { tableData.data = []; tableData.error = null; });

  it("counts rows per advert_id", async () => {
    tableData.data = [{ advert_id: "a" }, { advert_id: "a" }, { advert_id: "b" }];
    const map = await resolveLikeCounts(["a", "b", "c"]);
    expect(map.get("a")).toBe(2);
    expect(map.get("b")).toBe(1);
    expect(map.get("c") ?? 0).toBe(0);
  });

  it("returns empty map for empty input", async () => {
    const map = await resolveLikeCounts([]);
    expect(map.size).toBe(0);
  });
});
