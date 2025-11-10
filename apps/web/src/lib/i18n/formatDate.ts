import type { Locale } from "@/lib/i18n";

/**
 * Format a date with locale-specific formatting
 * @param date - Date object or ISO string
 * @param locale - The locale to use for formatting
 * @param format - Format type: 'short', 'long', or 'relative'
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  locale: Locale,
  format: "short" | "long" | "relative" = "short"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return "";
  }

  // Map locales to Intl locale strings
  const localeMap: Record<Locale, string> = {
    en: "en-US",
    ru: "ru-RU",
    nl: "nl-BE",
    fr: "fr-BE",
    de: "de-BE",
  };

  const intlLocale = localeMap[locale] || "en-US";

  if (format === "relative") {
    return formatRelativeDate(dateObj, locale);
  }

  try {
    const options: Intl.DateTimeFormatOptions =
      format === "long"
        ? {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }
        : {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          };

    return new Intl.DateTimeFormat(intlLocale, options).format(dateObj);
  } catch (error) {
    // Fallback
    return dateObj.toLocaleDateString();
  }
}

/**
 * Format a date as relative time (e.g., "2 hours ago", "2 часа назад")
 * @param date - Date object
 * @param locale - The locale to use
 * @returns Relative time string
 */
function formatRelativeDate(date: Date, locale: Locale): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const localeMap: Record<Locale, string> = {
    en: "en-US",
    ru: "ru-RU",
    nl: "nl-BE",
    fr: "fr-BE",
    de: "de-BE",
  };

  const intlLocale = localeMap[locale] || "en-US";

  try {
    const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });

    if (Math.abs(diffYears) >= 1) {
      return rtf.format(-diffYears, "year");
    } else if (Math.abs(diffMonths) >= 1) {
      return rtf.format(-diffMonths, "month");
    } else if (Math.abs(diffDays) >= 1) {
      return rtf.format(-diffDays, "day");
    } else if (Math.abs(diffHours) >= 1) {
      return rtf.format(-diffHours, "hour");
    } else if (Math.abs(diffMinutes) >= 1) {
      return rtf.format(-diffMinutes, "minute");
    } else {
      return rtf.format(-diffSeconds, "second");
    }
  } catch (error) {
    // Fallback to simple formatting
    if (diffDays > 0) {
      return `${diffDays} ${locale === "ru" ? "дней назад" : "days ago"}`;
    } else if (diffHours > 0) {
      return `${diffHours} ${locale === "ru" ? "часов назад" : "hours ago"}`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} ${locale === "ru" ? "минут назад" : "minutes ago"}`;
    } else {
      return locale === "ru" ? "только что" : "just now";
    }
  }
}
