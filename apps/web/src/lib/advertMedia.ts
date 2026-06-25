import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";

const SIGNED_DOWNLOAD_TTL_SECONDS = 10 * 60;
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
    .select("advert_id,url,sort")
    .in("advert_id", activeIds)
    .order("sort", { ascending: true });

  // First (lowest sort) media row per advert. Rows arrive sorted ascending.
  const firstPath = new Map<string, string>();
  for (const row of (media ?? []) as Array<{ advert_id: string; url: string }>) {
    if (!firstPath.has(row.advert_id)) firstPath.set(row.advert_id, row.url);
  }
  if (firstPath.size === 0) return out;

  const service = await supabaseService();
  const storage = service.storage.from("ad-media");

  await Promise.all(
    Array.from(firstPath.entries()).map(async ([advertId, path]) => {
      if (path.startsWith("http://") || path.startsWith("https://")) {
        out.set(advertId, path); // legacy absolute URL — use as-is
        return;
      }
      const { data, error } = await storage.createSignedUrl(
        path,
        SIGNED_DOWNLOAD_TTL_SECONDS,
      );
      if (!error && data?.signedUrl) out.set(advertId, data.signedUrl);
    }),
  );

  return out;
}
