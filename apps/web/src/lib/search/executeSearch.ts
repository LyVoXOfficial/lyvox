import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveFirstImages } from "@/lib/advertMedia";
import { resolveLikeCounts } from "@/lib/likeCounts";
import type { SearchAdvertsQuery } from "@/lib/validations/search";

// Card fields projected out of the full search_adverts RPC row. The RPC returns
// the full advert row (description, condition, status, location_id, updated_at,
// relevance_rank, total_count, …) but shipping all of it bloats the payload
// (24 full descriptions per page) and leaks more shape than intended.
type SearchRpcRow = {
  id: string;
  user_id?: string | null;
  category_id?: string | null;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  created_at?: string | null;
  seller_verified?: boolean | null;
};

/**
 * A single projected search result, exactly as the /api/search envelope ships it.
 * user_id + category_id are kept on purpose: the discover swipe deck
 * (mapSearchItemToDeckCard) needs sellerId (= chat peer_id) and categoryId for
 * taste reranking and the actions sheet. Card rendering (mapSearchItemToCard)
 * reads the rest.
 */
export type SearchResultItem = {
  id: string;
  user_id: string | null;
  category_id: string | null;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  created_at: string | null;
  seller_verified: boolean;
  image: string | null;
  like_count: number;
};

export type SearchResultPayload = {
  items: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export type ExecuteSearchResult =
  | { ok: true; payload: SearchResultPayload }
  | { ok: false; supabaseError: PostgrestError };

/**
 * Core search execution shared by GET /api/search (client re-fetch path) and
 * app/search/page.tsx (SSR first paint). Takes an already-validated query,
 * calls the search_adverts RPC via the session-scoped server client (RLS parity
 * with the API — the SSR set must equal what the client would fetch), projects
 * to card fields, and resolves images + like counts in one parallel wave.
 *
 * Returns a discriminated result so the API route can preserve its exact
 * FETCH_FAILED envelope on an RPC error, while the RSC page can degrade to an
 * empty shell (letting the client island re-fetch) instead of throwing a 500.
 */
export async function executeSearch(
  params: SearchAdvertsQuery,
): Promise<ExecuteSearchResult> {
  const pageOffset = params.page * params.limit;

  const rpcArgs = {
    search_query: params.q ?? undefined,
    category_id_filter: params.category_id ?? undefined,
    price_min_filter: params.price_min ?? undefined,
    price_max_filter: params.price_max ?? undefined,
    location_filter: params.location ?? undefined,
    location_lat: params.lat ?? undefined,
    location_lng: params.lng ?? undefined,
    radius_km: params.radius_km ?? 50,
    sort_by: params.sort_by ?? undefined,
    page_offset: pageOffset,
    page_limit: params.limit,
    verified_only: params.verified_only ?? false,
    condition_filter: params.condition ?? undefined,
  };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("search_adverts", rpcArgs);

  if (error) {
    return { ok: false, supabaseError: error };
  }

  // total_count rides on every RPC row; fall back to array length if absent.
  const totalCount =
    data && data.length > 0 ? (data[0]?.total_count ?? data.length) : 0;

  const results =
    (data as SearchRpcRow[] | null)?.map((row) => ({
      id: row.id,
      user_id: row.user_id ?? null,
      category_id: row.category_id ?? null,
      title: row.title,
      price: row.price ?? null,
      currency: row.currency ?? null,
      location: row.location ?? null,
      created_at: row.created_at ?? null,
      seller_verified: Boolean(row.seller_verified),
    })) ?? [];

  const ids = results.map((r) => r.id);
  const [imageMap, likeMap] = await Promise.all([
    resolveFirstImages(ids, { cap: params.limit }),
    resolveLikeCounts(ids, { cap: params.limit }),
  ]);

  const items: SearchResultItem[] = results.map((r) => ({
    ...r,
    image: imageMap.get(r.id) ?? null,
    like_count: likeMap.get(r.id) ?? 0,
  }));

  return {
    ok: true,
    payload: {
      items,
      total: totalCount,
      page: params.page,
      limit: params.limit,
      hasMore: totalCount > pageOffset + results.length,
    },
  };
}
