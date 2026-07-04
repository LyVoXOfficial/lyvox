"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import SearchFilters, { type SearchFiltersState } from "@/components/SearchFilters";
import SaveSearchButton from "@/components/saved/SaveSearchButton";
import { logger } from "@/lib/errorLogger";
import { mapSearchItemToCard } from "@/lib/advertCards";
import { buildOutsideRadiusParams, buildRelaxedParams, buildSearchRequestParams } from "@/lib/search/buildSearchParams";
import AdsGrid from "@/components/ads-grid";
import { AdsGridSkeleton } from "@/components/marketplace-grid-states";
import VerifiedFilterChip from "@/components/search/VerifiedFilterChip";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { localizeHref } from "@/lib/i18n";

const ANTI_SOCIAL_THRESHOLD = 10;
const OUTSIDE_RADIUS_THRESHOLD = 6;
const OUTSIDE_RADIUS_LIMIT = 12;

type SearchResult = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
};

type SearchResponse = {
  ok: boolean;
  data?: {
    items: Array<{
      id: string;
      category_id?: string | null;
      title: string;
      price?: number | null;
      currency?: string | null;
      location?: string | null;
      image?: string | null;       // NEW — now provided by /api/search
      created_at?: string | null;
      seller_verified?: boolean;
      user_id?: string;
    }>;
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
  error?: string;
};

/**
 * SearchPage component
 * Displays search results with filters, sorting, and pagination
 * Supports URL synchronization with search parameters
 */
export default function SearchPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchHref = useCallback(
    (queryString?: string) => localizeHref(queryString ? `/search?${queryString}` : "/search", locale),
    [locale],
  );
  const translate = useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => {
      const value = t(key, params);
      return value === key ? fallback : value;
    },
    [t],
  );

  // Extract URL parameters
  const query = searchParams.get("q") || "";
  const categoryId = searchParams.get("category_id") || null;
  const priceMin = searchParams.get("price_min");
  const priceMax = searchParams.get("price_max");
  const location = searchParams.get("location") || null;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radiusKm = searchParams.get("radius_km") || "50";
  const sortBy = searchParams.get("sort_by") || "created_at_desc";
  const condition = searchParams.get("condition");
  const page = Number.parseInt(searchParams.get("page") || "0", 10);
  const limit = 24;
  const verifiedOnlyFilter = (() => {
    const raw = searchParams.get("verified_only");
    if (!raw) return false;
    const normalized = raw.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  })();

  // State
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [outsideRadiusResults, setOutsideRadiusResults] = useState<SearchResult[]>([]);
  const [relaxedResults, setRelaxedResults] = useState<SearchResult[]>([]);
  const [relaxedTotal, setRelaxedTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load search results
  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const baseRequest = {
        query,
        categoryId,
        priceMin,
        priceMax,
        location,
        lat,
        lng,
        radiusKm,
        sortBy,
        page,
        limit,
        verifiedOnly: verifiedOnlyFilter,
        condition,
        sourceParams: searchParams,
      };
      const params = buildSearchRequestParams(baseRequest);

      const loadSearchResponse = async (requestParams: URLSearchParams) => {
        let response: Response;
        try {
          response = await fetch(`/api/search?${requestParams.toString()}`);
        } catch (fetchError) {
          const translated = translate("search.fetchFailed", "Could not load search results.");
          throw new Error(translated);
        }

        if (!response.ok) {
          const translated = translate("search.fetchFailed", "Could not load search results.");
          throw new Error(translated);
        }

        let data: SearchResponse;
        try {
          data = await response.json();
        } catch (parseError) {
          const translated = translate("search.fetchFailed", "Could not load search results.");
          throw new Error(translated);
        }

        if (!data.ok || !data.data) {
          const errorKey = data.error === "FETCH_FAILED" ? "search.fetchFailed" : "search.error";
          const translated = translate(errorKey, "Could not load search results.");
          throw new Error(translated);
        }

        return data.data;
      };

      const data = await loadSearchResponse(params);
      const formattedResults: SearchResult[] = data.items.map(mapSearchItemToCard);
      let outsideResults: SearchResult[] = [];

      const shouldLoadOutsideRadius =
        page === 0 &&
        formattedResults.length < OUTSIDE_RADIUS_THRESHOLD &&
        Boolean(lat && lng);
      if (shouldLoadOutsideRadius) {
        const outsideParams = buildOutsideRadiusParams({
          ...baseRequest,
          limit: OUTSIDE_RADIUS_LIMIT,
        });
        if (outsideParams) {
          const expanded = await loadSearchResponse(outsideParams);
          const inRadiusIds = new Set(formattedResults.map((item) => item.id));
          outsideResults = expanded.items
            .map(mapSearchItemToCard)
            .filter((item) => !inRadiusIds.has(item.id))
            .slice(0, OUTSIDE_RADIUS_THRESHOLD);
        }
      }

      // T14 item 2 — Zero-result relaxation. Precedence: exact →
      // exact+outside-radius (geo) → relaxed (drop price/condition/verified) →
      // true-empty. Only broaden when the exact query is truly empty and the geo
      // expansion found nothing, and only using real rows from the loosened query.
      let relaxed: SearchResult[] = [];
      let relaxedCount = 0;
      const shouldRelax =
        page === 0 && data.total === 0 && outsideResults.length === 0;
      if (shouldRelax) {
        const relaxedParams = buildRelaxedParams({ ...baseRequest, limit: OUTSIDE_RADIUS_LIMIT });
        if (relaxedParams) {
          const relaxedData = await loadSearchResponse(relaxedParams);
          relaxed = relaxedData.items.map(mapSearchItemToCard).slice(0, OUTSIDE_RADIUS_THRESHOLD);
          relaxedCount = relaxedData.total;
        }
      }

      setResults(formattedResults);
      setOutsideRadiusResults(outsideResults);
      setRelaxedResults(relaxed);
      setRelaxedTotal(relaxedCount);
      setTotal(data.total);
      setHasMore(data.hasMore);

      // Fire analytics only on new searches (not pagination fetches)
      if (page === 0) {
        const hasFilters = Boolean(categoryId || priceMin || priceMax || location || verifiedOnlyFilter || condition);
        void fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_name: ANALYTICS_EVENTS.SEARCH_PERFORMED,
            props: {
              result_count: data.total,
              zero_result: data.total === 0,
              sort: sortBy,
              has_filters: hasFilters,
            },
          }),
        }).catch(() => {});
      }
    } catch (err) {
      logger.error("Search error", {
        component: "SearchPage",
        action: "performSearch",
        metadata: { query: searchParams.get("q") },
        error: err,
      });
      // Error message should already be translated from the catch blocks above
      const errorMessage = err instanceof Error 
        ? err.message 
        : translate("search.error", "Could not load search results.");
      setError(errorMessage);
      setResults([]);
      setOutsideRadiusResults([]);
      setRelaxedResults([]);
      setRelaxedTotal(0);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [query, categoryId, priceMin, priceMax, location, lat, lng, radiusKm, sortBy, page, limit, translate, searchParams, verifiedOnlyFilter, condition]);

  // Fetch results when params change
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Handle filter changes
  const handleFiltersChange = (filters: SearchFiltersState) => {
    const params = new URLSearchParams(searchParams.toString());

    if (query) params.set("q", query);
    
    if (filters.category_id) {
      params.set("category_id", filters.category_id);
    } else {
      params.delete("category_id");
    }

    if (filters.price_min !== null && filters.price_min > 0) {
      params.set("price_min", filters.price_min.toString());
    } else {
      params.delete("price_min");
    }

    if (filters.price_max !== null && filters.price_max < 10000) {
      params.set("price_max", filters.price_max.toString());
    } else {
      params.delete("price_max");
    }

    if (filters.location) {
      params.set("location", filters.location);
    } else {
      params.delete("location");
    }

    if (filters.location && filters.lat !== null && filters.lng !== null) {
      params.set("lat", String(filters.lat));
      params.set("lng", String(filters.lng));
      params.set("radius_km", String(filters.radius_km ?? 50));
    } else {
      params.delete("lat");
      params.delete("lng");
      params.delete("radius_km");
    }

    if (filters.verified_only) {
      params.set("verified_only", "true");
    } else {
      params.delete("verified_only");
    }

    if (filters.condition) {
      params.set("condition", filters.condition);
    } else {
      params.delete("condition");
    }

    if (filters.sort_by) {
      params.set("sort_by", filters.sort_by);
    }

    Array.from(params.keys())
      .filter((key) => key.startsWith("catalog_field_"))
      .forEach((key) => params.delete(key));

    Object.entries(filters.catalog_fields || {}).forEach(([key, value]) => {
      const paramKey = `catalog_field_${key}`;
      if (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "") ||
        (typeof value === "number" && Number.isNaN(value))
      ) {
        params.delete(paramKey);
        return;
      }

      if (typeof value === "boolean") {
        params.set(paramKey, value ? "true" : "false");
      } else {
        params.set(paramKey, String(value));
      }
    });

    // Reset to page 0 when filters change
    params.set("page", "0");
    
    router.push(searchHref(params.toString()));
  };

  // Handle sort change
  const handleSortChange = (newSortBy: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort_by", newSortBy);
    params.set("page", "0"); // Reset to first page
    router.push(searchHref(params.toString()));
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(searchHref(params.toString()));
  };

  // Sentinel ref for IntersectionObserver-based infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll for mobile - load more results
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);

  // Reset accumulated results when search params change (except page)
  useEffect(() => {
    setAllResults([]);
  }, [query, categoryId, priceMin, priceMax, location, lat, lng, radiusKm, sortBy, verifiedOnlyFilter, condition]);

  // Accumulate results for infinite scroll
  useEffect(() => {
    if (isMobile) {
      setAllResults((prev) => {
        // If it's the first page (page 0), replace all results
        if (page === 0) {
          return results;
        }
        // For subsequent pages, append new results
        if (results.length > 0) {
          // Check if these results are new (not already in allResults)
          const existingIds = new Set(prev.map((r) => r.id));
          const newResults = results.filter((r) => !existingIds.has(r.id));
          if (newResults.length > 0) {
            return [...prev, ...newResults];
          }
        }
        return prev;
      });
    } else {
      setAllResults(results);
    }
  }, [results, isMobile, page]);

  // Clear isLoadingMore when a fetch completes
  useEffect(() => {
    if (!loading) setIsLoadingMore(false);
  }, [loading]);

  // IntersectionObserver-based infinite scroll sentinel
  useEffect(() => {
    if (!isMobile || !hasMore || loading || isLoadingMore) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsLoadingMore(true);
          const nextPage = page + 1;
          const params = new URLSearchParams(searchParams.toString());
          params.set("page", nextPage.toString());
          router.push(searchHref(params.toString()), { scroll: false });
        }
      },
      { rootMargin: "300px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile, hasMore, loading, isLoadingMore, page, searchHref, searchParams, router]);

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit);
  const currentPage = page;
  const startItem = currentPage * limit + 1;
  const endItem = Math.min((currentPage + 1) * limit, total);
  const activeFilterChips = [
    query ? { key: "q", label: `"${query}"`, params: ["q"] } : null,
    categoryId ? { key: "category_id", label: t("search.category") || "Category selected", params: ["category_id"] } : null,
    priceMin || priceMax
      ? {
          key: "price",
          label: `€${priceMin || 0}-${priceMax || 10000}`,
          params: ["price_min", "price_max"],
        }
      : null,
    location ? { key: "location", label: location, params: ["location", "lat", "lng", "radius_km"] } : null,
    verifiedOnlyFilter
      ? { key: "verified_only", label: t("search.verifiedOnly") || "Verified sellers", params: ["verified_only"] }
      : null,
    ...Array.from(searchParams.keys())
      .filter((key) => key.startsWith("catalog_field_"))
      .map((key) => ({
        key,
        label: key.replace("catalog_field_", ""),
        params: [key],
      })),
  ].filter(Boolean) as Array<{ key: string; label: string; params: string[] }>;

  const clearParams = (keys: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    keys.forEach((key) => params.delete(key));
    params.set("page", "0");
    const next = params.toString();
    router.push(searchHref(next || undefined));
  };

  // Render pagination numbers
  const renderPaginationNumbers = () => {
    if (totalPages <= 1) return null;

    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, ellipsis, current range, ellipsis, last page
      if (currentPage < 3) {
        // Near start
        for (let i = 0; i < 4; i++) pages.push(i);
        pages.push("ellipsis");
        pages.push(totalPages - 1);
      } else if (currentPage > totalPages - 4) {
        // Near end
        pages.push(0);
        pages.push("ellipsis");
        for (let i = totalPages - 4; i < totalPages; i++) pages.push(i);
      } else {
        // Middle
        pages.push(0);
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("ellipsis");
        pages.push(totalPages - 1);
      }
    }

    return pages.map((pageNum, idx) => {
      if (pageNum === "ellipsis") {
        return (
          <PaginationItem key={`ellipsis-${idx}`}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      return (
        <PaginationItem key={pageNum}>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(pageNum);
            }}
            isActive={pageNum === currentPage}
          >
            {pageNum + 1}
          </PaginationLink>
        </PaginationItem>
      );
    });
  };

  return (
    <div className="py-4 md:py-6">
      {/* ── Results header card (full-width, above the rail+grid) ────────────── */}
      <div
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r)",
          padding: "16px 20px",
          boxShadow: "var(--shS)",
        }}
      >
        {/* Left: title + count */}
        <div className="min-w-0">
          <h1
            className="font-extrabold tracking-tight leading-tight"
            style={{ fontSize: "21px", letterSpacing: "-0.02em" }}
          >
            {query ? (
              <>
                {query}{" "}
                <span className="font-semibold text-muted-foreground">
                  {translate("search.inBelgium", "in Belgium")}
                </span>
              </>
            ) : (
              translate("search.results", "Search results")
            )}
          </h1>
          <p
            className="mt-0.5 text-sm text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            {!loading && (total > 0
              ? (total < ANTI_SOCIAL_THRESHOLD
                ? translate("search.allResults", "All results")
                : t("search.showing", { start: startItem, end: endItem, total }) ||
                  `Showing ${startItem}–${endItem} of ${total}`)
              : !loading && (t("search.noResults") || "No results found")
            )}
          </p>
        </div>

        {/* Right: sort dropdown + SaveSearch + Discover + mobile filter button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort selector — mockup shows it here on desktop */}
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger
              className="h-10 gap-1.5 font-semibold text-sm"
              style={{
                borderRadius: "var(--rm)",
                border: "1px solid var(--border)",
                background: "var(--secondary)",
                minWidth: "170px",
              }}
            >
              <SelectValue placeholder={t("search.sort") || "Sort"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">
                {t("search.sortRelevance") || "Relevance"}
              </SelectItem>
              <SelectItem value="price_asc">
                {t("search.sortPriceAsc") || "Price: Low to High"}
              </SelectItem>
              <SelectItem value="price_desc">
                {t("search.sortPriceDesc") || "Price: High to Low"}
              </SelectItem>
              <SelectItem value="created_at_desc">
                {t("search.sortNewest") || "Newest first"}
              </SelectItem>
              <SelectItem value="created_at_asc">
                {t("search.sortOldest") || "Oldest first"}
              </SelectItem>
            </SelectContent>
          </Select>

          <SaveSearchButton
            query={query}
            filters={{
              category_id: categoryId,
              price_min: priceMin ? Number(priceMin) : null,
              price_max: priceMax ? Number(priceMax) : null,
              location,
              verified_only: verifiedOnlyFilter || null,
              condition: condition || null,
              sort_by: sortBy,
            }}
          />

          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition hover:text-primary"
            style={{
              height: "40px",
              padding: "0 14px",
              borderRadius: "var(--rm)",
              border: "1px solid var(--border)",
              background: "var(--secondary)",
            }}
          >
            {t("discover.enter")}
          </Link>

          {/* Mobile-only: Filters drawer trigger */}
          <div className="lg:hidden">
            <SearchFilters
              variant="drawer"
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              onFiltersChange={handleFiltersChange}
            />
          </div>
        </div>
      </div>

      {/* Quick-filter chips (above results) — verified toggle with live count preview */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <VerifiedFilterChip />
      </div>

      {/* Applied-filter chips (below header, full-width) */}
      {activeFilterChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            {translate("search.applied", "Applied")}
          </span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-label={`${translate("search.removeFilter", "Remove filter")}: ${chip.label}`}
              onClick={() => clearParams(chip.params)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary-foreground transition hover:text-primary"
              style={{
                height: "30px",
                padding: "0 12px",
                borderRadius: "999px",
                border: "1px solid var(--border)",
                background: "var(--secondary)",
              }}
            >
              {chip.label}
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(searchHref())}
            className="h-7 px-2 text-xs"
            style={{ color: "var(--priD)" }}
          >
            {t("search.clear") || "Clear all"}
          </Button>
        </div>
      )}

      {/* ── 2-column layout: left rail (desktop) + results ─────────────────── */}
      <div className="flex items-start gap-[22px]">
        {/* Left filter rail — sticky, desktop only */}
        <aside className="hidden lg:block shrink-0 lg:sticky lg:top-24 lg:self-start" style={{ width: "262px" }}>
          <SearchFilters variant="sidebar" onFiltersChange={handleFiltersChange} />
        </aside>

        {/* Results area */}
        <main className="min-w-0 flex-1">
          {/* Loading state — skeleton grid matches real layout */}
          {loading && (
            <div aria-busy="true" aria-label={translate("common.loading", "Loading...")}>
              <AdsGridSkeleton count={12} gridColsClass="grid-cols-2 lg:grid-cols-3" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div
              className="p-6 text-center"
              style={{
                background: "oklch(0.97 0.04 24 / 0.15)",
                border: "1px solid oklch(0.80 0.12 24 / 0.40)",
                borderRadius: "var(--r)",
              }}
            >
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchResults()}
                className="mt-3"
              >
                {t("common.retry") || "Retry"}
              </Button>
            </div>
          )}

          {/* Relaxed-results state — honest "no exact matches, similar nearby" with
              real rows from a loosened query + SaveSearch as the primary CTA */}
          {!loading && !error && total === 0 && outsideRadiusResults.length === 0 && relaxedResults.length > 0 && (
            <section className="space-y-5" aria-labelledby="relaxed-title">
              <div
                className="space-y-3 p-5"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r)",
                  boxShadow: "var(--shS)",
                }}
              >
                <div className="space-y-1">
                  <h2 id="relaxed-title" className="text-base font-semibold">
                    {translate("search.relaxedTitle", "No exact matches — here's what's similar")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {relaxedTotal > 0
                      ? translate(
                          "search.relaxedCount",
                          "We broadened your filters and found {count} more.",
                          { count: relaxedTotal },
                        )
                      : translate("search.relaxedHint", "We broadened your filters to show related listings.")}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    {translate("search.zeroResultSaveTitle", "Get notified when new matches appear")}
                  </p>
                  <SaveSearchButton
                    query={query}
                    filters={{
                      category_id: categoryId,
                      price_min: priceMin ? Number(priceMin) : null,
                      price_max: priceMax ? Number(priceMax) : null,
                      location,
                      verified_only: verifiedOnlyFilter || null,
                      condition: condition || null,
                      sort_by: sortBy,
                    }}
                  />
                </div>
              </div>
              <AdsGrid items={relaxedResults} gridColsClass="grid-cols-2 lg:grid-cols-3" />
            </section>
          )}

          {/* Zero-result state — retention CTA with SaveSearch */}
          {!loading && !error && total === 0 && outsideRadiusResults.length === 0 && relaxedResults.length === 0 && (
            <div
              className="space-y-5 p-8 text-center"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                boxShadow: "var(--shS)",
              }}
            >
              <div className="space-y-2">
                <p className="text-base font-semibold">
                  {translate("search.emptyTitle", "Nothing matched your search")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeFilterChips.length > 0
                    ? translate("search.emptyWithFilters", "Try removing some filters or broadening your price range.")
                    : translate("search.emptyBrowse", "Browse categories or try a different search term to find what you need.")}
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {translate("search.zeroResultSaveTitle", "Get notified when new matches appear")}
                </p>
                <SaveSearchButton
                  query={query}
                  filters={{
                    category_id: categoryId,
                    price_min: priceMin ? Number(priceMin) : null,
                    price_max: priceMax ? Number(priceMax) : null,
                    location,
                    verified_only: verifiedOnlyFilter || null,
                    condition: condition || null,
                    sort_by: sortBy,
                  }}
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {activeFilterChips.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => router.push(searchHref())}>
                    {translate("search.clearFilters", "Clear filters")}
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/">{translate("search.browseCategories", "Browse categories")}</Link>
                </Button>
              </div>
            </div>
          )}

          {/* Results grid — 2-col mobile, 3-col desktop (rail already takes 262px) */}
          {!loading && !error && (total > 0 || outsideRadiusResults.length > 0) && (
            <>
              {total > 0 && (
                <AdsGrid
                  items={isMobile ? allResults : results}
                  gridColsClass="grid-cols-2 lg:grid-cols-3"
                />
              )}

              {outsideRadiusResults.length > 0 && (
                <section className={cn(total > 0 && "mt-10")} aria-labelledby="outside-radius-title">
                  <h2 id="outside-radius-title" className="mb-4 text-base font-semibold">
                    {translate("search.outside_radius", "Farther from you")}
                  </h2>
                  <AdsGrid items={outsideRadiusResults} gridColsClass="grid-cols-2 lg:grid-cols-3" />
                </section>
              )}

              {/* Pagination (desktop only) */}
              {!isMobile && totalPages > 1 && (
                <div className="mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 0) {
                              handlePageChange(currentPage - 1);
                            }
                          }}
                          aria-disabled={currentPage === 0}
                          className={cn(currentPage === 0 && "pointer-events-none opacity-50")}
                        />
                      </PaginationItem>
                      {renderPaginationNumbers()}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages - 1) {
                              handlePageChange(currentPage + 1);
                            }
                          }}
                          aria-disabled={currentPage === totalPages - 1}
                          className={cn(
                            currentPage === totalPages - 1 && "pointer-events-none opacity-50",
                          )}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}

              {/* IntersectionObserver sentinel for mobile infinite scroll */}
              {isMobile && hasMore && (
                <div
                  ref={sentinelRef}
                  className="mt-8 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
