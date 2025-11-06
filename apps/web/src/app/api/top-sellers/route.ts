import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";
import { withRateLimit } from "@/lib/rateLimiter";

// GET /api/top-sellers - Get top sellers from materialized view
async function GET(request: NextRequest) {
  const supabase = supabaseServer();
  
  // Get query parameters
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Fetch from materialized view
  const { data: sellers, error } = await supabase
    .from("top_sellers")
    .select("*")
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Failed to fetch top sellers:", error);
    return createErrorResponse(
      ApiErrorCode.FETCH_FAILED,
      `Failed to fetch top sellers: ${error.message}`,
      500
    );
  }

  // Get total count from materialized view
  const { count } = await supabase
    .from("top_sellers")
    .select("*", { count: "exact", head: true });

  return createSuccessResponse({
    sellers: sellers || [],
    total: count || 0,
    limit,
    offset,
  });
}

// Apply rate limiting (this is public data, so generous limits)
export const GET_HANDLER = withRateLimit(GET, {
  maxRequests: 60,
  windowMs: 60 * 1000,
  keyType: "ip",
});

export { GET_HANDLER as GET };

