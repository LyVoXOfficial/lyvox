import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";
import { supabaseService } from "@/lib/supabaseService";
import { supabaseServer } from "@/lib/supabaseServer";
import { getMediaPreviewPublicUrl } from "@/lib/media/previewUrls";
import { loadCatalogGroups } from "@/lib/catalog/loadCatalogGroups";
import { detectCategoryType, type CategoryType } from "@/lib/utils/categoryDetector";
import { isCapabilityEnabled } from "@/lib/capabilities";
import {
  buildAdvertSourceHash,
  resolveAdvertSourceLocale,
} from "@/lib/translations/advertTranslations";
import type { Locale } from "@/lib/i18n";
import type { Tables } from "@/lib/supabaseTypes";
import type { BusinessPublicData } from "@/components/business/TraderPanel";
import type { CatalogFieldDefinition, CatalogSchemaGroup } from "@/catalog/renderer/types";

// PERF-01: single source of truth for the (viewer-independent) advert-detail
// payload. This is wrapped in `unstable_cache` so warm requests skip the ~18
// DB round-trips the page used to run sequentially per view. Two invariants
// make caching safe:
//   1. The cached wrapper only ever stores `status = 'active'` adverts, so the
//      shared Data Cache never holds a private/draft row. Drafts load uncached
//      per-request and are gated to their owner (see getAdvertDetail).
//   2. Nothing viewer-specific lives in here (no cookies/session, no
//      canSeeSeller). Media are returned as RAW storage paths and signed
//      per-request OUTSIDE the cache — signed URLs expire (~15m) and must never
//      be baked into a longer-lived cache entry.

const ADVERT_DETAIL_REVALIDATE_SECONDS = 120;

// Single source of truth for the per-advert cache tag. The unstable_cache
// wrapper and every mutation-side invalidation MUST use this exact string, or
// invalidation silently no-ops (advisor: "tag must exact-match").
export function advertCacheTag(advertId: string): string {
  return `advert:${advertId}`;
}

/**
 * Purge the cached /ad/[id] detail after a mutation. Best-effort: outside a
 * request/work store (e.g. a unit test invoking a route handler directly)
 * revalidateTag throws — there is nothing to purge there, and the revalidate
 * window covers any staleness, so we swallow it.
 */
export function revalidateAdvert(advertId: string): void {
  try {
    revalidateTag(advertCacheTag(advertId), "max");
  } catch {
    // no work store (tests / non-request context) — nothing to invalidate.
  }
}

const CACHE_DEBUG = process.env.ADVERT_CACHE_DEBUG === "1";
function cacheLog(message: string, context?: Record<string, unknown>) {
  if (CACHE_DEBUG) {
    // Fires only on a cold load (cache miss). Absence on a 2nd hit proves the
    // Data Cache served the request without touching Postgres.
    console.info(`[advertDetail] ${message}`, context ?? {});
  }
}

export type AdvertRecord = Pick<
  Tables<"adverts">,
  | "id"
  | "user_id"
  | "category_id"
  | "title"
  | "description"
  | "price"
  | "currency"
  | "location"
  | "created_at"
  | "status"
  | "business_id"
  | "content_locale"
  | "generation_id"
>;

export type AdvertTranslationRecord = Pick<
  Tables<"advert_translations">,
  | "source_locale"
  | "target_locale"
  | "title"
  | "description"
  | "generated_by"
  | "model_or_provider"
  | "source_hash"
>;

export type VehicleMake = {
  id: string;
  name_en: string | null;
  vehicle_make_i18n?: Array<{ name: string | null }>;
};

export type VehicleModel = {
  id: string;
  name_en: string | null;
  vehicle_model_i18n?: Array<{ name: string | null }>;
};

export type VehicleColor = {
  id: string;
  name_en: string | null;
  name_nl: string | null;
  name_fr: string | null;
  name_de: string | null;
  name_ru: string | null;
};

export type VehicleOption = {
  id: string;
  category: string;
  code: string;
  name_en: string | null;
  name_nl: string | null;
  name_fr: string | null;
  name_de: string | null;
  name_ru: string | null;
};

