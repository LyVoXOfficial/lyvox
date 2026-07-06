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
import { ArrowRight, BadgeEuro, Car, Home as HomeIcon, Laptop, MessageCircleWarning, ShieldCheck } from "lucide-react";

// PERF-003: Lazy load carousels below the fold
const CategoriesCarousel = dynamic(() => import("@/components/categories-carousel"), {
  ssr: true, // Keep SSR for SEO
});

import { getI18nProps } from "@/i18n/server";
import { getJsonLdScriptProps } from "@/lib/seo";
import { getBaseUrl } from "@/lib/seo/baseUrl";
import {
  languageAlternates,
  localizedAbsoluteUrl,
  localizedCanonical,
} from "@/lib/seo/localizedUrls";
import { localizeHref } from "@/lib/i18n";
import { getRequestSupabase } from "@/lib/supabaseServer";
import { getHomeSections } from "@/lib/home/getHomeSections";

export const revalidate = 60;

const BASE_URL = getBaseUrl();

// SEO P0 (audit §1.2): home gets its own composed title + canonical instead
// of inheriting the bare root `LyVoX` title. Composed from existing i18n
// `app.title` (no new locale keys) — English-only suffix per brief.
export async function generateMetadata(): Promise<Metadata> {
  const { locale, messages } = await getI18nProps();
  const siteName = messages?.app?.title ?? "LyVoX";
  return {
    title: `${siteName} — Buy & sell locally in Belgium`,
    alternates: {
      canonical: localizedCanonical("/", locale),
      languages: languageAlternates("/"),
    },
  };
}

