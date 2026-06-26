import { supabaseServer } from "@/lib/supabaseServer";

const DEFAULT_CAP = 48;

/** Count advert_likes rows per advert id (public-read RLS). Absent ids = 0. */
export async function resolveLikeCounts(advertIds: string[], options: { cap?: number } = {}): Promise<Map<string, number>> {
  const cap = options.cap ?? DEFAULT_CAP;
  const ids = Array.from(new Set(advertIds.filter(Boolean))).slice(0, cap);
  const out = new Map<string, number>();
  if (ids.length === 0) return out;

  const supabase = await supabaseServer();
  const { data } = await supabase.from("advert_likes").select("advert_id").in("advert_id", ids);
  for (const row of (data ?? []) as Array<{ advert_id: string }>) {
    out.set(row.advert_id, (out.get(row.advert_id) ?? 0) + 1);
  }
  return out;
}
