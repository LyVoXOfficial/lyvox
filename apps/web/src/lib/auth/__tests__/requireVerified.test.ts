import { describe, it, expect, beforeEach } from "vitest";

const tableData: Record<string, { data: unknown; error: unknown }> = {};
function builder(table: string) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = () => b;
  (b as { maybeSingle: unknown }).maybeSingle = async () => tableData[table] ?? { data: null, error: null };
  return b;
}
const supabase = { from: (t: string) => builder(t) } as never;

const { isViewerVerified } = await import("@/lib/auth/requireVerified");

describe("isViewerVerified", () => {
  beforeEach(() => { tableData.profiles = { data: null, error: null }; tableData.phones = { data: null, error: null }; });

  it("true when phones.verified is true", async () => {
    tableData.phones = { data: { verified: true }, error: null };
    tableData.profiles = { data: { verified_phone: false }, error: null };
    expect(await isViewerVerified(supabase, "u1")).toBe(true);
  });

  it("true when profiles.verified_phone is true even if a stale phones row says false (OR, not ??)", async () => {
    tableData.phones = { data: { verified: false }, error: null };
    tableData.profiles = { data: { verified_phone: true }, error: null };
    expect(await isViewerVerified(supabase, "u1")).toBe(true);
  });

  it("false when neither signal is true", async () => {
    tableData.phones = { data: { verified: false }, error: null };
    tableData.profiles = { data: { verified_phone: false }, error: null };
    expect(await isViewerVerified(supabase, "u1")).toBe(false);
  });

  it("false when both rows are missing", async () => {
    expect(await isViewerVerified(supabase, "u1")).toBe(false);
  });
});
