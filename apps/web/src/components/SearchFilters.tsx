"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabaseClient";
import type { Category } from "@/lib/types";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { ChevronRight, ChevronDown, X, MapPin, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { logger } from "@/lib/errorLogger";
import type { CatalogSchema, CatalogFieldDefinition } from "@/catalog/renderer";
// PERF-07 item 3: the catalog FormRenderer widget tree only renders after a
// category with a dynamic schema is selected — never on the initial /search
// (which is robots:noindex anyway). A static import forced ~24kB into the
// search route's first-load JS. Load it on demand; the sidebar rail (initial
// content) stays eager. Named export → resolve it inside the dynamic import.
const FormRenderer = dynamic(() => import("@/catalog/renderer").then((m) => m.FormRenderer));
import { detectCategoryType } from "@/lib/utils/categoryDetector";
import { buildSearchRequestParams } from "@/lib/search/buildSearchParams";
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
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
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
const RADIUS_OPTIONS = [10, 20, 50, 100] as const;
const GEO_LOCATIONS = [
  { city: "Brussel", region: "Brussels", lat: 50.8503, lng: 4.3517 },
  { city: "Antwerpen", region: "Flanders", lat: 51.2194, lng: 4.4025 },
  { city: "Gent", region: "Flanders", lat: 51.0543, lng: 3.7174 },
  { city: "Charleroi", region: "Wallonia", lat: 50.4114, lng: 4.4446 },
  { city: "Liège", region: "Wallonia", lat: 50.6326, lng: 5.5797 },
  { city: "Brugge", region: "Flanders", lat: 51.2093, lng: 3.2247 },
  { city: "Namur", region: "Wallonia", lat: 50.4674, lng: 4.872 },
  { city: "Leuven", region: "Flanders", lat: 50.8798, lng: 4.7005 },
  { city: "Mechelen", region: "Flanders", lat: 51.0257, lng: 4.4776 },
  { city: "Aalst", region: "Flanders", lat: 50.9378, lng: 4.0409 },
  { city: "Kortrijk", region: "Flanders", lat: 50.8285, lng: 3.2649 },
  { city: "Hasselt", region: "Flanders", lat: 50.9307, lng: 5.3378 },
  { city: "Oostende", region: "Flanders", lat: 51.2154, lng: 2.9286 },
  { city: "Genk", region: "Flanders", lat: 50.965, lng: 5.5 },
  { city: "Sint-Niklaas", region: "Flanders", lat: 51.1656, lng: 4.1437 },
  { city: "Turnhout", region: "Flanders", lat: 51.3227, lng: 4.9447 },
  { city: "Roeselare", region: "Flanders", lat: 50.9443, lng: 3.1264 },
  { city: "Mons", region: "Wallonia", lat: 50.4542, lng: 3.9563 },
  { city: "Tournai", region: "Wallonia", lat: 50.6071, lng: 3.3893 },
  { city: "Geel", region: "Flanders", lat: 51.165, lng: 4.99 },
  { city: "Wavre", region: "Wallonia", lat: 50.7167, lng: 4.6 },
  { city: "Nivelles", region: "Wallonia", lat: 50.5983, lng: 4.3286 },
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
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(50);
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
  const schemaCache = useRef<Map<string, CatalogSchemaState>>(new Map());
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [condition, setCondition] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("created_at_desc");

  // T14 item 5 — unified filter model.
  // Desktop: no "instant + Apply" duality — changes commit via a 300ms debounce.
  // Mobile drawer: changes buffer until Apply, which shows a live "Show N" count.
  // Debouncer keeps its timer in a closure (not a React ref) so it stays outside
  // the render path — the filter-chip onRemove closures call applyFilters.
  const debouncedCommit = useMemo(() => {
    const state: { timer: number | null } = { timer: null };
    return {
      run(fn: () => void) {
        if (state.timer) window.clearTimeout(state.timer);
        state.timer = window.setTimeout(fn, 300);
      },
      cancel() {
        if (state.timer) window.clearTimeout(state.timer);
        state.timer = null;
      },
    };
  }, []);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const previewReqRef = useRef(0);

  // Cancel any pending debounced commit on unmount.
  useEffect(() => () => debouncedCommit.cancel(), [debouncedCommit]);

  // Initialize from URL params
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const categoryId = searchParams.get("category_id");
      const priceMin = searchParams.get("price_min");
      const priceMax = searchParams.get("price_max");
      const locationParam = searchParams.get("location");
      const latParam = searchParams.get("lat");
      const lngParam = searchParams.get("lng");
      const radiusParam = searchParams.get("radius_km");
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

      setLocation(locationParam ?? "");
      const parsedLat = latParam ? Number.parseFloat(latParam) : null;
      const parsedLng = lngParam ? Number.parseFloat(lngParam) : null;
      setLocationLat(parsedLat !== null && Number.isFinite(parsedLat) ? parsedLat : null);
      setLocationLng(parsedLng !== null && Number.isFinite(parsedLng) ? parsedLng : null);

      const parsedRadius = radiusParam ? Number.parseInt(radiusParam, 10) : 50;
      setRadiusKm(RADIUS_OPTIONS.includes(parsedRadius as (typeof RADIUS_OPTIONS)[number]) ? parsedRadius : 50);

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
    return GEO_LOCATIONS
      .filter((loc) => {
        const city = loc.city.toLowerCase();
        const region = loc.region.toLowerCase();
        return city.includes(query) || region.includes(query);
      })
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

    const buildInitialFilters = (fieldMap: Record<string, CatalogFieldDefinition>) => {
      const initialFilters: Record<string, unknown> = {};
      searchParams.forEach((value, key) => {
        if (!key.startsWith("catalog_field_")) return;
        const fieldKey = key.replace("catalog_field_", "");
        const fieldDef = fieldMap[fieldKey];
        if (!fieldDef) return;
        let parsed: unknown = value;
        if (fieldDef.field_type === "number") {
          const numericValue = Number(value);
          if (Number.isNaN(numericValue)) return;
          parsed = numericValue;
        } else if (fieldDef.field_type === "boolean") {
          parsed = value === "true";
        }
        initialFilters[fieldKey] = parsed;
      });
      return initialFilters;
    };

    const loadSchema = async () => {
      const cacheKey = selectedCategory.id;
      const cached = schemaCache.current.get(cacheKey);
      if (cached && !cached.loading && !cached.error) {
        setFilterSchemaState(cached);
        setDynamicFilters(buildInitialFilters(cached.fields));
        return;
      }

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

        const newState: CatalogSchemaState = {
          loading: false,
          error: null,
          schema,
          fields: fieldMap,
        };
        schemaCache.current.set(cacheKey, newState);
        setFilterSchemaState(newState);
        setDynamicFilters(buildInitialFilters(fieldMap));
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
    applyFilters({
      category_id: selectedCategory?.id || null,
      price_min: range[0] > 0 ? range[0] : null,
      price_max: range[1] < 10000 ? range[1] : null,
      location: location || null,
      catalog_fields: dynamicFilters,
      verified_only: verifiedOnly,
      condition,
      sort_by: sortBy,
    });
  };

  const handleLocationSelect = (selectedLocation: (typeof GEO_LOCATIONS)[number]) => {
    setLocation(selectedLocation.city);
    setLocationLat(selectedLocation.lat);
    setLocationLng(selectedLocation.lng);
    setShowLocationSuggestions(false);
    applyFilters({
      category_id: selectedCategory?.id || null,
      price_min: priceRange[0] > 0 ? priceRange[0] : null,
      price_max: priceRange[1] < 10000 ? priceRange[1] : null,
      location: selectedLocation.city,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      radius_km: radiusKm,
      catalog_fields: dynamicFilters,
      verified_only: verifiedOnly,
      condition,
      sort_by: sortBy,
    });
  };

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setLocationLat(null);
    setLocationLng(null);
    setShowLocationSuggestions(true);
  };

  const buildMergedFilters = (filters: SearchFiltersState): SearchFiltersState => ({
    category_id: filters.category_id,
    price_min: filters.price_min,
    price_max: filters.price_max,
    location: filters.location,
    lat: filters.location ? (filters.lat === undefined ? locationLat : filters.lat) : null,
    lng: filters.location ? (filters.lng === undefined ? locationLng : filters.lng) : null,
    radius_km: filters.radius_km === undefined ? radiusKm : filters.radius_km,
    catalog_fields: filters.catalog_fields ?? dynamicFilters,
    verified_only: filters.verified_only ?? verifiedOnly,
    condition: filters.condition ?? condition,
    sort_by: filters.sort_by ?? sortBy,
  });

  // Navigation is owned by the page (via onFiltersChange → router.push). This
  // component no longer pushes to the router itself, removing the previous
  // double-navigation. Desktop debounces (300ms); the mobile drawer commits only
  // when Apply / Clear is pressed (force).
  const applyFilters = (filters: SearchFiltersState, force = false) => {
    const mergedFilters = buildMergedFilters(filters);

    if (actualVariant === "drawer") {
      // Buffer: local state already updated the UI; count preview reacts to state.
      // Only Apply / Clear (force) commits the navigation.
      if (force) {
        debouncedCommit.cancel();
        onFiltersChange?.(mergedFilters);
      }
      return;
    }

    // Sidebar (desktop): debounce the commit so slider drags / rapid toggles
    // coalesce into a single navigation.
    if (force) {
      debouncedCommit.cancel();
      onFiltersChange?.(mergedFilters);
      return;
    }
    debouncedCommit.run(() => onFiltersChange?.(mergedFilters));
  };

  // Mobile drawer: live "Show N" preview of how many results the currently
  // buffered filters would return, so Apply is not a leap in the dark. Debounced
  // 300ms and request-id guarded; only runs while the drawer is open, and uses a
  // real count (limit=1, ?instant=1 bucket) — never an estimate.
  useEffect(() => {
    if (actualVariant !== "drawer" || !open) return;
    const id = ++previewReqRef.current;
    const timer = window.setTimeout(() => {
      const cf = new URLSearchParams();
      Object.entries(dynamicFilters).forEach(([key, value]) => {
        if (
          value === null ||
          value === undefined ||
          (typeof value === "string" && value.trim() === "") ||
          (typeof value === "number" && Number.isNaN(value))
        ) {
          return;
        }
        cf.set(`catalog_field_${key}`, typeof value === "boolean" ? (value ? "true" : "false") : String(value));
      });

      const params = buildSearchRequestParams({
        query: searchParams.get("q") || undefined,
        categoryId: selectedCategory?.id || null,
        priceMin: priceRange[0] > 0 ? String(priceRange[0]) : null,
        priceMax: priceRange[1] < 10000 ? String(priceRange[1]) : null,
        location: location || null,
        lat: locationLat != null ? String(locationLat) : null,
        lng: locationLng != null ? String(locationLng) : null,
        radiusKm: String(radiusKm),
        sortBy,
        page: 0,
        limit: 1,
        verifiedOnly,
        condition,
        sourceParams: cf,
      });
      params.set("instant", "1");

      void fetch(`/api/search?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (id !== previewReqRef.current) return;
          if (body?.ok && body?.data && typeof body.data.total === "number") {
            setPreviewCount(body.data.total);
          }
        })
        .catch(() => {});
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    actualVariant,
    open,
    selectedCategory,
    priceRange,
    location,
    locationLat,
    locationLng,
    radiusKm,
    verifiedOnly,
    condition,
    sortBy,
    dynamicFilters,
    searchParams,
  ]);

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
    }, true);
  };

  const handleClearAll = () => {
    setSelectedCategory(null);
    setPriceRange([0, 10000]);
    setLocation("");
    setLocationLat(null);
    setLocationLng(null);
    setRadiusKm(50);
    setDynamicFilters({});
    setVerifiedOnly(false);
    setCondition(null);
    setSortBy("created_at_desc");
    applyFilters({
      category_id: null,
      price_min: null,
      price_max: null,
      location: null,
      lat: null,
      lng: null,
      radius_km: null,
      catalog_fields: {},
      verified_only: false,
      condition: null,
      sort_by: "created_at_desc",
    }, true);
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
        setLocationLat(null);
        setLocationLng(null);
        applyFilters({
          category_id: selectedCategory?.id || null,
          price_min: priceRange[0] > 0 ? priceRange[0] : null,
          price_max: priceRange[1] < 10000 ? priceRange[1] : null,
          location: null,
          lat: null,
          lng: null,
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
        <div className="flex items-center justify-between mb-2.5">
          <p
            className="font-bold uppercase tracking-widest text-muted-foreground"
            style={{ fontSize: "12px", letterSpacing: "0.05em" }}
          >
            {tr("search.category", "Category")}
          </p>
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
        <p
          className="mb-3 font-bold uppercase tracking-widest text-muted-foreground"
          style={{ fontSize: "12px", letterSpacing: "0.05em" }}
        >
          {tr("search.price", "Price (€)")}
        </p>
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
                handlePriceRangeChange([Math.min(val, priceRange[1]), priceRange[1]]);
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
                handlePriceRangeChange([priceRange[0], Math.max(val, priceRange[0])]);
              }}
              className="h-11 flex-1"
              placeholder={tr("filters.max", "Max")}
            />
          </div>
        </div>
      </div>

      {/* Verified Sellers Filter — toggle-switch with proper ARIA role=switch */}
      <div
        className="border-t border-border/70"
        style={{ paddingTop: "16px", marginTop: "4px" }}
      >
        <button
          type="button"
          role="switch"
          aria-checked={verifiedOnly}
          onClick={() => {
            const value = !verifiedOnly;
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
          className="flex w-full cursor-pointer items-center gap-3 font-semibold text-left"
          style={{ fontSize: "13.5px" }}
        >
          <span
            className="relative shrink-0 transition-colors"
            style={{
              width: "36px",
              height: "21px",
              borderRadius: "999px",
              background: verifiedOnly ? "var(--primary)" : "var(--border)",
            }}
            aria-hidden="true"
          >
            <span
              className="absolute top-[2px] transition-all"
              style={{
                width: "17px",
                height: "17px",
                borderRadius: "999px",
                background: "#fff",
                right: verifiedOnly ? "2px" : undefined,
                left: verifiedOnly ? undefined : "2px",
              }}
            />
          </span>
          {tr("search.verifiedOnly", "Verified sellers only")}
        </button>
      </div>

      {/* Condition Filter — pill-style (mockup line 353-357), same state/handler wiring */}
      <div>
        <p
          className="mb-2.5 font-bold uppercase tracking-widest text-muted-foreground"
          style={{ fontSize: "12px", letterSpacing: "0.05em" }}
        >
          {tr("search.condition", "Condition")}
        </p>
        <div className="flex flex-wrap gap-[7px]">
          {([
            ["new", tr("search.condition_new", "New")],
            ["used", tr("search.condition_used", "Used")],
            ["for_parts", tr("search.condition_for_parts", "For parts")],
          ] as const).map(([value, label]) => {
            const isActive = condition === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const newCondition = isActive ? null : value;
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
                className="inline-flex items-center font-bold transition"
                style={{
                  height: "30px",
                  padding: "0 12px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  background: isActive
                    ? "oklch(0.56 0.13 178 / 0.12)"
                    : "var(--card)",
                  border: isActive ? "none" : "1px solid var(--border)",
                  color: isActive ? "var(--priD)" : "var(--foreground)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort Filter */}
      <div className="space-y-2">
        <p
          className="font-bold uppercase tracking-widest text-muted-foreground"
          style={{ fontSize: "12px", letterSpacing: "0.05em" }}
        >
          {tr("search.sort", "Sort")}
        </p>
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
              {locationSuggestions.map((suggestion) => (
                <button
                  key={suggestion.city}
                  type="button"
                  onClick={() => handleLocationSelect(suggestion)}
                  className="flex min-h-[44px] w-full cursor-pointer flex-col items-start justify-center border-b border-border/60 px-4 py-2.5 text-left text-sm transition hover:bg-secondary/70 last:border-b-0"
                >
                  <span>{suggestion.city}</span>
                  <span className="text-xs text-muted-foreground">{suggestion.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <Label className="text-sm font-semibold">
            {tr("search.radius_label", "Radius")}
          </Label>
          <Select
            value={String(radiusKm)}
            onValueChange={(value) => {
              const nextRadius = Number.parseInt(value, 10);
              setRadiusKm(nextRadius);
              applyFilters({
                category_id: selectedCategory?.id || null,
                price_min: priceRange[0] > 0 ? priceRange[0] : null,
                price_max: priceRange[1] < 10000 ? priceRange[1] : null,
                location: location || null,
                lat: locationLat,
                lng: locationLng,
                radius_km: nextRadius,
                catalog_fields: dynamicFilters,
                verified_only: verifiedOnly,
                condition,
                sort_by: sortBy,
              });
            }}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RADIUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {tr(`search.radius_${option}`, `${option} km`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

  // Drawer footer only (desktop commits via debounce — no Apply button there).
  const filtersFooter = (
    <div className="flex gap-2">
      <Button onClick={handleApplyFilters} className="h-11 flex-1">
        {previewCount !== null
          ? tr("search.showN", "Show {count}").replace("{count}", String(previewCount))
          : tr("search.apply", "Apply")}
      </Button>
      <Button variant="outline" onClick={handleClearAll} className="h-11 px-5">
        {tr("search.clear", "Clear")}
      </Button>
    </div>
  );

  // Sidebar variant (desktop) — styled to mockup rail card (lines 344-362)
  if (actualVariant === "sidebar") {
    return (
      <aside
        className="w-full shrink-0"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r)",
          padding: "20px",
          boxShadow: "var(--shS)",
        }}
      >
        {/* Rail header: "Filters" + "Clear all" */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-extrabold" style={{ fontSize: "16px" }}>
            {tr("search.filters", "Filters")}
          </h2>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-semibold transition hover:opacity-70"
            style={{ fontSize: "12.5px", color: "var(--priD)" }}
          >
            {tr("search.clear", "Clear all")}
          </button>
        </div>
        {filtersContent}
      </aside>
    );
  }

  // Drawer variant (mobile) — styled to mockup filter pill (line 389)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-bold text-white transition hover:opacity-90"
          style={{
            height: "34px",
            padding: "0 13px",
            borderRadius: "999px",
            background: "var(--gC)",
            fontSize: "12.5px",
            whiteSpace: "nowrap",
          }}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          {tr("search.filters", "Filters")}
          {activeFilters.length > 0 && (
            <span className="ml-0.5">· {activeFilters.length}</span>
          )}
        </button>
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
