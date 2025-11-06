import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";
import { withRateLimit } from "@/lib/rateLimiter";

// POST /api/adverts/[id]/view - Track advert view
async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = supabaseServer();
  
  // Get advertId from params
  const params = await context.params;
  const { id: advertId } = params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(advertId)) {
    return createErrorResponse(
      ApiErrorCode.INVALID_INPUT,
      "Invalid advert ID format",
      400
    );
  }

  // Check if advert exists and is active
  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, status")
    .eq("id", advertId)
    .single();

  if (advertError || !advert) {
    return createErrorResponse(
      ApiErrorCode.NOT_FOUND,
      "Advert not found",
      404
    );
  }

  // Get user (if authenticated)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get IP address and user agent from request
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
             request.headers.get("x-real-ip") || 
             "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Insert view record
  const { error: insertError } = await supabase
    .from("advert_views")
    .insert({
      advert_id: advertId,
      user_id: user?.id || null,
      ip_address: ip,
      user_agent: userAgent,
    });

  if (insertError) {
    console.error("Failed to track view:", insertError);
    // Don't fail the request if we can't track the view
    return createSuccessResponse({
      message: "View tracking failed (non-critical)",
      advert_id: advertId,
    });
  }

  // Get updated view count
  const { data: viewCount } = await supabase
    .rpc("get_advert_view_count", { advert_id_param: advertId });

  return createSuccessResponse({
    message: "View tracked",
    advert_id: advertId,
    view_count: viewCount || 0,
  });
}

// Apply rate limiting (generous limits for view tracking)
export const POST_HANDLER = withRateLimit(POST, {
  maxRequests: 100,
  windowMs: 60 * 1000,
  keyType: "ip",
});

export { POST_HANDLER as POST };

