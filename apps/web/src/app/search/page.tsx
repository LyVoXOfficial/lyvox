"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import SearchFilters, { type SearchFiltersState } from "@/components/SearchFilters";
import { logger } from "@/lib/errorLogger";
import { mapSearchItemToCard } from "@/lib/advertCards";
import AdsGrid from "@/components/ads-grid";
import { AdsGridSkeleton } from "@/components/marketplace-grid-states";
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
      const params = new URLSearchParams();

      if (query) params.set("q", query);
      if (categoryId) params.set("category_id", categoryId);
      if (priceMin) params.set("price_min", priceMin);
      if (priceMax) params.set("price_max", priceMax);
      if (location) params.set("location", location);
      params.set("sort_by", sortBy);
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (verifiedOnlyFilter) params.set("verified_only", "true");
      if (condition) params.set("condition", condition);

      searchParams.forEach((value, key) => {
        if (key.startsWith("catalog_field_")) {
          params.set(key, value);
        }
      });

      let response: Response;
      try {
        response = await fetch(`/api/search?${params.toString()}`);
      } catch (fetchError) {
        // Network error or fetch failed
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
        // Translate error codes to user-friendly messages
        const errorKey = data.error === "FETCH_FAILED" ? "search.fetchFailed" : "search.error";
        const translated = translate(errorKey, "Could not load search results.");
        throw new Error(translated);
      }

      const formattedResults: SearchResult[] = data.data.items.map(mapSearchItemToCard);

      setResults(formattedResults);

      setTotal(data.data.total);
      setHasMore(data.data.hasMore);
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
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [query, categoryId, priceMin, priceMax, location, sortBy, page, limit, translate, searchParams, verifiedOnlyFilter, condition]);

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
    
    router.push(`/search?${params.toString()}`);
  };

  // Handle sort change
  const handleSortChange = (newSortBy: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort_by", newSortBy);
    params.set("page", "0"); // Reset to first page
    router.push(`/search?${params.toString()}`);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/search?${params.toString()}`);
  };

  // Infinite scroll for mobile - load more results
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);

  // Reset accumulated results when search params change (except page)
  useEffect(() => {
    setAllResults([]);
  }, [query, categoryId, priceMin, priceMax, location, sortBy, verifiedOnlyFilter, condition]);

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

  // Infinite scroll handler
  useEffect(() => {
    if (!isMobile || !hasMore || loading || isLoadingMore) return;

    let scrollTimer: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const clientHeight = document.documentElement.clientHeight;

        // Load more when user is 300px from bottom
        if (scrollHeight - scrollTop - clientHeight < 300 && !isLoadingMore) {
          setIsLoadingMore(true);
          const nextPage = page + 1;
          const params = new URLSearchParams(searchParams.toString());
          params.set("page", nextPage.toString());
          router.push(`/search?${params.toString()}`, { scroll: false });
          // Reset loading flag after fetch completes
          setTimeout(() => setIsLoadingMore(false), 2000);
        }
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(scrollTimer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile, hasMore, loading, page, isLoadingMore, searchParams, router]);

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
    location ? { key: "location", label: location, params: ["location"] } : null,
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
    router.push(next ? `/search?${next}` : "/search");
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
    <div className="py-2 md:py-4">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters Sidebar */}
        <aside className="hidden shrink-0 lg:sticky lg:top-24 lg:block lg:self-start">
          <SearchFilters variant="sidebar" onFiltersChange={handleFiltersChange} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Header with sort and mobile filters */}
          <div className="mb-5 rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h1 className="text-2xl font-extrabold tracking-tight">
                {query
                  ? t("search.resultsFor", { query }) || `Results for "${query}"`
                  : t("search.results") || "Search results"}
              </h1>
              {!loading && (
                <p className="text-sm text-muted-foreground mt-1">
                  {total > 0
                    ? t("search.showing", { start: startItem, end: endItem, total }) ||
                      `Showing ${startItem}-${endItem} of ${total}`
                    : t("search.noResults") || "No results found"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link
                href="/discover"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary/40"
              >
                {t("discover.enter")}
              </Link>

              {/* Mobile filters button */}
              <div className="lg:hidden">
                <SearchFilters
                  variant="drawer"
                  open={filtersOpen}
                  onOpenChange={setFiltersOpen}
                  onFiltersChange={handleFiltersChange}
                />
              </div>

              {/* Sort selector */}
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("search.sort") || "Sort"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">
                    {t("search.sortRelevance") || "Relevance"}
                  </SelectItem>
                  <SelectItem value="price_asc">
                    {t("search.sortPriceAsc") || "Price: low to high"}
                  </SelectItem>
                  <SelectItem value="price_desc">
                    {t("search.sortPriceDesc") || "Price: high to low"}
                  </SelectItem>
                  <SelectItem value="created_at_desc">
                    {t("search.sortNewest") || "Newest first"}
                  </SelectItem>
                  <SelectItem value="created_at_asc">
                    {t("search.sortOldest") || "Oldest first"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {activeFilterChips.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Applied
              </span>
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => clearParams(chip.params)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/70 px-2.5 py-1 text-xs font-medium text-secondary-foreground transition hover:border-primary/30 hover:text-primary"
                >
                  {chip.label}
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => router.push("/search")} className="h-7 px-2 text-xs">
                {t("search.clear") || "Clear"}
              </Button>
            </div>
          )}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center rounded-md border border-border/80 bg-card py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchResults()}
                className="mt-2"
              >
                {t("common.retry") || "Retry"}
              </Button>
            </div>
          )}

          {/* Results — AdsGrid renders a buyer-friendly empty state (with actions)
              when there are no matches, the #1 churn moment. */}
          {!loading && !error && (
            <>
              <AdsGrid
                items={isMobile ? allResults : results}
                emptyTitle={translate("search.emptyTitle", "Nothing matched your search")}
                emptyDescription={
                  activeFilterChips.length > 0
                    ? translate(
                        "search.emptyWithFilters",
                        "Try removing some filters or broadening your price range.",
                      )
                    : translate(
                        "search.emptyBrowse",
                        "Browse categories or try a different search term to find what you need.",
                      )
                }
                primaryAction={{
                  href: "/",
                  label: translate("search.browseCategories", "Browse categories"),
                }}
                secondaryAction={
                  activeFilterChips.length > 0
                    ? {
                        href: "/search",
                        label: translate("search.clearFilters", "Clear filters"),
                        variant: "outline",
                      }
                    : undefined
                }
              />
              
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
                            currentPage === totalPages - 1 && "pointer-events-none opacity-50"
                          )}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}

              {/* Infinite scroll indicator (mobile) */}
              {isMobile && hasMore && (
                <div className="mt-8 flex items-center justify-center">
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
