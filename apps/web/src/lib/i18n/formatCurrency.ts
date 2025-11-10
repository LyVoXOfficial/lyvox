import type { Locale } from "@/lib/i18n";

/**
 * Format a number as currency with locale-specific formatting
 * @param amount - The amount to format
 * @param locale - The locale to use for formatting
 * @param currency - The currency code (default: EUR)
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  locale: Locale,
  currency: string = "EUR"
): string {
  // Map locales to Intl locale strings
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    ru: "ru-RU",
    nl: "nl-BE", // Belgium Dutch
    fr: "fr-BE", // Belgium French
    de: "de-BE", // Belgium German
  };

  const intlLocale = localeMap[locale] || "en-US";

  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback to simple formatting if Intl is not available
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Format a number as currency without currency symbol (for display in tables, etc.)
 * @param amount - The amount to format
 * @param locale - The locale to use for formatting
 * @returns Formatted number string
 */
export function formatCurrencyAmount(
  amount: number,
  locale: Locale
): string {
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    ru: "ru-RU",
    nl: "nl-BE",
    fr: "fr-BE",
    de: "de-BE",
  };

  const intlLocale = localeMap[locale] || "en-US";

  try {
    return new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    return amount.toFixed(2);
  }
}
