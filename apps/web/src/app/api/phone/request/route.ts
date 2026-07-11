import { randomBytes, createHmac, randomInt } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import { withCsrfProtection } from "@/lib/security/csrf";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { requestOtpSchema } from "@/lib/validations/phone";
import { parseBelgianMobile } from "@/lib/validations/belgianPhone";
import { verifyTurnstile } from "@/lib/antifraud/turnstile";
import type { TablesInsert } from "@/lib/supabaseTypes";
import { getIntegrationStatus } from "@/lib/integrations/registry";

export const runtime = "nodejs";

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const OTP_USER_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_OTP_USER_PER_15M, 5);
const OTP_WINDOW_SEC = 15 * 60;
const OTP_IP_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_OTP_IP_PER_60M, 20);
const OTP_IP_WINDOW_SEC = 60 * 60;

const otpUserLimiter = createRateLimiter({
  limit: OTP_USER_ATTEMPTS,
  windowSec: OTP_WINDOW_SEC,
  prefix: "otp:user",
});

const otpIpLimiter = createRateLimiter({
  limit: OTP_IP_ATTEMPTS,
  windowSec: OTP_IP_WINDOW_SEC,
  prefix: "otp:ip",
});

const otpFallbackLimiter = createRateLimiter({
  limit: OTP_USER_ATTEMPTS,
  windowSec: OTP_WINDOW_SEC,
  prefix: "otp:ip",
  bucketId: "fallback",
});

const getUserId = async (req: Request) => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

