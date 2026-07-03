import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/baseUrl";
import { supabaseService } from "@/lib/supabaseService";

export const revalidate = 3600; // rebuild at most once per hour

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1.0 },
  { url: absoluteUrl("/sell"), changeFrequency: "monthly", priority: 0.8 },
  { url: absoluteUrl("/legal/privacy"), changeFrequency: "yearly", priority: 0.2 },
  { url: absoluteUrl("/legal/terms"), changeFrequency: "yearly", priority: 0.2 },
  { url: absoluteUrl("/legal/cookies"), changeFrequency: "yearly", priority: 0.2 },
  { url: absoluteUrl("/legal/imprint"), changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = await supabaseService();
    // All category levels, but only branches that actually carry inventory —
    // listing every empty leaf would ship thin/soft-404 pages to Google
    // (level-1 hubs stay regardless: they are the permanent IA skeleton).
    const [{ data: categories }, { data: stocked }] = await Promise.all([
      supabase.from("categories").select("id, path, level").eq("is_active", true),
      supabase.from("adverts").select("category_id").eq("status", "active").limit(5000),
    ]);

    const stockedIds = new Set((stocked ?? []).map((a) => a.category_id).filter(Boolean));
    const pathById = new Map((categories ?? []).map((c) => [c.id, c.path as string | null]));
    const stockedPaths = [...stockedIds]
      .map((id) => pathById.get(id))
      .filter((p): p is string => Boolean(p));

    const hasInventory = (path: string) =>
      stockedPaths.some((p) => p === path || p.startsWith(`${path}/`));

    for (const category of categories ?? []) {
      if (!category.path) continue;
      if (category.level !== 1 && !hasInventory(category.path)) continue;
      categoryRoutes.push({
        url: absoluteUrl(`/c/${category.path}`),
        changeFrequency: "weekly",
        priority: category.level === 1 ? 0.6 : 0.5,
      });
    }
  } catch {
    // Categories are optional — fall back to static routes only on error.
  }

  const advertRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = await supabaseService();
    const { data: adverts } = await supabase
      .from("adverts")
      .select("id, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(5000);

    for (const advert of adverts ?? []) {
      advertRoutes.push({
        url: absoluteUrl(`/ad/${advert.id}`),
        lastModified: advert.updated_at ?? undefined,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch {
    // Adverts are optional — fall back to static routes only on error.
  }

  return [...STATIC_ROUTES, ...categoryRoutes, ...advertRoutes];
}
