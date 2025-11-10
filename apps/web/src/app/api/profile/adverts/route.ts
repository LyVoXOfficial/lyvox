import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest } from "@/lib/validations";
import { getUserAdvertsQuerySchema } from "@/lib/validations/profile";
import { signMediaUrls } from "@/lib/media/signMediaUrls";

export const runtime = "nodejs";

/**
 * GET /api/profile/adverts
 * 
 * Returns paginated list of user's adverts with optional status filter
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 12, max: 100)
 * - status: Filter by status (all, active, draft, archived) (default: all)
 */
export async function GET(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
  }

  // Parse and validate query parameters
  const url = new URL(request.url);
  const queryParams: Record<string, string | undefined> = {};
  
  for (const [key, value] of url.searchParams.entries()) {
    queryParams[key] = value;
  }

  const validationResult = validateRequest(getUserAdvertsQuerySchema, queryParams);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const { page, pageSize, status } = validationResult.data;

  // Calculate pagination offset
  const offset = (page - 1) * pageSize;

  // Build query for adverts (without nested media)
  let query = supabase
    .from("adverts")
    .select("id, title, price, status, created_at, location", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  // Apply status filter
  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: adverts, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  // Fetch media for all adverts in a separate query
  let mediaByAdvert: Record<string, Array<{ url: string | null; signedUrl: string | null; sort: number | null }>> = {};
  if (adverts && adverts.length > 0) {
    const advertIds = adverts.map((ad) => ad.id);
    const { data: mediaData, error: mediaError } = await supabase
      .from("media")
      .select("advert_id, url, sort")
      .in("advert_id", advertIds);

    if (mediaError) {
      // Log error but don't fail the request - adverts can exist without media
      console.error("Failed to fetch media for adverts:", mediaError);
    } else if (mediaData) {
      const signedMedia = await signMediaUrls(mediaData);
      mediaByAdvert = signedMedia.reduce(
        (acc, media) => {
          if (!acc[media.advert_id]) {
            acc[media.advert_id] = [];
          }

          acc[media.advert_id].push({
            url: media.signedUrl ?? null,
            signedUrl: media.signedUrl ?? null,
            sort: media.sort ?? null,
          });

          return acc;
        },
        {} as Record<string, Array<{ url: string | null; signedUrl: string | null; sort: number | null }>>,
      );
    }
  }

  // Transform media data structure - attach media to their adverts
  const transformedAdverts = (adverts ?? []).map((advert) => ({
    id: advert.id,
    title: advert.title,
    price: advert.price ? Number(advert.price) : null,
    status: advert.status,
    created_at: advert.created_at ?? "",
    location: advert.location,
    media: mediaByAdvert[advert.id] ?? [],
  }));

  return createSuccessResponse({
    adverts: transformedAdverts,
    total: count ?? 0,
    page,
    pageSize,
  });
}

