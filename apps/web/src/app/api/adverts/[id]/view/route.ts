import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createSuccessResponse,
  createErrorResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";

const uuidSchema = z.string().uuid();

const viewLimiter = createRateLimiter({
  limit: 100,
  windowSec: 60,
  prefix: "adverts:view",
});

// POST /api/adverts/[id]/view - Track advert view
async function trackView(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer();
  const { id: advertId } = await context.params;

  const uuidValidation = uuidSchema.safeParse(advertId);
  if (!uuidValidation.success) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid advert ID format",
    });
  }

  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, status")
    .eq("id", advertId)
    .maybeSingle();

  if (advertError) {
    return handleSupabaseError(advertError, ApiErrorCode.FETCH_FAILED);
  }

  if (!advert) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Advert not found",
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0].trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const { error: insertError } = await supabase.from("advert_views").insert({
    advert_id: advertId,
    user_id: user?.id ?? null,
    ip_address: ip,
    user_agent: userAgent,
  });

  if (insertError) {
    console.error("Failed to track view:", insertError);
    return createSuccessResponse({
      message: "View tracking failed (non-critical)",
      advert_id: advertId,
    });
  }

  const { data: viewCount, error: viewCountError } = await supabase.rpc("get_advert_view_count", {
    advert_id_param: advertId,
  });

  if (viewCountError) {
    return handleSupabaseError(viewCountError, ApiErrorCode.FETCH_FAILED);
  }

  return createSuccessResponse({
    message: "View tracked",
    advert_id: advertId,
    view_count: viewCount ?? 0,
  });
}

export const POST = withRateLimit(trackView, {
  limiter: viewLimiter,
  makeKey: (_req, _userId, ip) => ip ?? "anonymous",
});

