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

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordValidity(password: string) {
  const lengthOk = typeof password === "string" && password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classes = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
  return lengthOk && classes >= 3;
}

type ConsentBody = {
  terms?: boolean;
  privacy?: boolean;
  marketing?: boolean;
};

type RegisterBody = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  consents?: ConsentBody;
  locale?: string;
};

export async function POST(request: Request) {
  const parseResult = await safeJsonParse<RegisterBody>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const body = parseResult.data;
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";
  const consents = body.consents ?? {};

  if (!emailPattern.test(email)) {
    return createErrorResponse(ApiErrorCode.INVALID_EMAIL, { status: 400 });
  }

  if (!passwordValidity(password)) {
    return createErrorResponse(ApiErrorCode.WEAK_PASSWORD, { status: 400 });
  }

  if (password !== confirmPassword) {
    return createErrorResponse(ApiErrorCode.PASSWORD_MISMATCH, { status: 400 });
  }

  if (!consents.terms || !consents.privacy) {
    return createErrorResponse(ApiErrorCode.CONSENT_REQUIRED, { status: 400 });
  }

  const locale = resolveLocale(body.locale);
  const supabase = supabaseServer();
  const origin = new URL(request.url).origin;
  const redirect = new URL("/auth/callback", origin);
  redirect.searchParams.set("next", "/onboarding");

  const { data, error } = await supabase.auth.signUp({
    email,
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
    service = supabaseService();
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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
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
}
