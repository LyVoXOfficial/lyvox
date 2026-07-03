export const runtime = "nodejs";
export const revalidate = 60;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseService } from "@/lib/supabaseService";
import type { Category } from "@/lib/types";
import CategoryList from "@/components/category-list";
import AdsGrid from "@/components/ads-grid";
import Breadcrumbs from "@/components/Breadcrumbs";
import CategoryFilters from "@/components/category/CategoryFilters";
import { buildCategoryBreadcrumbs, getLocalizedCategoryName } from "@/lib/breadcrumbs";
import { getI18nProps, getInitialLocale } from "@/i18n/server";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { getFirstImage } from "@/lib/media/getFirstImage";
import { getJsonLdScriptProps } from "@/lib/seo";
import { getBaseUrl } from "@/lib/seo/baseUrl";

const BASE_URL = getBaseUrl();

// F12: per-category SEO metadata (was absent — /c/* had no canonical/title/desc).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const slugPath = Array.isArray(path) ? path.join("/") : "";
  if (!slugPath) return {};

  const supabase = await supabaseService();
  const { data: current } = await supabase
    .from("categories")
    .select("name_ru,name_en,name_nl,name_fr,name_de,slug,path")
    .eq("path", slugPath)
    .eq("is_active", true)
    .maybeSingle();

  if (!current) return {};

  const [locale, { messages }] = await Promise.all([getInitialLocale(), getI18nProps()]);
  const name = getLocalizedCategoryName(current as Category, locale);

  const descTemplate =
    (messages as Record<string, Record<string, string>>)?.category?.seoDescription ??
    "Browse {category} listings on LyVoX.";
  const description = descTemplate.replace("{category}", name);
  const canonical = `${BASE_URL}/c/${slugPath}`;

  return {
    title: `${name} | LyVoX`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${name} | LyVoX`,
      description,
      url: canonical,
      type: "website",
      siteName: "LyVoX",
    },
  };
}

type AdvertItem = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
};

const PAGE_SIZE = 24;

type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export default async function CategoryPage({ params, searchParams }: Props) {
  const { path } = await params;
  const { sort: sortParam, page: pageParam } = await searchParams;
  const currentPage = Math.max(0, Number(pageParam || "0") || 0);
  const pageOffset = currentPage * PAGE_SIZE;
  const slugPath = Array.isArray(path) ? path.join("/") : "";
  if (!slugPath) {
    notFound();
  }

  const supabase = await supabaseService();

  const { data: current, error } = await supabase
    .from("categories")
    .select("*")
    .eq("path", slugPath)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !current) {
    notFound();
  }

  const typedCurrent = current as Category;
  const { locale, messages } = await getI18nProps();
  const t = (key: string, fallback: string): string => {
    const value = key.split(".").reduce<any>((acc, part) => (acc ? acc[part] : undefined), messages);
    return typeof value === "string" ? value : fallback;
  };

  // Get all categories needed for breadcrumbs
  const crumbPaths = slugPath
    .split("/")
    .filter(Boolean)
    .map((_, idx, arr) => arr.slice(0, idx + 1).join("/"));

  let allCategories: Category[] = [];
  if (crumbPaths.length) {
    const { data: crumbData } = await supabase
      .from("categories")
      .select("id, parent_id, slug, level, name_ru, name_en, name_nl, name_fr, path, sort, icon, is_active")
      .in("path", crumbPaths)
      .eq("is_active", true);

    allCategories = (crumbData as Category[]) || [];
  }

  // Build breadcrumbs with localization
  const breadcrumbItems = buildCategoryBreadcrumbs(slugPath, allCategories, locale, "/c");

  const { data: childData } = await supabase
    .from("categories")
    .select("*")
    .eq("parent_id", typedCurrent.id)
    .eq("is_active", true)
    .order("sort", { ascending: true });

  const children = (childData as Category[] | null) ?? [];

  // Handle sorting
  const sort = sortParam || "date-desc";
  let orderBy: { column: string; ascending: boolean };
  
  switch (sort) {
    case "date-asc":
      orderBy = { column: "created_at", ascending: true };
      break;
    case "price-asc":
      orderBy = { column: "price", ascending: true };
      break;
    case "price-desc":
      orderBy = { column: "price", ascending: false };
      break;
    case "date-desc":
    default:
      orderBy = { column: "created_at", ascending: false };
  }

  const adverts: AdvertItem[] = [];
  const [{ data: advertsRaw }, { count: totalAdverts }] = await Promise.all([
    supabase
      .from("adverts")
      .select("id,title,price,currency,location,created_at,user_id")
      .eq("category_id", typedCurrent.id)
      .eq("status", "active")
      .order(orderBy.column, { ascending: orderBy.ascending })
      .order("id", { ascending: false })
      .range(pageOffset, pageOffset + PAGE_SIZE - 1),
    supabase
      .from("adverts")
      .select("id", { count: "exact", head: true })
      .eq("category_id", typedCurrent.id)
      .eq("status", "active"),
  ]);

  if (advertsRaw?.length) {
    const ids = advertsRaw.map((a) => a.id);
    const userIds = advertsRaw
      .map((a) => a.user_id)
      .filter((value): value is string => typeof value === "string");

    let verifiedMap = new Map<string, boolean>();
    if (userIds.length) {
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
    const { data: mediaRows, error: mediaError } = await supabase
      .from("media")
      .select("advert_id,url,sort")
      .in("advert_id", ids)
      .order("sort", { ascending: true });

    const firstMedia = new Map<string, string>();

    if (mediaError) {
      console.warn("Failed to fetch category media", mediaError);
    } else if (mediaRows?.length) {
      const signedMedia = await signMediaUrls(mediaRows);
      const grouped = signedMedia.reduce(
        (acc, media) => {
          if (!acc.has(media.advert_id)) {
            acc.set(media.advert_id, []);
          }

          acc.get(media.advert_id)!.push({
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
          firstMedia.set(advertId, first);
        }
      }
    }

    advertsRaw.forEach((row) => {
      adverts.push({
        id: row.id,
        title: row.title,
        price: row.price,
        currency: row.currency ?? null,
        location: row.location,
        createdAt: (row as { created_at?: string | null }).created_at ?? null,
        image: firstMedia.get(row.id) ?? null,
        sellerVerified: verifiedMap.get(row.user_id ?? "") ?? false,
      });
    });
  }

  const currentName = getLocalizedCategoryName(typedCurrent, locale);

  // F12: BreadcrumbList JSON-LD (Home → … → current category).
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t("category.allCategories", "All categories"),
        item: `${BASE_URL}/c`,
      },
      ...breadcrumbItems.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: crumb.label,
        item: `${BASE_URL}${crumb.href}`,
      })),
    ],
  };

  // F12: ItemList JSON-LD of the listings on this page (helps category indexation).
  const itemListJsonLd = adverts.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: currentName,
        numberOfItems: adverts.length,
        itemListElement: adverts.map((advert, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${BASE_URL}/ad/${advert.id}`,
          name: advert.title,
        })),
      }
    : null;

  return (
    <div className="space-y-6">
      <script {...getJsonLdScriptProps(breadcrumbJsonLd)} />
      {itemListJsonLd ? <script {...getJsonLdScriptProps(itemListJsonLd)} /> : null}
      <Breadcrumbs
        items={breadcrumbItems}
        homeLabel={t("category.allCategories", "All categories")}
        homeHref="/c"
      />

      <header className="space-y-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{currentName}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "category.listingsSubtitle",
            "Active listings in this category are refreshed as sellers publish new offers.",
          )}
        </p>
      </header>

      {children.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">
            {t("category.subcategories", "Subcategories")}
          </h2>
          <CategoryList items={children} base="/c" />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">
            {t("category.listings", "Listings")}
          </h2>
          <Link
            href={`/search?category_id=${typedCurrent.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("category.searchWithFilters", "Search with filters")} →
          </Link>
        </div>
        <CategoryFilters />
        {adverts.length > 0 ? (
          <AdsGrid items={adverts} />
        ) : (
          <div className="rounded-2xl border border-border/70 bg-card p-8 text-center shadow-[var(--shadow-soft)]">
            <p className="text-sm text-muted-foreground">
              {t(
                "category.noListings",
                "There are no active listings in this category yet. Be the first to post one.",
              )}
            </p>
          </div>
        )}

        {/* Pagination */}
        {(totalAdverts ?? 0) > PAGE_SIZE && (
          <nav
            className="flex items-center justify-center gap-3 pt-4"
            aria-label={t("category.page", `Page ${currentPage + 1} of ${Math.ceil((totalAdverts ?? 0) / PAGE_SIZE)}`)}
          >
            {currentPage > 0 && (
              <Link
                href={`/c/${slugPath}?${new URLSearchParams({ sort: sortParam || "date-desc", page: String(currentPage - 1) })}`}
                className="rounded-lg border border-border/70 bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                ← {t("category.prevPage", "Previous page")}
              </Link>
            )}
            <span className="text-sm text-muted-foreground">
              {currentPage + 1} / {Math.ceil((totalAdverts ?? 0) / PAGE_SIZE)}
            </span>
            {(currentPage + 1) * PAGE_SIZE < (totalAdverts ?? 0) && (
              <Link
                href={`/c/${slugPath}?${new URLSearchParams({ sort: sortParam || "date-desc", page: String(currentPage + 1) })}`}
                className="rounded-lg border border-border/70 bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                {t("category.nextPage", "Next page")} →
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
