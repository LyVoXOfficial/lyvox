import { createHmac } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabaseTypes";

export const runtime = "nodejs";

type PhoneOtpRow = Tables<"phone_otps">;

const sanitize = (value: unknown) => String(value ?? "").trim();

export async function POST(req: Request) {
  const parseResult = await safeJsonParse<{ code?: unknown; phone?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const code = sanitize(parseResult.data.code);
  const phone = sanitize(parseResult.data.phone);

  if (!code || !phone) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, { status: 400 });
  }

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
    .eq("e164", phone)
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

  const computedHash = createHmac("sha256", otp.code_salt).update(code).digest("hex");
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
    details: { e164: phone, otp_last_four: otp.code_last_four },
  };
  const { error: logError } = await supabase.from("logs").insert(logEntry);
  if (logError) {
    console.warn("PHONE_VERIFY_LOG_FAILED", logError.message);
  }

  return createSuccessResponse({});
}
