"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabaseClient";
import type { Category } from "@/lib/types";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { ChevronRight, ChevronDown, X, MapPin, SlidersHorizontal, ShieldCheck } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  condition: string | null;
  sort_by: string;
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
const COMMON_LOCATIONS = [
  "Brussels",
  "Antwerp",
  "Ghent",
  "Bruges",
  "Leuven",
  "Mechelen",
  "Hasselt",
  "Genk",
  "Kortrijk",
  "Ostend",
  "Aalst",
  "Namur",
  "Liège",
  "Charleroi",
  "Mons",
  "Tournai",
  "Wavre",
  "Arlon",
];

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
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
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
  const [condition, setCondition] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("created_at_desc");

  // Initialize from URL params
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const categoryId = searchParams.get("category_id");
      const priceMin = searchParams.get("price_min");
      const priceMax = searchParams.get("price_max");
      const locationParam = searchParams.get("location");
      const verifiedOnlyParam = searchParams.get("verified_only");

      if (categoryId) {
        const cat = categories.find((category) => category.id === categoryId) ?? null;
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

      const conditionParam = searchParams.get("condition");
      setCondition(conditionParam || null);

      const sortByParam = searchParams.get("sort_by");
      setSortBy(sortByParam ?? "created_at_desc");
    }, 0);

    return () => window.clearTimeout(timeout);
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

  const locationSuggestions = useMemo(() => {
    if (!location.trim()) {
      return [];
    }

    const query = location.toLowerCase().trim();
    return COMMON_LOCATIONS
      .filter((loc) => loc.toLowerCase().includes(query))
      .slice(0, 5);
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
      const timeout = window.setTimeout(() => {
        if (cancelled) return;
        setFilterSchemaState({
          loading: false,
          error: null,
          schema: null,
          fields: {},
        });
        setDynamicFilters({});
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timeout);
      };
    }

    const categoryType = detectCategoryType(selectedCategory.path || selectedCategory.slug || "");
    if (SCHEMA_EXCLUDED_TYPES.has(categoryType)) {
      const timeout = window.setTimeout(() => {
        if (cancelled) return;
        setFilterSchemaState({
          loading: false,
          error: null,
          schema: null,
          fields: {},
        });
        setDynamicFilters({});
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timeout);
      };
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
      condition,
      sort_by: sortBy,
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
      condition,
      sort_by: sortBy,
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
      condition,
      sort_by: sortBy,
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
      condition: filters.condition ?? condition,
      sort_by: filters.sort_by ?? sortBy,
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

    if (mergedFilters.condition) {
      params.set("condition", mergedFilters.condition);
    } else {
      params.delete("condition");
    }

    if (mergedFilters.sort_by) {
      params.set("sort_by", mergedFilters.sort_by);
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

  const handleDynamicFieldChange = (fieldKey: string, value: unknown) => {
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
        condition,
        sort_by: sortBy,
      });

      return next;
    });
  };

  const handleApplyFilters = () => {
    applyFilters({
      category_id: selectedCategory?.id || null,
      price_min: priceRange[0] > 0 ? priceRange[0] : null,
      price_max: priceRange[1] < 10000 ? priceRange[1] : null,
      location: location || null,
      catalog_fields: dynamicFilters,
      verified_only: verifiedOnly,
      condition,
      sort_by: sortBy,
    });
  };

  const handleClearAll = () => {
    setSelectedCategory(null);
    setPriceRange([0, 10000]);
    setLocation("");
    setDynamicFilters({});
    setVerifiedOnly(false);
    setCondition(null);
    setSortBy("created_at_desc");
    applyFilters({
      category_id: null,
      price_min: null,
      price_max: null,
      location: null,
      catalog_fields: {},
      verified_only: false,
      condition: null,
      sort_by: "created_at_desc",
    });
  };

  const tree = buildCategoryTree(categories);
  const isLocationSuggestionsOpen = showLocationSuggestions && locationSuggestions.length > 0;
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
  const activeFilters: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (selectedCategory) {
    activeFilters.push({
        key: "category",
        label: getLocalizedCategoryName(selectedCategory, locale),
        onRemove: handleClearCategory,
    });
  }

  if (priceRange[0] > 0 || priceRange[1] < 10000) {
    activeFilters.push({
      key: "price",
      label: `€${priceRange[0]}-€${priceRange[1]}`,
      onRemove: () => {
        setPriceRange([0, 10000]);
        applyFilters({
          category_id: selectedCategory?.id || null,
          price_min: null,
          price_max: null,
          location: location || null,
          catalog_fields: dynamicFilters,
          verified_only: verifiedOnly,
          condition,
          sort_by: sortBy,
        });
      },
    });
  }

  if (location) {
    activeFilters.push({
      key: "location",
      label: location,
      onRemove: () => {
        setLocation("");
        applyFilters({
          category_id: selectedCategory?.id || null,
          price_min: priceRange[0] > 0 ? priceRange[0] : null,
          price_max: priceRange[1] < 10000 ? priceRange[1] : null,
          location: null,
          catalog_fields: dynamicFilters,
          verified_only: verifiedOnly,
          condition,
          sort_by: sortBy,
        });
      },
    });
  }

  if (verifiedOnly) {
    activeFilters.push({
      key: "verified",
      label: tr("search.verifiedOnly", "Verified sellers"),
      onRemove: () => {
        setVerifiedOnly(false);
        applyFilters({
          category_id: selectedCategory?.id || null,
          price_min: priceRange[0] > 0 ? priceRange[0] : null,
          price_max: priceRange[1] < 10000 ? priceRange[1] : null,
          location: location || null,
          catalog_fields: dynamicFilters,
          verified_only: false,
          condition,
          sort_by: sortBy,
        });
      },
    });
  }

  if (condition) {
    const conditionLabels: Record<string, string> = {
      new: tr("search.condition_new", "New"),
      used: tr("search.condition_used", "Used"),
      for_parts: tr("search.condition_for_parts", "For parts"),
    };
    activeFilters.push({
      key: "condition",
      label: conditionLabels[condition] ?? condition,
      onRemove: () => {
        setCondition(null);
        applyFilters({
          category_id: selectedCategory?.id || null,
          price_min: priceRange[0] > 0 ? priceRange[0] : null,
          price_max: priceRange[1] < 10000 ? priceRange[1] : null,
          location: location || null,
          catalog_fields: dynamicFilters,
          verified_only: verifiedOnly,
          condition: null,
          sort_by: sortBy,
        });
      },
    });
  }

  const dynamicCount = Object.keys(dynamicFilters).length;
  if (dynamicCount > 0) {
    activeFilters.push({
      key: "specifics",
      label: (dynamicCount === 1
        ? tr("filters.specificFilterOne", "{count} specific filter")
        : tr("filters.specificFilterOther", "{count} specific filters")
      ).replace("{count}", String(dynamicCount)),
      onRemove: () => {
        setDynamicFilters({});
        applyFilters({
          category_id: selectedCategory?.id || null,
          price_min: priceRange[0] > 0 ? priceRange[0] : null,
          price_max: priceRange[1] < 10000 ? priceRange[1] : null,
          location: location || null,
          catalog_fields: {},
          verified_only: verifiedOnly,
          condition,
          sort_by: sortBy,
        });
      },
    });
  }

  const renderCategory = (cat: CategoryWithChildren, level: number = 0): React.ReactNode => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expanded.has(cat.id);
    const isSelected = selectedCategory?.id === cat.id;
    const Icon = getCategoryIcon(cat.icon, cat.level);
    const name = getLocalizedCategoryName(cat, locale);

    return (
      <div key={cat.id} className={cn("space-y-1", level > 0 && "ml-3")}>
        <div className="flex items-center gap-1">
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleExpand(cat.id)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
              aria-label={isExpanded ? tr("filters.collapse", "Collapse") : tr("filters.expand", "Expand")}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          {!hasChildren && <span className="w-3 shrink-0" />}
          <button
            type="button"
            onClick={() => handleCategorySelect(cat)}
            className={cn(
              "flex min-h-[40px] flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors",
              "hover:bg-muted",
              isSelected && "bg-primary/10 text-primary font-medium",
              level === 0 && "font-medium"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
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
      {activeFilters.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-semibold">{tr("filters.activeFilters", "Active filters")}</Label>
            <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-8 px-2 text-xs">
              {tr("search.clear", "Clear")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={filter.onRemove}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-border/70 bg-secondary/70 px-3 py-1 text-xs font-medium text-secondary-foreground transition hover:border-primary/30 hover:text-primary"
              >
                {filter.label}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">
            {tr("search.category", "Category")}
          </Label>
          {selectedCategory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearCategory}
              className="h-8 w-8 p-0 text-xs"
              aria-label={tr("search.clear", "Clear")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">
            {tr("common.loading", "Loading...")}
          </div>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-background p-2 shadow-[var(--shadow-soft)]">
            {tree.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2">
                {tr("filters.categoriesUnavailable", "Categories unavailable")}
              </div>
            ) : (
              tree.map((cat) => renderCategory(cat))
            )}
          </div>
        )}
        {selectedCategory && (
          <div className="mt-2 text-sm text-muted-foreground">
            {tr("search.selected", "Selected")}: {getLocalizedCategoryName(selectedCategory, locale)}
          </div>
        )}
      </div>

      {/* Price Range Filter */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {tr("search.price", "Price")}
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
              className="h-11 flex-1"
              placeholder={tr("filters.min", "Min")}
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
              className="h-11 flex-1"
              placeholder={tr("filters.max", "Max")}
            />
          </div>
        </div>
      </div>

      {/* Verified Sellers Filter */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {tr("search.verifiedOnly", "Verified sellers only")}
        </Label>
        <label
          htmlFor="verified-only"
          className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background p-3 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/30"
        >
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
                condition,
                sort_by: sortBy,
              });
            }}
          />
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground leading-snug font-normal">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {tr("search.verifiedOnlyHelper", "Show listings from sellers with verified email and phone")}
          </span>
        </label>
      </div>

      {/* Condition Filter */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">{tr("search.condition", "Condition")}</p>
        {([
          ["new", tr("search.condition_new", "New")],
          ["used", tr("search.condition_used", "Used")],
          ["for_parts", tr("search.condition_for_parts", "For parts")],
        ] as const).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={condition === value}
              onCheckedChange={(checked) => {
                const newCondition = checked ? value : null;
                setCondition(newCondition);
                applyFilters({
                  category_id: selectedCategory?.id || null,
                  price_min: priceRange[0] > 0 ? priceRange[0] : null,
                  price_max: priceRange[1] < 10000 ? priceRange[1] : null,
                  location: location || null,
                  catalog_fields: dynamicFilters,
                  verified_only: verifiedOnly,
                  condition: newCondition,
                  sort_by: sortBy,
                });
              }}
            />
            {label}
          </label>
        ))}
      </div>

      {/* Sort Filter */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">{tr("search.sort", "Sort")}</p>
        <Select value={sortBy} onValueChange={(newSortBy) => {
          setSortBy(newSortBy);
          applyFilters({
            category_id: selectedCategory?.id || null,
            price_min: priceRange[0] > 0 ? priceRange[0] : null,
            price_max: priceRange[1] < 10000 ? priceRange[1] : null,
            location: location || null,
            catalog_fields: dynamicFilters,
            verified_only: verifiedOnly,
            condition,
            sort_by: newSortBy,
          });
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">{tr("search.sortRelevance", "Relevance")}</SelectItem>
            <SelectItem value="price_asc">{tr("search.sortPriceAsc", "Price: low to high")}</SelectItem>
            <SelectItem value="price_desc">{tr("search.sortPriceDesc", "Price: high to low")}</SelectItem>
            <SelectItem value="created_at_desc">{tr("search.sortNewest", "Newest first")}</SelectItem>
            <SelectItem value="created_at_asc">{tr("search.sortOldest", "Oldest first")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Location Filter */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">
          {tr("search.location", "Location")}
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
              placeholder={tr("search.locationPlaceholder", "City or region")}
              className="h-11 pl-9"
            />
          </div>
          {isLocationSuggestionsOpen && (
            <div
              ref={locationSuggestionsRef}
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-52 overflow-y-auto rounded-xl border border-border/70 bg-card shadow-[var(--shadow-card)]"
            >
              {locationSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleLocationSelect(suggestion)}
                  className="flex min-h-[44px] w-full cursor-pointer items-center border-b border-border/60 px-4 py-2.5 text-left text-sm transition hover:bg-secondary/70 last:border-b-0"
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
          {tr("search.filters", "Filters")}
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
    </div>
  );

  const filtersFooter = (
    <div className="flex gap-2">
      <Button onClick={handleApplyFilters} className="h-11 flex-1">
        {tr("search.apply", "Apply")}
      </Button>
      <Button variant="outline" onClick={handleClearAll} className="h-11 px-5">
        {tr("search.clear", "Clear")}
      </Button>
    </div>
  );

  // Sidebar variant (desktop)
  if (actualVariant === "sidebar") {
    return (
      <aside className="w-72 shrink-0 rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="mb-5 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-extrabold tracking-tight">{tr("search.filters", "Filters")}</h2>
        </div>
        {filtersContent}
        <div className="mt-6 border-t border-border/70 pt-4">{filtersFooter}</div>
      </aside>
    );
  }

  // Drawer variant (mobile)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-11 w-full gap-2 rounded-xl md:hidden">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {tr("search.filters", "Filters")}
          {activeFilters.length > 0 && (
            <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              {activeFilters.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[90vw] max-w-sm flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b border-border/70 px-4 py-4">
          <SheetTitle className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
            {tr("search.filters", "Filters")}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-5">{filtersContent}</div>
        <div className="sticky bottom-0 border-t border-border/70 bg-card px-4 py-4 shadow-[var(--shadow-card)]">
          {filtersFooter}
        </div>
      </SheetContent>
    </Sheet>
  );
}
