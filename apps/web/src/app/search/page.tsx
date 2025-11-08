"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import SearchFilters, { type SearchFiltersState } from "@/components/SearchFilters";
import { logger } from "@/lib/errorLogger";
import AdsGrid from "@/components/ads-grid";
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
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchResult = {
  id: string;
  title: string;
  price?: number | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
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
      created_at?: string | null;
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

  // Extract URL parameters
  const query = searchParams.get("q") || "";
  const categoryId = searchParams.get("category_id") || null;
  const priceMin = searchParams.get("price_min");
  const priceMax = searchParams.get("price_max");
  const location = searchParams.get("location") || null;
  const sortBy = searchParams.get("sort_by") || "created_at_desc";
  const page = Number.parseInt(searchParams.get("page") || "0", 10);
  const limit = 24;

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
        const translated = t("search.fetchFailed");
        throw new Error(translated);
      }

      if (!response.ok) {
        const translated = t("search.fetchFailed");
        throw new Error(translated);
      }

      let data: SearchResponse;
      try {
        data = await response.json();
      } catch (parseError) {
        const translated = t("search.fetchFailed");
        throw new Error(translated);
      }

      if (!data.ok || !data.data) {
        // Translate error codes to user-friendly messages
        const errorKey = data.error === "FETCH_FAILED" ? "search.fetchFailed" : "search.error";
        const translated = t(errorKey);
        throw new Error(translated);
      }

      // Fetch media for results using public API
      const ids = data.data.items.map((item) => item.id);
      const firstMedia = new Map<string, string>();

      if (ids.length > 0) {
        // Fetch media for each advert (we'll optimize this later with a bulk endpoint)
        const mediaPromises = ids.slice(0, 24).map(async (id) => {
          try {
            const mediaResponse = await fetch(`/api/media/public?advertId=${id}`);
            if (mediaResponse.ok) {
              const mediaData = await mediaResponse.json();
              if (mediaData.ok && mediaData.items && mediaData.items.length > 0) {
                // Get first image (sorted by sort order)
                const firstItem = mediaData.items[0];
                return { advertId: id, url: firstItem.url || null };
              }
            }
          } catch (err) {
            logger.warn("Failed to fetch media for advert", {
              component: "SearchPage",
              action: "fetchMedia",
              metadata: { advertId: id },
              error: err,
            });
          }
          return { advertId: id, url: null };
        });

        const mediaResults = await Promise.all(mediaPromises);
        mediaResults.forEach(({ advertId, url }) => {
          if (url) {
            firstMedia.set(advertId, url);
          }
        });
      }

      const formattedResults: SearchResult[] = data.data.items.map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        location: item.location,
        image: firstMedia.get(item.id) ?? null,
        createdAt: item.created_at ?? null,
      }));

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
        : t("search.error");
      setError(errorMessage);
      setResults([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [query, categoryId, priceMin, priceMax, location, sortBy, page, limit, t, searchParams]);

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
  }, [query, categoryId, priceMin, priceMax, location, sortBy]);

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
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters Sidebar */}
        <aside className="hidden lg:block lg:w-64 shrink-0">
          <SearchFilters variant="sidebar" onFiltersChange={handleFiltersChange} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Header with sort and mobile filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-2xl font-semibold">
                {query
                  ? t("search.resultsFor", { query }) || `Результаты для "${query}"`
                  : t("search.results") || "Результаты поиска"}
              </h1>
              {!loading && (
                <p className="text-sm text-muted-foreground mt-1">
                  {total > 0
                    ? t("search.showing", { start: startItem, end: endItem, total }) ||
                      `Показано ${startItem}-${endItem} из ${total}`
                    : t("search.noResults") || "Результаты не найдены"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
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
                  <SelectValue placeholder={t("search.sort") || "Сортировка"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">
                    {t("search.sortRelevance") || "Релевантность"}
                  </SelectItem>
                  <SelectItem value="price_asc">
                    {t("search.sortPriceAsc") || "Цена: по возрастанию"}
                  </SelectItem>
                  <SelectItem value="price_desc">
                    {t("search.sortPriceDesc") || "Цена: по убыванию"}
                  </SelectItem>
                  <SelectItem value="created_at_desc">
                    {t("search.sortNewest") || "Сначала новые"}
                  </SelectItem>
                  <SelectItem value="created_at_asc">
                    {t("search.sortOldest") || "Сначала старые"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchResults()}
                className="mt-2"
              >
                {t("common.retry") || "Повторить"}
              </Button>
            </div>
          )}

          {/* Results */}
          {!loading && !error && (
            <>
              <AdsGrid items={isMobile ? allResults : results} />
              
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

