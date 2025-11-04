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
import { signMediaSchema } from "@/lib/validations/media";

export const runtime = "nodejs";

const SIGNED_UPLOAD_TTL_SECONDS = 5 * 60;

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

export async function POST(request: Request) {
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

  const { advertId, fileName, contentType, fileSize } = validationResult.data;

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
      details: { limit: MEDIA_LIMIT_PER_ADVERT },
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

  const storage = supabaseService().storage.from("ad-media");
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

  return createSuccessResponse({
    path: storagePath,
    token: signedUpload.token,
    expiresIn: SIGNED_UPLOAD_TTL_SECONDS,
    orderIndex: nextSort,
    max: MEDIA_LIMIT_PER_ADVERT,
  });
}
