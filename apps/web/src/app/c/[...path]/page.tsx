export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabaseService";
import type { Category } from "@/lib/types";
import CategoryList from "@/components/category-list";
import AdsGrid from "@/components/ads-grid";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildCategoryBreadcrumbs, getLocalizedCategoryName } from "@/lib/breadcrumbs";
import { getI18nProps } from "@/i18n/server";

type AdvertItem = {
  id: string;
  title: string;
  price?: number | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
};

type Props = {
  params: { path: string[] };
};

export default async function CategoryPage({ params }: Props) {
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

  const adverts: AdvertItem[] = [];
  const { data: advertsRaw } = await supabase
    .from("adverts")
    .select("id,title,price,location,created_at")
    .eq("category_id", typedCurrent.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(24);

  if (advertsRaw?.length) {
    const ids = advertsRaw.map((a) => a.id);
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
        location: row.location,
        createdAt: (row as { created_at?: string | null }).created_at ?? null,
        image: firstMedia.get(row.id) ?? null,
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

      {children.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-зinc-900">Подкатегории</h2>
          <CategoryList items={children} base="/c" />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Подкатегории отсутствуют.</p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-зinc-900">Объявления</h2>
        <AdsGrid items={adverts} />
      </section>
    </div>
  );
}
