export const supportedLocales = ["en", "fr", "nl", "ru", "de"] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = "en";
export const localeCookieName = "locale";
export const localeHeaderName = "x-lyvox-locale";
export const pathnameHeaderName = "x-lyvox-pathname";

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

export function isSupportedLocale(input?: string | null): input is Locale {
  return supportedLocales.includes(input as Locale);
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

function splitPathSuffix(path: string) {
  const hashIndex = path.indexOf("#");
  const queryIndex = path.indexOf("?");
  const suffixIndex =
    hashIndex === -1
      ? queryIndex
      : queryIndex === -1
        ? hashIndex
        : Math.min(queryIndex, hashIndex);

  if (suffixIndex === -1) {
    return { pathname: path, suffix: "" };
  }

  return {
    pathname: path.slice(0, suffixIndex),
    suffix: path.slice(suffixIndex),
  };
}

export function stripLocalePrefix(pathname: string): { locale: Locale | null; pathname: string } {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segments = normalized.split("/");
  const first = segments[1];

  if (!isSupportedLocale(first)) {
    return { locale: null, pathname: normalized || "/" };
  }

  const stripped = `/${segments.slice(2).join("/")}`.replace(/\/+$/, "");
  return {
    locale: first,
    pathname: stripped === "" ? "/" : stripped,
  };
}

export function localizePath(path: string, locale: Locale): string {
  const { pathname, suffix } = splitPathSuffix(path.startsWith("/") ? path : `/${path}`);
  const unlocalized = stripLocalePrefix(pathname).pathname;
  const prefix = `/${locale}`;
  return `${prefix}${unlocalized === "/" ? "" : unlocalized}${suffix}`;
}

export function localizeHref(href: string, locale: Locale): string {
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  ) {
    return href;
  }

  if (!href.startsWith("/")) {
    return href;
  }

  if (href === "/api" || href.startsWith("/api/")) {
    return href;
  }

  return localizePath(href, locale);
}
