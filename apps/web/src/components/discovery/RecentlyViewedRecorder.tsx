"use client";

import { useEffect } from "react";
import { addRecentlyViewed, type RecentAdvert } from "@/lib/recentlyViewed";

export default function RecentlyViewedRecorder({ advert }: { advert: RecentAdvert }) {
  useEffect(() => {
    if (!advert?.id) return;
    addRecentlyViewed(advert);
  }, [advert]);
  return null;
}
