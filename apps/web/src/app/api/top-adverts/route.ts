import { supabaseServer } from "@/lib/supabaseServer";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";

const limiter = createRateLimiter({
  limit: 60,
  windowSec: 60,
  prefix: "top-adverts",
});

// GET /api/top-adverts - Get top adverts by views + favorites
async function baseHandler(request: Request) {
  const supabase = supabaseServer();
  
  // Get query parameters
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 100);

  // Get adverts with view and favorite counts
  // We use a custom query to calculate popularity score
  const { data: adverts, error } = await supabase
    .from("adverts")
    .select(`
      id,
      title,
      price,
      currency,
      location,
      status,
      created_at,
      user_id
    `)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1000); // Get recent adverts

  if (error) {
    console.error("Failed to fetch adverts:", error);
    return createErrorResponse(ApiErrorCode.FETCH_FAILED, {
      status: 500,
      detail: `Failed to fetch adverts: ${error.message}`,
    });
  }

  if (!adverts || adverts.length === 0) {
    return createSuccessResponse({
      adverts: [],
      total: 0,
    });
  }

  const advertIds = adverts.map((a) => a.id);

  // Get view counts for adverts (last 30 days)
  const { data: viewCounts } = await supabase
    .from("advert_views")
    .select("advert_id")
    .in("advert_id", advertIds)
    .gte("viewed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  // Get favorite counts for adverts
  const { data: favoriteCounts } = await supabase
    .from("favorites")
    .select("advert_id")
    .in("advert_id", advertIds);

  // Count views and favorites per advert
  const viewCountMap: Record<string, number> = {};
  const favoriteCountMap: Record<string, number> = {};

  viewCounts?.forEach((v) => {
    viewCountMap[v.advert_id] = (viewCountMap[v.advert_id] || 0) + 1;
  });

  favoriteCounts?.forEach((f) => {
    favoriteCountMap[f.advert_id] = (favoriteCountMap[f.advert_id] || 0) + 1;
  });

  // Calculate popularity score and sort
  const advertsWithScores = adverts.map((advert) => {
    const views = viewCountMap[advert.id] || 0;
    const favorites = favoriteCountMap[advert.id] || 0;
    
    // Popularity score: views * 1 + favorites * 5 (favorites are more valuable)
    const popularityScore = views * 1 + favorites * 5;

    return {
      ...advert,
      view_count: views,
      favorite_count: favorites,
      popularity_score: popularityScore,
    };
  });

  // Sort by popularity score
  advertsWithScores.sort((a, b) => b.popularity_score - a.popularity_score);

  // Take top N
  const topAdverts = advertsWithScores.slice(0, limit);

  // Get first image for each advert
  const topAdvertIds = topAdverts.map((a) => a.id);
  const { data: mediaData } = await supabase
    .from("media")
    .select("advert_id, url")
    .in("advert_id", topAdvertIds)
    .order("sort", { ascending: true });

  const mediaMap: Record<string, string> = {};
  mediaData?.forEach((m) => {
    if (!mediaMap[m.advert_id]) {
      mediaMap[m.advert_id] = m.url;
    }
  });

  // Add images to adverts
  const result = topAdverts.map((advert) => ({
    ...advert,
    image: mediaMap[advert.id] || null,
  }));

  return createSuccessResponse({
    adverts: result,
    total: result.length,
  });
}

// Apply rate limiting (this is public data, so generous limits)
export const GET = withRateLimit(baseHandler, {
  limiter,
  makeKey: (_req, _userId, ip) => ip ?? "anonymous",
});

