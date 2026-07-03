import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import SectionTitle from "@/components/section-title";
import AdsGrid from "@/components/ads-grid";
import DiscoveryFeed from "@/components/discovery/DiscoveryFeed";
import RecentlyViewed from "@/components/discovery/RecentlyViewed";
import SearchBar from "@/components/SearchBar";
import TopSellersCarousel from "@/components/home/TopSellersCarousel";
import TopAdvertCard from "@/components/home/TopAdvertCard";
import { ArrowRight, Car, Home as HomeIcon, Laptop, ShieldCheck } from "lucide-react";

// PERF-003: Lazy load carousels below the fold
const InfoCarousel = dynamic(() => import("@/components/info-carousel"), {
  ssr: true, // Keep SSR for SEO
});

const CategoriesCarousel = dynamic(() => import("@/components/categories-carousel"), {
  ssr: true, // Keep SSR for SEO
});

import { getI18nProps } from "@/i18n/server";
import { logger } from "@/lib/errorLogger";
import { getJsonLdScriptProps } from "@/lib/seo";
import { getBaseUrl, absoluteUrl } from "@/lib/seo/baseUrl";
import { supabaseServer } from "@/lib/supabaseServer";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { getFirstImage } from "@/lib/media/getFirstImage";
import { resolveLikeCounts } from "@/lib/likeCounts";
import type { AdvertCard } from "@/lib/advertCards";

export const revalidate = 60;

const BASE_URL = getBaseUrl();

// SEO P0 (audit §1.2): home gets its own composed title + canonical instead
// of inheriting the bare root `LyVoX` title. Composed from existing i18n
// `app.title` (no new locale keys) — English-only suffix per brief.
export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18nProps();
  const siteName = messages?.app?.title ?? "LyVoX";
  return {
    title: `${siteName} — Buy & sell locally in Belgium`,
    alternates: { canonical: absoluteUrl("/") },
  };
}

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

