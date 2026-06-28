import { describe, it, expect } from "vitest";
import { resolveGeneration } from "@/lib/catalog/resolveGeneration";

// ---------------------------------------------------------------------------
// Mock supabase builder — returns specified rows for any .eq() chain
// ---------------------------------------------------------------------------

function makeSupabase(rows: unknown[], error?: object) {
  const chain = {
    select: () => chain,
    eq: (_col: string, _val: unknown) => Promise.resolve({ data: error ? null : rows, error: error ?? null }),
  };
  return { from: (_table: string) => chain };
}

// Canonical generation fixtures (simplified BMW 5-Series scenario)
const E34 = { id: "gen-e34", code: "E34", start_year: 1988, end_year: 1996, facelift: false };
const E39 = { id: "gen-e39", code: "E39", start_year: 1995, end_year: 2003, facelift: false };
const E60 = { id: "gen-e60", code: "E60", start_year: 2003, end_year: 2010, facelift: false };

describe("resolveGeneration — F7 bug #1996 fix", () => {
  // ── Core ambiguity case: 1996 BMW 5 must NOT auto-pick ─────────────────
  it("(a) 1996 BMW 5-Series → ambiguous (E34 ends 1996, E39 starts 1995)", async () => {
    const result = await resolveGeneration("model-bmw5", 1996, makeSupabase([E34, E39, E60]));
    expect(result.status).toBe("ambiguous");
    expect(result.candidates.map((c) => c.code)).toEqual(expect.arrayContaining(["E34", "E39"]));
    expect(result.candidates.length).toBe(2);
  });

  // ── Unambiguous year within a single generation ─────────────────────────
  it("(b) 1998 → unique (only E39 covers 1995–2003)", async () => {
    const result = await resolveGeneration("model-bmw5", 1998, makeSupabase([E34, E39, E60]));
    expect(result.status).toBe("unique");
    expect(result.candidates[0].code).toBe("E39");
  });

  it("(c) 2004 → unique (only E60 covers 2003–2010)", async () => {
    const result = await resolveGeneration("model-bmw5", 2004, makeSupabase([E34, E39, E60]));
    expect(result.status).toBe("unique");
    expect(result.candidates[0].code).toBe("E60");
  });

  // ── Year outside all generations ────────────────────────────────────────
  it("(d) year predating all generations → none", async () => {
    const result = await resolveGeneration("model-bmw5", 1980, makeSupabase([E34, E39, E60]));
    expect(result.status).toBe("none");
    expect(result.candidates).toHaveLength(0);
  });

  // ── No year provided ────────────────────────────────────────────────────
  it("(e) no year, multiple generations → ambiguous", async () => {
    const result = await resolveGeneration("model-bmw5", null, makeSupabase([E34, E39, E60]));
    expect(result.status).toBe("ambiguous");
  });

  it("(f) no year, single generation → unique", async () => {
    const solo = { ...E34, model_id: "model-solo" };
    const result = await resolveGeneration("model-solo", null, makeSupabase([solo]));
    expect(result.status).toBe("unique");
    expect(result.candidates[0].id).toBe("gen-e34");
  });

  // ── Model with no generations ────────────────────────────────────────────
  it("(g) model with no generations → none", async () => {
    const result = await resolveGeneration("model-unknown", 2000, makeSupabase([]));
    expect(result.status).toBe("none");
    expect(result.candidates).toHaveLength(0);
  });

  // ── DB error → none (fail-safe, not throw) ──────────────────────────────
  it("(h) DB error → returns none without throwing", async () => {
    const result = await resolveGeneration("model-bmw5", 2000, makeSupabase([], { message: "conn refused", code: "500" }));
    expect(result.status).toBe("none");
  });

  // ── Null-bounded generations (open start or end) ─────────────────────────
  it("(i) generation with null end_year covers all future years → matches", async () => {
    const openEnd = { id: "gen-open", code: "OPEN", start_year: 2020, end_year: null, facelift: false };
    const result = await resolveGeneration("model-x", 2025, makeSupabase([openEnd]));
    expect(result.status).toBe("unique");
    expect(result.candidates[0].id).toBe("gen-open");
  });

  it("(j) generation with null start_year covers all past years → matches", async () => {
    const openStart = { id: "gen-classic", code: "CLASSIC", start_year: null, end_year: 1970, facelift: false };
    const result = await resolveGeneration("model-x", 1965, makeSupabase([openStart]));
    expect(result.status).toBe("unique");
    expect(result.candidates[0].id).toBe("gen-classic");
  });
});
