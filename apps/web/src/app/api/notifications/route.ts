import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread_only") === "true";
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  const limit = Math.min(
    limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const offset = offsetParam ? Number.parseInt(offsetParam, 10) : 0;

  if (Number.isNaN(limit) || limit < 1) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid limit parameter",
    });
  }

  if (Number.isNaN(offset) || offset < 0) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid offset parameter",
    });
  }

  let query = supabase
    .from("notifications")
    .select("id, type, channel, title, body, payload, read_at, sent_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data: notifications, error } = await query;

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  // Get total count
  let countQuery = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (unreadOnly) {
    countQuery = countQuery.is("read_at", null);
  }

  const { count } = await countQuery;

  return createSuccessResponse({
    notifications: notifications || [],
    total: count || 0,
    limit,
    offset,
  });
}

