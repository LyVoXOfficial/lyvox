import { supabaseService } from "@/lib/supabaseService";
import {
  ensureAdvertOwnership,
  requireAuthenticatedUser,
  resolveUserId,
  MEDIA_LIMIT_PER_ADVERT,
} from "../_shared";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { completeMediaSchema } from "@/lib/validations/media";
import { getMediaPreviewPublicUrl } from "@/lib/media/previewUrls";

export const runtime = "nodejs";

const SIGNED_DOWNLOAD_TTL_SECONDS = 15 * 60;

// A-4: finalizing an upload writes a media row + issues a signed download URL — tight
// per-user limit consistent with other write endpoints (likes:post, report:user) at 30/min.
const mediaCompleteLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "media:complete" });

const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) =>
  userId ?? ip ?? "anonymous";

async function handlePost(request: Request) {
  const parseResult = await safeJsonParse<{
    advertId?: string;
    storagePath?: string;
    width?: number;
    height?: number;
    previewStoragePath?: string;
    previewWidth?: number;
    previewHeight?: number;
  }>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(completeMediaSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { advertId, storagePath, width, height, previewStoragePath, previewWidth, previewHeight } = validationResult.data;

  const authResult = await requireAuthenticatedUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user, supabase } = authResult;

  const service = await supabaseService();

  if (!storagePath.startsWith(`${user.id}/${advertId}/`)) {
    // SECURITY: log unexpected storage path usage
    await service
      .from("logs")
      .insert({
        user_id: user.id,
        action: "media_complete_denied",
        details: { advertId, storagePath },
      });
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  if (previewStoragePath && !previewStoragePath.startsWith(`${user.id}/${advertId}/previews/`)) {
    await service
      .from("logs")
      .insert({
        user_id: user.id,
        action: "media_complete_preview_denied",
        details: { advertId, previewStoragePath },
      });
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { status: 403 });
  }

  const ownership = await ensureAdvertOwnership({
    supabase,
    advertId,
    userId: user.id,
    denyLogAction: "media_complete_denied_owner",
    denyLogDetails: { storagePath },
  });
  if ("response" in ownership) {
    return ownership.response;
  }

  const { count: mediaCount, error: countError } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("advert_id", advertId);

  if (countError) {
    return handleSupabaseError(countError, ApiErrorCode.FETCH_FAILED);
  }

  if ((mediaCount ?? 0) >= MEDIA_LIMIT_PER_ADVERT) {
    return createErrorResponse(ApiErrorCode.LIMIT_REACHED, {
      status: 409,
      detail: `Media limit of ${MEDIA_LIMIT_PER_ADVERT} items reached for this advert`,
    });
  }

  const { data: existingPath } = await supabase
    .from("media")
    .select("id")
    .eq("advert_id", advertId)
    .eq("url", storagePath)
    .maybeSingle();

  if (existingPath) {
    return createSuccessResponse({ reused: true });
  }

  const { data: lastSort } = await supabase
    .from("media")
    .select("sort")
    .eq("advert_id", advertId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = Number.isFinite(lastSort?.sort) ? (lastSort!.sort ?? 0) + 1 : (mediaCount ?? 0);

  const insertPayload = {
    advert_id: advertId,
    url: storagePath,
    sort: nextSort,
    w: width ?? null,
    h: height ?? null,
    preview_url: previewStoragePath ?? null,
    preview_w: previewWidth ?? null,
    preview_h: previewHeight ?? null,
    preview_mime: previewStoragePath ? "image/webp" : null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("media")
    .insert(insertPayload)
    .select("id, url, sort, w, h, preview_url, preview_w, preview_h")
    .single();

  if (insertError || !inserted) {
    return handleSupabaseError(
      insertError ?? { message: "INSERT_FAILED" },
      ApiErrorCode.CREATE_FAILED,
    );
  }

  const { data: signedDownload, error: signedError } = await service.storage
    .from("ad-media")
    .createSignedUrl(storagePath, SIGNED_DOWNLOAD_TTL_SECONDS);

  if (signedError || !signedDownload) {
    return handleSupabaseError(
      signedError ?? { message: "SIGNED_DOWNLOAD_FAILED" },
      ApiErrorCode.SIGNED_URL_FAILED,
    );
  }

  return createSuccessResponse({
    media: {
      id: inserted.id,
      url: signedDownload.signedUrl,
      previewUrl: getMediaPreviewPublicUrl(inserted.preview_url),
      sort: inserted.sort,
      w: inserted.w,
      h: inserted.h,
      preview_w: inserted.preview_w,
      preview_h: inserted.preview_h,
      storagePath,
      previewStoragePath: inserted.preview_url,
    },
  });
}

export const POST = withRateLimit(handlePost, {
  limiter: mediaCompleteLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});
