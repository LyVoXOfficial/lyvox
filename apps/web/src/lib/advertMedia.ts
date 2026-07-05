import { supabaseServer } from "@/lib/supabaseServer";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { getFirstImage } from "@/lib/media/getFirstImage";

const DEFAULT_CAP = 24;

/**
 * Resolve a signed first-image URL for each active advert id.
 * Inactive adverts and adverts without media are omitted from the result.
 * The id list is deduped and capped (default 24) before any DB/storage work.
 */
export async function resolveFirstImages(
  advertIds: string[],
  options: { cap?: number } = {},
): Promise<Map<string, string>> {
  const cap = options.cap ?? DEFAULT_CAP;
  const ids = Array.from(new Set(advertIds.filter(Boolean))).slice(0, cap);
  const out = new Map<string, string>();
  if (ids.length === 0) return out;

  const supabase = await supabaseServer();

  const { data: adverts } = await supabase
    .from("adverts")
    .select("id,status")
    .in("id", ids);

  const activeIds = (adverts ?? [])
    .filter((a: { status?: string | null }) => a.status === "active")
    .map((a: { id: string }) => a.id);
  if (activeIds.length === 0) return out;

  const { data: media } = await supabase
    .from("media")
    .select("advert_id,url,preview_url,sort")
    .in("advert_id", activeIds)
    .order("sort", { ascending: true });

  // First (lowest sort) media row per advert. Rows arrive sorted ascending.
  const firstRow = new Map<string, { advert_id: string; url: string; preview_url: string | null }>();
  for (const row of (media ?? []) as Array<{ advert_id: string; url: string; preview_url: string | null }>) {
    if (!firstRow.has(row.advert_id)) firstRow.set(row.advert_id, row);
  }
  if (firstRow.size === 0) return out;

  // Batch + shared memory cache (PERF-03: consolidated onto the same signer as everywhere else).
  const signed = await signMediaUrls(Array.from(firstRow.values()));

  for (const item of signed) {
    const image = getFirstImage([item]);
    if (image) out.set(item.advert_id, image);
  }

  return out;
}
