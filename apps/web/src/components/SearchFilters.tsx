"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabaseClient";
import type { Category } from "@/lib/types";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { ChevronRight, ChevronDown, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { logger } from "@/lib/errorLogger";
import { FormRenderer, type CatalogSchema, type CatalogFieldDefinition, type CatalogSchemaField } from "@/catalog/renderer";
import { detectCategoryType } from "@/lib/utils/categoryDetector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type SearchFiltersProps = {
  variant?: "sidebar" | "drawer";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onFiltersChange?: (filters: SearchFiltersState) => void;
};

export type SearchFiltersState = {
  category_id: string | null;
  price_min: number | null;
  price_max: number | null;
  location: string | null;
  catalog_fields: Record<string, unknown>;
  verified_only: boolean;
};

type CategoryWithChildren = Category & {
  children?: CategoryWithChildren[];
};

type CatalogSchemaState = {
  loading: boolean;
  error: string | null;
  schema: CatalogSchema | null;
  fields: Record<string, CatalogFieldDefinition>;
};

const SCHEMA_EXCLUDED_TYPES = new Set(["vehicle", "real_estate", "electronics", "fashion", "jobs"]);

function getLocalizedCategoryName(cat: Category, locale: string): string {
  const localeMap: Record<string, keyof Category> = {
    en: "name_en",
    nl: "name_nl",
    fr: "name_fr",
    de: "name_de",
    ru: "name_ru",
  };
  const nameKey = localeMap[locale] || localeMap.en;
  // Try localized name first, then fallback to English, then Russian
  const localizedName = cat[nameKey] as string;
  if (localizedName && localizedName.trim()) {
    return localizedName;
  }
  // Fallback chain: en -> ru -> empty
  return (cat.name_en as string) || (cat.name_ru as string) || "";
}

