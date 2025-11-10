import InfoCarousel from "@/components/info-carousel";
import CategoriesCarousel from "@/components/categories-carousel";
import SectionTitle from "@/components/section-title";
import AdsGrid from "@/components/ads-grid";
// import TopSellersCarousel from "@/components/home/TopSellersCarousel";
// import TopAdvertCard from "@/components/home/TopAdvertCard";
import { getI18nProps } from "@/i18n/server";
import { logger } from "@/lib/errorLogger";
import { getJsonLdScriptProps } from "@/lib/seo";
import { supabaseServer } from "@/lib/supabaseServer";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { getFirstImage } from "@/lib/media/getFirstImage";

export const revalidate = 60;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://lyvox.be";

type AdListItem = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
};

type SupabaseClient = Awaited<ReturnType<typeof supabaseServer>>;

async function resolveFirstImages(
  supabase: SupabaseClient,
  advertIds: string[],
  logContext: { component: string; action: string },
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  if (advertIds.length === 0) {
    return map;
  }

  const { data: mediaData, error: mediaError } = await supabase
    .from("media")
    .select("advert_id,url,sort")
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
        sort: media.sort ?? null,
      });

      return acc;
    },
    new Map<string, Array<{ url: string | null; signedUrl: string | null; sort: number | null }>>(),
  );

  for (const [advertId, items] of grouped.entries()) {
    const first = getFirstImage(items);
    if (first) {
      map.set(advertId, first);
    }
  }

  return map;
}

async function getFreeAds(): Promise<AdListItem[]> {
  const supabase = await supabaseServer();

  // Get free ads (price = 0 or null)
  const { data: free, error: freeError } = await supabase
    .from("adverts")
    .select("id,title,price,currency,location,created_at,user_id")
    .eq("status", "active")
    .or("price.eq.0,price.is.null")
    .order("created_at", { ascending: false })
    .limit(10);

  if (freeError) {
    logger.error("Failed to fetch free ads", {
      component: "HomePage",
      action: "getFreeAds",
      error: freeError,
    });
    return [];
  }

  const freeIds = (free ?? []).map((ad) => ad.id);
  const userIds = (free ?? [])
    .map((ad) => ad.user_id)
    .filter((value): value is string => typeof value === "string");

  let verifiedMap = new Map<string, boolean>();
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id,verified_email,verified_phone")
      .in("id", userIds);

    if (profilesData) {
      verifiedMap = new Map(
        profilesData.map((profile) => [
          profile.id,
          Boolean(profile.verified_email) && Boolean(profile.verified_phone),
        ]),
      );
    }
  }

  // Get first image for each ad
  const firstImageByAdvert = new Map<string, string>();
  if (freeIds.length) {
    const mediaMap = await resolveFirstImages(supabase, freeIds, {
      component: "HomePage",
      action: "getFreeAds:media",
    });

    for (const [advertId, url] of mediaMap.entries()) {
      firstImageByAdvert.set(advertId, url);
    }
  }

  return (free ?? []).map((ad) => ({
    id: ad.id,
    title: ad.title,
    price: ad.price,
    currency: ad.currency ?? null,
    location: ad.location,
    createdAt: ad.created_at ?? null,
    image: firstImageByAdvert.get(ad.id) ?? null,
    sellerVerified: verifiedMap.get(ad.user_id ?? "") ?? false,
  }));
}

async function getLatestAds(): Promise<AdListItem[]> {
  const supabase = await supabaseServer();

  // Get latest ads
  const { data: ads, error: adsError } = await supabase
    .from("adverts")
    .select("id,title,price,currency,location,created_at,user_id")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(24);

  if (adsError) {
    logger.error("Failed to fetch latest ads", {
      component: "HomePage",
      action: "getLatestAds",
      error: adsError,
    });
    return [];
  }

  const adIds = (ads ?? []).map((ad) => ad.id);
  const userIds = (ads ?? [])
    .map((ad) => ad.user_id)
    .filter((value): value is string => typeof value === "string");

  let verifiedMap = new Map<string, boolean>();
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id,verified_email,verified_phone")
      .in("id", userIds);

    if (profilesData) {
      verifiedMap = new Map(
        profilesData.map((profile) => [
          profile.id,
          Boolean(profile.verified_email) && Boolean(profile.verified_phone),
        ]),
      );
    }
  }

  // Get first image for each ad
  const firstMedia = new Map<string, string>();
  if (adIds.length) {
    const mediaMap = await resolveFirstImages(supabase, adIds, {
      component: "HomePage",
      action: "getLatestAds:media",
    });

    for (const [advertId, url] of mediaMap.entries()) {
      firstMedia.set(advertId, url);
    }
  }

  return (ads ?? []).map((ad) => ({
    id: ad.id,
    title: ad.title,
    price: ad.price,
    currency: ad.currency ?? null,
    location: ad.location,
    createdAt: ad.created_at ?? null,
    image: firstMedia.get(ad.id) ?? null,
    sellerVerified: verifiedMap.get(ad.user_id ?? "") ?? false,
  }));
}

export default async function Home() {
  const { locale, messages } = await getI18nProps();
  
  // Fetch data in parallel
  const [freeAds, latestAds] = await Promise.all([
    getFreeAds(),
    getLatestAds(),
  ]);

  // Helper function for translations
  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = messages;
    for (const k of keys) {
      value = value?.[k];
    }
    return value ?? key;
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: messages?.app?.title ?? "LyVoX",
    description: messages?.app?.description ?? undefined,
    url: BASE_URL,
    logo: `${BASE_URL}/favicon.ico`,
  };

  return (
    <>
      <script {...getJsonLdScriptProps(organizationJsonLd)} />
      <div className="space-y-8">
      <InfoCarousel />

      <section className="space-y-4">
        <SectionTitle>{t("common.categories")}</SectionTitle>
        <CategoriesCarousel />
      </section>

            {/* Top Sellers and Top Advert - temporarily disabled until we have data
            <section className="space-y-4">
              <SectionTitle>{t("home.top_sellers_and_adverts") || "Топ продавцов и объявлений"}</SectionTitle>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopSellersCarousel />
                <TopAdvertCard />
              </div>
            </section>
            */}

      <section className="space-y-4">
        <SectionTitle>{t("home.free_ads")}</SectionTitle>
        <AdsGrid items={freeAds} />
      </section>

        <section className="space-y-4">
          <SectionTitle>{t("home.latest")}</SectionTitle>
          <AdsGrid items={latestAds} />
        </section>
      </div>
    </>
  );
}