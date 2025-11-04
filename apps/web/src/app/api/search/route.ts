import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  ApiErrorCode,
} from "@/lib/apiErrors";
import { validateRequest, searchAdvertsQuerySchema } from "@/lib/validations";
import { createRateLimiter, withRateLimit, getClientIp } from "@/lib/rateLimiter";

export const runtime = "nodejs";

// Rate limiting configuration for search endpoint
// Public endpoint with higher limits than sensitive endpoints
const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const SEARCH_IP_ATTEMPTS = parsePositiveInt(process.env.RATE_LIMIT_SEARCH_IP_PER_MIN, 60);
const SEARCH_IP_WINDOW_SEC = 60;

const searchIpLimiter = createRateLimiter({
  limit: SEARCH_IP_ATTEMPTS,
  windowSec: SEARCH_IP_WINDOW_SEC,
  prefix: "search:ip",
});

/**
 * GET /api/search
 * 
 * Search adverts with full-text search, filters, sorting, and pagination.
 * 
 * Query parameters:
 * - q: Search query text (full-text search in title and description)
 * - category_id: Filter by category UUID
 * - price_min: Minimum price filter
 * - price_max: Maximum price filter
 * - location: Text matching for location
 * - lat: Latitude for geospatial search (requires lng)
 * - lng: Longitude for geospatial search (requires lat)
 * - radius_km: Search radius in kilometers (default: 50, max: 1000)
 * - sort_by: Sort option (relevance, price_asc, price_desc, created_at_asc, created_at_desc)
 * - page: Page number for pagination (default: 0)
 * - limit: Results per page (default: 24, max: 100)
 * 
 * Returns: Array of adverts with total_count and relevance_rank
 */
const baseHandler = async (request: NextRequest) => {
  // Parse query parameters from URL
  const url = new URL(request.url);
  const queryParams: Record<string, string | undefined> = {};
  
  // Extract all query parameters
  for (const [key, value] of url.searchParams.entries()) {
    queryParams[key] = value;
  }

  // Validate query parameters with Zod schema
  const validationResult = validateRequest(searchAdvertsQuerySchema, queryParams);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const params = validationResult.data;

  // Calculate pagination offset
  const pageOffset = params.page * params.limit;

  // Prepare parameters for PostgreSQL function
  const searchParams = {
    search_query: params.q ?? null,
    category_id_filter: params.category_id ?? null,
    price_min_filter: params.price_min ?? null,
    price_max_filter: params.price_max ?? null,
    location_filter: params.location ?? null,
    location_lat: params.lat ?? null,
    location_lng: params.lng ?? null,
    radius_km: params.radius_km ?? 50,
    sort_by: params.sort_by,
    page_offset: pageOffset,
    page_limit: params.limit,
  };

  const supabase = supabaseServer();

  // Call PostgreSQL function search_adverts via RPC
  const { data, error } = await supabase.rpc("search_adverts", searchParams);

  if (error) {
    return handleSupabaseError(error, ApiErrorCode.FETCH_FAILED);
  }

  // Extract total_count from first result (if available) or calculate from array length
  const totalCount = data && data.length > 0 ? (data[0]?.total_count ?? data.length) : 0;

  // Remove total_count from each result (it's duplicated in every row)
  const results = data?.map(({ total_count: _, ...rest }) => rest) ?? [];

  return createSuccessResponse({
    items: results,
    total: totalCount,
    page: params.page,
    limit: params.limit,
    hasMore: totalCount > pageOffset + results.length,
  });
};

// Apply rate limiting by IP address
export const GET = withRateLimit(baseHandler, {
  limiter: searchIpLimiter,
  makeKey: (_req, _userId, ip) => ip ?? "anonymous",
});

