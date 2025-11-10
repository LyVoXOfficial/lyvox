import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { markReadSchema } from "@/lib/validations/chat";

export const runtime = "nodejs";

const baseHandler = async (req: Request) => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTH, { status: 401 });
  }

  const parseResult = await safeJsonParse<{ conversation_id?: unknown }>(req);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(markReadSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { conversation_id } = validationResult.data;

  // Verify user is a participant
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

  // Update last_read_at
  const { error: updateError } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversation_id)
    .eq("user_id", user.id);

  if (updateError) {
    return handleSupabaseError(updateError, ApiErrorCode.UPDATE_FAILED);
  }

  // Log action
  await supabase.from("logs").insert({
    user_id: user.id,
    action: "chat_read",
    details: { conversation_id } as never,
  });

  return createSuccessResponse({});
};

export const POST = baseHandler;