const baseHandler = async (req: Request) => {
  const capability = await getIntegrationStatus("sms_otp");
  if (!capability.effective) {
    return createErrorResponse(ApiErrorCode.FEATURE_DISABLED, { status: 404 });
  }

  const parseResult = await safeJsonParse<{ phone?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(requestOtpSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { phone, turnstileToken } = validationResult.data;

  // Turnstile CAPTCHA verification (no-op when TURNSTILE_SECRET_KEY is unset).
  // Guards SMS toll-fraud abuse from a scripted/compromised authenticated session.
  const turnstileResult = await verifyTurnstile(turnstileToken, getClientIp(req));
  if (!turnstileResult.ok) {
    return createErrorResponse(ApiErrorCode.CAPTCHA_FAILED, {
      status: 403,
      detail: turnstileResult.codes.join(","),
    });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  // Belgium-only policy (Layer A): accept only valid Belgian MOBILE numbers and
  // normalize national / 0032 / +32 input to canonical E.164. Every downstream
  // operation uses this normalized `e164` so the verify route (which normalizes
  // identically) matches the stored value.
  const belgianResult = parseBelgianMobile(phone);
  if (!belgianResult.ok) {
    return createErrorResponse(ApiErrorCode.PHONE_NOT_BELGIAN_MOBILE, { status: 400 });
  }
  const e164 = belgianResult.e164;

  // Service-role client for all phones / phone_otps writes (and the pre-check
  // SELECT). After the DB migration, authenticated/anon will have no
  // INSERT/UPDATE/DELETE on these tables; using service-role now means the code
  // works unchanged before and after the migration is applied.
  const service = await supabaseService();

  // Best-effort pre-check: the e164 column is globally UNIQUE, so at most one
  // phones row can own a given number. If that row belongs to ANOTHER user,
  // reject early with a dedicated, localizable error — before any Twilio lookup,
  // OTP insert or SMS send. We never reject a user re-using THEIR OWN number,
  // and we never echo the other user's data. On any failure (query error or a
  // missing service-role key falling back to an RLS-scoped client that can't
  // see other users' rows) we simply continue: the UNIQUE constraint and the
  // 23505 fallback below remain the real source of truth.
  try {
    const existingPhone = await service
      .from("phones")
      .select("user_id")
      .eq("e164", e164)
      .maybeSingle();
    if (
      !existingPhone.error &&
      existingPhone.data &&
      existingPhone.data.user_id !== user.id
    ) {
      return createErrorResponse(ApiErrorCode.PHONE_ALREADY_REGISTERED, { status: 409 });
    }
  } catch {
    // Pre-check is best-effort; fall through to the constraint-backed upsert.
  }

  // Layer B: Twilio Lookup v2 line-type gate. Hard-block VoIP / non-fixed-VoIP
  // (disposable / "receive-SMS-online") numbers BEFORE issuing an OTP or sending
  // SMS. FAIL-OPEN on everything else: if the call throws, returns non-ok, or has
  // no line_type_intelligence.type, we log and continue — a Twilio outage must not
  // lock out legitimate users (Layer A already filters hard). The lookup json is
  // still stored in phones.lookup as before.
  let lookup: Record<string, unknown> | null = null;
  if (process.env.TWILIO_LOOKUP_URL && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const lookupUrl = `${process.env.TWILIO_LOOKUP_URL}/${encodeURIComponent(e164)}?Fields=line_type_intelligence`;
      const authToken = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
      ).toString("base64");
      const response = await fetch(lookupUrl, {
        headers: { Authorization: `Basic ${authToken}` },
      });
      if (response.ok) {
        const lookupData = (await response.json()) as Record<string, unknown>;
        lookup = lookupData;
        const lineType = (
          lookupData?.line_type_intelligence as Record<string, unknown> | undefined
        )?.type as string | undefined;
        const normalizedType = lineType?.toLowerCase();
        if (normalizedType === "voip" || normalizedType === "nonfixedvoip") {
          return createErrorResponse(ApiErrorCode.PHONE_LINE_TYPE_BLOCKED, { status: 403 });
        }
      } else {
        console.warn("TWILIO_LOOKUP_NON_OK", { httpStatus: response.status });
      }
    } catch (error) {
      // Fail-open: network / parse error must not block OTP issuance.
      console.warn("TWILIO_LOOKUP_FAILED_FALLBACK", error);
    }
  }

  const phoneRecord: TablesInsert<"phones"> = {
    user_id: user.id,
    e164: e164,
    verified: false,
    lookup: lookup as TablesInsert<"phones">["lookup"],
  };

  const upsertPhonesResult = await service.from("phones").upsert(phoneRecord);
  if (upsertPhonesResult.error) {
    // Race-safe fallback: if the e164 UNIQUE constraint was violated (the number
    // is owned by another account, possibly registered between our pre-check and
    // this write), surface the dedicated error rather than the generic save failure.
    if (upsertPhonesResult.error.code === "23505") {
      return createErrorResponse(ApiErrorCode.PHONE_ALREADY_REGISTERED, { status: 409 });
    }
    return handleSupabaseError(upsertPhonesResult.error, ApiErrorCode.PHONE_SAVE_FAILED);
  }

  // Ensure only one active OTP per user/phone pair
  const deactivatePrevious = await service
    .from("phone_otps")
    .update({ used: true })
    .eq("user_id", user.id)
    .eq("e164", e164)
    .eq("used", false);
  if (deactivatePrevious.error) {
    return handleSupabaseError(deactivatePrevious.error, ApiErrorCode.OTP_CLEANUP_FAILED);
  }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const salt = randomBytes(16).toString("hex");
  const codeHash = createHmac("sha256", salt).update(code).digest("hex");
  const codeLastFour = code.slice(-4);

  const otpInsert: TablesInsert<"phone_otps"> = {
    user_id: user.id,
    e164: e164,
    code_hash: codeHash,
    code_salt: salt,
    code_last_four: codeLastFour,
    expires_at: expiresAt,
    attempts: 0,
    used: false,
  };

  const { error: otpError } = await service.from("phone_otps").insert(otpInsert);
  if (otpError) {
    return handleSupabaseError(otpError, ApiErrorCode.OTP_CREATE_FAILED);
  }

  try {
    const authToken = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
    ).toString("base64");
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: process.env.TWILIO_FROM ?? "",
          To: e164,
          Body: `LyVoX: ваш код подтверждения ${code}. Срок действия 10 минут.`,
        }),
      },
    );
    // fetch() only rejects on a network failure. A Twilio rejection (trial-account
    // restriction, non-SMS-capable sender, geo-permissions for the destination) comes back
    // as a non-2xx response with an error body. Without this check the route returned success
    // while no SMS was ever delivered — the caller saw "code sent" and waited for nothing.
    if (!twilioResponse.ok) {
      const twilioError = (await twilioResponse.json().catch(() => null)) as
        | { code?: number; message?: string }
        | null;
      console.error("TWILIO_SEND_FAILED", {
        httpStatus: twilioResponse.status,
        twilioCode: twilioError?.code,
        twilioMessage: twilioError?.message,
      });
      return createErrorResponse(ApiErrorCode.SMS_SEND_FAIL, { status: 502 });
    }
  } catch (error) {
    console.error("TWILIO_SEND_ERROR", error);
    return createErrorResponse(ApiErrorCode.SMS_SEND_FAIL, { status: 500 });
  }

  const logDetails = {
    e164: e164,
    lookup,
    otp_last_four: codeLastFour,
  } as TablesInsert<"logs">["details"];

  const logEntry: TablesInsert<"logs"> = {
    user_id: user.id,
    action: "phone_request",
    details: logDetails,
  };
  const { error: logError } = await supabase.from("logs").insert(logEntry);
  if (logError) {
    console.warn("PHONE_LOG_FAILED", logError.message);
  }

  return createSuccessResponse({});
};

const withFallbackLimit = withRateLimit(baseHandler, {
  limiter: otpFallbackLimiter,
  getUserId,
  makeKey: (req, userId) => (!userId ? getClientIp(req) : null),
});

const withUserLimit = withRateLimit(withCsrfProtection(withFallbackLimit), {
  limiter: otpUserLimiter,
  getUserId,
  makeKey: (_req, userId) => userId,
});

export const POST = withRateLimit(withUserLimit, {
  limiter: otpIpLimiter,
  makeKey: (req) => getClientIp(req),
});
