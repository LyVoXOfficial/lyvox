type SearchRequestParamsInput = {
  query?: string;
  categoryId?: string | null;
  priceMin?: string | null;
  priceMax?: string | null;
  location?: string | null;
  lat?: string | null;
  lng?: string | null;
  radiusKm?: string | null;
  sortBy?: string;
  page?: number;
  limit?: number;
  verifiedOnly?: boolean;
  condition?: string | null;
  sourceParams?: URLSearchParams;
};

const hasCoordinatePair = (lat?: string | null, lng?: string | null) => Boolean(lat && lng);

export function buildSearchRequestParams(input: SearchRequestParamsInput) {
  const params = new URLSearchParams();

  if (input.query) params.set("q", input.query);
  if (input.categoryId) params.set("category_id", input.categoryId);
  if (input.priceMin) params.set("price_min", input.priceMin);
  if (input.priceMax) params.set("price_max", input.priceMax);
  if (hasCoordinatePair(input.lat, input.lng)) {
    params.set("lat", input.lat as string);
    params.set("lng", input.lng as string);
    if (input.radiusKm) params.set("radius_km", input.radiusKm);
  } else if (input.location) {
    params.set("location", input.location);
  }

  params.set("sort_by", input.sortBy ?? "created_at_desc");
  params.set("page", String(input.page ?? 0));
  params.set("limit", String(input.limit ?? 24));

  if (input.verifiedOnly) params.set("verified_only", "true");
  if (input.condition) params.set("condition", input.condition);

  input.sourceParams?.forEach((value, key) => {
    if (key.startsWith("catalog_field_")) {
      params.set(key, value);
    }
  });

  return params;
}

/**
 * Zero-result relaxation (T14 item 2): when an exact search returns nothing,
 * loosen the *restrictive* filters (price range, condition, verified-only) while
 * keeping the intent-defining ones (query, category, location). Returns null when
 * there is nothing to relax — so the caller only broadens when it can honestly
 * offer "similar nearby" instead of a dead end. Results are still real rows from
 * the loosened query; nothing is fabricated.
 */
export function buildRelaxedParams(input: SearchRequestParamsInput) {
  const hasRelaxableFilter = Boolean(
    input.priceMin || input.priceMax || input.condition || input.verifiedOnly,
  );
  if (!hasRelaxableFilter) return null;

  return buildSearchRequestParams({
    ...input,
    priceMin: null,
    priceMax: null,
    condition: null,
    verifiedOnly: false,
    page: 0,
  });
}

export function buildOutsideRadiusParams(
  input: SearchRequestParamsInput,
  multiplier = 3,
) {
  if (!hasCoordinatePair(input.lat, input.lng)) return null;

  const radius = Number.parseFloat(input.radiusKm ?? "");
  if (!Number.isFinite(radius) || radius <= 0) return null;

  return buildSearchRequestParams({
    ...input,
    radiusKm: String(radius * multiplier),
    page: 0,
  });
}