export type CategorySummary = {
  path: string;
  slug: string;
  level: number;
  name_en: string | null;
  name_nl: string | null;
  name_fr: string | null;
  name_de: string | null;
  name_ru: string | null;
};

export type VehicleGeneration = {
  id: string;
  model_id: string;
  code: string | null;
  start_year: number | null;
  end_year: number | null;
  facelift: boolean | null;
  summary: string | null;
  production_countries: string[] | null;
  vehicle_generation_i18n?: Array<{
    locale: string;
    summary: string | null;
    pros: string[] | null;
    cons: string[] | null;
    inspection_tips: string[] | null;
  }>;
};

export type VehicleInsights = {
  generation_id: string;
  pros: string[] | null;
  cons: string[] | null;
  inspection_tips: string[] | null;
  notable_features: string[] | null;
  engine_examples: string[] | null;
  common_issues: string[] | null;
  reliability_score: number | null;
  popularity_score: number | null;
  vehicle_generation_insights_i18n?: Array<{
    locale: string;
    pros: string[] | null;
    cons: string[] | null;
    inspection_tips: string[] | null;
    notable_features: string[] | null;
    engine_examples: string[] | null;
    common_issues: string[] | null;
  }>;
};

export type SellerInfo = {
  id: string;
  displayName: string | null;
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  trustScore: number;
  createdAt: string | null;
  activeAdverts: number;
};

// Raw (unsigned) media row. `url`/`preview_url` are storage paths; the page
// signs them per-request via signMediaUrls (see the caching invariant above).
export type RawMediaItem = {
  id: string;
  url: string | null;
  preview_url: string | null;
  sort: number | null;
  w: number | null;
  h: number | null;
};

export type AdvertDetail = {
  advert: AdvertRecord;
  translation: AdvertTranslationRecord | null;
  specifics: Record<string, any>;
  media: RawMediaItem[];
  make: VehicleMake | null;
  model: VehicleModel | null;
  color: VehicleColor | null;
  generations: VehicleGeneration[];
  selectedGeneration: VehicleGeneration | null;
  insights: VehicleInsights | null;
  vehicleOptions: VehicleOption[];
  seller: SellerInfo;
  category: CategorySummary | null;
  categoryBreadcrumbs: CategorySummary[];
  benefits: Array<{ benefit_type: string; valid_until: string }>;
  businessData: BusinessPublicData | null;
  listingDomain: CategoryType;
  catalogGroups: CatalogSchemaGroup[];
  catalogFields: Record<string, CatalogFieldDefinition>;
};

export type SimilarAdvertItem = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  location: string | null;
  createdAt: string | null;
  image: string | null;
  sellerVerified?: boolean;
};

// Raw similar-advert row: media kept as paths so the page can batch-sign them.
export type SimilarAdvertRaw = Omit<SimilarAdvertItem, "image"> & {
  media: Array<{ url: string | null; preview_url: string | null; sort: number | null }>;
};

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

// Exported for unit testing — an option is "on" unless it is an explicit falsy.
export function isTruthyOption(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const str = String(value).toLowerCase();
  return str !== "false" && str !== "0" && str !== "no" && str !== "";
}

// PERF-01: the old loader pulled the ENTIRE vehicle_options catalog on every
// view. Options are referenced in specifics as `option_<category>_<code>`;
// getOptionLabel only needs rows whose category is referenced. Extract that set
// so we can filter the query (or skip it entirely when nothing is referenced).
export function extractReferencedOptionCategories(
  specifics: Record<string, unknown> | null | undefined,
): string[] {
  const categories = new Set<string>();
  for (const [key, value] of Object.entries(specifics ?? {})) {
    if (!key.startsWith("option_")) continue;
    if (!isTruthyOption(value)) continue;
    const rest = key.slice("option_".length); // "<category>_<code>"
    const category = rest.split("_")[0];
    if (category) categories.add(category);
  }
  return [...categories];
}

