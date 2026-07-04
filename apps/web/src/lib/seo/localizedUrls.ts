import type { MetadataRoute } from "next";
import {
  defaultLocale,
  localizePath,
  supportedLocales,
  type Locale,
} from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo/baseUrl";

export function localizedAbsoluteUrl(path: string, locale: Locale): string {
  return absoluteUrl(localizePath(path, locale));
}

export function languageAlternates(path: string): Record<string, string> {
  const entries = supportedLocales.map((locale) => [
    locale,
    localizedAbsoluteUrl(path, locale),
  ]);

  return Object.fromEntries([
    ...entries,
    ["x-default", absoluteUrl(path)],
  ]);
}

export function localizedCanonical(path: string, locale: Locale): string {
  return localizedAbsoluteUrl(path, locale);
}

export function localizedSitemapEntries(
  path: string,
  entry: Omit<MetadataRoute.Sitemap[number], "url" | "alternates"> = {},
): MetadataRoute.Sitemap {
  const alternates = { languages: languageAlternates(path) };

  return supportedLocales.map((locale) => ({
    ...entry,
    url: localizedAbsoluteUrl(path, locale),
    alternates,
  }));
}

export function defaultLocaleUrl(path: string): string {
  return localizedAbsoluteUrl(path, defaultLocale);
}
