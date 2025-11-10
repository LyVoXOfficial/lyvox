import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
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
          supabaseResponse = NextResponse.next({
            request,
          });
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

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const needsAuthCheck = isProtectedRoute || isAuthRoute || hasAuthCookie;

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;

  if (needsAuthCheck) {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    user = currentUser ?? null;

    if (isProtectedRoute && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    if (user && isAuthRoute) {
      return NextResponse.redirect(new URL("/profile", request.url));
    }
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