function parseAdvertYear(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function determineGeneration(
  generations: VehicleGeneration[],
  specifics: Record<string, any>,
  advertGenerationId?: string | null,
): VehicleGeneration | null {
  if (!generations.length) return null;

  // F7: prefer the normalized FK column (explicit seller choice).
  const fkId = advertGenerationId ?? null;
  if (fkId) {
    const match = generations.find((g) => g.id === fkId);
    if (match) return match;
  }

  // Backward compat: try JSONB specifics.generation_id (pre-F7 records).
  const jsonbId = specifics.generation_id ? String(specifics.generation_id) : null;
  if (jsonbId) {
    const match = generations.find((g) => g.id === jsonbId);
    if (match) return match;
  }

  // Year-range fallback — ONLY when result is unambiguous (bug #1996).
  const advertYear = parseAdvertYear(specifics.year);
  if (advertYear) {
    const matching = generations.filter((g) => {
      const startOk = g.start_year === null || g.start_year <= advertYear;
      const endOk = g.end_year === null || g.end_year >= advertYear;
      return startOk && endOk;
    });
    if (matching.length === 1) return matching[0];
  }

  if (generations.length === 1) return generations[0];

  return null;
}

type ServiceClient = Awaited<ReturnType<typeof supabaseService>>;

async function loadVehicleInsights(
  client: ServiceClient,
  generationId: string,
): Promise<VehicleInsights | null> {
  const { data, error } = await client
    .from("vehicle_generation_insights")
    .select("*")
    .eq("generation_id", generationId)
    .limit(1);

  const base = Array.isArray(data) ? data[0] : null;
  if (error || !base) {
    if (error) console.warn("Failed to load vehicle insights", { generationId, error });
    return null;
  }

  const normalizedBase: VehicleInsights = {
    ...(base as VehicleInsights),
    reliability_score: normalizeNullableNumber((base as VehicleInsights).reliability_score),
    popularity_score: normalizeNullableNumber((base as VehicleInsights).popularity_score),
  };

  const { data: translations } = await client
    .from("vehicle_generation_insights_i18n")
    .select("locale, pros, cons, inspection_tips, notable_features, engine_examples, common_issues")
    .eq("generation_id", generationId);

  return { ...normalizedBase, vehicle_generation_insights_i18n: translations ?? [] };
}

/**
 * Load the full (viewer-independent) advert detail. Wave-parallelized: each
 * `Promise.all` fires all queries whose inputs are already known, so cold
 * regeneration issues ~3 waves instead of ~18 sequential round-trips.
 *
 * @param onlyActive when true, returns null unless the advert is `status='active'`.
 *   The cached wrapper passes true so the shared cache only holds public rows.
 */
export async function loadAdvertDetailCore(
  advertId: string,
  locale: Locale,
  onlyActive: boolean,
): Promise<AdvertDetail | null> {
  let svc: ServiceClient;
  try {
    svc = await supabaseService();
  } catch (error) {
    console.error("loadAdvertDetailCore: service client unavailable", { advertId, error });
    return null;
  }

  cacheLog("core:cold-load", { advertId, locale, onlyActive });

  try {
    // ── Wave 0: everything keyed on advert id (known upfront) ──────────────
    const nowIso = new Date().toISOString();
    const [advertRes, specificsRes, mediaRes, benefitsRes] = await Promise.all([
      svc
        .from("adverts")
        .select(
          "id,user_id,category_id,title,description,price,currency,location,created_at,status,business_id,content_locale,generation_id",
        )
        .eq("id", advertId)
        .limit(1),
      svc.from("ad_item_specifics").select("specifics").eq("advert_id", advertId).limit(1),
      svc
        .from("media")
        .select("id,url,preview_url,sort,w,h")
        .eq("advert_id", advertId)
        .order("sort", { ascending: true }),
      svc
        .from("benefits")
        .select("benefit_type, valid_until")
        .eq("advert_id", advertId)
        .gt("valid_until", nowIso),
    ]);

    const advert = Array.isArray(advertRes.data)
      ? (advertRes.data[0] as AdvertRecord | undefined)
      : undefined;

    if (advertRes.error) {
      console.error("Failed to load advert record", { advertId, error: advertRes.error });
      return null;
    }
    if (!advert) return null;
    if (onlyActive && advert.status !== "active") return null;

    const specificsRecord = Array.isArray(specificsRes.data) ? specificsRes.data[0] : null;
    const specifics = ((specificsRecord as any)?.specifics ?? {}) as Record<string, any>;

    const media: RawMediaItem[] = (
      (mediaRes.data as RawMediaItem[] | null) ?? []
    ).map((row) => ({
      id: row.id,
      url: row.url ?? null,
      preview_url: (row as any).preview_url ?? null,
      sort: row.sort ?? null,
      w: row.w ?? null,
      h: row.h ?? null,
    }));

    const benefits = ((benefitsRes.data as Array<{ benefit_type: string; valid_until: string }>) ?? []).map(
      (b) => ({ benefit_type: b.benefit_type, valid_until: b.valid_until }),
    );

    // Derived inputs for wave 1.
    const makeId = specifics.make_id ? String(specifics.make_id) : null;
    const modelId = specifics.model_id ? String(specifics.model_id) : null;
    const colorId = specifics.color_id ? String(specifics.color_id) : null;
    const optionCategories = extractReferencedOptionCategories(specifics);

    const sourceLocale = resolveAdvertSourceLocale(advert.content_locale);
    const wantsTranslation =
      isCapabilityEnabled("advert_translations") && locale !== sourceLocale;
    const sourceHash = wantsTranslation ? buildAdvertSourceHash(advert) : null;

    // ── Wave 1: everything derivable from the advert row + specifics ───────
    const [
      translationRes,
      categoryRes,
      profileRes,
      trustRes,
      activeCountRes,
      businessRes,
      makeRes,
      modelRes,
      colorRes,
      generationsRes,
      optionsRes,
    ] = await Promise.all([
      wantsTranslation
        ? svc
            .from("advert_translations")
            .select(
              "source_locale,target_locale,title,description,generated_by,model_or_provider,source_hash",
            )
            .eq("advert_id", advertId)
            .eq("target_locale", locale)
            .eq("source_hash", sourceHash!)
            .eq("status", "published")
            .order("updated_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: null, error: null } as const),
      advert.category_id
        ? svc
            .from("categories")
            .select("path, slug, level, name_en, name_nl, name_fr, name_de, name_ru")
            .eq("id", advert.category_id)
            .limit(1)
        : Promise.resolve({ data: null, error: null } as const),
      svc
        .from("profiles")
        .select("display_name, verified_email, verified_phone, created_at")
        .eq("id", advert.user_id)
        .limit(1),
      svc.from("trust_score").select("score").eq("user_id", advert.user_id).limit(1),
      svc
        .from("adverts")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", advert.user_id)
        .eq("status", "active"),
      advert.business_id
        ? // biz_public_read RLS = `status='active'`; replicate it explicitly
          // since the service client bypasses RLS (advisor trap #1).
          svc
            .from("businesses")
            .select(
              "legal_name,trade_name,legal_form,address_line,postcode,city,country,kbo_number,vat_number,email,phone_e164,withdrawal_terms,self_certified_at,entity_verified",
            )
            .eq("id", advert.business_id)
            .eq("status", "active")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      makeId
        ? svc
            .from("vehicle_makes")
            .select("id, name_en, vehicle_make_i18n(name)")
            .eq("id", makeId)
            .limit(1)
        : Promise.resolve({ data: null, error: null } as const),
      modelId
        ? svc
            .from("vehicle_models")
            .select("id, name_en, vehicle_model_i18n(name)")
            .eq("id", modelId)
            .limit(1)
        : Promise.resolve({ data: null, error: null } as const),
      colorId
        ? svc
            .from("vehicle_colors")
            .select("id, name_en, name_nl, name_fr, name_de, name_ru")
            .eq("id", colorId)
            .limit(1)
        : Promise.resolve({ data: null, error: null } as const),
      modelId
        ? svc
            .from("vehicle_generations")
            .select(
              "id, model_id, code, start_year, end_year, facelift, summary, production_countries, vehicle_generation_i18n(locale, summary, pros, cons, inspection_tips)",
            )
            .eq("model_id", modelId)
            .order("start_year", { ascending: true })
        : Promise.resolve({ data: null, error: null } as const),
      optionCategories.length
        ? svc
            .from("vehicle_options")
            .select("id, category, code, name_en, name_nl, name_fr, name_de, name_ru")
            .in("category", optionCategories)
            .order("category", { ascending: true })
            .order("name_en", { ascending: true })
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    // Translation
    let translation: AdvertTranslationRecord | null = null;
    if (!translationRes.error && Array.isArray(translationRes.data)) {
      translation = (translationRes.data[0] as AdvertTranslationRecord | undefined) ?? null;
    }

    // Category + breadcrumbs (breadcrumbs need category.path → wave 2)
    const category = (
      Array.isArray(categoryRes.data) ? (categoryRes.data[0] as CategorySummary | undefined) : undefined
    ) ?? null;

    // Seller
    const profile = Array.isArray(profileRes.data) ? profileRes.data[0] : null;
    const trust = Array.isArray(trustRes.data) ? trustRes.data[0] : null;
    const seller: SellerInfo = {
      id: advert.user_id,
      displayName: (profile as any)?.display_name ?? null,
      verifiedEmail: Boolean((profile as any)?.verified_email),
      verifiedPhone: Boolean((profile as any)?.verified_phone),
      trustScore: (trust as any)?.score ?? 0,
      createdAt: (profile as any)?.created_at ?? null,
      activeAdverts: activeCountRes.count ?? 0,
    };

    const businessData = (businessRes.data as BusinessPublicData | null) ?? null;

    const make = (Array.isArray(makeRes.data) ? (makeRes.data[0] as VehicleMake) : null) ?? null;
    const model = (Array.isArray(modelRes.data) ? (modelRes.data[0] as VehicleModel) : null) ?? null;
    const color = (Array.isArray(colorRes.data) ? (colorRes.data[0] as VehicleColor) : null) ?? null;
    const generations = (
      !generationsRes.error && Array.isArray(generationsRes.data)
        ? (generationsRes.data as VehicleGeneration[])
        : []
    );
    const vehicleOptions = ((optionsRes.data as VehicleOption[] | null) ?? []) as VehicleOption[];

    const selectedGeneration = determineGeneration(generations, specifics, advert.generation_id);
    const insightsGenerationId =
      advert.generation_id ?? specifics.generation_id ?? selectedGeneration?.id ?? null;

    // Domain drives both catalog schema and the page's JSON-LD/spec renderers.
    const listingDomain: CategoryType = make
      ? "vehicle"
      : detectCategoryType(category?.path ?? category?.slug ?? "");

    // Breadcrumb category paths (each ancestor prefix of category.path).
    const crumbPaths = category?.path
      ? category.path
          .split("/")
          .filter(Boolean)
          .map((_, idx, arr) => arr.slice(0, idx + 1).join("/"))
      : [];

    // ── Wave 2: needs wave-1 outputs (category.path, generation, domain) ───
    const [breadcrumbsRes, insights, catalog] = await Promise.all([
      crumbPaths.length
        ? svc
            .from("categories")
            .select("path, slug, level, name_en, name_nl, name_fr, name_de, name_ru")
            .in("path", crumbPaths)
        : Promise.resolve({ data: null, error: null } as const),
      insightsGenerationId
        ? loadVehicleInsights(svc, String(insightsGenerationId))
        : Promise.resolve(null),
      loadCatalogGroups(listingDomain, svc).catch(() => ({ groups: [], fields: {} })),
    ]);

    const categoryBreadcrumbs = Array.isArray(breadcrumbsRes.data)
      ? (breadcrumbsRes.data as CategorySummary[]).sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
      : [];

    return {
      advert,
      translation,
      specifics,
      media,
      make,
      model,
      color,
      generations,
      selectedGeneration,
      insights,
      vehicleOptions,
      seller,
      category,
      categoryBreadcrumbs,
      benefits,
      businessData,
      listingDomain,
      catalogGroups: catalog.groups,
      catalogFields: catalog.fields,
    };
  } catch (error) {
    console.error("loadAdvertDetailCore unexpected error", { advertId, error });
    return null;
  }
}

/**
 * Cached loader for PUBLIC (active) adverts. The shared Data Cache only ever
 * holds active rows, so serving a cache entry can never leak a draft. Keyed by
 * (advertId, locale); invalidated by `revalidateTag('advert:'+id)` on mutation.
 */
export function getCachedActiveAdvertDetail(
  advertId: string,
  locale: Locale,
): Promise<AdvertDetail | null> {
  return unstable_cache(
    () => loadAdvertDetailCore(advertId, locale, true),
    ["advert-detail", advertId, locale],
    { revalidate: ADVERT_DETAIL_REVALIDATE_SECONDS, tags: ["advert", advertCacheTag(advertId)] },
  )();
}

/**
 * Viewer-aware entry point. Returns the cached public payload for active
 * adverts; for non-active adverts it loads uncached and returns the row only to
 * its owner (replicating the original `status!=='active' && user!==owner → 404`
 * gate). This keeps drafts out of the shared cache entirely.
 */
export async function getAdvertDetail(
  advertId: string,
  locale: Locale,
  currentUserId: string | null,
): Promise<AdvertDetail | null> {
  const active = await getCachedActiveAdvertDetail(advertId, locale);
  if (active) return active;

  // Not active (or not found). Only an authenticated owner may see it.
  if (!currentUserId) return null;

  const draft = await loadAdvertDetailCore(advertId, locale, false);
  if (!draft) return null;
  // Race: became active between the two loads → public, fine to show.
  if (draft.advert.status === "active") return draft;
  if (draft.advert.user_id !== currentUserId) return null;
  return draft;
}

/**
 * Similar adverts (raw media paths — signed by the caller). Cached per category
 * since it is viewer-independent; tagged so a category's listings refresh when
 * one is mutated.
 */
async function loadSimilarAdvertsRaw(
  advertId: string,
  categoryId: string,
): Promise<SimilarAdvertRaw[]> {
  let client: ServiceClient;
  try {
    client = await supabaseService();
  } catch {
    return [];
  }

  try {
    const { data, error } = await client
      .from("adverts")
      .select(
        "id, title, price, currency, location, created_at, user_id, media(url, preview_url, sort)",
      )
      .eq("category_id", categoryId)
      .eq("status", "active")
      .neq("id", advertId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error || !data) {
      if (error) console.warn("Failed to load similar adverts", { advertId, error });
      return [];
    }

    const userIds = data
      .map((row) => row.user_id)
      .filter((value): value is string => typeof value === "string");

    let verifiedMap = new Map<string, boolean>();
    if (userIds.length) {
      const { data: profilesData } = await client
        .from("profiles")
        .select("id,verified_email,verified_phone")
        .in("id", userIds);
      if (profilesData) {
        verifiedMap = new Map(
          profilesData.map((profile) => [
            profile.id,
            Boolean(profile.verified_email) && Boolean(profile.verified_phone),
          ]),
        );
      }
    }

    return data.map((row) => ({
      id: row.id,
      title: row.title,
      price: normalizeNullableNumber(row.price),
      currency: row.currency ?? "EUR",
      location: row.location,
      createdAt: row.created_at ?? null,
      sellerVerified: verifiedMap.get(row.user_id ?? "") ?? false,
      media: Array.isArray(row.media)
        ? row.media.map((item) => ({
            url: item?.url ?? null,
            preview_url: item?.preview_url ?? null,
            sort: item?.sort ?? null,
          }))
        : [],
    }));
  } catch (error) {
    console.warn("Failed to load similar adverts (unexpected)", { advertId, error });
    return [];
  }
}

export function getCachedSimilarAdverts(
  advertId: string,
  categoryId: string | null,
): Promise<SimilarAdvertRaw[]> {
  if (!categoryId) return Promise.resolve([]);
  return unstable_cache(
    () => loadSimilarAdvertsRaw(advertId, categoryId),
    ["advert-similar", advertId, categoryId],
    { revalidate: ADVERT_DETAIL_REVALIDATE_SECONDS, tags: ["advert", `advert-category:${categoryId}`] },
  )();
}

export { getMediaPreviewPublicUrl };
