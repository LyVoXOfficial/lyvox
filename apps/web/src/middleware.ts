import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  isSupportedLocale,
  localeCookieName,
  localeHeaderName,
  localizePath,
  pathnameHeaderName,
  resolveFromAcceptLanguage,
  resolveLocale,
  stripLocalePrefix,
  type Locale,
} from "@/lib/i18n";

const AUTH_COOKIE_PREFIXES = ["sb", "supabase", "supabase-auth-token"];
const PROTECTED_PREFIXES = [
  "/profile",
  "/verify",
  "/debug",
  "/admin",
  "/post",
  "/api/profile",
  "/api/favorites",
  "/api/comparison",
  "/api/media",
  "/api/me",
  "/api/reports",
];
const AUTH_ROUTES = ["/login", "/register"];

function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function getPreferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  if (cookieLocale) {
    return resolveLocale(cookieLocale);
  }

  return resolveFromAcceptLanguage(request.headers.get("accept-language"));
}

function setLocaleCookie(response: NextResponse, locale: Locale) {
  response.cookies.set(localeCookieName, locale, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    httpOnly: false,
  });
}

function getLocaleRouting(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const stripped = stripLocalePrefix(pathname);
  const locale = stripped.locale ?? defaultLocale;
  const internalPathname = stripped.pathname;
  const hasLocalePrefix = stripped.locale !== null;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(localeHeaderName, locale);
  requestHeaders.set(pathnameHeaderName, internalPathname);

  return {
    locale,
    internalPathname,
    hasLocalePrefix,
    shouldRewrite: hasLocalePrefix && internalPathname !== pathname,
    requestHeaders,
  };
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/") {
    const locale = getPreferredLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = localizePath("/", locale);
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Vary", "Accept-Language, Cookie");
    response.headers.set("Cache-Control", "private, max-age=300");
    setLocaleCookie(response, locale);
    return response;
  }

  const routing = getLocaleRouting(request);
  const makeResponse = () => {
    if (!routing.shouldRewrite) {
      return NextResponse.next({
        request: {
          headers: routing.requestHeaders,
        },
      });
    }

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = routing.internalPathname;
    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: routing.requestHeaders,
      },
    });
  };

  let supabaseResponse = makeResponse();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = makeResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) =>
      AUTH_COOKIE_PREFIXES.some(
        (prefix) =>
          name === prefix || name.startsWith(`${prefix}-`) || name.startsWith(`${prefix}:`),
      ),
    );

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathMatches(routing.internalPathname, prefix),
  );
  const isAuthRoute = AUTH_ROUTES.includes(routing.internalPathname);
  const needsAuthCheck = isProtectedRoute || isAuthRoute || hasAuthCookie;

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;

  if (needsAuthCheck) {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    user = currentUser ?? null;

    if (isProtectedRoute && !user) {
      const url = request.nextUrl.clone();
      url.pathname = routing.hasLocalePrefix
        ? localizePath("/login", routing.locale)
        : "/login";
      url.search = "";
      url.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }

    if (user && isAuthRoute) {
      return NextResponse.redirect(
        new URL(
          routing.hasLocalePrefix ? localizePath("/profile", routing.locale) : "/profile",
          request.url,
        ),
      );
    }
  }

  if (routing.hasLocalePrefix && isSupportedLocale(routing.locale)) {
    setLocaleCookie(supabaseResponse, routing.locale);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
