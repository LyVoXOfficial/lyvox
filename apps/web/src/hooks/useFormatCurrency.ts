"use client";

import { useI18n } from "@/i18n";
import { formatCurrency, formatCurrencyAmount } from "@/lib/i18n/formatCurrency";

/**
 * Hook for formatting currency values
 * @param currency - Currency code (default: EUR)
 * @returns Object with formatCurrency and formatCurrencyAmount functions
 */
export function useFormatCurrency(currency: string = "EUR") {
  const { locale } = useI18n();

  return {
    formatCurrency: (amount: number) => formatCurrency(amount, locale, currency),
    formatCurrencyAmount: (amount: number) => formatCurrencyAmount(amount, locale),
  };
}

