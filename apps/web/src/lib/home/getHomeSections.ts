import { logger } from "@/lib/errorLogger";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { getFirstImage } from "@/lib/media/getFirstImage";
import { resolveLikeCounts } from "@/lib/likeCounts";
import { supabaseServer } from "@/lib/supabaseServer";
import type { AdvertCard } from "@/lib/advertCards";

export type AdListItem = {
  id: string;
  categoryId?: string | null;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
  likeCount?: number;
};

export type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;

type RawAdvertRow = {
  id: string;
  category_id: string | null;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  created_at: string | null;
  user_id: string | null;
};

async function resolveFirstImages(
  supabase: SupabaseServerClient,
  advertIds: string[],
  logContext: { component: string; action: string },
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  if (advertIds.length === 0) {
    return map;
  }

  const { data: mediaData, error: mediaError } = await supabase
    .from("media")
    .select("advert_id,url,preview_url,sort")
    .in("advert_id", advertIds)
    .order("sort", { ascending: true });

  if (mediaError) {
    logger.warn("Failed to fetch media rows", {
      component: logContext.component,
      action: logContext.action,
      error: mediaError,
    });
    return map;
  }

  if (!mediaData?.length) {
    return map;
  }

  const signedMedia = await signMediaUrls(mediaData);
  const grouped = signedMedia.reduce(
    (acc, media) => {
      const advertId = media.advert_id;
      if (!acc.has(advertId)) {
        acc.set(advertId, []);
      }

      acc.get(advertId)!.push({
        url: media.url ?? null,
        signedUrl: media.signedUrl,
        previewUrl: media.previewUrl,
        sort: media.sort ?? null,
      });

      return acc;
    },
    new Map<string, Array<{ url: string | null; signedUrl: string | null; previewUrl?: string | null; sort: number | null }>>(),
  );

  for (const [advertId, items] of grouped.entries()) {
    const first = getFirstImage(items);
    if (first) {
      map.set(advertId, first);
    }
  }

  return map;
}

// PERF-05: `getFreeAds` (price = 0/null) and `getLatestAds` (all active) are
// independent `adverts` queries — different filters, can't be merged — but
// their result sets overlap (a fresh free ad is often also in the latest 24).
// The old code fetched media/profiles/likes separately per section, doubling
// that work for any overlapping id. This fetches both advert lists first,
// then resolves media/profiles/likes ONCE for the union of ids/user ids.
export async function getHomeSections(
  supabase: SupabaseServerClient,
): Promise<{ freeAds: AdListItem[]; latestAds: AdvertCard[] }> {
  const [freeRes, latestRes] = await Promise.all([
    supabase
      .from("adverts")
      .select("id,category_id,title,price,currency,location,created_at,user_id")
      .eq("status", "active")
      .or("price.eq.0,price.is.null")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("adverts")
      .select("id,category_id,title,price,currency,location,created_at,user_id")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  if (freeRes.error) {
    logger.error("Failed to fetch free ads", {
      component: "HomePage",
      action: "getFreeAds",
      error: freeRes.error,
    });
  }
  if (latestRes.error) {
    logger.error("Failed to fetch latest ads", {
      component: "HomePage",
      action: "getLatestAds",
      error: latestRes.error,
    });
  }

  const freeRows = (freeRes.error ? [] : freeRes.data) ?? ([] as RawAdvertRow[]);
  const latestRows = (latestRes.error ? [] : latestRes.data) ?? ([] as RawAdvertRow[]);

  const allIds = Array.from(new Set([...freeRows.map((ad) => ad.id), ...latestRows.map((ad) => ad.id)]));
  const allUserIds = Array.from(
    new Set(
      [...freeRows, ...latestRows]
        .map((ad) => ad.user_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  );

  const profilesPromise =
    allUserIds.length > 0
      ? supabase.from("profiles").select("id,verified_email,verified_phone").in("id", allUserIds)
      : Promise.resolve({ data: null });

  const mediaPromise =
    allIds.length > 0
      ? resolveFirstImages(supabase, allIds, { component: "HomePage", action: "getHomeSections:media" })
      : Promise.resolve(new Map<string, string>());

  const [{ data: profilesData }, mediaMap, likeMap] = await Promise.all([
    profilesPromise,
    mediaPromise,
    resolveLikeCounts(allIds, { supabase }),
  ]);

  const verifiedMap = new Map<string, boolean>();
  if (profilesData) {
    for (const profile of profilesData) {
      verifiedMap.set(
        profile.id,
        Boolean(profile.verified_email) && Boolean(profile.verified_phone),
      );
    }
  }

  const freeAds: AdListItem[] = freeRows.map((ad) => ({
    id: ad.id,
    categoryId: ad.category_id ?? null,
    title: ad.title,
    price: ad.price,
    currency: ad.currency ?? null,
    location: ad.location,
    createdAt: ad.created_at ?? null,
    image: mediaMap.get(ad.id) ?? null,
    sellerVerified: verifiedMap.get(ad.user_id ?? "") ?? false,
    likeCount: likeMap.get(ad.id) ?? 0,
  }));

  const latestAds: AdvertCard[] = latestRows.map((ad) => ({
    id: ad.id,
    categoryId: ad.category_id ?? null,
    title: ad.title,
    price: ad.price ?? null,
    currency: ad.currency ?? null,
    location: ad.location ?? null,
    createdAt: ad.created_at ?? null,
    image: mediaMap.get(ad.id) ?? null,
    sellerVerified: verifiedMap.get(ad.user_id ?? "") ?? false,
    likeCount: likeMap.get(ad.id) ?? 0,
  }));

  return { freeAds, latestAds };
}
