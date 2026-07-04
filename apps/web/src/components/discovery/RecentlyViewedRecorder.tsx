"use client";

import { useEffect } from "react";
import { addRecentlyViewed, type RecentAdvert } from "@/lib/recentlyViewed";
import { recordAdOpen, toPriceBand } from "@/lib/discovery/sessionIntent";

export default function RecentlyViewedRecorder({ advert }: { advert: RecentAdvert }) {
  useEffect(() => {
    if (!advert?.id) return;
    addRecentlyViewed(advert);
    recordAdOpen(advert.categoryId, toPriceBand(advert.price));
  }, [advert]);
  return null;
}
