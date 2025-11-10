"use client";

import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/i18n/formatDate";

/**
 * Hook for formatting dates
 * @returns formatDate function with current locale
 */
export function useFormatDate() {
  const { locale } = useI18n();

  return {
    formatDate: (
      date: Date | string,
      format: "short" | "long" | "relative" = "short"
    ) => formatDate(date, locale, format),
  };
}