export default async function Home() {
  const { locale, messages } = await getI18nProps();
  const supabase = await getRequestSupabase();

  const { freeAds, latestAds } = await getHomeSections(supabase);

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
    logo: `${BASE_URL}/lyvox.svg`,
  };

  // WebSite + SearchAction — enables the Google sitelinks searchbox and ties
  // the site entity to the internal /search?q= endpoint (SEO audit §5.2).
  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: messages?.app?.title ?? "LyVoX",
    url: localizedAbsoluteUrl("/", locale),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${localizedAbsoluteUrl("/search", locale)}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  const href = (path: string) => localizeHref(path, locale);

  // Product-first showcase: 6 freshest listings, photo-carrying first.
  // The feed below excludes them (its page-1 fetch starts past the SSR batch,
  // so no duplicates re-enter via pagination either).
  const withImage = latestAds.filter((ad) => ad.image);
  const showcaseAds = [...withImage, ...latestAds.filter((ad) => !ad.image)].slice(0, 6);
  const showcaseIds = new Set(showcaseAds.map((ad) => ad.id));
  const feedInitial = latestAds.filter((ad) => !showcaseIds.has(ad.id));

  // Quick action pills — keep existing hrefs/labels/icons exactly
  const quickActions = [
    {
      href: "/c/transport",
      label: t("home.qa_transport"),
      icon: Car,
    },
    {
      // Real transliterated category paths — /c/electronics and /c/home-garden
      // were dead mockup slugs (live 404s from the hero chips).
      href: "/c/elektronika-i-tehnika",
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
      href: "/c/dlya-doma-hobbi-i-detey",
      label: t("home.category_home"),
      icon: HomeIcon,
    },
  ];

  return (
    <>
      <script {...getJsonLdScriptProps(organizationJsonLd)} />
      <script {...getJsonLdScriptProps(webSiteJsonLd)} />
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

          {/* Compact single-column hero — the stats card is gone (council verdict:
              low real numbers displayed prominently read as "dead marketplace";
              inflating them would be a misleading practice — so neither). */}
          <div
            className="relative py-9 md:py-11"
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

              {/* Category pills + post CTA (the CTA moved here from the removed
                  stats card — and is now visible on mobile too) */}
              <div className="mt-[18px] flex flex-wrap items-center gap-[9px]">
                {quickActions.map(({ href, label, icon: Icon, highlighted }) =>
                  highlighted ? (
                    /* "Verified sellers" — teal gradient pill */
                    <Link
                      key={href}
                      href={localizeHref(href, locale)}
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
                      href={localizeHref(href, locale)}
                      className="inline-flex h-[38px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full border border-border bg-card px-[15px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                      style={{ fontSize: "13.5px", boxShadow: "var(--shS)" }}
                    >
                      <Icon className="h-[15px] w-[15px] shrink-0 text-primary" aria-hidden="true" />
                      {label}
                    </Link>
                  ),
                )}
                <Link
                  href={href("/post")}
                  className="lyvox-cta-gradient inline-flex h-[38px] shrink-0 items-center gap-[7px] whitespace-nowrap rounded-full px-[16px] font-bold text-primary-foreground transition hover:brightness-105"
                  style={{ fontSize: "13.5px" }}
                >
                  {t("home.post_listing")}
                  <ArrowRight className="h-[15px] w-[15px] shrink-0" aria-hidden="true" />
                </Link>
              </div>
            </div>

          </div>
        </section>

        {/* ── FRESH LISTINGS — product-first proof grid (SSR, council verdict:
               a marketplace sells with goods, not with a pitch) ── */}
        <section className="space-y-3">
          <AdsGrid items={showcaseAds} />
          <div className="flex justify-end">
            <Link
              href={href("/search")}
              className="inline-flex items-center gap-[5px] font-semibold transition hover:opacity-80"
              style={{ fontSize: "14px", color: "var(--priD)" }}
            >
              {t("home.see_all")}
              <ArrowRight className="h-[14px] w-[14px]" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* ── HOW LYVOX PROTECTS — static mechanisms row (replaces the
               InfoCarousel: same i18n content, zero JS, crawlable links,
               no horizontal scroll) ── */}
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            {
              title: t("infocards.verified_title"),
              body: t("infocards.verified_body"),
              href: "/search?verified_only=true",
              icon: ShieldCheck,
            },
            {
              title: t("infocards.report_title"),
              body: t("infocards.report_body"),
              href: "/contact",
              icon: MessageCircleWarning,
            },
            {
              title: t("infocards.payment_title"),
              body: t("infocards.payment_body"),
              href: "/profile/billing",
              icon: BadgeEuro,
            },
          ].map(({ title, body, href, icon: Icon }) => (
            <Link
              key={href}
              href={localizeHref(href, locale)}
              className="group flex items-start gap-3.5 rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)] transition duration-200 hover:border-primary/30 hover:shadow-[var(--shadow-card)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/40 text-accent-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold tracking-tight">{title}</span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] leading-5 text-muted-foreground">{body}</span>
              </span>
            </Link>
          ))}
        </section>

        {/* ── CATEGORIES (kept from original) ─────────────────────────── */}
        <section className="space-y-4">
          <SectionTitle>{t("common.categories")}</SectionTitle>
          <CategoriesCarousel />
        </section>

        {/* ── TOP SELLERS ─────────────────────────────────────────────── */}
        <TopSellersCarousel />

        {/* ── TOP ADVERT — section title + card owned by TopAdvertCard ── */}
        <TopAdvertCard />

        {/* ── FREE ADS ────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <SectionTitle>{t("home.free_ads")}</SectionTitle>
          <AdsGrid items={freeAds} />
        </section>

        {/* ── RECENTLY VIEWED ─────────────────────────────────────────── */}
        <RecentlyViewed />

        {/* ── DISCOVER — retention loop, demoted below the shopping sections
               (council verdict: not top-of-funnel while the catalog is small) */}
        <Link
          href={href("/discover")}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-card)] transition hover:border-primary/40"
        >
          <span>
            <span className="block font-semibold text-foreground">{t("discover.title")}</span>
            <span className="block text-sm text-muted-foreground">{t("discover.subtitle")}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>

        {/* ── RECOMMENDED NOW — the growing feed goes LAST so it never
               buries the sections above; auto-load is capped inside
               DiscoveryFeed, footer stays reachable via the "more" button. */}
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
              href={href("/search")}
              className="inline-flex items-center gap-[5px] font-semibold transition hover:opacity-80"
              style={{ fontSize: "14px", color: "var(--priD)" }}
            >
              {t("home.see_all")}
              <ArrowRight className="h-[14px] w-[14px]" aria-hidden="true" />
            </Link>
          </div>

          {/* 4-column responsive grid — AdsGrid already handles 2→3→4 col breakpoints */}
          <DiscoveryFeed initialItems={feedInitial} hasMoreInitial={latestAds.length >= 24} />
        </section>

      </div>
    </>
  );
}
