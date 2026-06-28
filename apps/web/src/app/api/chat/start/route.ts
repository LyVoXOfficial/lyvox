import { supabaseServer } from "@/lib/supabaseServer";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { trackServerEvent } from "@/lib/analytics/trackServerEvent";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { startConversationSchema } from "@/lib/validations/chat";
import { isViewerVerified } from "@/lib/auth/requireVerified";

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

// Type cast for the untyped start_conversation rpc
type StartConversationArgs = {
  p_advert_id: string;
  p_peer_id: string;
};

type RpcClient = {
  rpc: (
    fn: "start_conversation",
    args: StartConversationArgs,
  ) => Promise<{ data: string | null; error: { message?: string; code?: string } | null }>;
};

const baseHandler = async (req: Request) => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  if (!(await isViewerVerified(supabase, user.id))) {
    return createErrorResponse(ApiErrorCode.VERIFICATION_REQUIRED, { status: 403, detail: "Phone verification required to contact a seller" });
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

  // advert_id is required to use the start_conversation rpc
  if (!advert_id) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "advert_id is required to start a conversation",
    });
  }

  // Verify the advert exists and is active before calling the rpc
  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, status")
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

  // Call the SECURITY DEFINER rpc — it creates both participants, is idempotent,
  // and verifies the peer relationship (one party must be the advert owner).
  const typedClient = supabase as unknown as RpcClient;
  const { data: convId, error: rpcError } = await typedClient.rpc("start_conversation", {
    p_advert_id: advert_id,
    p_peer_id: peer_id,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";

    if (msg.includes("CANNOT_CHAT_SELF")) {
      return createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        detail: "Cannot start conversation with yourself",
      });
    }
    if (msg.includes("ADVERT_NOT_FOUND")) {
      return createErrorResponse(ApiErrorCode.NOT_FOUND, {
        status: 404,
        detail: "Advert not found",
      });
    }
    if (msg.includes("INVALID_PEER")) {
      return createErrorResponse(ApiErrorCode.FORBIDDEN, {
        status: 403,
        detail: "Cannot start conversation with this user for this advert",
      });
    }
    if (msg.includes("auth required")) {
      return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
    }

    return createErrorResponse(ApiErrorCode.INTERNAL_ERROR, { status: 500 });
  }

  // Log action (best-effort)
  await supabase.from("logs").insert({
    user_id: user.id,
    action: "chat_start",
    details: { conversation_id: convId, peer_id, advert_id } as never,
  });

  // F6: funnel event — fire-and-forget, non-critical
  await trackServerEvent(
    ANALYTICS_EVENTS.CONTACT_START,
    { advert_id, conversation_id: convId },
    {
      userId: user.id,
      // One contact_start per (user, conversation) — convId uniquely identifies it
      dedupKey: `contact_start:${convId}`,
    },
  );

  return createSuccessResponse({
    conversation_id: convId,
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
