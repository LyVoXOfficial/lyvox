import { verifyTurnstile } from "@/lib/antifraud/turnstile";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { verifyCaptchaSchema } from "@/lib/validations/antifraud";
import { withCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

// Generic Turnstile pre-check used by client-only Supabase Auth flows (login,
// password-reset) that have no server API route of their own to attach the
// register-style guard to. Rate-limited so the check itself can't be used as
// a captcha-solving oracle.
const verifyCaptchaIpLimiter = createRateLimiter({
  limit: 20,
  windowSec: 60,
  prefix: "verify-captcha:ip",
});

const baseHandler = async (req: Request) => {
  const parseResult = await safeJsonParse<{ token?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(verifyCaptchaSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const turnstileResult = await verifyTurnstile(validationResult.data.token, getClientIp(req));
  if (!turnstileResult.ok) {
    return createErrorResponse(ApiErrorCode.CAPTCHA_FAILED, {
      status: 403,
      detail: turnstileResult.codes.join(","),
    });
  }

  return createSuccessResponse({});
};

export const POST = withRateLimit(withCsrfProtection(baseHandler), {
  limiter: verifyCaptchaIpLimiter,
  makeKey: (req) => getClientIp(req),
});
