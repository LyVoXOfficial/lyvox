import { type Locale } from "@/lib/i18n";

export function formatDate(value: string | number | Date, locale: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  try {
    return new Intl.DateTimeFormat(localeMap(locale), options).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatCurrency(amount: number, locale: Locale, currency: string = "EUR") {
  try {
    return new Intl.NumberFormat(localeMap(locale), { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return amount.toFixed(2) + " " + currency;
  }
}

function localeMap(locale: Locale): string {
  // Map our short codes to full BCP47 tags if needed
  switch (locale) {
    case "en":
      return "en-GB";
    case "fr":
      return "fr-FR";
    case "nl":
      return "nl-NL";
    case "ru":
      return "ru-RU";
    default:
      return "en-GB";
  }
}

