import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { resolveLocale } from "@/lib/i18n";
import { CONSENT_VERSION } from "@/lib/consents";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { registerSchema } from "@/lib/validations/auth";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import { isDisposableEmail } from "@/lib/antifraud/disposableEmail";
import { verifyTurnstile } from "@/lib/antifraud/turnstile";
import { withCsrfProtection } from "@/lib/security/csrf";

export const runtime = "nodejs";

const registerIpLimiter = createRateLimiter({
  limit: 5,
  windowSec: 60,
  prefix: "register:ip",
});

const baseHandler = async (req: Request) => {
  const parseResult = await safeJsonParse<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    consents?: { terms?: boolean; privacy?: boolean; marketing?: boolean };
    locale?: string;
    turnstileToken?: string;
  }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(registerSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { email, password, consents, turnstileToken } = validationResult.data;
  const locale = resolveLocale(validationResult.data.locale);

  // Guard 1: Disposable email check
  if (isDisposableEmail(email)) {
    return createErrorResponse(ApiErrorCode.DISPOSABLE_EMAIL, { status: 400 });
  }

  // Guard 2: Turnstile CAPTCHA verification (no-op when TURNSTILE_SECRET_KEY is unset)
  const turnstileResult = await verifyTurnstile(turnstileToken, getClientIp(req));
  if (!turnstileResult.ok) {
    return createErrorResponse(ApiErrorCode.CAPTCHA_FAILED, {
      status: 403,
      detail: turnstileResult.codes.join(","),
    });
  }

  const supabase = await supabaseServer();
  const origin = new URL(req.url).origin;
  const redirect = new URL("/auth/callback", origin);
  redirect.searchParams.set("next", "/onboarding");

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: redirect.toString(),
      data: {
        locale,
        marketing_opt_in: !!consents.marketing,
        consent_versions: CONSENT_VERSION,
      },
    },
  });

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.SIGNUP_FAILED);
  }

  const user = data.user;
  if (!user) {
    return createErrorResponse(ApiErrorCode.SIGNUP_INCOMPLETE, { status: 500 });
  }

  let service;
  try {
    service = await supabaseService();
  } catch {
    return createErrorResponse(ApiErrorCode.SERVICE_ROLE_MISSING, { status: 500 });
  }

  const timestamp = new Date().toISOString();
  const consentState = {
    terms: {
      accepted: true,
      version: CONSENT_VERSION.terms,
      accepted_at: timestamp,
    },
    privacy: {
      accepted: true,
      version: CONSENT_VERSION.privacy,
      accepted_at: timestamp,
    },
    marketing: {
      accepted: !!consents.marketing,
      version: CONSENT_VERSION.marketing,
      accepted_at: consents.marketing ? timestamp : null,
    },
  } as const;

  const profileUpsert = await service.from("profiles").upsert({
    id: user.id,
    verified_email: !!user.email_confirmed_at,
    verified_phone: false,
    consents: consentState,
  });

  if (profileUpsert.error) {
    return handleSupabaseError(profileUpsert.error, ApiErrorCode.PROFILE_UPSERT_FAILED);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await service.from("logs").insert({
    user_id: user.id,
    action: "consent_accept",
    details: {
      source: "register",
      locale,
      ip,
      consents: consentState,
    },
  });

  return createSuccessResponse(
    {
      verificationRequired: !user.email_confirmed_at,
    },
    201,
  );
};

export const POST = withRateLimit(withCsrfProtection(baseHandler), {
  limiter: registerIpLimiter,
  makeKey: (req) => getClientIp(req),
});
