import { supabaseServer } from "@/lib/supabaseServer";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/lib/apiErrors";
import { createRateLimiter, withRateLimit } from "@/lib/rateLimiter";
import { excludeSeedFromAggregates } from "@/lib/seed/excludeSeedFromAggregates";

const limiter = createRateLimiter({
  limit: 60,
  windowSec: 60,
  prefix: "top-sellers",
});

// Historical column set of the top_sellers MV, i.e. the response shape before
// T18 added the is_seed column. Selecting these explicitly keeps the payload
// byte-for-byte identical (and never leaks the seed flag) regardless of the
// flag — the new is_seed column is used only for filtering, never returned.
const TOP_SELLER_COLUMNS =
  "id, display_name, verified_email, verified_phone, created_at, total_deals, rating, trust_score, active_adverts, avg_views";

// GET /api/top-sellers - Get top sellers from materialized view
async function baseHandler(request: Request) {
  const supabase = await supabaseServer();

  // Get query parameters
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // T18: at launch the founder can exclude seeded/demo sellers from this
  // social-proof surface. OFF (default) → seed sellers remain, as today.
  const excludeSeed = excludeSeedFromAggregates();

  // Fetch from materialized view
  let sellersQuery = supabase
    .from("top_sellers")
    .select(TOP_SELLER_COLUMNS)
    .range(offset, offset + limit - 1);
  if (excludeSeed) sellersQuery = sellersQuery.eq("is_seed", false);
  const { data: sellers, error } = await sellersQuery;

  if (error) {
    console.error("Failed to fetch top sellers:", error);
    return createErrorResponse(ApiErrorCode.FETCH_FAILED, {
      status: 500,
      detail: `Failed to fetch top sellers: ${error.message}`,
    });
  }

  // Get total count from materialized view
  let countQuery = supabase
    .from("top_sellers")
    .select("*", { count: "exact", head: true });
  if (excludeSeed) countQuery = countQuery.eq("is_seed", false);
  const { count } = await countQuery;

  return createSuccessResponse({
    sellers: sellers || [],
    total: count || 0,
    limit,
    offset,
  });
}

// Apply rate limiting (this is public data, so generous limits)
export const GET = withRateLimit(baseHandler, {
  limiter,
  makeKey: (_req, _userId, ip) => ip ?? "anonymous",
});

