// apps/web/src/components/discovery/DiscoveryFeed.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdsGrid from "@/components/ads-grid";
import { AdsGridSkeleton } from "@/components/marketplace-grid-states";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { mapSearchItemToCard, type AdvertCard, type SearchApiItem } from "@/lib/advertCards";
import { appendUnique } from "@/lib/discoveryFeed";

const PAGE_SIZE = 24;
// Auto-load stops after this many fetched pages; further pages load via the
// explicit "more" button. Keeps the sections and footer below the feed
// reachable instead of an endless scroll burying them.
const AUTO_PAGES = 2;

export default function DiscoveryFeed({
  initialItems,
  hasMoreInitial,
}: {
  initialItems: AdvertCard[];
  /** Set when the caller withholds some SSR items (e.g. a showcase section) —
      initialItems.length alone can no longer tell whether more pages exist. */
  hasMoreInitial?: boolean;
}) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };

  const [items, setItems] = useState<AdvertCard[]>(initialItems);
  const [page, setPage] = useState(1); // page 0 == initialItems (SSR)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(
    hasMoreInitial === undefined ? initialItems.length < PAGE_SIZE : !hasMoreInitial,
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/search?sort_by=created_at_desc&page=${page}&limit=${PAGE_SIZE}`,
      );
      if (!res.ok) throw new Error("fetch failed");
      const body = await res.json();
      if (!body.ok || !body.data) throw new Error("bad payload");
      const incoming = (body.data.items as SearchApiItem[]).map(mapSearchItemToCard);
      setItems((prev) => appendUnique(prev, incoming));
      setPage((p) => p + 1);
      if (!body.data.hasMore || incoming.length === 0) setDone(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, page]);

  const autoLoad = page <= AUTO_PAGES;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || done || !autoLoad) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, done, autoLoad]);

  return (
    <div className="space-y-6">
      <AdsGrid items={items} />

      {loading && <AdsGridSkeleton count={8} />}

      {error && !loading && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {tr("discovery.load_error", "Couldn't load more listings.")}
          </p>
          <Button variant="outline" size="sm" onClick={loadMore}>
            {tr("common.retry", "Retry")}
          </Button>
        </div>
      )}

      {done && !error && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {tr("discovery.end_of_feed", "You've reached the end.")}
        </p>
      )}

      {!done && !error && !loading && !autoLoad && (
        <div className="flex justify-center py-2">
          <Button variant="outline" onClick={loadMore}>
            {t("common.more")}
          </Button>
        </div>
      )}

      {!done && autoLoad && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}
    </div>
  );
}
