import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

export async function middleware(request: NextRequest) {
  const res = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Supabase auth session hydration
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  await supabase.auth.getSession().catch(() => {});

  // i18n locale handling
  const url = request.nextUrl;

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
  // Next.js 16 compatible matcher - exclude Next.js internals and static files
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt, sitemap.xml (SEO files)
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
