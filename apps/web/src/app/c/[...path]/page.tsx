export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabaseService";
import type { Category } from "@/lib/types";
import CategoryList from "@/components/category-list";
import AdsGrid from "@/components/ads-grid";

type Breadcrumb = {
  path: string;
  name: string;
};

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

  const crumbPaths = slugPath
    .split("/")
    .filter(Boolean)
    .map((_, idx, arr) => arr.slice(0, idx + 1).join("/"));

  const breadcrumbs: Breadcrumb[] = [];
  if (crumbPaths.length) {
    const { data: crumbData } = await supabase
      .from("categories")
      .select("path,name_ru")
      .in("path", crumbPaths)
      .eq("is_active", true);

    const nameByPath = new Map<string, string>();
    crumbData?.forEach((item) => nameByPath.set(item.path, item.name_ru));
    crumbPaths.forEach((path) => {
      const slug = path.split("/").pop() ?? path;
      const name = nameByPath.get(path) ?? slug.replace(/-/g, " ");
      breadcrumbs.push({ path, name });
    });
  }

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
    media?.forEach((row: { advert_id: string; url: string }) => {
      if (!firstMedia.has(row.advert_id)) {
        firstMedia.set(row.advert_id, row.url);
      }
    });

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

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link className="hover:underline" href="/c">
          Все категории
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.path}>
            {" / "}
            <Link className="hover:underline" href={`/c/${crumb.path}`}>
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-зinc-900">{typedCurrent.name_ru}</h1>
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
