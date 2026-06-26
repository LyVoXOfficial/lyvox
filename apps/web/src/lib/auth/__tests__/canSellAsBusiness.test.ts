import { describe, it, expect, beforeEach } from "vitest";

// ---------- minimal supabase mock ----------

type MockRow = Record<string, unknown> | null;

// Per-table data for `from().select().eq().maybeSingle()`
const tableData: Record<string, MockRow> = {};
// Result for `rpc("is_business_member", ...)`
let rpcResult: unknown = false;

function makeChainedBuilder(result: MockRow) {
  const b: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq", "match", "filter"];
  for (const m of methods) b[m] = () => b;
  b.maybeSingle = async () => ({ data: result, error: null });
  b.single = async () => ({ data: result, error: null });
  return b;
}

const supabase = {
  from: (table: string) => makeChainedBuilder(tableData[table] ?? null),
  rpc: async (_fn: string, _args?: unknown) => ({ data: rpcResult, error: null }),
} as never;

// ---------- import under test ----------
const { canSellAsBusiness } = await import("@/lib/auth/canSellAsBusiness");

// ---------- helpers ----------
function setPhoneVerified(verified: boolean) {
  tableData.profiles = { verified_phone: verified };
  tableData.phones = { verified: verified };
}

describe("canSellAsBusiness", () => {
  beforeEach(() => {
    // Reset: verified phone, is member, business is active (happy path)
    setPhoneVerified(true);
    rpcResult = true;
    tableData.businesses = { status: "active" };
  });

  it("returns {ok:false, reason:'phone'} when user is not phone-verified", async () => {
    setPhoneVerified(false);
    const result = await canSellAsBusiness(supabase, "user-1", "biz-1");
    expect(result).toEqual({ ok: false, reason: "phone" });
  });

  it("returns {ok:false, reason:'membership'} when verified but not a business member", async () => {
    rpcResult = false;
    const result = await canSellAsBusiness(supabase, "user-1", "biz-1");
    expect(result).toEqual({ ok: false, reason: "membership" });
  });

  it("returns {ok:false, reason:'not_active'} when verified+member but business status is 'draft'", async () => {
    tableData.businesses = { status: "draft" };
    const result = await canSellAsBusiness(supabase, "user-1", "biz-1");
    expect(result).toEqual({ ok: false, reason: "not_active" });
  });

  it("returns {ok:false, reason:'not_active'} when business status is 'suspended'", async () => {
    tableData.businesses = { status: "suspended" };
    const result = await canSellAsBusiness(supabase, "user-1", "biz-1");
    expect(result).toEqual({ ok: false, reason: "not_active" });
  });

  it("returns {ok:false, reason:'not_active'} when business row is missing (null)", async () => {
    tableData.businesses = null;
    const result = await canSellAsBusiness(supabase, "user-1", "biz-1");
    expect(result).toEqual({ ok: false, reason: "not_active" });
  });

  it("returns {ok:true} when phone-verified + is member + business status is active", async () => {
    // entity_verified is intentionally NOT checked (D4)
    tableData.businesses = { status: "active", entity_verified: false };
    const result = await canSellAsBusiness(supabase, "user-1", "biz-1");
    expect(result).toEqual({ ok: true });
  });

  it("does NOT require entity_verified: returns ok:true even with entity_verified false", async () => {
    tableData.businesses = { status: "active", entity_verified: false };
    const result = await canSellAsBusiness(supabase, "user-1", "biz-1");
    expect(result.ok).toBe(true);
  });

  it("checks verification via profiles.verified_phone OR phones.verified (OR logic)", async () => {
    // Only profile verified, phones says false — should still be verified (OR)
    tableData.profiles = { verified_phone: true };
    tableData.phones = { verified: false };
    const result = await canSellAsBusiness(supabase, "user-1", "biz-1");
    expect(result.ok).toBe(true);
  });
});
