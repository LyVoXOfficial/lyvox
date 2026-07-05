import { createRateLimiter, type RateLimitResult } from "@/lib/rateLimiter";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackServerEvent } from "@/lib/analytics/trackServerEvent";
import {
  ApiErrorCode,
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
} from "@/lib/apiErrors";
import { buildChatOfferMessageBody } from "@/lib/chat/offers";
import { assertSameOrigin } from "@/lib/security/csrf";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import type { Tables, TablesInsert } from "@/lib/supabaseTypes";
import { validateRequest } from "@/lib/validations";
import { createChatOfferSchema, updateChatOfferSchema } from "@/lib/validations/chat";

export const runtime = "nodejs";

const CHAT_OFFER_ATTEMPTS = 5;
const CHAT_OFFER_WINDOW_SEC = 60 * 60;
const CHAT_OFFER_SELECT =
  "id, advert_id, conversation_id, sender_id, amount_cents, currency, message, status, created_at, responded_at";
const MESSAGE_SELECT = "id, conversation_id, author_id, body, created_at, updated_at";

type ChatOfferRow = Tables<"chat_offers">;
type AdvertOfferFields = Pick<Tables<"adverts">, "id" | "user_id" | "status" | "currency" | "min_offer_cents">;

const chatOfferLimiter = createRateLimiter({
  limit: CHAT_OFFER_ATTEMPTS,
  windowSec: CHAT_OFFER_WINDOW_SEC,
  prefix: "chat:offer",
});

function createRateLimitResponse(result: RateLimitResult) {
  const resetAt = new Date(result.reset * 1000).toISOString();
  const response = createErrorResponse(ApiErrorCode.RATE_LIMITED, {
    status: 429,
    detail: `Rate limit exceeded. Retry after ${result.retryAfterSec} seconds. Reset at ${resetAt}. Limit: ${result.limit}`,
  });
  response.headers.set("Retry-After", String(result.retryAfterSec));
  response.headers.set("RateLimit-Limit", String(result.limit));
  response.headers.set("RateLimit-Remaining", "0");
  response.headers.set("RateLimit-Reset", String(result.reset));
  return response;
}

async function assertParticipant(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  conversationId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { response: handleSupabaseError(error, ApiErrorCode.FETCH_FAILED), participant: null };
  }

  if (!data) {
    return {
      response: createErrorResponse(ApiErrorCode.FORBIDDEN, {
        status: 403,
        detail: "You are not a participant in this conversation",
      }),
      participant: null,
    };
  }

  return { response: null, participant: data };
}

export async function POST(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const parseResult = await safeJsonParse<Record<string, unknown>>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(createChatOfferSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { advert_id, conversation_id, amount_cents, currency, message } = validationResult.data;

  const limitResult = await chatOfferLimiter(`${user.id}:${advert_id}`);
  if (!limitResult.success) {
    return createRateLimitResponse(limitResult);
  }

  const participantResult = await assertParticipant(supabase, conversation_id, user.id);
  if (participantResult.response) {
    return participantResult.response;
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, advert_id")
    .eq("id", conversation_id)
    .maybeSingle();

  if (conversationError) {
    return handleSupabaseError(conversationError, ApiErrorCode.FETCH_FAILED);
  }

  if (!conversation) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Conversation not found",
    });
  }

  if (conversation.advert_id !== advert_id) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Offer advert does not match the conversation",
    });
  }

  const service = await supabaseService();
  const { data: advert, error: advertError } = await service
    .from("adverts")
    .select("id, user_id, status, currency, min_offer_cents")
    .eq("id", advert_id)
    .maybeSingle<AdvertOfferFields>();

  if (advertError) {
    return handleSupabaseError(advertError, ApiErrorCode.FETCH_FAILED);
  }

  if (!advert) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Advert not found",
    });
  }

  if (advert.user_id === user.id) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Sellers cannot make offers on their own advert",
    });
  }

  if (advert.status !== "active") {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Cannot make an offer on an inactive advert",
    });
  }

  const now = new Date().toISOString();
  const autoDeclined = advert.min_offer_cents !== null && amount_cents < advert.min_offer_cents;
  const offerPayload: TablesInsert<"chat_offers"> = {
    advert_id,
    conversation_id,
    sender_id: user.id,
    amount_cents,
    currency,
    message: message || null,
    status: autoDeclined ? "declined" : "sent",
    responded_at: autoDeclined ? now : null,
  };

  const { data: offer, error: offerError } = await service
    .from("chat_offers")
    .insert(offerPayload)
    .select(CHAT_OFFER_SELECT)
    .single();

  if (offerError) {
    return handleSupabaseError(offerError, ApiErrorCode.CREATE_FAILED);
  }

  if (autoDeclined) {
    await trackServerEvent(
      ANALYTICS_EVENTS.OFFER_DECLINED_AUTO,
      { advert_id, conversation_id, offer_id: offer.id, amount_cents },
      { userId: user.id, dedupKey: `offer_declined_auto:${offer.id}` },
    );

    return createSuccessResponse({
      offer,
      message: null,
      autoDeclined: true,
    });
  }

  const systemBody = buildChatOfferMessageBody(offer.id);
  const { data: chatMessage, error: messageError } = await service
    .from("messages")
    .insert({
      conversation_id,
      author_id: user.id,
      body: systemBody,
    })
    .select(MESSAGE_SELECT)
    .single();

  if (messageError) {
    await service.from("chat_offers").delete().eq("id", offer.id);
    return handleSupabaseError(messageError, ApiErrorCode.CREATE_FAILED);
  }

  await trackServerEvent(
    ANALYTICS_EVENTS.OFFER_SENT,
    { advert_id, conversation_id, offer_id: offer.id, amount_cents },
    { userId: user.id, dedupKey: `offer_sent:${offer.id}` },
  );

  return createSuccessResponse({
    offer,
    message: chatMessage,
    autoDeclined: false,
  });
}

export async function PATCH(req: Request) {
  const csrfError = assertSameOrigin(req);
  if (csrfError) return csrfError;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const parseResult = await safeJsonParse<Record<string, unknown>>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(updateChatOfferSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { offer_id, status } = validationResult.data;
  const { data: offer, error: offerError } = await supabase
    .from("chat_offers")
    .select(CHAT_OFFER_SELECT)
    .eq("id", offer_id)
    .maybeSingle<ChatOfferRow>();

  if (offerError) {
    return handleSupabaseError(offerError, ApiErrorCode.FETCH_FAILED);
  }

  if (!offer) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "Offer not found",
    });
  }

  if (offer.sender_id === user.id) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, {
      status: 403,
      detail: "Only the recipient can respond to an offer",
    });
  }

  if (offer.status !== "sent") {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      detail: "Offer is no longer open",
    });
  }

  const { data: updatedOffer, error: updateError } = await supabase
    .from("chat_offers")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", offer_id)
    .eq("status", "sent")
    .select(CHAT_OFFER_SELECT)
    .maybeSingle<ChatOfferRow>();

  if (updateError) {
    return handleSupabaseError(updateError, ApiErrorCode.UPDATE_FAILED);
  }

  if (!updatedOffer) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, {
      status: 403,
      detail: "Offer response was not allowed",
    });
  }

  return createSuccessResponse({ offer: updatedOffer });
}
