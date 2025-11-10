import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { sendMessageSchema } from "@/lib/validations/chat";

export const runtime = "nodejs";

// Rate limiting: 20 messages per minute per user
const CHAT_SEND_USER_ATTEMPTS = 20;
const CHAT_SEND_USER_WINDOW_SEC = 60;
const CHAT_SEND_IP_ATTEMPTS = 100; // 100 messages per hour per IP
const CHAT_SEND_IP_WINDOW_SEC = 60 * 60;

const chatSendUserLimiter = createRateLimiter({
  limit: CHAT_SEND_USER_ATTEMPTS,
  windowSec: CHAT_SEND_USER_WINDOW_SEC,
  prefix: "chat:send:user",
});

const chatSendIpLimiter = createRateLimiter({
  limit: CHAT_SEND_IP_ATTEMPTS,
  windowSec: CHAT_SEND_IP_WINDOW_SEC,
  prefix: "chat:send:ip",
  bucketId: "global",
});

const baseHandler = async (req: Request) => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const parseResult = await safeJsonParse<{ conversation_id?: unknown; body?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(sendMessageSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { conversation_id, body } = validationResult.data;

  // Verify user is a participant in the conversation
  const { data: participant, error: participantError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .eq("conversation_id", conversation_id)
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

  // Insert message
  const { data: message, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id,
      author_id: user.id,
      body,
    })
    .select("id, conversation_id, author_id, body, created_at")
    .single();

  if (insertError) {
    return handleSupabaseError(insertError, ApiErrorCode.CREATE_FAILED);
  }

  // Log action
  await supabase.from("logs").insert({
    user_id: user.id,
    action: "chat_send",
    details: { conversation_id, message_id: message.id } as never,
  });

  return createSuccessResponse({
    message: {
      id: message.id,
      conversation_id: message.conversation_id,
      author_id: message.author_id,
      body: message.body,
      created_at: message.created_at,
    },
  });
};

const withUserLimit = withRateLimit(baseHandler, {
  limiter: chatSendUserLimiter,
  getUserId: async (req) => {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  },
  makeKey: (_req, userId) => (userId ? userId : null),
});

export const POST = withRateLimit(withUserLimit, {
  limiter: chatSendIpLimiter,
  makeKey: (_req, _userId, ip) => (ip ? ip : null),
});

