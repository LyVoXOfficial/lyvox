import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest, categoryTreeQuerySchema } from "@/lib/validations";
import type { Category } from "@/lib/types";
import { resolveLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";

// Cache categories tree for 1 hour (3600 seconds)
// This is a public endpoint with relatively stable data
export const revalidate = 3600;

/**
 * Type for category with localized name and children
 */
type CategoryTreeNode = {
  id: string;
  parent_id: string | null;
  slug: string;
  level: number;
  name: string; // Localized name
  path: string;
  sort: number | null;
  icon: string | null;
  is_active: boolean | null;
  children?: CategoryTreeNode[];
};

/**
 * Get localized category name based on locale
 */
function getLocalizedCategoryName(cat: Category & { name_de?: string | null }, locale: Locale): string {
  // Map locale to field name (including name_de which may exist in DB but not in type)
  const localeMap: Record<Locale, keyof (Category & { name_de?: string | null })> = {
    en: "name_en",
    nl: "name_nl",
    fr: "name_fr",
    de: "name_de",
    ru: "name_ru",
  };
  
  const nameKey = localeMap[locale] || "name_ru";
  const name = (cat[nameKey] as string | null | undefined);
  
  // Fallback chain: requested locale -> ru -> en -> nl -> fr -> de -> empty string
  return name || cat.name_ru || cat.name_en || cat.name_nl || cat.name_fr || (cat as any).name_de || "";
}

/**
 * Build recursive category tree from flat array
 */
function buildCategoryTree(
  categories: Category[],
  locale: Locale
): CategoryTreeNode[] {
  const categoryMap = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  // First pass: create all nodes with localized names
  categories.forEach((cat) => {
    const node: CategoryTreeNode = {
      id: cat.id,
      parent_id: cat.parent_id,
      slug: cat.slug,
      level: cat.level,
      name: getLocalizedCategoryName(cat, locale),
      path: cat.path,
      sort: cat.sort,
      icon: cat.icon,
      is_active: cat.is_active,
      children: [],
    };
    categoryMap.set(cat.id, node);
  });

  // Second pass: build tree structure
  categories.forEach((cat) => {
    const node = categoryMap.get(cat.id)!;
    if (cat.parent_id) {
      const parent = categoryMap.get(cat.parent_id);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort categories by sort order or name
  const sortCategories = (cats: CategoryTreeNode[]): CategoryTreeNode[] => {
    return [...cats]
      .sort((a, b) => {
        // First by sort order
        if (a.sort !== null && b.sort !== null) {
          return a.sort - b.sort;
        }
        if (a.sort !== null) return -1;
        if (b.sort !== null) return 1;
        // Then by localized name
        return a.name.localeCompare(b.name, locale);
      })
      .map((cat) => ({
        ...cat,
        children: cat.children && cat.children.length > 0
          ? sortCategories(cat.children)
          : undefined,
      }));
  };

  return sortCategories(roots);
}

/**
 * GET /api/categories/tree
 * 
 * Returns a recursive tree of all active categories with localized names.
 * 
 * Query parameters:
 * - locale: Locale for category names (en, fr, nl, ru, de). Default: en
 * 
 * Returns: Tree structure with localized category names
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const queryParams: Record<string, string | undefined> = {};
  
  // Extract query parameters
  const localeParam = url.searchParams.get("locale");
  if (localeParam) {
    queryParams.locale = localeParam;
  }

  // Validate query parameters
  const validationResult = validateRequest(categoryTreeQuerySchema, queryParams);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { locale } = validationResult.data;
  const resolvedLocale = resolveLocale(locale);

  const supabase = supabaseServer();

  // Fetch all active categories from database
  // Categories are public data, so no authentication required
  // Note: name_de may exist in DB but not in TypeScript type - we'll handle it dynamically
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, parent_id, slug, level, name_ru, name_en, name_nl, name_fr, path, sort, icon, is_active")
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .order("name_ru", { ascending: true });

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  if (!categories || categories.length === 0) {
    return createSuccessResponse({
      tree: [],
    });
  }

  // Build recursive tree structure with localized names
  const tree = buildCategoryTree(categories as Category[], resolvedLocale);

  return createSuccessResponse({
    tree,
    locale: resolvedLocale,
    count: categories.length,
  });
}

