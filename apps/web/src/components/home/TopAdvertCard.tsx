"use client";

import { useEffect, useState } from "react";
import AdCard from "@/components/ad-card";

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
 * through the standard AdCard with a synthetic "boost" benefit badge.
 * All data-fetch and route (/api/top-adverts) logic is preserved unchanged.
 */
export default function TopAdvertCard() {
  const [advert, setAdvert] = useState<TopAdvert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/top-adverts?limit=1");
        const body = await res.json();
        if (body.ok && body.data?.adverts?.[0]) {
          setAdvert(body.data.adverts[0]);
        }
      } catch {
        // silent — card just won't render
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    // Skeleton matching AdCard dimensions
    return (
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
    );
  }

  if (!advert) return null;

  // Synthesise a "boost" benefit so BenefitsBadge renders the amber Boost pill
  const boostBenefit = [
    {
      benefit_type: "boost",
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return (
    <AdCard
      id={advert.id}
      title={advert.title}
      price={advert.price}
      currency={advert.currency}
      location={advert.location}
      image={advert.image}
      likeCount={advert.like_count}
      benefits={boostBenefit}
    />
  );
}
