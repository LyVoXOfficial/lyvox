export type GenerationStatus = "unique" | "ambiguous" | "none";

export type VehicleGenerationSummary = {
  id: string;
  code: string | null;
  start_year: number | null;
  end_year: number | null;
  facelift: boolean | null;
};

export type ResolveGenerationResult = {
  status: GenerationStatus;
  candidates: VehicleGenerationSummary[];
};

type AnySupabase = { from: (table: string) => any };

/**
 * Resolve vehicle generation for a model+year combination.
 *
 * Returns:
 *   unique   → exactly one generation matches; candidates[0] is the answer
 *   ambiguous → multiple generations match the year (e.g. 1996 BMW 5: E34 + E39);
 *               caller must show a chooser
 *   none     → no generations recorded for this model, or no match for the year
 *
 * When year is null, returns unique only if there is exactly one generation total.
 */
export async function resolveGeneration(
  modelId: string,
  year: number | null,
  supabase: AnySupabase,
): Promise<ResolveGenerationResult> {
  const { data: rows, error } = await supabase
    .from("vehicle_generations")
    .select("id, code, start_year, end_year, facelift")
    .eq("model_id", modelId);

  if (error || !rows || rows.length === 0) {
    return { status: "none", candidates: [] };
  }

  const generations = rows as VehicleGenerationSummary[];

  if (!year) {
    if (generations.length === 1) return { status: "unique", candidates: [generations[0]] };
    return { status: "ambiguous", candidates: generations };
  }

  const matching = generations.filter((g) => {
    const startOk = g.start_year === null || g.start_year <= year;
    const endOk = g.end_year === null || g.end_year >= year;
    return startOk && endOk;
  });

  if (matching.length === 0) return { status: "none", candidates: [] };
  if (matching.length === 1) return { status: "unique", candidates: [matching[0]] };
  return { status: "ambiguous", candidates: matching };
}
