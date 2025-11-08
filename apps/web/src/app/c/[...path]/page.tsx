export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabaseService";
import type { Category } from "@/lib/types";
import CategoryList from "@/components/category-list";
import AdsGrid from "@/components/ads-grid";
import Breadcrumbs from "@/components/Breadcrumbs";
import CategoryFilters from "@/components/category/CategoryFilters";
import { buildCategoryBreadcrumbs, getLocalizedCategoryName } from "@/lib/breadcrumbs";
import { getI18nProps } from "@/i18n/server";

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

type Props = {
  params: { path: string[] };
  searchParams: { sort?: string };
};

export default async function CategoryPage({ params, searchParams }: Props) {
  const slugPath = Array.isArray(params.path) ? params.path.join("/") : "";
  if (!slugPath) {
    notFound();
  }

  const supabase = supabaseService();

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
  const { locale } = await getI18nProps();

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
  const sort = searchParams.sort || "date-desc";
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
  const { data: advertsRaw } = await supabase
    .from("adverts")
    .select("id,title,price,currency,location,created_at,user_id")
    .eq("category_id", typedCurrent.id)
    .eq("status", "active")
    .order(orderBy.column, { ascending: orderBy.ascending })
    .limit(24);

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
    const { data: media } = await supabase
      .from("media")
      .select("advert_id,url,sort")
      .in("advert_id", ids)
      .order("sort", { ascending: true });

    const firstMedia = new Map<string, string>();
    const storage = supabaseService().storage.from("ad-media");
    const SIGNED_DOWNLOAD_TTL_SECONDS = 10 * 60;

    if (media && media.length > 0) {
      // Process media in parallel to generate signed URLs where needed
      const imagePromises = media.map(async (row: { advert_id: string; url: string }) => {
        if (!firstMedia.has(row.advert_id)) {
          const url = row.url;
          
          // If it's already an HTTP URL (legacy), use it as-is
          if (url.startsWith("http://") || url.startsWith("https://")) {
            firstMedia.set(row.advert_id, url);
            return;
          }

          // Generate signed URL for storage path
          const { data, error } = await storage.createSignedUrl(
            url,
            SIGNED_DOWNLOAD_TTL_SECONDS,
          );
          
          if (!error && data?.signedUrl) {
            firstMedia.set(row.advert_id, data.signedUrl);
          }
        }
      });

      await Promise.all(imagePromises);
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

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={breadcrumbItems}
        homeLabel="Все категории"
        homeHref="/c"
      />

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">{currentName}</h1>
        <p className="text-sm text-muted-foreground">
          Список объявлений в этой категории обновляется в режиме реального времени.
        </p>
      </header>

      {children.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900">Подкатегории</h2>
          <CategoryList items={children} base="/c" />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-900">Объявления</h2>
        <CategoryFilters />
        {adverts.length > 0 ? (
          <AdsGrid items={adverts} />
        ) : (
          <p className="text-sm text-muted-foreground">
            В данной категории пока нет активных объявлений. 
            Станьте первым, кто разместит объявление!
          </p>
        )}
      </section>
    </div>
  );
}
