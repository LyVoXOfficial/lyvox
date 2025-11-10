import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  const cursor = searchParams.get("cursor"); // message ID for pagination
  const limitParam = searchParams.get("limit");

  if (!conversationId) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "conversationId is required",
    });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid conversationId format",
    });
  }

  // Verify user is a participant
  const { data: participant, error: participantError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (participantError) {
    return handleSupabaseError(participantError, ApiErrorCode.FETCH_FAILED);
  }

  if (!participant) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, {
      status: 403,
      detail: "You are not a participant in this conversation",
    });
  }

  // Parse limit
  const limit = Math.min(
    limitParam ? Number.parseInt(limitParam, 10) : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  if (Number.isNaN(limit) || limit < 1) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Invalid limit parameter",
    });
  }

  // Build query
  let query = supabase
    .from("messages")
    .select("id, conversation_id, author_id, body, created_at, updated_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit + 1); // Fetch one extra to check if there are more

  // If cursor is provided, fetch messages before that ID
  if (cursor) {
    const cursorId = Number.parseInt(cursor, 10);
    if (!Number.isNaN(cursorId)) {
      query = query.lt("id", cursorId);
    }
  }

  const { data: messages, error: messagesError } = await query;

  if (messagesError) {
    return handleSupabaseError(messagesError, ApiErrorCode.FETCH_FAILED);
  }

  // Check if there are more messages
  const hasMore = messages && messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages ?? [];

  // Reverse to get chronological order (oldest first)
  resultMessages.reverse();

  // Get next cursor (ID of the oldest message in this batch)
  const nextCursor = resultMessages.length > 0 ? resultMessages[0].id : null;

  return createSuccessResponse({
    messages: resultMessages,
    has_more: hasMore,
    next_cursor: nextCursor,
  });
}

