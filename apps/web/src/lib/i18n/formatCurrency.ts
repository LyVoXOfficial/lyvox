/**
 * Currency formatting utilities
 * Supports all project locales with proper currency display
 */

import type { Locale } from "../i18n";

/**
 * Format currency amount with locale-specific formatting
 * 
 * @param amount Amount in cents or decimal
 * @param locale Display locale
 * @param currency Currency code (default: EUR)
 * @param options Additional Intl.NumberFormat options
 * @returns Formatted currency string
 * 
 * @example
 * ```ts
 * formatCurrency(1500, 'de'); // '1.500 €'
 * formatCurrency(1500, 'en'); // '€1,500'
 * formatCurrency(1500.50, 'nl'); // '€ 1.500,50'
 * formatCurrency(1500, 'de', 'USD'); // '$1,500'
 * ```
 */
export function formatCurrency(
  amount: number,
  locale: Locale,
  currency: string = "EUR",
  options?: Intl.NumberFormatOptions
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  });

  return formatter.format(amount);
}

/**
 * Format currency with compact notation (1.5K, 2M, etc.)
 * 
 * @param amount Amount to format
 * @param locale Display locale
 * @param currency Currency code (default: EUR)
 * @returns Compact formatted currency string
 * 
 * @example
 * ```ts
 * formatCurrencyCompact(1500, 'en'); // '€1.5K'
 * formatCurrencyCompact(2500000, 'de'); // '2,5 Mio. €'
 * ```
 */
export function formatCurrencyCompact(
  amount: number,
  locale: Locale,
  currency: string = "EUR"
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });

  return formatter.format(amount);
}

/**
 * Format price range
 * 
 * @param min Minimum price
 * @param max Maximum price
 * @param locale Display locale
 * @param currency Currency code (default: EUR)
 * @returns Formatted price range string
 * 
 * @example
 * ```ts
 * formatPriceRange(1000, 5000, 'de'); // '1.000 € - 5.000 €'
 * formatPriceRange(1000, 5000, 'en'); // '€1,000 - €5,000'
 * ```
 */
export function formatPriceRange(
  min: number,
  max: number,
  locale: Locale,
  currency: string = "EUR"
): string {
  const minFormatted = formatCurrency(min, locale, currency);
  const maxFormatted = formatCurrency(max, locale, currency);
  
  return `${minFormatted} - ${maxFormatted}`;
}

/**
 * Parse currency string to number
 * Removes currency symbols and locale-specific formatting
 * 
 * @param value Currency string to parse
 * @param locale Source locale
 * @returns Parsed number or null if invalid
 * 
 * @example
 * ```ts
 * parseCurrency('€1,500', 'en'); // 1500
 * parseCurrency('1.500 €', 'de'); // 1500
 * parseCurrency('invalid', 'en'); // null
 * ```
 */
export function parseCurrency(value: string, locale: Locale): number | null {
  if (!value || typeof value !== "string") return null;
  
  // Remove currency symbols and whitespace
  let cleaned = value.replace(/[€$£¥₽\s]/g, "");
  
  // Handle locale-specific decimal separators
  if (locale === "de" || locale === "nl" || locale === "fr") {
    // European format: 1.500,50
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else {
    // English format: 1,500.50
    cleaned = cleaned.replace(/,/g, "");
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}