function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const categoryMap = new Map<string, CategoryWithChildren>();
  const roots: CategoryWithChildren[] = [];

  // First pass: create all nodes
  categories.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  // Second pass: build tree structure
  categories.forEach((cat) => {
    const node = categoryMap.get(cat.id)!;
    if (cat.parent_id) {
      const parent = categoryMap.get(cat.parent_id);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort by sort order or name
  const sortCategories = (cats: CategoryWithChildren[]): CategoryWithChildren[] => {
    return [...cats]
      .sort((a, b) => {
        if (a.sort !== null && b.sort !== null) return a.sort - b.sort;
        if (a.sort !== null) return -1;
        if (b.sort !== null) return 1;
        return (a.name_ru || "").localeCompare(b.name_ru || "");
      })
      .map((cat) => ({
        ...cat,
        children: cat.children ? sortCategories(cat.children) : undefined,
      }));
  };

  return sortCategories(roots);
}

/**
 * SearchFilters component
 * Provides filtering UI for search results:
 * - Cascading category selector
 * - Price range slider
 * - Location autocomplete
 * - Desktop: sidebar variant
 * - Mobile: drawer variant
 */
export default function SearchFilters({
  variant,
  open,
  onOpenChange,
  onFiltersChange,
}: SearchFiltersProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auto-detect variant based on screen size if not provided
  const [internalVariant, setInternalVariant] = useState<"sidebar" | "drawer">(
    variant || (typeof window !== "undefined" && window.innerWidth >= 768 ? "sidebar" : "drawer")
  );

  // Detect screen size for auto-variant
  useEffect(() => {
    if (variant) return; // If variant is explicitly set, don't auto-detect

    const handleResize = () => {
      setInternalVariant(window.innerWidth >= 768 ? "sidebar" : "drawer");
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [variant]);

  const actualVariant = variant || internalVariant;

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [location, setLocation] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const locationSuggestionsRef = useRef<HTMLDivElement>(null);
  const [filterSchemaState, setFilterSchemaState] = useState<CatalogSchemaState>({
    loading: false,
    error: null,
    schema: null,
    fields: {},
  });
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, unknown>>({});
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Initialize from URL params
  useEffect(() => {
    const categoryId = searchParams.get("category_id");
    const priceMin = searchParams.get("price_min");
    const priceMax = searchParams.get("price_max");
    const locationParam = searchParams.get("location");
    const verifiedOnlyParam = searchParams.get("verified_only");

    if (categoryId) {
      // Find category in loaded categories
      const findCategory = (cats: Category[]): Category | null => {
        for (const cat of cats) {
          if (cat.id === categoryId) return cat;
        }
        return null;
      };
      const cat = findCategory(categories);
      if (cat) setSelectedCategory(cat);
    }

    if (priceMin || priceMax) {
      setPriceRange([
        priceMin ? Number.parseFloat(priceMin) : 0,
        priceMax ? Number.parseFloat(priceMax) : 10000,
      ]);
    }

    if (locationParam) {
      setLocation(locationParam);
    }

    if (verifiedOnlyParam) {
      const normalized = verifiedOnlyParam.trim().toLowerCase();
      setVerifiedOnly(["true", "1", "yes"].includes(normalized));
    } else {
      setVerifiedOnly(false);
    }
  }, [searchParams, categories]);

  // Load categories
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
            logger.error("Failed to fetch categories", {
              component: "SearchFilters",
              action: "fetchCategories",
              error,
            });
            setCategories([]);
          } else {
            setCategories((data as Category[]) || []);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          logger.error("Error fetching categories", {
          component: "SearchFilters",
          action: "fetchCategories",
          error: err,
        });
          setCategories([]);
          setLoading(false);
        }
      }
    }

    fetchCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  // Location autocomplete (simple - could be enhanced with API)
  useEffect(() => {
    if (!location.trim()) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    // Simple client-side filtering from existing locations
    // In production, this could use a geocoding API
    const query = location.toLowerCase().trim();
    // Placeholder: you could fetch distinct locations from DB or use a geocoding service
    const commonLocations = [
      "Amsterdam",
      "Rotterdam",
      "The Hague",
      "Utrecht",
      "Eindhoven",
      "Groningen",
      "Tilburg",
      "Almere",
      "Breda",
      "Nijmegen",
      "Brussels",
      "Antwerp",
      "Ghent",
      "Paris",
      "Lyon",
      "Marseille",
    ];

    const filtered = commonLocations
      .filter((loc) => loc.toLowerCase().includes(query))
      .slice(0, 5);

    setLocationSuggestions(filtered);
    setShowLocationSuggestions(filtered.length > 0);
  }, [location]);

  // Close location suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        locationSuggestionsRef.current &&
        !locationSuggestionsRef.current.contains(event.target as Node) &&
        locationInputRef.current &&
        !locationInputRef.current.contains(event.target as Node)
      ) {
        setShowLocationSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!selectedCategory) {
      setFilterSchemaState({
        loading: false,
        error: null,
        schema: null,
        fields: {},
      });
      setDynamicFilters({});
      return;
    }

    const categoryType = detectCategoryType(selectedCategory.path || selectedCategory.slug || "");
    if (SCHEMA_EXCLUDED_TYPES.has(categoryType)) {
      setFilterSchemaState({
        loading: false,
        error: null,
        schema: null,
        fields: {},
      });
      setDynamicFilters({});
      return;
    }

    const loadSchema = async () => {
      setFilterSchemaState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const response = await fetch(`/api/catalog/schema?category_id=${selectedCategory.id}`);
        if (cancelled) return;

        if (!response.ok) {
          setFilterSchemaState({
            loading: false,
            error: t("catalog.common.schema_missing"),
            schema: null,
            fields: {},
          });
          setDynamicFilters({});
          return;
        }

        const payload = await response.json();
        if (!payload?.ok || !payload?.data) {
          setFilterSchemaState({
            loading: false,
            error: t("catalog.common.schema_missing"),
            schema: null,
            fields: {},
          });
          setDynamicFilters({});
          return;
        }

        const schema: CatalogSchema = {
          version: payload.data.schema.version,
          steps: payload.data.schema.steps,
        };
        const fieldMap = payload.data.fields as Record<string, CatalogFieldDefinition>;

        const initialFilters: Record<string, unknown> = {};
        searchParams.forEach((value, key) => {
          if (!key.startsWith("catalog_field_")) return;
          const fieldKey = key.replace("catalog_field_", "");
          const fieldDef = fieldMap[fieldKey];
          if (!fieldDef) return;

          let parsed: unknown = value;
          if (fieldDef.field_type === "number") {
            const numericValue = Number(value);
            if (Number.isNaN(numericValue)) {
              return;
            }
            parsed = numericValue;
          } else if (fieldDef.field_type === "boolean") {
            parsed = value === "true";
          }

          initialFilters[fieldKey] = parsed;
        });

        setFilterSchemaState({
          loading: false,
          error: null,
          schema,
          fields: fieldMap,
        });
        setDynamicFilters(initialFilters);
      } catch (error) {
        if (cancelled) return;
        setFilterSchemaState({
          loading: false,
          error: t("catalog.common.schema_missing"),
          schema: null,
          fields: {},
        });
        setDynamicFilters({});
      }
    };

    loadSchema();

    return () => {
      cancelled = true;
    };
  }, [selectedCategory, searchParams, t]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setDynamicFilters({});
    applyFilters({
      category_id: category.id,
      price_min: priceRange[0] > 0 ? priceRange[0] : null,
      price_max: priceRange[1] < 10000 ? priceRange[1] : null,
      location: location || null,
      catalog_fields: {},
      verified_only: verifiedOnly,
    });
  };

  const handleClearCategory = () => {
    setSelectedCategory(null);
    setDynamicFilters({});
    applyFilters({
      category_id: null,
      price_min: priceRange[0] > 0 ? priceRange[0] : null,
      price_max: priceRange[1] < 10000 ? priceRange[1] : null,
      location: location || null,
      catalog_fields: {},
      verified_only: verifiedOnly,
    });
  };

  const handlePriceRangeChange = (range: [number, number]) => {
    setPriceRange(range);
  };

  const handleLocationSelect = (selectedLocation: string) => {
    setLocation(selectedLocation);
    setShowLocationSuggestions(false);
    applyFilters({
      category_id: selectedCategory?.id || null,
      price_min: priceRange[0] > 0 ? priceRange[0] : null,
      price_max: priceRange[1] < 10000 ? priceRange[1] : null,
      location: selectedLocation || null,
      catalog_fields: dynamicFilters,
      verified_only: verifiedOnly,
    });
  };

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setShowLocationSuggestions(true);
  };

  const applyFilters = (filters: SearchFiltersState) => {
    const mergedFilters: SearchFiltersState = {
      category_id: filters.category_id,
      price_min: filters.price_min,
      price_max: filters.price_max,
      location: filters.location,
      catalog_fields: filters.catalog_fields ?? dynamicFilters,
      verified_only: filters.verified_only ?? verifiedOnly,
    };

    onFiltersChange?.(mergedFilters);

    // Update URL params
    const params = new URLSearchParams(searchParams.toString());

    if (mergedFilters.category_id) {
      params.set("category_id", mergedFilters.category_id);
    } else {
      params.delete("category_id");
    }

    if (mergedFilters.price_min !== null && mergedFilters.price_min > 0) {
      params.set("price_min", mergedFilters.price_min.toString());
    } else {
      params.delete("price_min");
    }

    if (mergedFilters.price_max !== null && mergedFilters.price_max < 10000) {
      params.set("price_max", mergedFilters.price_max.toString());
    } else {
      params.delete("price_max");
    }

    if (mergedFilters.location) {
      params.set("location", mergedFilters.location);
    } else {
      params.delete("location");
    }

    if (mergedFilters.verified_only) {
      params.set("verified_only", "true");
    } else {
      params.delete("verified_only");
    }

    Array.from(params.keys())
      .filter((key) => key.startsWith("catalog_field_"))
      .forEach((key) => params.delete(key));

    Object.entries(mergedFilters.catalog_fields).forEach(([key, value]) => {
      if (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "") ||
        (typeof value === "number" && Number.isNaN(value))
      ) {
        return;
      }
      const paramKey = `catalog_field_${key}`;
      if (typeof value === "boolean") {
        params.set(paramKey, value ? "true" : "false");
      } else {
        params.set(paramKey, String(value));
      }
    });

    router.push(`/search?${params.toString()}`);
  };

  const handleDynamicFieldChange = useCallback(
    (fieldKey: string, value: unknown) => {
      setDynamicFilters((prev) => {
        const next = { ...prev };
        const isEmpty =
          value === null ||
          value === undefined ||
          (typeof value === "string" && value.trim() === "") ||
          (typeof value === "number" && Number.isNaN(value));

        if (isEmpty) {
          delete next[fieldKey];
        } else {
          next[fieldKey] = value;
        }

        applyFilters({
          category_id: selectedCategory?.id || null,
          price_min: priceRange[0] > 0 ? priceRange[0] : null,
          price_max: priceRange[1] < 10000 ? priceRange[1] : null,
          location: location || null,
          catalog_fields: next,
          verified_only: verifiedOnly,
        });

        return next;
      });
    },
    [applyFilters, selectedCategory?.id, priceRange, location],
  );

  const handleApplyFilters = () => {
    applyFilters({
      category_id: selectedCategory?.id || null,
      price_min: priceRange[0] > 0 ? priceRange[0] : null,
      price_max: priceRange[1] < 10000 ? priceRange[1] : null,
      location: location || null,
      catalog_fields: dynamicFilters,
      verified_only: verifiedOnly,
    });
  };

  const handleClearAll = () => {
    setSelectedCategory(null);
    setPriceRange([0, 10000]);
    setLocation("");
    setDynamicFilters({});
    setVerifiedOnly(false);
    applyFilters({
      category_id: null,
      price_min: null,
      price_max: null,
      location: null,
      catalog_fields: {},
      verified_only: false,
    });
  };

  const tree = buildCategoryTree(categories);
  const filterSchema = useMemo(() => {
    if (!filterSchemaState.schema) return null;
    return {
      version: filterSchemaState.schema.version,
      steps: (filterSchemaState.schema.steps ?? []).map((step) => ({
        ...step,
        groups: step.groups?.map((group) => ({
          ...group,
          fields: group.fields?.map((field) => ({
            ...field,
            optional: true,
          })),
        })),
      })),
    } as CatalogSchema;
  }, [filterSchemaState.schema]);

  const renderCategory = (cat: CategoryWithChildren, level: number = 0): React.ReactNode => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expanded.has(cat.id);
    const isSelected = selectedCategory?.id === cat.id;
    const Icon = getCategoryIcon(cat.icon, cat.level);
    const name = getLocalizedCategoryName(cat, locale);

    return (
      <div key={cat.id} className={cn("space-y-1", level > 0 && "ml-4")}>
        <div className="flex items-center gap-2">
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleExpand(cat.id)}
              className="p-1 hover:bg-muted rounded transition-colors"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          )}
          {!hasChildren && <span className="w-5" />}
          <button
            type="button"
            onClick={() => handleCategorySelect(cat)}
            className={cn(
              "flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
              "hover:bg-muted",
              isSelected && "bg-primary/10 text-primary font-medium",
              level === 0 && "font-medium"
            )}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{name}</span>
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {cat.children!.map((child) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const filtersContent = (
    <div className="space-y-6">
      {/* Category Filter */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">
            {t("search.category") || "Категория"}
          </Label>
          {selectedCategory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearCategory}
              className="h-auto p-1 text-xs"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">
            {t("common.loading") || "Загрузка…"}
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto border rounded-md p-2">
            {tree.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                {t("common.categories") || "Категории"} {t("common.loading") || "недоступны"}
              </div>
            ) : (
              tree.map((cat) => renderCategory(cat))
            )}
          </div>
        )}
        {selectedCategory && (
          <div className="mt-2 text-sm text-muted-foreground">
            {t("search.selected") || "Выбрано"}: {getLocalizedCategoryName(selectedCategory, locale)}
          </div>
        )}
      </div>

      {/* Price Range Filter */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {t("search.price") || "Цена"}
        </Label>
        <div className="space-y-3">
          <Slider
            value={priceRange}
            onValueChange={handlePriceRangeChange}
            min={0}
            max={10000}
            step={10}
            className="w-full"
          />
          <div className="flex items-center gap-2 text-sm">
            <Input
              type="number"
              min={0}
              max={10000}
              value={priceRange[0]}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value) || 0;
                setPriceRange([Math.min(val, priceRange[1]), priceRange[1]]);
              }}
              className="w-24"
              placeholder="Min"
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="number"
              min={0}
              max={10000}
              value={priceRange[1]}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value) || 10000;
                setPriceRange([priceRange[0], Math.max(val, priceRange[0])]);
              }}
              className="w-24"
              placeholder="Max"
            />
          </div>
        </div>
      </div>

      {/* Verified Sellers Filter */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {t("search.verifiedOnly") || "Только проверенные продавцы"}
        </Label>
        <div className="flex items-center gap-2">
          <Checkbox
            id="verified-only"
            checked={verifiedOnly}
            onCheckedChange={(checked) => {
              const value = checked === true;
              setVerifiedOnly(value);
              applyFilters({
                category_id: selectedCategory?.id || null,
                price_min: priceRange[0] > 0 ? priceRange[0] : null,
                price_max: priceRange[1] < 10000 ? priceRange[1] : null,
                location: location || null,
                catalog_fields: dynamicFilters,
                verified_only: value,
              });
            }}
          />
          <Label htmlFor="verified-only" className="text-sm text-muted-foreground leading-none font-normal">
            {t("search.verifiedOnlyHelper") || "Показывать объявления только от верифицированных продавцов"}
          </Label>
        </div>
      </div>

      {/* Location Filter */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {t("search.location") || "Локация"}
        </Label>
        <div className="relative">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={locationInputRef}
              type="text"
              value={location}
              onChange={(e) => handleLocationChange(e.target.value)}
              onFocus={() => setShowLocationSuggestions(locationSuggestions.length > 0)}
              placeholder={t("search.locationPlaceholder") || "Введите город или регион"}
              className="pl-9"
            />
          </div>
          {showLocationSuggestions && locationSuggestions.length > 0 && (
            <div
              ref={locationSuggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
            >
              {locationSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleLocationSelect(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0 text-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    {/* Category-specific filters */}
    {selectedCategory && !SCHEMA_EXCLUDED_TYPES.has(detectCategoryType(selectedCategory.path || selectedCategory.slug || "")) && (
      <div className="space-y-4">
        <Label className="text-sm font-semibold block">
          {t("search.filters")}
        </Label>
        {filterSchemaState.loading && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {t("catalog.common.schema_loading")}
          </div>
        )}
        {!filterSchemaState.loading && filterSchemaState.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {filterSchemaState.error}
          </div>
        )}
        {!filterSchemaState.loading && !filterSchemaState.error && filterSchema && (
          <FormRenderer
            schema={filterSchema}
            fields={filterSchemaState.fields}
            values={dynamicFilters}
            onChange={handleDynamicFieldChange}
            locale={locale}
          />
        )}
      </div>
    )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={handleApplyFilters} className="flex-1">
          {t("search.apply") || "Применить"}
        </Button>
        <Button variant="outline" onClick={handleClearAll}>
          {t("search.clear") || "Очистить"}
        </Button>
      </div>
    </div>
  );

  // Sidebar variant (desktop)
  if (actualVariant === "sidebar") {
    return (
      <aside className="w-64 shrink-0 border-r bg-background p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{t("search.filters") || "Фильтры"}</h2>
        </div>
        {filtersContent}
      </aside>
    );
  }

  // Drawer variant (mobile)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full md:hidden">
          {t("search.filters") || "Фильтры"}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 sm:max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("search.filters") || "Фильтры"}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 px-4">{filtersContent}</div>
      </SheetContent>
    </Sheet>
  );
}

