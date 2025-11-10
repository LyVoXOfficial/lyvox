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
import { startConversationSchema } from "@/lib/validations/chat";

export const runtime = "nodejs";

const CHAT_START_USER_ATTEMPTS = 10; // 10 conversations per minute
const CHAT_START_USER_WINDOW_SEC = 60;
const CHAT_START_IP_ATTEMPTS = 30; // 30 conversations per hour
const CHAT_START_IP_WINDOW_SEC = 60 * 60;

const chatStartUserLimiter = createRateLimiter({
  limit: CHAT_START_USER_ATTEMPTS,
  windowSec: CHAT_START_USER_WINDOW_SEC,
  prefix: "chat:start:user",
});

const chatStartIpLimiter = createRateLimiter({
  limit: CHAT_START_IP_ATTEMPTS,
  windowSec: CHAT_START_IP_WINDOW_SEC,
  prefix: "chat:start:ip",
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

  const parseResult = await safeJsonParse<{ advert_id?: unknown; peer_id?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(startConversationSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { advert_id, peer_id } = validationResult.data;

  // Cannot start conversation with yourself
  if (peer_id === user.id) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Cannot start conversation with yourself",
    });
  }

  // If advert_id is provided, verify it exists and is active
  if (advert_id) {
    const { data: advert, error: advertError } = await supabase
      .from("adverts")
      .select("id, user_id, status")
      .eq("id", advert_id)
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

    if (advert.status !== "active") {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        detail: "Cannot start conversation for inactive advert",
      });
    }

    // Verify peer_id is the advert owner (if advert_id is provided)
    if (advert.user_id !== peer_id && user.id !== advert.user_id) {
      return createErrorResponse(ApiErrorCode.FORBIDDEN, {
        status: 403,
        detail: "Cannot start conversation with this user for this advert",
      });
    }
  }

  // Check if conversation already exists
  // For advert-based conversations, check by advert_id and participants
  // For direct conversations, check by participants only
  let existingConversation;
  if (advert_id) {
    const { data: conversations, error: findError } = await supabase
      .from("conversations")
      .select("id, conversation_participants!inner(user_id)")
      .eq("advert_id", advert_id)
      .limit(1);

    if (findError) {
      return handleSupabaseError(findError, ApiErrorCode.FETCH_FAILED);
    }

    // Check if both users are participants
    existingConversation = conversations?.find((conv) => {
      const participants = conv.conversation_participants as Array<{ user_id: string }>;
      const userIds = participants.map((p) => p.user_id);
      return userIds.includes(user.id) && userIds.includes(peer_id);
    });
  } else {
    // For direct conversations, find by participants
    const { data: conversations, error: findError } = await supabase
      .from("conversations")
      .select("id, conversation_participants!inner(user_id)")
      .is("advert_id", null)
      .limit(100); // Get more to filter client-side

    if (findError) {
      return handleSupabaseError(findError, ApiErrorCode.FETCH_FAILED);
    }

    existingConversation = conversations?.find((conv) => {
      const participants = conv.conversation_participants as Array<{ user_id: string }>;
      const userIds = participants.map((p) => p.user_id);
      return userIds.includes(user.id) && userIds.includes(peer_id) && userIds.length === 2;
    });
  }

  if (existingConversation) {
    return createSuccessResponse({
      conversation_id: existingConversation.id,
      created: false,
    });
  }

  // Create new conversation
  const { data: newConversation, error: createError } = await supabase
    .from("conversations")
    .insert({
      created_by: user.id,
      advert_id: advert_id ?? null,
    })
    .select("id")
    .single();

  if (createError) {
    return handleSupabaseError(createError, ApiErrorCode.CREATE_FAILED);
  }

  // Add participants
  const participants = [
    { conversation_id: newConversation.id, user_id: user.id, role: "owner" as const },
    { conversation_id: newConversation.id, user_id: peer_id, role: "peer" as const },
  ];

  const { error: participantsError } = await supabase
    .from("conversation_participants")
    .insert(participants);

  if (participantsError) {
    // Rollback: delete conversation if participants insert fails
    await supabase.from("conversations").delete().eq("id", newConversation.id);
    return handleSupabaseError(participantsError, ApiErrorCode.CREATE_FAILED);
  }

  // Log action
  await supabase.from("logs").insert({
    user_id: user.id,
    action: "chat_start",
    details: { conversation_id: newConversation.id, peer_id, advert_id } as never,
  });

  return createSuccessResponse({
    conversation_id: newConversation.id,
    created: true,
  });
};

const withUserLimit = withRateLimit(baseHandler, {
  limiter: chatStartUserLimiter,
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
  limiter: chatStartIpLimiter,
  makeKey: (_req, _userId, ip) => (ip ? ip : null),
});

