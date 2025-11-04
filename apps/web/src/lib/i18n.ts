export const supportedLocales = ["en", "fr", "nl", "ru", "de"] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = "en";

const normaliseMap: Record<string, Locale> = {
  en: "en",
  "en-gb": "en",
  "en-us": "en",
  fr: "fr",
  "fr-fr": "fr",
  nl: "nl",
  "nl-nl": "nl",
  "nl-be": "nl",
  ru: "ru",
  "ru-ru": "ru",
  de: "de",
  "de-de": "de",
  "de-at": "de",
  "de-ch": "de",
};

export function resolveLocale(input?: string | null): Locale {
  if (!input) return defaultLocale;
  const key = input.trim().toLowerCase();
  if (!key) return defaultLocale;
  if (normaliseMap[key]) return normaliseMap[key];
  const match = supportedLocales.find((locale) => key === locale || key.startsWith(`${locale}-`));
  return match ?? defaultLocale;
}

export function resolveFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;
  const parts = header.split(',');
  for (const part of parts) {
    const [locale] = part.split(';');
    const resolved = resolveLocale(locale);
    if (resolved) return resolved;
  }
  return defaultLocale;
}
