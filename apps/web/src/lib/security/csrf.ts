/**
 * SEC-CSRF · explicit Origin/Sec-Fetch-Site assertion for mutating routes.
 *
 * De-facto CSRF protection today is only `SameSite=Lax` cookies + JSON bodies
 * (browsers won't attach cookies to a cross-site POST, and a cross-site
 * `<form>` can't set `Content-Type: application/json`). That holds, but it's
 * implicit — a future form-encoded or lenient-content-type mutating route
 * would silently reopen the hole. This makes the check explicit and
 * independent of cookie/body-shape behavior.
 *
 * Verification order (first match decides):
 *  1. `Origin` header present → its host must match the request's own host
 *     (`x-forwarded-host` on Vercel, else `Host`). Mismatch → reject.
 *  2. `Origin` absent, `Sec-Fetch-Site` present → reject only `cross-site`.
 *     (`same-origin`/`same-site`/`none` are all same-app or direct nav.)
 *  3. Neither header present → allow. Modern browsers always send at least
 *     one of these on state-changing fetch/XHR; their absence means a
 *     non-browser caller (cron, server-to-server, curl) that isn't relying on
 *     ambient cookies anyway, so there is nothing for CSRF to forge here.
 */
import { NextResponse } from "next/server";
import { createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";

function expectedHost(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-host");
  const host = forwarded || req.headers.get("host");
  return host ? host.trim().toLowerCase() : null;
}

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Returns a 403 `NextResponse` if the request fails the same-origin check,
 * or `null` if it passes. Call at the top of every mutating route handler:
 *
 *   const csrfError = assertSameOrigin(req);
 *   if (csrfError) return csrfError;
 */
export function assertSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");

  if (origin) {
    const host = originHost(origin);
    const expected = expectedHost(req);
    if (!host || !expected || host !== expected) {
      return createErrorResponse(ApiErrorCode.CSRF_ORIGIN_MISMATCH, {
        status: 403,
        detail: `Origin '${origin}' does not match request host`,
      });
    }
    return null;
  }

  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return createErrorResponse(ApiErrorCode.CSRF_ORIGIN_MISMATCH, {
      status: 403,
      detail: "Cross-site request rejected (Sec-Fetch-Site: cross-site)",
    });
  }

  return null;
}

type RouteHandler<TArgs extends unknown[] = []> = (req: Request, ...rest: TArgs) => Promise<Response>;

/**
 * Wraps a route handler with the same-origin assertion. Prefer this at the
 * `export const POST = withRateLimit(withCsrfProtection(handler), opts)`
 * composition site when the handler is already a named function value;
 * use the bare `assertSameOrigin` call inline when the handler is declared
 * as `export async function POST(...)`.
 */
export function withCsrfProtection<TArgs extends unknown[] = []>(
  handler: RouteHandler<TArgs>,
): RouteHandler<TArgs> {
  return async (req: Request, ...rest: TArgs) => {
    const csrfError = assertSameOrigin(req);
    if (csrfError) return csrfError;
    return handler(req, ...rest);
  };
}
