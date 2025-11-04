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

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id) {
    return createErrorResponse(ApiErrorCode.MISSING_ID, { status: 400 });
  }

  const supabase = supabaseServer();
  const authResult = await requireAuthenticatedUser(supabase);
  if ("response" in authResult) {
    return authResult.response;
  }
  const { user } = authResult;

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("id,advert_id,url,sort")
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

  const service = supabaseService();
  await service.storage.from("ad-media").remove([media.url]);

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

  return createSuccessResponse({});
}
