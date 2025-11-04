import type { Category } from "@/lib/types";

export type BreadcrumbItem = {
  label: string;
  href: string;
};

/**
 * Get localized category name based on locale
 */
export function getLocalizedCategoryName(cat: Category, locale: string): string {
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

/**
 * Build breadcrumbs from category path
 * @param categoryPath - Full category path (e.g., "transport/cars")
 * @param categories - Array of category objects with all paths
 * @param locale - Current locale for localization
 * @param basePath - Base path for breadcrumb links (default: "/c")
 * @returns Array of breadcrumb items
 */
export function buildCategoryBreadcrumbs(
  categoryPath: string,
  categories: Category[],
  locale: string,
  basePath: string = "/c"
): BreadcrumbItem[] {
  if (!categoryPath) {
    return [];
  }

  // Split path into segments
  const pathSegments = categoryPath.split("/").filter(Boolean);
  
  // Build paths for each level
  const crumbPaths = pathSegments.map((_, idx, arr) => 
    arr.slice(0, idx + 1).join("/")
  );

  // Create a map of path -> category for quick lookup
  const categoryByPath = new Map<string, Category>();
  categories.forEach((cat) => {
    if (cat.path) {
      categoryByPath.set(cat.path, cat);
    }
  });

  // Build breadcrumb items
  const breadcrumbs: BreadcrumbItem[] = [];
  crumbPaths.forEach((path) => {
    const category = categoryByPath.get(path);
    if (category) {
      const name = getLocalizedCategoryName(category, locale);
      breadcrumbs.push({
        label: name,
        href: `${basePath}/${path}`,
      });
    } else {
      // Fallback: use slug from path
      const slug = path.split("/").pop() ?? path;
      const name = slug.replace(/-/g, " ");
      breadcrumbs.push({
        label: name,
        href: `${basePath}/${path}`,
      });
    }
  });

  return breadcrumbs;
}

