"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Category } from "@/lib/types";
import CategoryList from "@/components/category-list";
import AdsGrid from "@/components/ads-grid";

type MediaRow = {
  advert_id: string;
  url: string;
  sort: number | null;
};

type Breadcrumb = {
  path: string;
  name: string;
};

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CategoryPage() {
  const params = useParams<{ path: string[] }>();
  const slugPath = useMemo(
    () => (Array.isArray(params.path) ? params.path.join("/") : ""),
    [params.path],
  );

  const [current, setCurrent] = useState<Category | null>(null);
  const [children, setChildren] = useState<Category[]>([]);
  const [ads, setAds] = useState<
    Array<{
      id: string;
      title: string;
      price?: number | null;
      location?: string | null;
      image?: string | null;
      createdAt?: string | null;
    }>
  >([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugPath) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: cur, error: currentError } = await supabase
        .from("categories")
        .select("*")
        .eq("path", slugPath)
        .maybeSingle();

      if (currentError || !cur) {
        if (!cancelled) {
          setError("Категория не найдена.");
          setCurrent(null);
          setChildren([]);
          setAds([]);
          setBreadcrumbs([]);
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      const typedCurrent = cur as Category;
      setCurrent(typedCurrent);

      const crumbPaths = slugPath
        .split("/")
        .filter(Boolean)
        .map((_, idx, arr) => arr.slice(0, idx + 1).join("/"));

      if (crumbPaths.length) {
        const { data: crumbData } = await supabase
          .from("categories")
          .select("path,name_ru")
          .in("path", crumbPaths);

        if (!cancelled) {
          const nameByPath = new Map<string, string>();
          crumbData?.forEach((item) => {
            nameByPath.set(item.path, item.name_ru);
          });
          setBreadcrumbs(
            crumbPaths.map((path) => ({
              path,
              name: nameByPath.get(path) ?? humanizeSlug(path.split("/").pop() ?? path),
            })),
          );
        }
      } else {
        setBreadcrumbs([]);
      }

      const { data: kidData } = await supabase
        .from("categories")
        .select("*")
        .eq("parent_id", typedCurrent.id)
        .eq("is_active", true)
        .order("sort", { ascending: true });

      if (cancelled) return;

      setChildren((kidData ?? []) as Category[]);

      const { data: adverts } = await supabase
        .from("adverts")
        .select("id,title,price,location,created_at")
        .eq("category_id", typedCurrent.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(24);

      if (cancelled) return;

      if (!adverts?.length) {
        setAds([]);
        setLoading(false);
        return;
      }

      const ids = adverts.map((a) => a.id);
      const { data: media } = await supabase
        .from("media")
        .select("advert_id,url,sort")
        .in("advert_id", ids)
        .order("sort", { ascending: true });

      if (cancelled) return;

      const firstByAd = new Map<string, string>();
      (media as MediaRow[] | null)?.forEach((m) => {
        if (!firstByAd.has(m.advert_id)) {
          firstByAd.set(m.advert_id, m.url);
        }
      });

      setAds(
        adverts.map((a) => ({
          id: a.id,
          title: a.title,
          price: a.price,
          location: a.location,
          createdAt: (a as { created_at?: string | null }).created_at ?? null,
          image: firstByAd.get(a.id) ?? null,
        })),
      );

      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [slugPath]);

  if (!slugPath) {
    return <div>Категория не найдена.</div>;
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

      {loading ? (
        <p>Загрузка…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !current ? (
        <p className="text-sm text-red-600">Категория не найдена.</p>
      ) : (
        <>
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold text-zinc-900">{current.name_ru}</h1>
            <p className="text-sm text-muted-foreground">
              Список объявлений в этой категории обновляется в режиме реального времени.
            </p>
          </header>

          {children.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-medium text-zinc-900">Подкатегории</h2>
              <CategoryList items={children} base="/c" />
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">Подкатегории отсутствуют.</p>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-zinc-900">Объявления</h2>
            <AdsGrid items={ads} />
          </section>
        </>
      )}
    </div>
  );
}
