// apps/web/src/components/discovery/RecentlyViewed.tsx
"use client";

import { useEffect, useState } from "react";
import AdCard from "@/components/ad-card";
import { getRecentlyViewed, type RecentAdvert } from "@/lib/recentlyViewed";
import { useI18n } from "@/i18n";

export default function RecentlyViewed() {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };
  const [items, setItems] = useState<RecentAdvert[] | null>(null);

  useEffect(() => {
    setItems(getRecentlyViewed());
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">
        {tr("discovery.recently_viewed", "Recently viewed")}
      </h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <div key={item.id} className="w-40 shrink-0 snap-start sm:w-48">
            <AdCard
              id={item.id}
              title={item.title}
              price={item.price}
              currency={item.currency}
              location={item.location}
              image={item.image}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
