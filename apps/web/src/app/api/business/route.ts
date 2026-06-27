import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  mapBusinessUniqueViolation,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { createBusinessSchema } from "@/lib/validations/business";
import { isViewerVerified } from "@/lib/auth/requireVerified";

export const runtime = "nodejs";

// Rate limiters: per-user (5/min) and per-IP (10/min)
const userLimiter = createRateLimiter({ limit: 5, windowSec: 60, prefix: "business:post:user" });
const ipLimiter = createRateLimiter({ limit: 10, windowSec: 60, prefix: "business:post:ip" });

const getUserId = async (req: Request): Promise<string | null> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

const baseHandler = async (req: Request): Promise<Response> => {
  // Step 1: Auth check
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
  }

  // Phone verification required
  const verified = await isViewerVerified(supabase, user.id);
  if (!verified) {
    return createErrorResponse(ApiErrorCode.VERIFICATION_REQUIRED, {
      status: 403,
      detail: "phone",
    });
  }

  // Step 2: Parse and validate body
  const parseResult = await safeJsonParse<unknown>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(createBusinessSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const {
    legal_name,
    trade_name,
    legal_form,
    kbo_number,
    vat_number,
    vat_liable,
    address_line,
    postcode,
    city,
    country,
    email,
    phone_e164,
    withdrawal_terms,
    returns_url,
  } = validationResult.data;

  // Step 3: Create business via RPC
  // create_business is not in the generated types, so we cast via unknown
  const { data: rpcData, error: rpcError } = await (
    supabase as unknown as {
      rpc: (
        fn: string,
        args: { p_legal_name: string; p_kbo: string; p_vat: string | null },
      ) => Promise<{ data: string | null; error: { message?: string; code?: string } | null }>;
    }
  ).rpc("create_business", {
    p_legal_name: legal_name,
    p_kbo: kbo_number,
    p_vat: vat_number ?? null,
  });

  if (rpcError) {
    const mapped = mapBusinessUniqueViolation(rpcError);
    if (mapped) return createErrorResponse(mapped, { status: 409 });
    return handleSupabaseError(rpcError, ApiErrorCode.INTERNAL_ERROR);
  }

  const business_id = rpcData as string;

  // Step 4: Update business with remaining fields + self-certification
  const selfCertifiedAt = new Date().toISOString();
  const selfCertifiedIp = getClientIp(req);

  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      trade_name: trade_name ?? null,
      legal_form: legal_form ?? null,
      address_line,
      postcode,
      city,
      country,
      phone_e164: phone_e164 ?? null,
      vat_liable,
      email,
      withdrawal_terms,
      ...(returns_url ? { returns_url } : {}),
      self_certified_at: selfCertifiedAt,
      self_certified_ip: selfCertifiedIp,
    })
    .eq("id", business_id);

  if (updateError) {
    return handleSupabaseError(updateError, ApiErrorCode.INTERNAL_ERROR);
  }

  // Step 5: Update profile seller_type
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ seller_type: "business" })
    .eq("id", user.id);

  if (profileError) {
    return handleSupabaseError(profileError, ApiErrorCode.INTERNAL_ERROR);
  }

  // Step 6: Insert vies:pending verification row if vat_liable
  if (vat_liable) {
    const { error: verError } = await supabase.from("verifications").insert({
      subject_type: "business",
      subject_id: business_id,
      method: "vies",
      status: "pending",
      evidence: { queued_at: new Date().toISOString() },
    });

    if (verError) {
      return handleSupabaseError(verError, ApiErrorCode.INTERNAL_ERROR);
    }
  }

  // Step 7: Provisional publish — set status='active' (B0 passed, D3)
  const { error: publishError } = await supabase
    .from("businesses")
    .update({ status: "active" })
    .eq("id", business_id);

  if (publishError) {
    return handleSupabaseError(publishError, ApiErrorCode.INTERNAL_ERROR);
  }

  // Step 8: Return success
  return createSuccessResponse({
    business_id,
    status: "active",
    entity_verified: false,
    verification: {
      vies: vat_liable ? "pending" : "n/a",
    },
  });
};

// Wrap with per-IP limiter, then per-user limiter
const withUserLimit = withRateLimit(baseHandler, {
  limiter: userLimiter,
  getUserId,
  makeKey: (_req, userId) => userId,
});

export const POST = withRateLimit(withUserLimit, {
  limiter: ipLimiter,
  makeKey: (req) => getClientIp(req),
});
