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
import { signMediaSchema } from "@/lib/validations/media";

export const runtime = "nodejs";

const SIGNED_UPLOAD_TTL_SECONDS = 5 * 60;

// A-4: signed-upload issuance is abuse surface (URL farming / upload spam); tight per-user
// limit, matching the write-ish "likes:post" / "report:user" precedent of 30/min.
const mediaSignLimiter = createRateLimiter({ limit: 30, windowSec: 60, prefix: "media:sign" });

const buildRateLimitKey = (_req: Request, userId: string | null, ip: string | null) =>
  userId ?? ip ?? "anonymous";

const sanitizeFileName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";

const buildPath = (userId: string, advertId: string, originalName: string) => {
  const safe = sanitizeFileName(originalName);
  const ext = safe.includes(".") ? safe.substring(safe.lastIndexOf(".") + 1) : "bin";
  const base = safe.replace(/\.[^.]+$/, "");
  const slug = `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.slice(0, 80);
  return `${userId}/${advertId}/${slug}.${ext}`;
};

const buildPreviewPath = (storagePath: string) => {
  const slashIndex = storagePath.lastIndexOf("/");
  const dir = slashIndex >= 0 ? storagePath.slice(0, slashIndex) : "";
  const file = slashIndex >= 0 ? storagePath.slice(slashIndex + 1) : storagePath;
  const base = file.replace(/\.[^.]+$/, "") || "photo";
  return `${dir}/previews/${base}-400.webp`;
};

async function handlePost(request: Request) {
  const parseResult = await safeJsonParse<{
    advertId?: string;
    fileName?: string;
    contentType?: string;
    fileSize?: number;
  }>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(signMediaSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { advertId, fileName, contentType, fileSize, previewContentType, previewFileSize } = validationResult.data;

  const authResult = await requireAuthenticatedUser(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user, supabase } = authResult;

  const ownership = await ensureAdvertOwnership({
    supabase,
    advertId,
    userId: user.id,
    denyLogAction: "media_sign_denied",
    denyLogDetails: { advertId, fileName },
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

  const { data: lastSort } = await supabase
    .from("media")
    .select("sort")
    .eq("advert_id", advertId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort = Number.isFinite(lastSort?.sort) ? (lastSort!.sort ?? 0) + 1 : (mediaCount ?? 0);

  const storagePath = buildPath(user.id, advertId, fileName);

  const service = await supabaseService();
  const storage = service.storage.from("ad-media");
  const previewStorage = service.storage.from("ad-media-preview");
  const { data: signedUpload, error: signedError } = await storage.createSignedUploadUrl(
    storagePath,
    { upsert: false },
  );

  if (signedError || !signedUpload) {
    return handleSupabaseError(
      signedError ?? { message: "SIGNED_URL_FAILED" },
      ApiErrorCode.SIGNED_URL_FAILED,
    );
  }

  let preview: { path: string; token: string } | null = null;
  if (previewContentType && previewFileSize) {
    const previewPath = buildPreviewPath(storagePath);
    const { data: signedPreviewUpload, error: previewSignedError } =
      await previewStorage.createSignedUploadUrl(previewPath, { upsert: false });

    if (previewSignedError || !signedPreviewUpload) {
      return handleSupabaseError(
        previewSignedError ?? { message: "PREVIEW_SIGNED_URL_FAILED" },
        ApiErrorCode.SIGNED_URL_FAILED,
      );
    }

    preview = {
      path: previewPath,
      token: signedPreviewUpload.token,
    };
  }

  return createSuccessResponse({
    path: storagePath,
    token: signedUpload.token,
    previewPath: preview?.path ?? null,
    previewToken: preview?.token ?? null,
    expiresIn: SIGNED_UPLOAD_TTL_SECONDS,
    orderIndex: nextSort,
    max: MEDIA_LIMIT_PER_ADVERT,
  });
}

export const POST = withRateLimit(handlePost, {
  limiter: mediaSignLimiter,
  getUserId: resolveUserId,
  makeKey: buildRateLimitKey,
});
