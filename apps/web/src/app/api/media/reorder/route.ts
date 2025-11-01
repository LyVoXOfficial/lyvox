import { supabaseServer } from "@/lib/supabaseServer";
import { ensureAdvertOwnership, requireAuthenticatedUser } from "../_shared";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

type Payload = {
  advertId?: string;
  orderedIds?: string[];
};

export async function POST(request: Request) {
  const parseResult = await safeJsonParse<Payload>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const body = parseResult.data;
  const advertId = body.advertId;
  const orderedIds = body.orderedIds;

  if (!advertId || typeof advertId !== "string") {
    return createErrorResponse(ApiErrorCode.MISSING_ADVERT_ID, { status: 400 });
  }

  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return createErrorResponse(ApiErrorCode.INVALID_ORDER, { status: 400 });
  }

  const supabase = supabaseServer();
  const authResult = await requireAuthenticatedUser(supabase);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user } = authResult;

  const ownership = await ensureAdvertOwnership({
    supabase,
    advertId,
    userId: user.id,
    denyLogAction: "media_reorder_denied",
    denyLogDetails: { orderedIds },
  });
  if ("response" in ownership) {
    return ownership.response;
  }

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("id")
    .eq("advert_id", advertId);

  if (mediaError) {
    return handleSupabaseError(mediaError, ApiErrorCode.FETCH_FAILED);
  }

  const mediaIds = new Set(media?.map((item) => item.id) ?? []);
  if (!orderedIds.every((id) => mediaIds.has(id))) {
    return createErrorResponse(ApiErrorCode.UNKNOWN_MEDIA_ID, { status: 400 });
  }

  const updates = orderedIds.map((id, index) =>
    supabase.from("media").update({ sort: index }).eq("id", id),
  );
  await Promise.all(updates);

  return createSuccessResponse({});
}
