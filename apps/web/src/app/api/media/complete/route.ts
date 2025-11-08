import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import {
  ensureAdvertOwnership,
  requireAuthenticatedUser,
  MEDIA_LIMIT_PER_ADVERT,
} from "../_shared";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { completeMediaSchema } from "@/lib/validations/media";

export const runtime = "nodejs";

const SIGNED_DOWNLOAD_TTL_SECONDS = 15 * 60;

export async function POST(request: Request) {
  const parseResult = await safeJsonParse<{
    advertId?: string;
    storagePath?: string;
    width?: number;
    height?: number;
  }>(request);
  if (!parseResult.success) {
    return parseResult.response;
  }

  const validationResult = validateRequest(completeMediaSchema, parseResult.data);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { advertId, storagePath, width, height } = validationResult.data;

  const supabase = supabaseServer();
  const authResult = await requireAuthenticatedUser(supabase);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user } = authResult;

  if (!storagePath.startsWith(`${user.id}/${advertId}/`)) {
    // SECURITY: log unexpected storage path usage
    await supabaseService()
      .from("logs")
      .insert({
        user_id: user.id,
        action: "media_complete_denied",
        details: { advertId, storagePath },
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
  };

  const { data: inserted, error: insertError } = await supabase
    .from("media")
    .insert(insertPayload)
    .select("id, url, sort, w, h")
    .single();

  if (insertError || !inserted) {
    return handleSupabaseError(
      insertError ?? { message: "INSERT_FAILED" },
      ApiErrorCode.CREATE_FAILED,
    );
  }

  const { data: signedDownload, error: signedError } = await supabaseService()
    .storage.from("ad-media")
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
      sort: inserted.sort,
      w: inserted.w,
      h: inserted.h,
      storagePath,
    },
  });
}