async function getFreeAds(supabase: SupabaseClient): Promise<AdListItem[]> {
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

  const profilesPromise =
    userIds.length > 0
      ? supabase.from("profiles").select("id,verified_email,verified_phone").in("id", userIds)
      : Promise.resolve({ data: null });

  const mediaPromise =
    freeIds.length > 0
      ? resolveFirstImages(
          supabase,
          freeIds,
          {
            component: "HomePage",
            action: "getFreeAds:media",
          },
        )
      : Promise.resolve(new Map<string, string>());

  const [{ data: profilesData }, mediaMap, likeMap] = await Promise.all([
    profilesPromise,
    mediaPromise,
    resolveLikeCounts(freeIds),
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

  return (free ?? []).map((ad) => ({
    id: ad.id,
    title: ad.title,
    price: ad.price,
    currency: ad.currency ?? null,
    location: ad.location,
    createdAt: ad.created_at ?? null,
    image: mediaMap.get(ad.id) ?? null,
    sellerVerified: verifiedMap.get(ad.user_id ?? "") ?? false,
    likeCount: likeMap.get(ad.id) ?? 0,
  }));
}

async function getLatestAds(supabase: SupabaseClient): Promise<AdvertCard[]> {
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

  const profilesPromise =
    userIds.length > 0
      ? supabase.from("profiles").select("id,verified_email,verified_phone").in("id", userIds)
      : Promise.resolve({ data: null });

  const mediaPromise =
    adIds.length > 0
      ? resolveFirstImages(
          supabase,
          adIds,
          {
            component: "HomePage",
            action: "getLatestAds:media",
          },
        )
      : Promise.resolve(new Map<string, string>());

  const [{ data: profilesData }, mediaMap, likeMap] = await Promise.all([
    profilesPromise,
    mediaPromise,
    resolveLikeCounts(adIds),
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

  return (ads ?? []).map((ad) => ({
    id: ad.id,
    title: ad.title,
    price: ad.price ?? null,
    currency: ad.currency ?? null,
    location: ad.location ?? null,
    createdAt: ad.created_at ?? null,
    image: mediaMap.get(ad.id) ?? null,
    sellerVerified: verifiedMap.get(ad.user_id ?? "") ?? false,
    likeCount: likeMap.get(ad.id) ?? 0,
  }));
}

export default async function Home() {
  const { locale, messages } = await getI18nProps();
  const supabase = await supabaseServer();

  // Fetch data in parallel — unchanged from original
  const [freeAds, latestAds] = await Promise.all([
    getFreeAds(supabase),
    getLatestAds(supabase),
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

  // Stats computed from real data — keep all existing computations
  const verifiedCount = latestAds.filter((ad) => ad.sellerVerified).length;

  // Quick action pills — keep existing hrefs/labels/icons exactly
  const quickActions = [
    {
      href: "/c/transport",
      label: t("home.qa_transport"),
      icon: Car,
    },
    {
      href: "/c/electronics",
      label: t("home.qa_electronics"),
      icon: Laptop,
    },
    {
      href: "/search?verified_only=true",
      label: t("home.qa_verified"),
      icon: ShieldCheck,
      highlighted: true, // "Verified sellers" pill uses the --gT gradient
    },
    {
      href: "/c/home-garden",
      label: t("home.category_home"),
      icon: HomeIcon,
    },
  ];

  return (
    <>
      <script {...getJsonLdScriptProps(organizationJsonLd)} />
      <div className="space-y-8 md:space-y-10">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Radial-gradient blobs background (exact from mockup line 108) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              inset: "-30% -10% auto -10%",
              height: "130%",
              background:
                "radial-gradient(40% 55% at 16% 18%, oklch(0.88 0.11 168 / 0.55), transparent 70%), radial-gradient(36% 48% at 84% 10%, oklch(0.78 0.13 200 / 0.36), transparent 70%), radial-gradient(46% 56% at 60% 92%, oklch(0.72 0.12 196 / 0.28), transparent 70%)",
              filter: "blur(6px)",
              zIndex: 0,
            }}
          />

          {/* Hero content grid — 1.55fr / .92fr on desktop, stacked on mobile */}
          <div
            className="relative grid gap-7 py-12 md:grid-cols-[1.55fr_.92fr] md:items-stretch md:gap-7 md:py-12"
            style={{ zIndex: 1 }}
          >
            {/* ── Left column ── */}
            <div className="flex flex-col gap-0">
              {/* Eyebrow */}
              <p
                className="font-bold uppercase tracking-[0.08em]"
                style={{ fontSize: "12px", color: "var(--primary)" }}
              >
                {t("home.hero_eyebrow")}
              </p>

              {/* Headline — prefix (plain) + trust phrase (gradient text-clip) */}
              <h1
                className="mt-3 font-extrabold leading-[1.05] tracking-tight text-foreground"
                style={{ fontSize: "clamp(2rem, 5vw, 46px)", letterSpacing: "-0.03em", maxWidth: "14ch" }}
              >
                {t("home.hero_headline_prefix")}{" "}
                <span
                  className="lyvox-trust-gradient"
                  style={{
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    display: "inline",
                    boxShadow: "none",
                  }}
                >
                  {t("home.hero_trust_phrase")}
                </span>
              </h1>

              {/* Subtitle */}
              <p
                className="mt-3.5 text-muted-foreground"
                style={{ fontSize: "16px", lineHeight: "1.55", maxWidth: "44ch" }}
              >
                {t("home.hero_subtitle")}
              </p>

              {/* Search pill — large hero variant (h-14, Search button inside pill) */}
              <div className="mt-[22px] max-w-[540px]">
                <SearchBar variant="hero" />
              </div>

              {/* Category pills */}
              <div className="mt-[18px] flex flex-wrap gap-[9px]">
                {quickActions.map(({ href, label, icon: Icon, highlighted }) =>
                  highlighted ? (
                    /* "Verified sellers" — teal gradient pill */
                    <Link
                      key={href}
                      href={href}
                      className="lyvox-trust-gradient inline-flex h-[38px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full px-[15px] font-bold text-white transition hover:brightness-105"
                      style={{
                        fontSize: "13.5px",
                        boxShadow: "0 2px 8px oklch(0.55 0.12 172 / 0.3)",
                      }}
                    >
                      <Icon className="h-[15px] w-[15px] shrink-0" aria-hidden="true" />
                      {label}
                    </Link>
                  ) : (
                    /* Plain category pills */
                    <Link
                      key={href}
                      href={href}
                      className="inline-flex h-[38px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border border-border bg-card px-[15px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                      style={{ fontSize: "13.5px", boxShadow: "var(--shS)" }}
                    >
                      <Icon className="h-[15px] w-[15px] shrink-0 text-primary" aria-hidden="true" />
                      {label}
                    </Link>
                  ),
                )}
              </div>
            </div>

            {/* ── Right column — stats card (hidden on mobile) ── */}
            <div
              className="hidden flex-col gap-[15px] rounded-[var(--r)] border border-border bg-card p-[22px] md:flex"
              style={{ boxShadow: "var(--shC)" }}
            >
              {/* Active listings */}
              <div className="flex items-center gap-[14px]">
                <span
                  className="grid shrink-0 place-items-center"
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "13px",
                    background: "oklch(0.90 0.10 168 / 0.6)",
                    color: "var(--mintI)",
                  }}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M3 7h18v13H3zM3 7l3-4h12l3 4M9 12h6" />
                  </svg>
                </span>
                <div>
                  <div className="font-extrabold leading-none tracking-tight text-foreground" style={{ fontSize: "28px", letterSpacing: "-0.02em" }}>
                    {latestAds.length.toLocaleString()}
                  </div>
                  <div className="mt-1 text-muted-foreground" style={{ fontSize: "13px" }}>
                    {t("home.stat_active_label")}
                  </div>
                </div>
              </div>

              {/* Verified sellers */}
              <div className="flex items-center gap-[14px]">
                <span
                  className="grid shrink-0 place-items-center"
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "13px",
                    background: "oklch(0.56 0.13 178 / 0.14)",
                    color: "var(--priD)",
                  }}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </span>
                <div>
                  <div className="font-extrabold leading-none tracking-tight text-foreground" style={{ fontSize: "28px", letterSpacing: "-0.02em" }}>
                    {verifiedCount.toLocaleString()}
                  </div>
                  <div className="mt-1 text-muted-foreground" style={{ fontSize: "13px" }}>
                    {t("home.stat_verified_label")}
                  </div>
                </div>
              </div>

              {/* Free listings */}
              <div className="flex items-center gap-[14px]">
                <span
                  className="grid shrink-0 place-items-center"
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "13px",
                    background: "oklch(0.86 0.13 72 / 0.45)",
                    color: "var(--amberI)",
                  }}
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                </span>
                <div>
                  <div className="font-extrabold leading-none tracking-tight text-foreground" style={{ fontSize: "28px", letterSpacing: "-0.02em" }}>
                    {freeAds.length.toLocaleString()}
                  </div>
                  <div className="mt-1 text-muted-foreground" style={{ fontSize: "13px" }}>
                    {t("home.stat_free_label")}
                  </div>
                </div>
              </div>

              {/* Post a listing CTA */}
              <Link
                href="/post"
                className="lyvox-cta-gradient mt-[2px] inline-flex items-center justify-between rounded-[var(--rm)] px-[18px] font-bold text-primary-foreground transition hover:brightness-105"
                style={{ height: 50, fontSize: "14.5px" }}
              >
                {t("home.post_listing")}
                <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── DISCOVER LINK (kept from original) ──────────────────────── */}
        <Link
          href="/discover"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-card)] transition hover:border-primary/40"
        >
          <span>
            <span className="block font-semibold text-foreground">{t("discover.title")}</span>
            <span className="block text-sm text-muted-foreground">{t("discover.subtitle")}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>

        {/* ── INFO CAROUSEL (kept from original) ──────────────────────── */}
        <InfoCarousel />

        {/* ── CATEGORIES (kept from original) ─────────────────────────── */}
        <section className="space-y-4">
          <SectionTitle>{t("common.categories")}</SectionTitle>
          <CategoriesCarousel />
        </section>

        {/* ── RECOMMENDED NOW (maps to DiscoveryFeed / latestAds) ─────── */}
        <section className="space-y-4">
          {/* Section header row with "See all" link */}
          <div className="flex items-end justify-between">
            <h2
              className="font-extrabold tracking-tight text-foreground"
              style={{ fontSize: "22px", letterSpacing: "-0.02em", margin: 0 }}
            >
              {t("home.recommended_now")}
            </h2>
            <Link
              href="/search"
              className="inline-flex items-center gap-[5px] font-semibold transition hover:opacity-80"
              style={{ fontSize: "14px", color: "var(--priD)" }}
            >
              {t("home.see_all")}
              <ArrowRight className="h-[14px] w-[14px]" aria-hidden="true" />
            </Link>
          </div>

          {/* 4-column responsive grid — AdsGrid already handles 2→3→4 col breakpoints */}
          <DiscoveryFeed initialItems={latestAds} />
        </section>

        {/* ── TOP SELLERS ─────────────────────────────────────────────── */}
        <TopSellersCarousel />

        {/* ── TOP ADVERT — section title + card owned by TopAdvertCard ── */}
        <TopAdvertCard />

        {/* ── FREE ADS (kept from original) ───────────────────────────── */}
        <section className="space-y-4">
          <SectionTitle>{t("home.free_ads")}</SectionTitle>
          <AdsGrid items={freeAds} />
        </section>

        {/* ── RECENTLY VIEWED (kept from original) ────────────────────── */}
        <RecentlyViewed />

      </div>
    </>
  );
}
