import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
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

  const supabase = await supabaseServer();

  // Check if advert is active (public access)
  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id,status")
    .eq("id", advertId)
    .maybeSingle();

  if (advertError) {
    return handleSupabaseError(advertError, ApiErrorCode.FETCH_FAILED);
  }

  if (!advert) {
    return createErrorResponse(ApiErrorCode.NOT_FOUND, { status: 404 });
  }

  // Only allow public access to active adverts
  if (advert.status !== "active") {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, { 
      status: 403,
      detail: "Media is only available for active adverts",
    });
  }

  // Load media - RLS allows public read for active adverts
  const { data: records, error: mediaError } = await supabase
    .from("media")
    .select("id,url,sort,w,h,created_at")
    .eq("advert_id", advertId)
    .order("sort", { ascending: true });

  if (mediaError) {
    console.error(`Failed to load media for advert ${advertId}:`, mediaError);
    return handleSupabaseError(mediaError, ApiErrorCode.FETCH_FAILED);
  }

  console.log(`Found ${records?.length || 0} media records for advert ${advertId}`);
  if (records?.length) {
    console.log(`Sample media path:`, records[0].url);
  }

  // Generate signed URLs using service role
  const service = await supabaseService();
  const storage = service.storage.from("ad-media");
  const items =
    records?.map(async (record) => {
      const path = record.url;

      if (path.startsWith("http://") || path.startsWith("https://")) {
        // Legacy public URLs – return as-is
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

      // Generate signed URL using service role
      const { data, error } = await storage.createSignedUrl(
        path,
        SIGNED_DOWNLOAD_TTL_SECONDS,
      );
      
      if (error) {
        console.error(`Failed to create signed URL for path "${path}":`, error);
      } else {
        console.log(`Created signed URL for path "${path}"`);
      }
      
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
