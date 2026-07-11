import { NextResponse } from "next/server";
import { createRateLimiter, getClientIp } from "@/lib/rateLimiter";
import { verifyTurnstile } from "@/lib/antifraud/turnstile";
import { ACCESS_GATE_TURNSTILE_ACTION } from "@/lib/antifraud/turnstileConfig";
import { assertSameOrigin } from "@/lib/security/csrf";
import {
  ACCESS_GATE_COOKIE_NAME,
  accessGateCookieOptions,
  getAccessGateRuntime,
  issueAccessGateCookie,
  sanitizeAccessGateReturnTo,
  verifyAccessGateCode,
} from "@/lib/security/accessGate";
import {
  accessGatePageRedirect,
  assertAccessGateSameOrigin,
  readAccessGateForm,
} from "../_shared";

const unlockLimiter = createRateLimiter({
  limit: 8,
  windowSec: 5 * 60,
  prefix: "access-gate:unlock",
});

export async function POST(request: Request): Promise<Response> {
  const sharedCsrfError = assertSameOrigin(request);
  if (sharedCsrfError) return sharedCsrfError;
  const csrfError = assertAccessGateSameOrigin(request);
  if (csrfError) return csrfError;

  const runtime = getAccessGateRuntime();
  const accessCode = runtime.accessCode;
  const signingSecret = runtime.signingSecret;
  if (
    runtime.active &&
    (!runtime.configured || accessCode === null || signingSecret === null)
  ) {
    return accessGatePageRedirect(request, "/", "unavailable");
  }

  const clientIp = getClientIp(request);
  if (runtime.active) {
    const rateLimit = await unlockLimiter(clientIp ?? "unknown");
    if (!rateLimit.success) {
      const response = accessGatePageRedirect(request, "/", "rate_limited");
      response.headers.set("Retry-After", String(rateLimit.retryAfterSec));
      return response;
    }
  }

  const form = await readAccessGateForm(request);
  if (!form) {
    return NextResponse.json(
      { ok: false, error: "INVALID_FORM" },
      { status: 400 },
    );
  }

  const returnTo = sanitizeAccessGateReturnTo(form.get("returnTo"));
  if (!runtime.active)
    return NextResponse.redirect(new URL(returnTo, request.url), 303);
  if (accessCode === null || signingSecret === null) {
    return accessGatePageRedirect(request, "/", "unavailable");
  }

  const turnstileToken = form.get("turnstileToken");
  const turnstile = await verifyTurnstile(
    typeof turnstileToken === "string" ? turnstileToken : null,
    clientIp,
    {
      required: true,
      expectedAction: ACCESS_GATE_TURNSTILE_ACTION,
      expectedHostname: new URL(request.url).hostname,
    },
  );
  if (!turnstile.ok) {
    return accessGatePageRedirect(request, returnTo, "captcha");
  }

  const candidate = form.get("code");
  const valid =
    typeof candidate === "string" &&
    candidate.length <= 256 &&
    (await verifyAccessGateCode(candidate, accessCode));
  if (!valid) return accessGatePageRedirect(request, returnTo, "invalid");

  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(
    ACCESS_GATE_COOKIE_NAME,
    await issueAccessGateCookie(signingSecret),
    accessGateCookieOptions,
  );
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
