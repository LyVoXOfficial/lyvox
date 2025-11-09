/**
 * Date and time formatting utilities
 * Supports all project locales with proper date display
 */

import type { Locale } from "../i18n";

/**
 * Format date with locale-specific formatting
 * 
 * @param date Date to format (Date object, ISO string, or timestamp)
 * @param locale Display locale
 * @param options Intl.DateTimeFormat options
 * @returns Formatted date string
 * 
 * @example
 * ```ts
 * formatDate(new Date(), 'de'); // '2. November 2025'
 * formatDate('2025-11-02', 'en'); // 'November 2, 2025'
 * formatDate(new Date(), 'nl', { dateStyle: 'short' }); // '02-11-2025'
 * ```
 */
export function formatDate(
  date: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === "string" || typeof date === "number" 
    ? new Date(date) 
    : date;

  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  };

  const formatter = new Intl.DateTimeFormat(locale, defaultOptions);
  return formatter.format(dateObj);
}

/**
 * Format date and time
 * 
 * @param date Date to format
 * @param locale Display locale
 * @param options Additional options
 * @returns Formatted date and time string
 * 
 * @example
 * ```ts
 * formatDateTime(new Date(), 'de'); // '2. November 2025, 14:30'
 * formatDateTime(new Date(), 'en'); // 'November 2, 2025, 2:30 PM'
 * ```
 */
export function formatDateTime(
  date: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatDate(date, locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

/**
 * Format date in short format
 * 
 * @param date Date to format
 * @param locale Display locale
 * @returns Short formatted date string
 * 
 * @example
 * ```ts
 * formatDateShort(new Date(), 'de'); // '02.11.2025'
 * formatDateShort(new Date(), 'en'); // '11/02/2025'
 * formatDateShort(new Date(), 'nl'); // '02-11-2025'
 * ```
 */
export function formatDateShort(
  date: Date | string | number,
  locale: Locale
): string {
  return formatDate(date, locale, { dateStyle: "short" });
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 * 
 * @param date Date to compare
 * @param locale Display locale
 * @param baseDate Base date for comparison (default: now)
 * @returns Relative time string
 * 
 * @example
 * ```ts
 * const yesterday = new Date(Date.now() - 86400000);
 * formatRelativeTime(yesterday, 'en'); // '1 day ago'
 * formatRelativeTime(yesterday, 'de'); // 'vor 1 Tag'
 * ```
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale: Locale,
  baseDate: Date = new Date()
): string {
  const dateObj = typeof date === "string" || typeof date === "number" 
    ? new Date(date) 
    : date;

  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  const diffMs = dateObj.getTime() - baseDate.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);
  const diffWeeks = Math.round(diffDays / 7);
  const diffMonths = Math.round(diffDays / 30);
  const diffYears = Math.round(diffDays / 365);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diffSeconds) < 60) {
    return rtf.format(diffSeconds, "second");
  } else if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  } else if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  } else if (Math.abs(diffDays) < 7) {
    return rtf.format(diffDays, "day");
  } else if (Math.abs(diffWeeks) < 4) {
    return rtf.format(diffWeeks, "week");
  } else if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, "month");
  } else {
    return rtf.format(diffYears, "year");
  }
}

/**
 * Format time only (without date)
 * 
 * @param date Date to format
 * @param locale Display locale
 * @param use24Hour Use 24-hour format (default: true for EU locales)
 * @returns Formatted time string
 * 
 * @example
 * ```ts
 * formatTime(new Date(), 'de'); // '14:30'
 * formatTime(new Date(), 'en', false); // '2:30 PM'
 * ```
 */
export function formatTime(
  date: Date | string | number,
  locale: Locale,
  use24Hour: boolean = locale !== "en"
): string {
  return formatDate(date, locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !use24Hour,
  });
}

/**
 * Parse date string with locale awareness
 * 
 * @param value Date string to parse
 * @param locale Source locale (affects parsing logic)
 * @returns Date object or null if invalid
 * 
 * @example
 * ```ts
 * parseDate('02.11.2025', 'de'); // Date object
 * parseDate('11/02/2025', 'en'); // Date object
 * parseDate('2025-11-02', 'en'); // Date object (ISO format works for all)
 * ```
 */
export function parseDate(value: string, locale: Locale): Date | null {
  if (!value || typeof value !== "string") return null;
  
  // Try ISO format first (works universally)
  const isoDate = new Date(value);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try locale-specific parsing
  // This is a simplified version - for production, consider using a library like date-fns
  const parts = value.split(/[.\-\/]/);
  if (parts.length !== 3) return null;
  
  let year: number, month: number, day: number;
  
  if (locale === "en") {
    // MM/DD/YYYY or MM-DD-YYYY
    [month, day, year] = parts.map(p => parseInt(p, 10));
  } else {
    // DD.MM.YYYY or DD-MM-YYYY (EU format)
    [day, month, year] = parts.map(p => parseInt(p, 10));
  }
  
  if (year < 100) year += 2000; // Handle 2-digit years
  
  const parsed = new Date(year, month - 1, day);
  return isNaN(parsed.getTime()) ? null : parsed;
}







