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

type SearchBarProps = {
  variant?: "default" | "compact";
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
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
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

  const isAutocompleteOpen = showAutocomplete && filteredCategories.length > 0;

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
      onSubmit(query);
    } else {
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
              if (filteredCategories.length > 0) {
                setShowAutocomplete(true);
              }
            }}
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
              {filteredCategories.map((category, index) => (
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
