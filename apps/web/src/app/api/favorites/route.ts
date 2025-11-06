import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";
import { withRateLimit } from "@/lib/rateLimiter";
import { z } from "zod";

// Schema for POST request
const addFavoriteSchema = z.object({
  advert_id: z.string().uuid(),
});

// GET /api/favorites - Get user's favorites
async function GET(request: NextRequest) {
  const supabase = supabaseServer();
  
  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorResponse(
      ApiErrorCode.UNAUTHORIZED,
      "Authentication required",
      401
    );
  }

  // Get query parameters for pagination
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "0");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "24"), 100);
  const offset = page * limit;

  // Fetch user's favorites with advert details
  const { data: favorites, error } = await supabase
    .from("favorites")
    .select(`
      advert_id,
      created_at,
      adverts:advert_id (
        id,
        title,
        price,
        currency,
        location,
        status,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return createErrorResponse(
      ApiErrorCode.FETCH_FAILED,
      `Failed to fetch favorites: ${error.message}`,
      500
    );
  }

  // Get total count
  const { count } = await supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Get first image for each advert
  const advertIds = favorites?.map(f => (f.adverts as any)?.id).filter(Boolean) || [];
  
  let mediaMap: Record<string, string> = {};
  if (advertIds.length > 0) {
    const { data: mediaData } = await supabase
      .from("media")
      .select("advert_id, url")
      .in("advert_id", advertIds)
      .order("sort", { ascending: true });

    if (mediaData) {
      mediaMap = mediaData.reduce((acc, m) => {
        if (!acc[m.advert_id]) {
          acc[m.advert_id] = m.url;
        }
        return acc;
      }, {} as Record<string, string>);
    }
  }

  // Format response
  const items = favorites?.map(fav => ({
    advert_id: fav.advert_id,
    favorited_at: fav.created_at,
    advert: {
      ...(fav.adverts as any),
      image: mediaMap[(fav.adverts as any)?.id] || null,
    },
  })) || [];

  return createSuccessResponse({
    items,
    total: count || 0,
    page,
    limit,
    hasMore: (count || 0) > offset + items.length,
  });
}

// POST /api/favorites - Add to favorites
async function POST(request: NextRequest) {
  const supabase = supabaseServer();
  
  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return createErrorResponse(
      ApiErrorCode.UNAUTHORIZED,
      "Authentication required",
      401
    );
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(
      ApiErrorCode.INVALID_INPUT,
      "Invalid JSON body",
      400
    );
  }

  const validation = addFavoriteSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse(
      ApiErrorCode.INVALID_INPUT,
      `Validation error: ${validation.error.errors[0].message}`,
      400
    );
  }

  const { advert_id } = validation.data;

  // Check if advert exists and is active
  const { data: advert, error: advertError } = await supabase
    .from("adverts")
    .select("id, status")
    .eq("id", advert_id)
    .single();

  if (advertError || !advert) {
    return createErrorResponse(
      ApiErrorCode.NOT_FOUND,
      "Advert not found",
      404
    );
  }

  if (advert.status !== "active") {
    return createErrorResponse(
      ApiErrorCode.INVALID_INPUT,
      "Cannot favorite inactive advert",
      400
    );
  }

  // Add to favorites (ON CONFLICT DO NOTHING to handle duplicates)
  const { error: insertError } = await supabase
    .from("favorites")
    .insert({
      user_id: user.id,
      advert_id,
    });

  if (insertError) {
    // Check if it's a duplicate key error
    if (insertError.code === "23505") {
      return createSuccessResponse({
        message: "Already in favorites",
        advert_id,
      });
    }

    return createErrorResponse(
      ApiErrorCode.DB_ERROR,
      `Failed to add favorite: ${insertError.message}`,
      500
    );
  }

  return createSuccessResponse(
    {
      message: "Added to favorites",
      advert_id,
    },
    201
  );
}

// Apply rate limiting
export const GET_HANDLER = withRateLimit(GET, {
  maxRequests: 60,
  windowMs: 60 * 1000,
  keyType: "user",
});

export const POST_HANDLER = withRateLimit(POST, {
  maxRequests: 30,
  windowMs: 60 * 1000,
  keyType: "user",
});

export { GET_HANDLER as GET, POST_HANDLER as POST };

