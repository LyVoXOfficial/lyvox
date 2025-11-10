import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  if (!id) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Notification ID is required",
    });
  }

  // Verify notification belongs to user
  const { data: notification, error: fetchError } = await supabase
    .from("notifications")
    .select("id, user_id, read_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return handleSupabaseError(fetchError, ApiErrorCode.FETCH_FAILED);
  }

  if (!notification) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Notification not found",
    });
  }

  if (notification.user_id !== user.id) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, {
      status: 403,
      detail: "You can only mark your own notifications as read",
    });
  }

  // Update read_at if not already read
  if (!notification.read_at) {
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return handleSupabaseError(updateError, ApiErrorCode.UPDATE_FAILED);
    }
  }

  return createSuccessResponse({});
}

