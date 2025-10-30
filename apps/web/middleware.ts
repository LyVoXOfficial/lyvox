import { NextResponse, type NextRequest } from "next/server";

const supported = ["en", "fr", "nl", "ru", "de"] as const;
type Locale = typeof supported[number];
const defaultLocale: Locale = "en";

function resolveLocale(input?: string | null): Locale {
  if (!input) return defaultLocale;
  const key = input.trim().toLowerCase();
  const map: Record<string, Locale> = {
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
  return map[key] ?? (supported.find((l) => key.startsWith(l + "-")) ?? defaultLocale);
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const res = NextResponse.next();

  // 1) explicit ?lang= overrides and persists
  const lang = url.searchParams.get("lang");
  if (lang) {
    const locale = resolveLocale(lang);
    res.cookies.set("locale", locale, { httpOnly: false, path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  // 2) ensure locale cookie exists based on Accept-Language
  const cookieLocale = request.cookies.get("locale")?.value;
  if (!cookieLocale) {
    const header = request.headers.get("accept-language");
    const locale = resolveLocale(header?.split(",")[0] ?? undefined);
    res.cookies.set("locale", locale, { httpOnly: false, path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}

export const config = {
  // Run for all paths except Next internals and static assets
  matcher: ["/(?!_next|.*\.[\w-]+$).*"],
};
