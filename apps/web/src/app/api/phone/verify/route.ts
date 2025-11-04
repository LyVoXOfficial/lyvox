import { createHmac } from "crypto";
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
import { verifyOtpSchema } from "@/lib/validations/phone";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

type PhoneOtpRow = Tables<"phone_otps">;

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
  prefix: "otp:verify:user",
});

const otpIpLimiter = createRateLimiter({
  limit: OTP_IP_ATTEMPTS,
  windowSec: OTP_IP_WINDOW_SEC,
  prefix: "otp:verify:ip",
});

const otpFallbackLimiter = createRateLimiter({
  limit: OTP_USER_ATTEMPTS,
  windowSec: OTP_WINDOW_SEC,
  prefix: "otp:verify:ip",
  bucketId: "fallback",
});

const getUserId = async (req: Request) => {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

const baseHandler = async (req: Request) => {
  const parseResult = await safeJsonParse<{ code?: unknown; phone?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(verifyOtpSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { code, phone } = validationResult.data;

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("phone_otps")
    .select("*")
    .eq("user_id", user.id)
    .eq("e164", phone.trim())
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !rows?.length) {
    return createErrorResponse(ApiErrorCode.OTP_NOT_FOUND, { status: 400 });
  }

  const otp = rows[0] as PhoneOtpRow;
  const now = Date.now();
  const expiresAt = otp.expires_at ? new Date(otp.expires_at).getTime() : 0;

  if (expiresAt < now) {
    return createErrorResponse(ApiErrorCode.OTP_EXPIRED, { status: 400 });
  }

  if ((otp.attempts ?? 0) >= 5) {
    return createErrorResponse(ApiErrorCode.OTP_LOCKED, { status: 429 });
  }

  const computedHash = createHmac("sha256", otp.code_salt).update(code.trim()).digest("hex");
  if (otp.code_hash !== computedHash) {
    const updateAttempt: TablesUpdate<"phone_otps"> = { attempts: (otp.attempts ?? 0) + 1 };
    await supabase.from("phone_otps").update(updateAttempt).eq("id", otp.id);
    return createErrorResponse(ApiErrorCode.OTP_INVALID, { status: 400 });
  }

  const markUsed: TablesUpdate<"phone_otps"> = { used: true };
  await supabase.from("phone_otps").update(markUsed).eq("id", otp.id);

  const phoneUpdate: TablesUpdate<"phones"> = { verified: true };
  const { error: phoneUpdateError } = await supabase
    .from("phones")
    .update(phoneUpdate)
    .eq("user_id", user.id);
  if (phoneUpdateError) {
    return handleSupabaseError(phoneUpdateError, ApiErrorCode.PHONE_UPDATE_FAILED);
  }

  const logEntry: TablesInsert<"logs"> = {
    user_id: user.id,
    action: "phone_verify",
    details: { e164: phone.trim(), otp_last_four: otp.code_last_four },
  };
  const { error: logError } = await supabase.from("logs").insert(logEntry);
  if (logError) {
    console.warn("PHONE_VERIFY_LOG_FAILED", logError.message);
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
