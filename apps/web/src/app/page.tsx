"use client";

import { useEffect, useState } from "react";
import InfoCarousel from "@/components/info-carousel";
import CategoriesCarousel from "@/components/categories-carousel";
import SectionTitle from "@/components/section-title";
import { supabase } from "@/lib/supabaseClient";
import AdsGrid from "@/components/ads-grid";

type AdListItem = {
  id: string;
  title: string;
  price?: number | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
};

type MediaRow = {
  advert_id: string;
  url: string;
  sort: number | null;
};

export default function Home() {
  const [freeAds, setFreeAds] = useState<AdListItem[]>([]);
  const [latest, setLatest] = useState<AdListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const { data: free } = await supabase
        .from("adverts")
        .select("id,title,price,location,created_at")
        .eq("status", "active")
        .or("price.eq.0,price.is.null")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: ads } = await supabase
        .from("adverts")
        .select("id,title,price,location,created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(24);

      const union = [...(free ?? []), ...(ads ?? [])];
      const uniqueIds = Array.from(new Set(union.map((item) => item.id)));

      const firstImageByAdvert = new Map<string, string>();

      if (uniqueIds.length) {
        const { data: media } = await supabase
          .from("media")
          .select("advert_id,url,sort")
          .in("advert_id", uniqueIds)
          .order("sort", { ascending: true });

        (media as MediaRow[] | null)?.forEach((row) => {
          if (!firstImageByAdvert.has(row.advert_id)) {
            firstImageByAdvert.set(row.advert_id, row.url);
          }
        });
      }

      if (!cancelled) {
        setFreeAds(
          (free ?? []).map((ad) => ({
            id: ad.id,
            title: ad.title,
            price: ad.price,
            location: ad.location,
            createdAt: ad.created_at ?? null,
            image: firstImageByAdvert.get(ad.id) ?? null,
          })),
        );

        setLatest(
          (ads ?? []).map((ad) => ({
            id: ad.id,
            title: ad.title,
            price: ad.price,
            location: ad.location,
            createdAt: ad.created_at ?? null,
            image: firstImageByAdvert.get(ad.id) ?? null,
          })),
        );

        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <InfoCarousel />

      <div>
        <SectionTitle>Категории</SectionTitle>
        <CategoriesCarousel />
      </div>

      <div>
        <SectionTitle>Бесплатные объявления</SectionTitle>
        {loading ? <p>Загрузка…</p> : <AdsGrid items={freeAds} />}
      </div>

      <div>
        <SectionTitle>Новые объявления</SectionTitle>
        {loading ? <p>Загрузка…</p> : <AdsGrid items={latest} />}
      </div>
    </div>
  );
}
