import { ensureAdvertOwnership, requireAuthenticatedUser, resolveUserId } from "../_shared";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { withCsrfProtection } from "@/lib/security/csrf";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { reorderMediaSchema } from "@/lib/validations/media";

export const runtime = "nodejs";

// A-4: reordering issues N updates per call — tight per-user limit, consistent with
// other write endpoints (likes:post, report:user) at 30/min.
const mediaReorderLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "media:reorder" });

const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) =>
  userId ?? ip ?? "anonymous";

async function handlePost(request: Request) {
  const parseResult = await safeJsonParse<{
    advertId?: string;
    orderedIds?: string[];
  }>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(reorderMediaSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { advertId, orderedIds } = validationResult.data;

  const authResult = await requireAuthenticatedUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user, supabase } = authResult;

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

export const POST = withRateLimit(withCsrfProtection(handlePost), {
  limiter: mediaReorderLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});
