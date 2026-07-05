import { supabaseService } from "@/lib/supabaseService";
import { revalidateAdvert } from "@/lib/advert/advertDetail";
import { ensureAdvertOwnership, requireAuthenticatedUser, resolveUserId } from "../_shared";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { withCsrfProtection } from "@/lib/security/csrf";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

// A-4: media delete — tight per-user limit, consistent with other write endpoints
// (likes:delete, likes:post) at 30/min.
const mediaDeleteLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "media:delete" });

const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) =>
  userId ?? ip ?? "anonymous";

async function handleDelete(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id) {
    return createErrorResponse(ApiErrorCode.MISSING_ID, { status: 400 });
  }

  const authResult = await requireAuthenticatedUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user, supabase } = authResult;

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("id,advert_id,url,preview_url,sort")
    .eq("id", id)
    .maybeSingle();

  if (mediaError) {
    return handleSupabaseError(mediaError, ApiErrorCode.FETCH_FAILED);
  }

  if (!media) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  const ownership = await ensureAdvertOwnership({
    supabase,
    advertId: media.advert_id,
    userId: user.id,
    denyLogAction: "media_delete_denied",
    denyLogDetails: { mediaId: id },
  });
  if ("response" in ownership) {
    return ownership.response;
  }

  const service = await supabaseService();
  if (media.url && !media.url.startsWith("http")) {
    await service.storage.from("ad-media").remove([media.url]);
  }
  if (media.preview_url && !media.preview_url.startsWith("http")) {
    await service.storage.from("ad-media-preview").remove([media.preview_url]);
  }

  const { error: deleteError } = await supabase.from("media").delete().eq("id", id);

  if (deleteError) {
    return handleSupabaseError(deleteError, ApiErrorCode.UPDATE_FAILED);
  }

  const { data: remaining } = await supabase
    .from("media")
    .select("id,sort")
    .eq("advert_id", media.advert_id)
    .order("sort", { ascending: true });

  if (remaining && remaining.length) {
    const updates = remaining.map((item, index) =>
      supabase.from("media").update({ sort: index }).eq("id", item.id),
    );
    await Promise.all(updates);
  }

  // PERF-01: drop the cached detail so the removed photo's path is not served.
  revalidateAdvert(media.advert_id);

  return createSuccessResponse({});
}

export const DELETE = withRateLimit(withCsrfProtection(handleDelete), {
  limiter: mediaDeleteLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});
