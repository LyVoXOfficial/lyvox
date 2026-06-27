import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks must be hoisted before any import of the module under test ---

const checkViesVatMock = vi.fn();
vi.mock("@/lib/verification/vies", () => ({
  checkViesVat: (...args: unknown[]) => checkViesVatMock(...args),
}));

// We intentionally do NOT mock nameMatch — its logic is simple and we want real behaviour.

const { runViesVerification } = await import("@/lib/verification/runViesVerification");

// ---------------------------------------------------------------------------
// Fake SupabaseClient factory
// ---------------------------------------------------------------------------

type UpdateChain = {
  eq: (col: string, val: unknown) => UpdateChain;
};

type SelectChain = {
  eq: (col: string, val: unknown) => SelectChain;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
};

type FromTable = {
  select: (cols: string) => SelectChain;
  update: (data: Record<string, unknown>) => UpdateChain;
};

// Track calls for assertions
let updatesRecorded: Array<{ table: string; data: Record<string, unknown> }> = [];

function makeSelectChain(data: Record<string, unknown> | null): SelectChain {
  const chain: SelectChain = {
    eq: () => chain,
    maybeSingle: async () => ({ data, error: null }),
  };
  return chain;
}

function makeUpdateChain(
  table: string,
  data: Record<string, unknown>,
): UpdateChain {
  updatesRecorded.push({ table, data });
  const chain: UpdateChain = {
    eq: () => chain,
  };
  return chain;
}

// Business fixtures
const BIZ_ACTIVE_VAT: Record<string, unknown> = {
  vat_number: "0203201340",
  vat_liable: true,
  legal_name: "Test BV",
  status: "active",
};

const BIZ_ACTIVE_NO_VAT: Record<string, unknown> = {
  vat_number: null,
  vat_liable: false,
  legal_name: "Test Eenmanszaak",
  status: "active",
};

