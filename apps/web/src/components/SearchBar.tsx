"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getRecentSearches, addRecentSearch, removeRecentSearch } from "@/lib/recentSearches";

type SearchBarProps = {
  /**
   * "default"  — tall pill + external "Find" button (home hero)
   * "compact"  — pill only, no submit button
   * "header"   — pill with an internal round gradient submit button (main header)
   */
  variant?: "default" | "compact" | "header";
  className?: string;
  onSubmit?: (query: string) => void;
};

function getLocalizedCategoryName(cat: Category, locale: string): string {
  const localeMap: Record<string, keyof Category> = {
    en: "name_en",
    nl: "name_nl",
    fr: "name_fr",
    de: "name_de",
    ru: "name_ru",
  };
  const nameKey = localeMap[locale] || localeMap.en;
  return (cat[nameKey] as string) || cat.name_ru || cat.name_en || "";
}

export default function SearchBar({ variant = "default", className, onSubmit }: SearchBarProps) {
  const { t, locale } = useI18n();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [instant, setInstant] = useState<
    Array<{ id: string; title: string; price?: number | null; currency?: string | null; image?: string | null }>
  >([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Load categories on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchCategories() {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("id, parent_id, slug, level, name_ru, name_en, name_nl, name_fr, path, sort, icon, is_active")
          .eq("is_active", true)
          .order("sort", { ascending: true });

        if (!cancelled) {
          if (error) {
            console.error("Failed to fetch categories:", error);
            setCategories([]);
          } else {
            setCategories((data as Category[]) || []);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching categories:", err);
          setCategories([]);
        }
      }
    }

    fetchCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  // Load recent searches when input gains focus
  useEffect(() => {
    if (focused) setRecent(getRecentSearches());
  }, [focused]);

  // Fetch top listing results for the debounced query
  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length < 2) {
      setInstant([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // instant=1 routes to the higher-limit typeahead bucket so rapid keystrokes
        // don't exhaust the main search rate limit and block a real submission.
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6&instant=1`);
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body.ok && body.data) setInstant(body.data.items);
      } catch {
        /* ignore — dropdown just omits listing results */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const filteredCategories = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return [];
    }

    const query = debouncedSearch.toLowerCase().trim();
    return categories
      .filter((cat) => {
        const name = getLocalizedCategoryName(cat, locale).toLowerCase();
        return name.includes(query);
      })
      .slice(0, 10); // Limit to 10 suggestions
  }, [debouncedSearch, categories, locale]);

  const isAutocompleteOpen =
    focused &&
    (instant.length > 0 ||
      (debouncedSearch.trim().length < 2 && recent.length > 0) ||
      (showAutocomplete && filteredCategories.length > 0));

  // Close autocomplete when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;

    // If a category is selected, navigate to it
    if (selectedIndex >= 0 && filteredCategories[selectedIndex]) {
      const selectedCategory = filteredCategories[selectedIndex];
      router.push(`/c/${selectedCategory.path}`);
      setShowAutocomplete(false);
      return;
    }

    if (onSubmit) {
      addRecentSearch(query);
      onSubmit(query);
    } else {
      addRecentSearch(query);
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
    setShowAutocomplete(false);
  };

  const handleCategorySelect = (category: Category) => {
    router.push(`/c/${category.path}`);
    setSearch("");
    setShowAutocomplete(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isAutocompleteOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev < filteredCategories.length - 1 ? prev + 1 : prev));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (event.key === "Enter" && selectedIndex >= 0) {
      event.preventDefault();
      handleCategorySelect(filteredCategories[selectedIndex]);
    } else if (event.key === "Escape") {
      setShowAutocomplete(false);
      setSelectedIndex(-1);
    }
  };

  const isCompact = variant === "compact";
  const isHeader = variant === "header";

  /**
   * "header" variant: single pill containing search-icon + input + round gradient submit button.
   * All submit/autocomplete behaviour is unchanged; only the chrome is different.
   */
  if (isHeader) {
    return (
      <form onSubmit={handleSubmit} className={cn("relative flex min-w-0 flex-1", className)}>
        <div className="flex flex-1 items-center gap-[10px] rounded-full border border-border bg-card px-4 py-0 shadow-[var(--shS)]" style={{ height: 45 }}>
          <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedIndex(-1);
              setShowAutocomplete(event.target.value.trim().length > 0);
            }}
            onFocus={() => {
              setFocused(true);
              if (filteredCategories.length > 0) setShowAutocomplete(true);
            }}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder={t("common.search") || "Search listings across Belgium…"}
            aria-label={t("common.search") || "Search listings"}
            aria-autocomplete="list"
            aria-expanded={isAutocompleteOpen}
            className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {/* Round gradient submit button — inside the pill */}
          <button
            type="submit"
            aria-label={t("common.find") || "Search"}
            className="lyvox-cta-gradient grid shrink-0 place-items-center rounded-full"
            style={{ width: 33, height: 33 }}
          >
            <ArrowRight className="h-4 w-4 text-white" aria-hidden="true" />
          </button>
        </div>

        {/* Autocomplete dropdown — positioned relative to the form */}
        {isAutocompleteOpen && (
          <div
            ref={autocompleteRef}
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-border/70 bg-card shadow-[var(--shadow-hi)]"
            role="listbox"
          >
            {instant.length > 0 && (
              <div className="border-b border-border/60 py-1">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tr("search.instant_results", "Listings")}
                </p>
                {instant.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(`/ad/${item.id}`)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary/60"
                  >
                    <span className="lyvox-image-placeholder flex h-10 w-10 shrink-0 overflow-hidden rounded-md">
                      {item.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={item.image} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                    {typeof item.price === "number" && (
                      <span className="shrink-0 text-sm font-semibold">
                        {item.price} {item.currency ?? "EUR"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {focused && debouncedSearch.trim().length < 2 && recent.length > 0 && (
              <div className="py-1">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tr("search.recent_searches", "Recent searches")}
                </p>
                {recent.map((q) => (
                  <div key={q} className="flex items-center justify-between px-3 py-1.5 hover:bg-secondary/60">
                    <button
                      type="button"
                      onClick={() => router.push(`/search?q=${encodeURIComponent(q)}`)}
                      className="min-w-0 flex-1 truncate text-left text-sm"
                    >
                      {q}
                    </button>
                    <button
                      type="button"
                      aria-label={tr("search.remove_recent", "Remove")}
                      onClick={() => setRecent(removeRecentSearch(q))}
                      className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showAutocomplete && filteredCategories.map((category, index) => (
              <Link
                key={category.id}
                href={`/c/${category.path}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleCategorySelect(category);
                }}
                className={cn(
                  "block cursor-pointer border-b px-4 py-3 transition last:border-b-0 hover:bg-secondary/70",
                  selectedIndex === index && "bg-secondary"
                )}
                role="option"
                aria-selected={selectedIndex === index}
              >
                <div className="flex items-center gap-2">
                  {category.icon && (
                    <span className="text-lg" aria-hidden="true">{category.icon}</span>
                  )}
                  <span className="text-sm font-medium">{getLocalizedCategoryName(category, locale)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />
          <input
            ref={inputRef}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedIndex(-1);
              setShowAutocomplete(event.target.value.trim().length > 0);
            }}
            onFocus={() => {
              setFocused(true);
              if (filteredCategories.length > 0) {
                setShowAutocomplete(true);
              }
            }}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder={t("common.search") || "Search listings, categories, brands"}
            aria-label={t("common.search") || "Search listings"}
            aria-autocomplete="list"
            aria-expanded={isAutocompleteOpen}
            className={cn(
              "w-full rounded-full border border-border/70 bg-card text-foreground shadow-[var(--shadow-soft)] outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-4 focus:ring-primary/12",
              isCompact ? "h-10 pl-10 pr-4 text-sm" : "h-12 pl-11 pr-4 text-sm md:text-base"
            )}
          />

          {/* Autocomplete dropdown */}
          {isAutocompleteOpen && (
            <div
              ref={autocompleteRef}
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-border/70 bg-card shadow-[var(--shadow-hi)]"
              role="listbox"
            >
              {instant.length > 0 && (
                <div className="border-b border-border/60 py-1">
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {tr("search.instant_results", "Listings")}
                  </p>
                  {instant.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => router.push(`/ad/${item.id}`)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary/60"
                    >
                      <span className="lyvox-image-placeholder flex h-10 w-10 shrink-0 overflow-hidden rounded-md">
                        {item.image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.image} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                      {typeof item.price === "number" && (
                        <span className="shrink-0 text-sm font-semibold">
                          {item.price} {item.currency ?? "EUR"}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {focused && debouncedSearch.trim().length < 2 && recent.length > 0 && (
                <div className="py-1">
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {tr("search.recent_searches", "Recent searches")}
                  </p>
                  {recent.map((q) => (
                    <div key={q} className="flex items-center justify-between px-3 py-1.5 hover:bg-secondary/60">
                      <button
                        type="button"
                        onClick={() => router.push(`/search?q=${encodeURIComponent(q)}`)}
                        className="min-w-0 flex-1 truncate text-left text-sm"
                      >
                        {q}
                      </button>
                      <button
                        type="button"
                        aria-label={tr("search.remove_recent", "Remove")}
                        onClick={() => setRecent(removeRecentSearch(q))}
                        className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAutocomplete && filteredCategories.map((category, index) => (
                <Link
                  key={category.id}
                  href={`/c/${category.path}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleCategorySelect(category);
                  }}
                  className={cn(
                    "block cursor-pointer border-b px-4 py-3 transition last:border-b-0 hover:bg-secondary/70",
                    selectedIndex === index && "bg-secondary"
                  )}
                  role="option"
                  aria-selected={selectedIndex === index}
                >
                  <div className="flex items-center gap-2">
                    {category.icon && (
                      <span className="text-lg" aria-hidden="true">
                        {category.icon}
                      </span>
                    )}
                    <span className="text-sm font-medium">{getLocalizedCategoryName(category, locale)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        {!isCompact && (
          <Button type="submit" className="hidden h-12 rounded-full px-6 md:inline-flex">
            {t("common.find") || "Find"}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </form>
  );
}
