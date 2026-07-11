export const runtime = "nodejs";
// Dynamic on purpose: results are per-query and executeSearch reads cookies via
// supabaseServer (session/RLS-scoped) — same reason PERF-01 could not ISR the ad
// page. No `revalidate`: a copied TTL would risk caching one viewer's scoped
// results for another. (search/layout.tsx already sets robots: noindex.)
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { validateRequest, searchAdvertsQuerySchema } from "@/lib/validations";
import { executeSearch, type SearchResultItem } from "@/lib/search/executeSearch";
import {
  buildOutsideRadiusParams,
  buildRelaxedParams,
  buildSearchRequestParams,
  readSearchRequestFromParams,
} from "@/lib/search/buildSearchParams";
import {
  OUTSIDE_RADIUS_LIMIT,
  OUTSIDE_RADIUS_THRESHOLD,
  SEARCH_PAGE_LIMIT,
} from "@/lib/search/constants";
import { AdsGridSkeleton } from "@/components/marketplace-grid-states";
import { getIntegrationStatus } from "@/lib/integrations/registry";
import SearchClient, { type SearchInitialState } from "./SearchClient";

type RawSearchParams = Record<string, string | string[] | undefined>;

// Next hands searchParams as a plain object (values can repeat → string[]).
// Collapse to a URLSearchParams taking the first value of any repeated key, to
// match the client's useSearchParams().get() semantics.
function toURLSearchParams(raw: RawSearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    sp.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
  }
  return sp;
}

// Validate a canonical request URLSearchParams and run the search. Returns null
// on validation failure or a transient RPC error so the caller can degrade to an
// empty shell (letting the client island re-fetch) instead of throwing a 500.
async function runSearch(params: URLSearchParams): Promise<SearchResultItem[] | null> {
  const validation = validateRequest(searchAdvertsQuerySchema, Object.fromEntries(params));
  if (!validation.success) return null;
  const result = await executeSearch(validation.data);
  return result.ok ? result.payload.items : null;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const discoverStatusPromise = getIntegrationStatus("discover_v2");
  const sp = toURLSearchParams(await searchParams);
  const baseRequest = readSearchRequestFromParams(sp, SEARCH_PAGE_LIMIT);
  const mainParams = buildSearchRequestParams(baseRequest);
  // Canonical signature the seed corresponds to — the client fetch guard keys on it.
  const key = mainParams.toString();
  const page = baseRequest.page ?? 0;

  // Main (first page) search — this is what lands in the SSR HTML.
  const mainValidation = validateRequest(
    searchAdvertsQuerySchema,
    Object.fromEntries(mainParams),
  );
  const mainResult = mainValidation.success ? await executeSearch(mainValidation.data) : null;

  let initial: SearchInitialState;

  if (!mainResult || !mainResult.ok) {
    // SSR search failed (bad params / transient) → empty shell; client re-fetches.
    initial = {
      hydrated: false,
      key,
      items: [],
      total: 0,
      hasMore: false,
      page,
      outsideItems: [],
      relaxedItems: [],
      relaxedTotal: 0,
    };
  } else {
    const { items, total, hasMore } = mainResult.payload;

    // Fallbacks mirror the client precedence exactly: exact → +outside-radius
    // (geo, when few exact matches) → relaxed (drop price/condition/verified,
    // when truly empty) → true-empty. Only on page 0. The precedence is
    // inherently sequential (relaxed only when the geo expansion found nothing),
    // so these two cannot be parallelized without changing behavior.
    let outsideItems: SearchResultItem[] = [];
    let relaxedItems: SearchResultItem[] = [];
    let relaxedTotal = 0;

    if (
      page === 0 &&
      items.length < OUTSIDE_RADIUS_THRESHOLD &&
      Boolean(baseRequest.lat && baseRequest.lng)
    ) {
      const outsideParams = buildOutsideRadiusParams({ ...baseRequest, limit: OUTSIDE_RADIUS_LIMIT });
      if (outsideParams) {
        const expanded = await runSearch(outsideParams);
        if (expanded) {
          const inRadius = new Set(items.map((i) => i.id));
          outsideItems = expanded
            .filter((i) => !inRadius.has(i.id))
            .slice(0, OUTSIDE_RADIUS_THRESHOLD);
        }
      }
    }

    if (page === 0 && total === 0 && outsideItems.length === 0) {
      const relaxedParams = buildRelaxedParams({ ...baseRequest, limit: OUTSIDE_RADIUS_LIMIT });
      if (relaxedParams) {
        const validation = validateRequest(
          searchAdvertsQuerySchema,
          Object.fromEntries(relaxedParams),
        );
        if (validation.success) {
          const relaxedResult = await executeSearch(validation.data);
          if (relaxedResult.ok) {
            relaxedItems = relaxedResult.payload.items.slice(0, OUTSIDE_RADIUS_THRESHOLD);
            relaxedTotal = relaxedResult.payload.total;
          }
        }
      }
    }

    initial = {
      hydrated: true,
      key,
      items,
      total,
      hasMore,
      page: mainResult.payload.page,
      outsideItems,
      relaxedItems,
      relaxedTotal,
    };
  }

  return (
    <Suspense
      fallback={
        <div className="py-4 md:py-6">
          <AdsGridSkeleton count={12} gridColsClass="grid-cols-2 lg:grid-cols-3" />
        </div>
      }
    >
      <SearchClient initial={initial} discoverEnabled={(await discoverStatusPromise).effective} />
    </Suspense>
  );
}
