/**
 * Helper functions for category name localization
 * Provides fallback logic for missing translations
 */

import type { Locale } from "../i18n";

export interface Category {
  id: string;
  slug: string;
  name_en: string | null;
  name_nl: string | null;
  name_fr: string | null;
  name_ru: string | null;
  name_de: string | null;
  [key: string]: any;
}

/**
 * Get localized category name with fallback logic
 * Priority: requested locale → EN → RU → slug
 * 
 * @param category Category object with translations
 * @param locale Requested locale (en, nl, fr, ru, de)
 * @returns Localized category name or fallback
 * 
 * @example
 * ```ts
 * const category = { slug: 'transport', name_en: 'Transport', name_de: 'Transport', ... };
 * getCategoryName(category, 'de'); // 'Transport'
 * getCategoryName(category, 'zh'); // Falls back to EN or RU
 * ```
 */
export function getCategoryName(category: Category, locale: Locale): string {
  // Map locale to column name
  const localeMap: Record<Locale, keyof Category> = {
    en: "name_en",
    nl: "name_nl",
    fr: "name_fr",
    ru: "name_ru",
    de: "name_de",
  };

  // Try requested locale
  const field = localeMap[locale];
  if (field && category[field]) {
    return category[field] as string;
  }

  // Fallback chain: EN → RU → slug
  if (category.name_en) return category.name_en;
  if (category.name_ru) return category.name_ru;
  
  // Last resort: use slug (capitalized and cleaned)
  return category.slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get multiple category names at once
 * Useful for rendering category trees or breadcrumbs
 * 
 * @param categories Array of categories
 * @param locale Requested locale
 * @returns Array of localized names in same order
 * 
 * @example
 * ```ts
 * const categories = [cat1, cat2, cat3];
 * const names = getCategoryNames(categories, 'de');
 * // ['Transport', 'Autos', 'Gebrauchtwagen']
 * ```
 */
export function getCategoryNames(categories: Category[], locale: Locale): string[] {
  return categories.map(cat => getCategoryName(cat, locale));
}

/**
 * Build category path string (for breadcrumbs)
 * 
 * @param categories Array of categories from root to leaf
 * @param locale Requested locale
 * @param separator Path separator (default: ' › ')
 * @returns Formatted category path
 * 
 * @example
 * ```ts
 * const path = [root, parent, child];
 * getCategoryPath(path, 'de'); // 'Transport › Autos › Gebrauchtwagen'
 * getCategoryPath(path, 'en', ' / '); // 'Transport / Cars / Used Cars'
 * ```
 */
export function getCategoryPath(
  categories: Category[], 
  locale: Locale, 
  separator: string = " › "
): string {
  return getCategoryNames(categories, locale).join(separator);
}




