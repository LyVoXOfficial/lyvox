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

export default function CategoryPage() {
  const params = useParams<{ path: string[] }>();
  const slugPath = useMemo(
    () => (Array.isArray(params.path) ? params.path.join("/") : ""),
    [params.path],
  );

  const [current, setCurrent] = useState<Category | null>(null);
  const [children, setChildren] = useState<Category[]>([]);
  const [ads, setAds] = useState<
    Array<{ id: string; title: string; price?: number | null; location?: string | null; image?: string | null; createdAt?: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugPath) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: cur, error: errCur } = await supabase
        .from("categories")
        .select("*")
        .eq("path", slugPath)
        .maybeSingle();

      if (errCur || !cur) {
        if (!cancelled) {
          setError("Категория не найдена.");
          setCurrent(null);
          setChildren([]);
          setAds([]);
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      setCurrent(cur as Category);

      const { data: kids } = await supabase
        .from("categories")
        .select("*")
        .eq("parent_id", cur.id)
        .eq("is_active", true)
        .order("sort", { ascending: true });

      if (cancelled) return;

      setChildren((kids ?? []) as Category[]);

      const { data: adverts } = await supabase
        .from("adverts")
        .select("id,title,price,location,created_at")
        .eq("category_id", cur.id)
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

  if (!slugPath) return <div>Категория не найдена</div>;

  const crumbs = slugPath.split("/");

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link className="hover:underline" href="/c">
          Категории
        </Link>
        {crumbs.map((part, idx) => {
          const sub = crumbs.slice(0, idx + 1).join("/");
          return (
            <span key={sub}>
              {" / "}
              <Link className="hover:underline" href={`/c/${sub}`}>
                {part}
              </Link>
            </span>
          );
        })}
      </nav>

      {loading ? (
        <p>Загрузка…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !current ? (
        <p className="text-sm text-red-600">Категория не найдена.</p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">{current.name_ru}</h1>

          {children.length ? (
            <>
              <h2 className="text-lg font-medium">Подкатегории</h2>
              <CategoryList items={children} base="/c" />
            </>
          ) : null}

          <h2 className="text-lg font-medium">Объявления</h2>
          <AdsGrid items={ads} />
        </>
      )}
    </div>
  );
}
