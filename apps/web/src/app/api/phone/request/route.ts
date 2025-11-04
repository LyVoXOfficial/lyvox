import { randomBytes, createHmac } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { requestOtpSchema } from "@/lib/validations/phone";
import type { TablesInsert } from "@/lib/supabaseTypes";

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
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

const baseHandler = async (req: Request) => {
  const parseResult = await safeJsonParse<{ phone?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(requestOtpSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { phone } = validationResult.data;

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  let lookup: Record<string, unknown> | null = null;
  if (process.env.TWILIO_LOOKUP_URL && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const lookupUrl = `${process.env.TWILIO_LOOKUP_URL}/${encodeURIComponent(phone)}?Type=carrier`;
      const authToken = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
      ).toString("base64");
      const response = await fetch(lookupUrl, {
        headers: { Authorization: `Basic ${authToken}` },
      });
      lookup = (await response.json()) as Record<string, unknown>;
    } catch {
      // Lookup failures should not block OTP issuance.
    }
  }

  const phoneRecord: TablesInsert<"phones"> = {
    user_id: user.id,
    e164: phone.trim(),
    verified: false,
    lookup: lookup as TablesInsert<"phones">["lookup"],
  };

  const upsertPhonesResult = await supabase.from("phones").upsert(phoneRecord);
  if (upsertPhonesResult.error) {
    return handleSupabaseError(upsertPhonesResult.error, ApiErrorCode.PHONE_SAVE_FAILED);
  }

  // Ensure only one active OTP per user/phone pair
  const deactivatePrevious = await supabase
    .from("phone_otps")
    .update({ used: true })
    .eq("user_id", user.id)
    .eq("e164", phone)
    .eq("used", false);
  if (deactivatePrevious.error) {
    return handleSupabaseError(deactivatePrevious.error, ApiErrorCode.OTP_CLEANUP_FAILED);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const salt = randomBytes(16).toString("hex");
  const codeHash = createHmac("sha256", salt).update(code).digest("hex");
  const codeLastFour = code.slice(-4);

  const otpInsert: TablesInsert<"phone_otps"> = {
    user_id: user.id,
    e164: phone,
    code_hash: codeHash,
    code_salt: salt,
    code_last_four: codeLastFour,
    expires_at: expiresAt,
    attempts: 0,
    used: false,
  };

  const { error: otpError } = await supabase.from("phone_otps").insert(otpInsert);
  if (otpError) {
    return handleSupabaseError(otpError, ApiErrorCode.OTP_CREATE_FAILED);
  }

  try {
    const authToken = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
    ).toString("base64");
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: process.env.TWILIO_FROM ?? "",
          To: phone,
          Body: `LyVoX: ваш код подтверждения ${code}. Срок действия 10 минут.`,
        }),
      },
    );
  } catch (error) {
    console.error("TWILIO_SEND_ERROR", error);
    return createErrorResponse(ApiErrorCode.SMS_SEND_FAIL, { status: 500 });
  }

  const logDetails = {
    e164: phone,
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

const withUserLimit = withRateLimit(withFallbackLimit, {
  limiter: otpUserLimiter,
  getUserId,
  makeKey: (_req, userId) => userId,
});

export const POST = withRateLimit(withUserLimit, {
  limiter: otpIpLimiter,
  makeKey: (req) => getClientIp(req),
});
