import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";
import { withRateLimit } from "@/lib/rateLimiter";

// DELETE /api/favorites/[advertId] - Remove from favorites
async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ advertId: string }> }
) {
  const supabase = supabaseServer();
  
  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorResponse(
      ApiErrorCode.UNAUTHORIZED,
      "Authentication required",
      401
    );
  }

  // Get advertId from params
  const params = await context.params;
  const { advertId } = params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(advertId)) {
    return createErrorResponse(
      ApiErrorCode.INVALID_INPUT,
      "Invalid advert ID format",
      400
    );
  }

  // Delete from favorites
  const { error: deleteError, count } = await supabase
    .from("favorites")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .eq("advert_id", advertId);

  if (deleteError) {
    return createErrorResponse(
      ApiErrorCode.DB_ERROR,
      `Failed to remove favorite: ${deleteError.message}`,
      500
    );
  }

  if (count === 0) {
    return createErrorResponse(
      ApiErrorCode.NOT_FOUND,
      "Favorite not found",
      404
    );
  }

  return createSuccessResponse({
    message: "Removed from favorites",
    advert_id: advertId,
  });
}

// Apply rate limiting
export const DELETE_HANDLER = withRateLimit(DELETE, {
  maxRequests: 30,
  windowMs: 60 * 1000,
  keyType: "user",
});

export { DELETE_HANDLER as DELETE };

