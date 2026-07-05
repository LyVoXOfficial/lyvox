import { supabaseService } from "@/lib/supabaseService";
import {
  ensureAdvertOwnership,
  requireAuthenticatedUser,
  resolveUserId,
  logMediaEvent,
  MEDIA_LIMIT_PER_ADVERT,
} from "../_shared";
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
import { completeMediaSchema } from "@/lib/validations/media";
import { getMediaPreviewPublicUrl, buildPreviewStoragePath } from "@/lib/media/previewUrls";
import { sanitizeImageBuffer, derivePreviewBuffer } from "@/lib/media/sanitizeImage";

export const runtime = "nodejs";

const SIGNED_DOWNLOAD_TTL_SECONDS = 15 * 60;

type ServiceClient = Awaited<ReturnType<typeof supabaseService>>;

/** Best-effort removal of orphaned upload objects after a rejected completion. */
async function cleanupUploads(
  service: ServiceClient,
  storagePath: string,
  previewStoragePath: string | null | undefined,
): Promise<void> {
  try {
    await service.storage.from("ad-media").remove([storagePath]);
    if (previewStoragePath) {
      await service.storage.from("ad-media-preview").remove([previewStoragePath]);
    }
  } catch {
    // The request has already failed; cleanup is opportunistic.
  }
}

// A-4: finalizing an upload writes a media row + issues a signed download URL — tight
// per-user limit consistent with other write endpoints (likes:post, report:user) at 30/min.
const mediaCompleteLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "media:complete" });

const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) =>
  userId ?? ip ?? "anonymous";

async function handlePost(request: Request) {
  const parseResult = await safeJsonParse<{
    advertId?: string;
    storagePath?: string;
  }>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(completeMediaSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  // NOTE: client-supplied dimensions/preview fields are ignored — SEC-UPLOAD
  // recomputes them server-side from the sanitised bytes below (authoritative).
  const { advertId, storagePath } = validationResult.data;

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

  // The preview path is DERIVED from the (ownership-checked) full path — never
  // taken from the client — so it is always within the user's namespace and is
  // written only here, from the sanitised buffer.
  const previewStoragePath = buildPreviewStoragePath(storagePath);

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
    // Already completed (and therefore already sanitised) on a prior call.
    return createSuccessResponse({ reused: true });
  }

  // SEC-UPLOAD: bytes were uploaded straight to Storage via a signed URL,
  // bypassing every server route — so this is the only point at which we can
  // inspect and neutralise them. Download → magic-byte sniff → sharp re-encode
  // to a clean WebP (EXIF/GPS stripped, decompression bombs bounded) BEFORE the
  // media row is created. Any rejection deletes the orphaned upload(s).
  const download = await service.storage.from("ad-media").download(storagePath);
  if (download.error || !download.data) {
    await cleanupUploads(service, storagePath, previewStoragePath);
    return createErrorResponse(ApiErrorCode.NOT_FOUND, {
      status: 404,
      detail: "uploaded object not found",
    });
  }

  const originalBuffer = Buffer.from(await download.data.arrayBuffer());
  const sanitized = await sanitizeImageBuffer(originalBuffer);
  if (!sanitized.ok) {
    await cleanupUploads(service, storagePath, previewStoragePath);
    await logMediaEvent("media_complete_rejected", user.id, {
      advertId,
      storagePath,
      reason: sanitized.reason,
    });
    if (sanitized.reason === "TOO_LARGE") {
      return createErrorResponse(ApiErrorCode.FILE_TOO_LARGE, {
        status: 413,
        detail: sanitized.reason,
      });
    }
    return createErrorResponse(ApiErrorCode.UNSUPPORTED_CONTENT_TYPE, {
      status: 422,
      detail: sanitized.reason,
    });
  }

  // Overwrite the stored object with the normalised WebP. The stored
  // Content-Type (not the path extension) is what the signed URL serves.
  const reupload = await service.storage
    .from("ad-media")
    .upload(storagePath, sanitized.buffer, { contentType: "image/webp", upsert: true });
  if (reupload.error) {
    await cleanupUploads(service, storagePath, previewStoragePath);
    return handleSupabaseError(reupload.error, ApiErrorCode.CREATE_FAILED);
  }

  // Derive the PUBLIC preview server-side from the already-sanitised full buffer
  // and write it (the client never uploads to the public bucket), so the
  // unsigned, publicly-served thumbnail can only ever be sanitised bytes. On
  // failure, remove anything at the derived path and fall back to signing the
  // full image for thumbnails (preview_url null).
  let effectivePreviewPath: string | null = previewStoragePath;
  let effectivePreviewW: number | null = null;
  let effectivePreviewH: number | null = null;
  try {
    const preview = await derivePreviewBuffer(sanitized.buffer);
    const previewUpload = await service.storage
      .from("ad-media-preview")
      .upload(previewStoragePath, preview.buffer, {
        contentType: "image/webp",
        upsert: true,
      });
    if (previewUpload.error) throw previewUpload.error;
    effectivePreviewW = preview.width;
    effectivePreviewH = preview.height;
  } catch (previewError) {
    await service.storage.from("ad-media-preview").remove([previewStoragePath]);
    effectivePreviewPath = null;
    await logMediaEvent("media_complete_preview_failed", user.id, {
      advertId,
      previewStoragePath,
      error: String(previewError),
    });
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
    w: sanitized.width,
    h: sanitized.height,
    preview_url: effectivePreviewPath,
    preview_w: effectivePreviewW,
    preview_h: effectivePreviewH,
    preview_mime: effectivePreviewPath ? "image/webp" : null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("media")
    .insert(insertPayload)
    .select("id, url, sort, w, h, preview_url, preview_w, preview_h")
    .single();

  if (insertError || !inserted) {
    // Symmetry with the other failure branches: never leave sanitised-but-
    // unreferenced objects (esp. the public preview) behind on a failed insert.
    await cleanupUploads(service, storagePath, effectivePreviewPath);
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

export const POST = withRateLimit(withCsrfProtection(handlePost), {
  limiter: mediaCompleteLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});
