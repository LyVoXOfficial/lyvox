import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { ensureAdvertOwnership, requireAuthenticatedUser } from "../_shared";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";

export const runtime = "nodejs";

const SIGNED_DOWNLOAD_TTL_SECONDS = 10 * 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const advertId = url.searchParams.get("advertId");

  if (!advertId) {
    return createErrorResponse(ApiErrorCode.MISSING_ADVERT_ID, { status: 400 });
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
    denyLogAction: "media_list_denied",
  });
  if ("response" in ownership) {
    return ownership.response;
  }

  const { data: records, error: mediaError } = await supabase
    .from("media")
    .select("id,url,sort,w,h,created_at")
    .eq("advert_id", advertId)
    .order("sort", { ascending: true });

  if (mediaError) {
    return handleSupabaseError(mediaError, ApiErrorCode.FETCH_FAILED);
  }

  const storage = supabaseService().storage.from("ad-media");
  const items =
    records?.map(async (record) => {
      const path = record.url;

      if (path.startsWith("http://") || path.startsWith("https://")) {
        // Legacy public URLs – return as-is but note missing storage path.
        return {
          id: record.id,
          url: path,
          storagePath: null,
          sort: record.sort,
          w: record.w,
          h: record.h,
          created_at: record.created_at,
        };
      }

      const { data, error } = await storage.createSignedUrl(
        path,
        SIGNED_DOWNLOAD_TTL_SECONDS,
      );
      return {
        id: record.id,
        url: error ? null : data?.signedUrl ?? null,
        storagePath: path,
        sort: record.sort,
        w: record.w,
        h: record.h,
        created_at: record.created_at,
      };
    }) ?? [];

  const resolved = await Promise.all(items);

  return createSuccessResponse({
    items: resolved.filter((item) => item.url !== null),
    expiresIn: SIGNED_DOWNLOAD_TTL_SECONDS,
  });
}