function makeServiceClient(opts: {
  biz: Record<string, unknown> | null;
  verRow?: Record<string, unknown> | null;
  bizAfter?: Record<string, unknown> | null;
}): SupabaseClient {
  let selectCallCount = 0;

  return {
    from: (table: string): FromTable => {
      return {
        select: (_cols: string): SelectChain => {
          const chain: SelectChain = {
            eq: () => chain,
            maybeSingle: async () => {
              // First select on "businesses" → the main biz load
              // Select on "verifications" → the vies:pending row
              // Second select on "businesses" → read-back of entity_verified
              if (table === "businesses") {
                selectCallCount++;
                if (selectCallCount === 1) {
                  return { data: opts.biz, error: null };
                }
                // read-back
                return {
                  data: opts.bizAfter ?? ({ entity_verified: false } as Record<string, unknown>),
                  error: null,
                };
              }
              if (table === "verifications") {
                return {
                  data: opts.verRow ?? null,
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          };
          return chain;
        },
        update: (data: Record<string, unknown>): UpdateChain => makeUpdateChain(table, data),
      };
    },
  } as unknown as SupabaseClient;
}

type SupabaseClient = Awaited<ReturnType<typeof import("@supabase/supabase-js").createClient>>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  checkViesVatMock.mockReset();
  updatesRecorded = [];
});

describe("runViesVerification", () => {
  // ── Not found ─────────────────────────────────────────────────────────────

  it("returns business_status:'not_found' when business row is missing", async () => {
    const service = makeServiceClient({ biz: null });
    const result = await runViesVerification(service, "no-such-id");
    expect(result.business_status).toBe("not_found");
    expect(checkViesVatMock).not.toHaveBeenCalled();
  });

  // ── Not VAT-liable (D2) ───────────────────────────────────────────────────

  it("returns kbo/pending with note when vat_liable=false, no VIES call", async () => {
    const service = makeServiceClient({ biz: BIZ_ACTIVE_NO_VAT });
    const result = await runViesVerification(service, "biz-1");
    expect(result.method).toBe("kbo");
    expect(result.status).toBe("pending");
    expect(result.entity_verified).toBe(false);
    expect(result.evidence).toMatchObject({ note: "awaiting_admin_no_vat" });
    expect(checkViesVatMock).not.toHaveBeenCalled();
  });

  // ── Valid + name match → verified ─────────────────────────────────────────

  it("valid VIES + matching name → status:'verified', entity_verified:true", async () => {
    checkViesVatMock.mockResolvedValue({
      outcome: "valid",
      name: "Test BV",
      address: "Rue A 1",
      requestIdentifier: "REQ-001",
      requestDate: "2026-06-27",
    });

    const service = makeServiceClient({
      biz: BIZ_ACTIVE_VAT,
      verRow: { id: "ver-1", evidence: { queued_at: "2026-06-27" } },
      bizAfter: { entity_verified: true },
    });

    const result = await runViesVerification(service, "biz-1");

    expect(result.method).toBe("vies");
    expect(result.status).toBe("verified");
    expect(result.entity_verified).toBe(true);
    expect(result.evidence).toMatchObject({ name_match: "auto" });

    // Must have updated verifications to verified
    const verUpdate = updatesRecorded.find(
      (u) => u.table === "verifications" && (u.data as { status?: string }).status === "verified",
    );
    expect(verUpdate).toBeDefined();
  });

  // ── Valid + name mismatch → pending ───────────────────────────────────────

  it("valid VIES + name mismatch → status:'pending', evidence.name_match='mismatch'", async () => {
    checkViesVatMock.mockResolvedValue({
      outcome: "valid",
      name: "Completely Different Company NV",
      address: "Rue B 2",
      requestIdentifier: "",
      requestDate: "2026-06-27",
    });

    const service = makeServiceClient({
      biz: BIZ_ACTIVE_VAT,
      verRow: { id: "ver-1", evidence: {} },
      bizAfter: { entity_verified: false },
    });

    const result = await runViesVerification(service, "biz-1");

    expect(result.method).toBe("vies");
    expect(result.status).toBe("pending");
    expect(result.evidence).toMatchObject({ name_match: "mismatch" });

    // Must NOT have updated to verified
    const verifiedUpdate = updatesRecorded.find(
      (u) => u.table === "verifications" && (u.data as { status?: string }).status === "verified",
    );
    expect(verifiedUpdate).toBeUndefined();
  });

  // ── Invalid → failed + suspend when active ────────────────────────────────

  it("invalid VIES → status:'failed', business suspended when was active", async () => {
    checkViesVatMock.mockResolvedValue({
      outcome: "invalid",
      requestDate: "2026-06-27",
    });

    const service = makeServiceClient({
      biz: BIZ_ACTIVE_VAT,
      verRow: { id: "ver-1", evidence: {} },
    });

    const result = await runViesVerification(service, "biz-1");

    expect(result.method).toBe("vies");
    expect(result.status).toBe("failed");
    expect(result.business_status).toBe("suspended");
    expect(result.entity_verified).toBe(false);

    // verifications must be updated to failed
    const verFailed = updatesRecorded.find(
      (u) => u.table === "verifications" && (u.data as { status?: string }).status === "failed",
    );
    expect(verFailed).toBeDefined();

    // businesses must be updated to suspended
    const bizSuspended = updatesRecorded.find(
      (u) => u.table === "businesses" && (u.data as { status?: string }).status === "suspended",
    );
    expect(bizSuspended).toBeDefined();
  });

  it("invalid VIES → business NOT suspended when it was NOT active (e.g. draft)", async () => {
    checkViesVatMock.mockResolvedValue({
      outcome: "invalid",
      requestDate: "2026-06-27",
    });

    const service = makeServiceClient({
      biz: { ...BIZ_ACTIVE_VAT, status: "draft" },
      verRow: { id: "ver-1", evidence: {} },
    });

    const result = await runViesVerification(service, "biz-1");

    expect(result.status).toBe("failed");
    expect(result.business_status).toBe("draft");

    const bizSuspended = updatesRecorded.find(
      (u) => u.table === "businesses" && (u.data as { status?: string }).status === "suspended",
    );
    expect(bizSuspended).toBeUndefined();
  });

  // ── Unavailable (transient) → pending + retry meta ────────────────────────

  it("unavailable VIES → status:'pending', retry_count bumped, next_retry_at set", async () => {
    checkViesVatMock.mockResolvedValue({
      outcome: "unavailable",
      error: "MS_UNAVAILABLE",
    });

    const service = makeServiceClient({
      biz: BIZ_ACTIVE_VAT,
      verRow: { id: "ver-1", evidence: { retry_count: 1 } },
      bizAfter: { entity_verified: false },
    });

    const result = await runViesVerification(service, "biz-1");

    expect(result.method).toBe("vies");
    expect(result.status).toBe("pending");
    expect(result.business_status).toBe("active"); // provisional stands
    expect(typeof result.evidence.retry_count).toBe("number");
    expect(result.evidence.retry_count).toBe(2); // was 1, now 2
    expect(typeof result.evidence.next_retry_at).toBe("string");
    expect(result.evidence.next_retry_at).toBeTruthy();

    // verifications row must have been updated (not to failed or verified)
    const verUpdate = updatesRecorded.find(
      (u) =>
        u.table === "verifications" &&
        typeof (u.data as { evidence?: unknown }).evidence === "object",
    );
    expect(verUpdate).toBeDefined();
  });

  it("unavailable VIES on first attempt → retry_count becomes 1, backoff ~2s", async () => {
    checkViesVatMock.mockResolvedValue({
      outcome: "unavailable",
      error: "TIMEOUT",
    });

    const before = Date.now();

    const service = makeServiceClient({
      biz: BIZ_ACTIVE_VAT,
      verRow: { id: "ver-1", evidence: {} }, // no prior retry_count
      bizAfter: { entity_verified: false },
    });

    const result = await runViesVerification(service, "biz-1");

    expect(result.evidence.retry_count).toBe(1);
    const nextRetry = new Date(result.evidence.next_retry_at as string).getTime();
    // next_retry_at must be at least ~2s ahead
    expect(nextRetry).toBeGreaterThan(before + 1900);
    // and not unreasonably far (cap 30s + jitter)
    expect(nextRetry).toBeLessThan(before + 35_000);
  });

  // ── bad_input → failed immediately ────────────────────────────────────────

  it("bad_input VIES → status:'failed', no retry meta", async () => {
    checkViesVatMock.mockResolvedValue({
      outcome: "bad_input",
      error: "INVALID_INPUT",
    });

    const service = makeServiceClient({
      biz: BIZ_ACTIVE_VAT,
      verRow: { id: "ver-1", evidence: {} },
    });

    const result = await runViesVerification(service, "biz-1");

    expect(result.status).toBe("failed");
    // No retry_count in evidence (bad_input means don't retry)
    expect(result.evidence.retry_count).toBeUndefined();
  });
});
