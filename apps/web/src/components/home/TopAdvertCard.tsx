"use client";

import { useEffect, useState } from "react";
import AdCard from "@/components/ad-card";
import { useI18n } from "@/i18n";

type TopAdvert = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  location: string | null;
  image: string | null;
  view_count: number;
  favorite_count: number;
  like_count: number;
  popularity_score: number;
};

/**
 * TopAdvertCard — fetches from /api/top-adverts and renders the #1 advert
 * through the standard AdCard. Popularity is editorial ranking, not a paid
 * benefit, so this component must never synthesize a boost/sponsored claim.
 * Owns its section header so the title never orphans when data is empty.
 * All data-fetch and route (/api/top-adverts) logic is preserved unchanged.
 */
export default function TopAdvertCard() {
  const [advert, setAdvert] = useState<TopAdvert | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();
  const tr = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/top-adverts?limit=1");
        const body = await res.json();
        if (body.ok && body.data?.adverts?.[0]) {
          setAdvert(body.data.adverts[0]);
        }
      } catch {
        // silent — section won't render
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    // Skeleton matching AdCard dimensions — no orphan title during load
    return (
      <section className="space-y-4">
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="max-w-[280px]">
          <div
            className="animate-pulse overflow-hidden rounded-[var(--r)] border border-border bg-card"
            style={{ boxShadow: "var(--shS)" }}
          >
            <div className="bg-muted" style={{ aspectRatio: "4/3" }} />
            <div className="space-y-2 p-[14px]">
              <div className="h-5 w-1/3 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Nothing to show — return null (no orphan header because title is inside)
  if (!advert) return null;

  return (
    <section className="space-y-4">
      <h2
        className="font-extrabold tracking-tight text-foreground"
        style={{ fontSize: "22px", letterSpacing: "-0.02em", margin: 0 }}
      >
        {tr("home.top_advert", "Top advert")}
      </h2>
      {/* Single card — not wrapped in a grid to avoid 1/4-width single-item awkwardness */}
      <div className="max-w-[280px]">
        <AdCard
          id={advert.id}
          title={advert.title}
          price={advert.price}
          currency={advert.currency}
          location={advert.location}
          image={advert.image}
          likeCount={advert.like_count}
        />
      </div>
    </section>
  );
}
