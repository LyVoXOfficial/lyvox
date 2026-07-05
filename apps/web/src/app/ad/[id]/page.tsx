import type { Metadata } from "next";

import { CheckCircle2, ChevronDown, CircleAlert, Clock, MapPin, MessageSquare, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import AdvertGallery from "@/components/AdvertGallery";
import PublishedShareBanner from "@/components/ad/PublishedShareBanner";
import ListingCompletionBanner from "@/components/ad/ListingCompletionBanner";
import AdvertDetails from "@/components/AdvertDetails";
import AdvertContactPanel from "@/components/AdvertContactPanel";
import SellerCard from "@/components/SellerCard";
import SimilarAdverts from "@/components/SimilarAdverts";
import BenefitsBadge from "@/components/BenefitsBadge";
import LikeToggle from "@/components/likes/LikeToggle";
import RecentlyViewedRecorder from "@/components/discovery/RecentlyViewedRecorder";
import { formatCurrency, formatDate } from "@/i18n/format";
import { getI18nProps, getInitialLocale } from "@/i18n/server";
import { localizeHref, type Locale } from "@/lib/i18n";
import { getJsonLdScriptProps } from "@/lib/seo";
import { absoluteUrl } from "@/lib/seo/baseUrl";
import {
  languageAlternates,
  localizedAbsoluteUrl,
  localizedCanonical,
} from "@/lib/seo/localizedUrls";
import { truncateDescription } from "@/lib/seo/catalog/common";
import { buildListingJsonLd } from "@/lib/seo/catalog/listingJsonLd";
import { resolvePostFlowMode } from "@/lib/utils/categoryDetector";
import { supabaseServer } from "@/lib/supabaseServer";
import { isViewerVerified } from "@/lib/auth/requireVerified";
import SellerIdentityGate from "@/components/trust/SellerIdentityGate";
import { signMediaUrls } from "@/lib/media/signMediaUrls";
import { getFirstImage } from "@/lib/media/getFirstImage";
import type { Tables } from "@/lib/supabaseTypes";
import { TraderPanel } from "@/components/business/TraderPanel";
import type { BusinessPublicData } from "@/components/business/TraderPanel";
import { LeaveReviewForm } from "@/components/reviews/LeaveReviewForm";
import AdvertMobileContactBar from "@/components/AdvertMobileContactBar";
import { KeySpecsStrip } from "@/components/ad/KeySpecsStrip";
import { DocumentBadges } from "@/components/ad/DocumentBadges";
import { CatalogDetailsSection } from "@/components/ad/CatalogDetailsSection";
import {
  AdvertTranslatedDescription,
  AdvertTranslatedTitle,
  AdvertTranslationControls,
  AdvertTranslationProvider,
} from "@/components/ad/AdvertTranslationView";
import { resolveAdvertSourceLocale } from "@/lib/translations/advertTranslations";
import { cache } from "react";
import {
  getAdvertDetail,
  getCachedActiveAdvertDetail,
  getCachedSimilarAdverts,
  type AdvertDetail,
} from "@/lib/advert/advertDetail";
import type { CatalogSchemaGroup } from "@/catalog/renderer/types";

// PERF-01: the page stays dynamically rendered — the root layout reads
// headers()/cookies() for locale, and the SEC-CSP per-request nonce depends on
// that dynamic render. The performance win comes from the DATA layer:
// getAdvertDetail caches the viewer-independent payload via unstable_cache, so
// warm requests skip the ~18-query per-view DB waterfall WITHOUT turning the
// route static (which would bake a stale CSP nonce → white-screen under
// enforce). `revalidate` here is a data-cache default, not route-level ISR.
export const revalidate = 120;

// De-dup the auth lookup across generateMetadata + the page + viewer checks.
const getRequestUserId = cache(async (): Promise<string | null> => {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch (error) {
    console.warn("Failed to resolve current user", error);
    return null;
  }
});

// Post-signing advert-detail shape: media carries signed URLs (raw storage
// paths are signed per-request, outside the cache — see advertDetail.ts).
type PageAdvertData = Omit<AdvertDetail, "media"> & { media: MediaItem[] };

const isDevEnvironment = process.env.NODE_ENV !== "production";

function advertDebug(message: string, context?: Record<string, unknown>) {
  if (!isDevEnvironment) {
    return;
  }
  if (context) {
    console.info(`[AdvertPage] ${message}`, context);
  } else {
    console.info(`[AdvertPage] ${message}`);
  }
}

type AdvertRecord = Pick<
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
>;

type AdvertTranslationRecord = Pick<
  Tables<"advert_translations">,
  | "source_locale"
  | "target_locale"
  | "title"
  | "description"
  | "generated_by"
  | "model_or_provider"
  | "source_hash"
>;

type Messages = Record<string, any>;
type TFunction = (key: string, params?: Record<string, string | number>) => string;

type VehicleMake = {
  id: string;
  name_en: string | null;
  vehicle_make_i18n?: Array<{ name: string | null }>;
};

type VehicleModel = {
  id: string;
  name_en: string | null;
  vehicle_model_i18n?: Array<{ name: string | null }>;
};

type VehicleColor = {
  id: string;
  name_en: string | null;
  name_nl: string | null;
  name_fr: string | null;
  name_de: string | null;
  name_ru: string | null;
};

type VehicleOption = {
  id: string;
  category: string;
  code: string;
  name_en: string | null;
  name_nl: string | null;
  name_fr: string | null;
  name_de: string | null;
  name_ru: string | null;
};

type CategorySummary = {
  path: string;
  slug: string;
  level: number;
  name_en: string | null;
  name_nl: string | null;
  name_fr: string | null;
  name_de: string | null;
  name_ru: string | null;
};

type VehicleGeneration = {
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

type VehicleInsights = {
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

type SellerInfo = {
  id: string;
  displayName: string | null;
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  trustScore: number;
  createdAt: string | null;
  activeAdverts: number;
};

type MediaItem = {
  id: string;
  url: string;
  sort: number | null;
  w: number | null;
  h: number | null;
};

type AdvertData = {
  advert: AdvertRecord;
  translation: AdvertTranslationRecord | null;
  specifics: Record<string, any>;
  media: MediaItem[];
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
  benefits: Array<{
    benefit_type: string;
    valid_until: string;
  }>;
  businessData: BusinessPublicData | null;
};

type SimilarAdvertItem = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  location: string | null;
  createdAt: string | null;
  image: string | null;
  sellerVerified?: boolean;
};

type TranslatedInsights = {
  pros: string[];
  cons: string[];
  inspectionTips: string[];
  notableFeatures: string[];
  engineExamples: string[];
  commonIssues: string[];
};

type GenerationLocaleData = {
  summary: string | null;
  pros: string[];
  cons: string[];
  inspectionTips: string[];
};

type DetailItem = {
  label: string;
  value: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-FR",
  nl: "nl-NL",
  ru: "ru-RU",
  de: "de-DE",
};

const SPEC_KEY_EXCLUSIONS = new Set(["make_id", "model_id", "color_id", "additional_phone", "generation_id"]);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  if (!isValidUuid(id)) {
    return {};
  }

  try {
    const locale = await getInitialLocale();
    // Metadata is public → only active adverts get rich OG tags (shared cache).
    const advertData = await getCachedActiveAdvertDetail(id, locale);

    if (!advertData) {
      return {};
    }

    // Real route is /ad/[id] — a single dynamic segment, no slug child route.
    // A canonical/og:url with an appended slug 404s; keep this id-only.
    const canonicalPath = `/ad/${advertData.advert.id}`;
    const canonical = localizedCanonical(canonicalPath, locale);
    const description = advertData.advert.description
      ? truncateDescription(advertData.advert.description, 160)
      : "";
    const primaryImage = advertData.media[0];
    const localeTag = resolveLocaleTag(locale);
    // Stable route (not the expiring signed URL) so cached OG metadata never
    // goes stale — see apps/web/src/app/og/advert/[id]/route.ts. Lives outside
    // /api/ because robots.ts disallows /api/ and scrapers honor robots.txt.
    const ogImageUrl = absoluteUrl(`/og/advert/${advertData.advert.id}`);

    return {
      title: advertData.advert.title,
      description,
      alternates: {
        canonical,
        languages: languageAlternates(canonicalPath),
      },
      openGraph: {
        title: advertData.advert.title,
        description,
        url: canonical,
        type: "article",
        locale: localeTag,
        images: primaryImage
          ? [
              {
                url: ogImageUrl,
                width: primaryImage.w ?? undefined,
                height: primaryImage.h ?? undefined,
                alt: advertData.advert.title,
              },
            ]
          : undefined,
      },
      twitter: {
        card: primaryImage ? "summary_large_image" : "summary",
        title: advertData.advert.title,
        description,
        images: primaryImage ? [ogImageUrl] : undefined,
      },
    };
  } catch (error) {
    console.error("generateMetadata error", { id, error });
    return {};
  }
}

export default async function AdvertPage({ params }: PageProps) {
  let resolvedId: string | null = null;
  try {
    const resolvedParams = await params;
    const rawId = resolvedParams?.id;
    const idCandidate = Array.isArray(rawId) ? rawId[0] : rawId;
    const id = typeof idCandidate === "string" ? idCandidate : "";
    resolvedId = id;
    advertDebug("Render start", { rawId, resolvedId: id });

    if (!isValidUuid(id)) {
      advertDebug("Invalid advert id", { resolvedId: id });
      return (
        <div className="space-y-8">
          <h1 className="text-2xl font-semibold">Invalid listing link</h1>
          <p className="text-sm text-muted-foreground">
            The listing identifier is invalid. Check the link and try again.
          </p>
        </div>
      );
    }

    let currentUserId: string | null = null;
    let locale: Locale = "en";
    let messages: Messages = {};
    let data: PageAdvertData | null = null;

    try {
      const [resolvedUserId, i18n] = await Promise.all([getRequestUserId(), getI18nProps()]);
      currentUserId = resolvedUserId;
      locale = i18n.locale;
      messages = i18n.messages;
      const detail = await getAdvertDetail(id, locale, currentUserId);
      if (detail) {
        // Sign media per-request (outside the cache — signed URLs expire ~15m).
        const signedRows = await signMediaUrls(detail.media);
        const media: MediaItem[] = [];
        for (const record of signedRows) {
          if (!record.signedUrl) continue;
          media.push({
            id: record.id,
            url: record.signedUrl,
            w: record.w ?? null,
            h: record.h ?? null,
            sort: record.sort ?? null,
          });
        }
        data = { ...detail, media };
      }
      advertDebug("Data load completed", {
        advertId: id,
        hasData: Boolean(data),
        locale,
        currentUserId,
      });
    } catch (error) {
      console.error("AdvertPage load error", { id, error });
      advertDebug("AdvertPage data load error", {
        advertId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return (
        <div className="space-y-8">
          <h1 className="text-2xl font-semibold">Could not load the page</h1>
          <p className="text-sm text-muted-foreground">
            We could not load this listing. Please refresh the page or try again later.
          </p>
        </div>
      );
    }

    if (!data) {
      advertDebug("Advert data not found", { advertId: id });
      // Graceful fallback instead of 404: show "not found" content,
      // avoids masking upstream data-loading issues during diagnostics.
      return (
        <div className="space-y-8">
          <h1 className="text-2xl font-semibold">Listing not found</h1>
          <p className="text-sm text-muted-foreground">
            We could not load this listing. It may have been removed or may be temporarily unavailable.
          </p>
        </div>
      );
    }

  // Viewer-specific + volatile reads run in parallel (none are cached):
  //  - viewerVerified: identity gate (per-viewer)
  //  - similar adverts: cached list of raw media paths (signed below)
  //  - like count: volatile, single RPC
  const [viewerVerified, similarRaw, likeCount] = await Promise.all([
    loadViewerVerified(currentUserId),
    getCachedSimilarAdverts(data.advert.id, data.advert.category_id),
    (async () => {
      const { data: likeCountData } = await (await supabaseServer()).rpc(
        "get_advert_like_count",
        { advert_id_param: data.advert.id },
      );
      return Number(likeCountData ?? 0);
    })(),
  ]);
  const isOwnListing = !!currentUserId && currentUserId === data.seller.id;
  const canSeeSeller = viewerVerified || isOwnListing;

  // Sign similar-advert media per-request (batched + memory-cached).
  const similarMediaFlat = similarRaw.flatMap((row) =>
    row.media.map((item) => ({
      advert_id: row.id,
      url: item.url,
      preview_url: item.preview_url,
      sort: item.sort,
    })),
  );
  const signedSimilarMedia = await signMediaUrls(similarMediaFlat);
  const similarMediaByAdvert = new Map<string, typeof signedSimilarMedia>();
  for (const item of signedSimilarMedia) {
    const list = similarMediaByAdvert.get(item.advert_id);
    if (list) {
      list.push(item);
    } else {
      similarMediaByAdvert.set(item.advert_id, [item]);
    }
  }
  const similarAdverts: SimilarAdvertItem[] = similarRaw.map((row) => ({
    id: row.id,
    title: row.title,
    price: row.price,
    currency: row.currency,
    location: row.location,
    createdAt: row.createdAt,
    image: getFirstImage(similarMediaByAdvert.get(row.id) ?? []),
    sellerVerified: row.sellerVerified,
  }));

  const t = createTranslator(messages);
  const translate = (key: string, fallback: string) => {
    return translateFallback(t, key, fallback);
  };

  const priceValue = normalizeNullableNumber(data.advert.price);
  const priceText =
    priceValue !== null
      ? formatCurrency(priceValue, locale, data.advert.currency ?? "EUR")
      : translate("advert.price_not_specified", "Price on request");

  const locationText =
    data.advert.location ??
    translate("advert.location_not_specified", "Location not set");

  const createdText = data.advert.created_at
    ? formatDate(data.advert.created_at, locale)
    : "";

  const makeName = getMakeName(data.make);
  const modelName = getModelName(data.model);
  const colorName = getColorName(data.color, locale);

  const detailItems = buildDetailItems({
    specifics: data.specifics,
    locale,
    makeName,
    modelName,
    colorName,
    t,
  });

  const optionLabels = buildOptionLabels({
    specifics: data.specifics,
    vehicleOptions: data.vehicleOptions,
    locale,
    t,
  });

  const galleryImages = data.media.map((item, index) => ({
    id: item.id,
    url: item.url,
    alt: `${data.advert.title} - ${translateFallback(
      t,
      "advert.gallery.image_alt",
      `Photo ${index + 1}`,
      { index: index + 1 },
    )}`,
    width: item.w ?? undefined,
    height: item.h ?? undefined,
  }));

  const translatedInsights = translateInsights(data.insights, locale);
  const generationLocale = data.selectedGeneration
    ? getGenerationLocaleData(data.selectedGeneration, locale)
    : null;

  const reliabilityScoreDisplay = formatScore(data.insights?.reliability_score);
  const popularityScoreDisplay = formatScore(data.insights?.popularity_score);
  const showScores = reliabilityScoreDisplay !== null || popularityScoreDisplay !== null;

  // Real route is /ad/[id] — a single dynamic segment, no slug child route.
  // A canonical/JSON-LD url with an appended slug 404s; keep this id-only.
  const canonicalPath = `/ad/${data.advert.id}`;
  const canonicalUrl = localizedCanonical(canonicalPath, locale);
  const imageUrls = galleryImages.map((image) => image.url).filter(Boolean);
  const primaryImageUrl = galleryImages[0]?.url ?? null;
  const listingPath = `/ad/${data.advert.id}`;
  const href = (path: string) => localizeHref(path, locale);
  const loginHref = href(`/login?next=${encodeURIComponent(href(listingPath))}`);
  const editHref = href(`/post?edit=${data.advert.id}`);
  const sellerVerified = data.seller.verifiedEmail && data.seller.verifiedPhone;

  const brandName =
    data.make?.vehicle_make_i18n?.[0]?.name ??
    data.make?.name_en ??
    null;

  const resolveCategoryName = (category: CategorySummary) => {
    const byLocale: Record<Locale, string | null> = {
      en: category.name_en,
      fr: category.name_fr,
      nl: category.name_nl,
      ru: category.name_ru,
      de: category.name_de,
    };

    return (
      byLocale[locale] ??
      category.name_en ??
      category.name_nl ??
      category.name_fr ??
      category.name_de ??
      category.name_ru ??
      category.slug
    );
  };

  const breadcrumbElements: Array<Record<string, unknown>> = [
    {
      "@type": "ListItem",
      position: 1,
      name: translate("common.home", "Home"),
      item: localizedAbsoluteUrl("/", locale),
    },
  ];

  if (data.categoryBreadcrumbs.length) {
    breadcrumbElements.push({
      "@type": "ListItem",
      position: breadcrumbElements.length + 1,
      name: translate("common.categories", "Categories"),
      item: localizedAbsoluteUrl("/c", locale),
    });

    const sortedBreadcrumbs = [...data.categoryBreadcrumbs].sort(
      (a, b) => (a.level ?? 0) - (b.level ?? 0),
    );

    sortedBreadcrumbs.forEach((category) => {
      breadcrumbElements.push({
        "@type": "ListItem",
        position: breadcrumbElements.length + 1,
        name: resolveCategoryName(category),
        item: localizedAbsoluteUrl(`/c/${category.path}`, locale),
      });
    });
  }

  breadcrumbElements.push({
    "@type": "ListItem",
    position: breadcrumbElements.length + 1,
    name: data.advert.title,
    item: canonicalUrl,
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbElements,
  };

  // F12: per-category structured data via the listing JSON-LD dispatcher.
  // Domain is derived from the category path; a vehicle make forces the vehicle
  // branch even if the category slug is ambiguous.
  // F12/F13: domain + catalog schema are derived and cached in the loader.
  const listingDomain = data.listingDomain;
  const listingFlowMode = resolvePostFlowMode(data.category?.path ?? data.category?.slug ?? "");
  const catalogGroups = data.catalogGroups;
  const catalogFields = data.catalogFields;

  const catalogSpecificValues = normalizeCatalogSpecificValues(data.specifics ?? {});
  const completion = getCatalogCompletion(catalogGroups, catalogSpecificValues);
  const showCompletionBanner =
    isOwnListing &&
    listingFlowMode === "fast_goods" &&
    completion !== null &&
    completion.filledCount < completion.targetCount;
  const completionEditHref = `${editHref}&complete=1`;

  const productJsonLd = buildListingJsonLd({
    domain: listingDomain,
    id: data.advert.id,
    title: data.advert.title,
    description: data.advert.description ?? null,
    url: canonicalUrl,
    images: imageUrls,
    price: priceValue,
    currency: data.advert.currency ?? "EUR",
    location: data.advert.location ?? null,
    createdAt: data.advert.created_at ?? null,
    specifics: data.specifics,
    vehicle: {
      brandName,
      modelName,
      colorName,
    },
    seller: {
      // Real seller node (was a hardcoded "LyVoX seller" stub): business →
      // Organization, private → Person. businessData present iff this is a B2C ad.
      displayName: data.seller.displayName,
      isBusiness: Boolean(data.businessData),
      businessName: data.businessData?.trade_name ?? data.businessData?.legal_name ?? null,
    },
  });

  const showDetails = detailItems.length > 0 || optionLabels.length > 0;
  const showGeneration = Boolean(data.selectedGeneration);
  const showInsights =
    Boolean(
      translatedInsights &&
        (translatedInsights.pros.length ||
          translatedInsights.cons.length ||
          translatedInsights.inspectionTips.length ||
          translatedInsights.notableFeatures.length ||
          translatedInsights.engineExamples.length ||
          translatedInsights.commonIssues.length),
    ) ||
    showScores;

  const sellerCardLabels = {
    unknownSellerLabel: translate("advert.seller_labels.unknown", "Seller"),
    memberSinceLabel: translate("advert.seller_labels.member_since", "Member since"),
    verifiedSellerLabel: translate("advert.verified_seller", "Verified seller"),
    verifiedSellerTooltip: translate("advert.verified_seller_tooltip", "Seller confirmed email and phone"),
    emailLabel: translate("advert.seller_labels.email", "Email"),
    emailVerifiedLabel: translate("advert.seller_labels.email_verified", "Verified"),
    emailUnverifiedLabel: translate("advert.seller_labels.email_unverified", "Not verified"),
    phoneLabel: translate("advert.seller_labels.phone", "Phone"),
    phoneVerifiedLabel: translate("advert.seller_labels.phone_verified", "Verified"),
    phoneUnverifiedLabel: translate("advert.seller_labels.phone_unverified", "Not verified"),
    trustScoreLabel: translate("advert.seller_labels.trust_score", "Trust score"),
    activeAdvertsLabel: translate("advert.seller_labels.active_listings", "Active listings"),
    sellerTypePrivateLabel: translate("advert.seller_labels.type_private", "Private seller"),
    sellerTypeProfessionalLabel: translate("advert.seller_labels.type_professional", "Professional seller"),
  };

  const sellerName = data.seller.displayName ?? sellerCardLabels.unknownSellerLabel;
  const sourceLocale = resolveAdvertSourceLocale(data.advert.content_locale);
  const displayedTranslation =
    data.translation && data.translation.target_locale === locale && locale !== sourceLocale
      ? data.translation
      : null;
  const translationSourceLanguage = translate(
    `advert.translation_language.${sourceLocale}`,
    sourceLocale.toUpperCase(),
  );
  const translationBadgeLabel = translateFallback(
    t,
    "advert.translation_generated",
    "Machine translated from {language}",
    { language: translationSourceLanguage },
  );
  const favoriteAdvert = {
    id: data.advert.id,
    title: data.advert.title,
    price: priceValue,
    currency: data.advert.currency ?? "EUR",
    location: data.advert.location,
    image: primaryImageUrl,
    createdAt: data.advert.created_at,
    sellerVerified,
  };
  const trustTimeline = [
    {
      title: translate("advert.trust.email.title", "Email check"),
      body: data.seller.verifiedEmail
        ? translate("advert.trust.email.verified", "Seller email has been verified.")
        : translate("advert.trust.email.pending", "Seller email is not verified yet."),
      verified: data.seller.verifiedEmail,
    },
    {
      title: translate("advert.trust.phone.title", "Phone check"),
      body: data.seller.verifiedPhone
        ? translate("advert.trust.phone.verified", "Seller phone has been verified.")
        : translate("advert.trust.phone.pending", "Seller phone is not verified yet."),
      verified: data.seller.verifiedPhone,
    },
    {
      title: translate("advert.trust.messaging.title", "In-platform messaging"),
      body: translate(
        "advert.trust.messaging.body",
        "Use LyVoX chat so there is a record if support needs to review the deal.",
      ),
      verified: true,
    },
    {
      title: translate("advert.trust.inspect.title", "Inspect before payment"),
      body: translate(
        "advert.trust.inspect.body",
        "Check item condition, documents, serial numbers, and seller identity before sending money.",
      ),
      verified: true,
    },
  ];

  return (
    <>
      <script {...getJsonLdScriptProps(productJsonLd)} />
      <script {...getJsonLdScriptProps(breadcrumbJsonLd)} />
      {/* Bottom clearance = BottomNav + AdvertMobileContactBar (audit B-2), scoped to
          mobile/tablet where the contact bar renders (lg:hidden there → lg:pb-0 here). */}
      <div className="space-y-8 pb-[calc(var(--bottom-nav-h)+var(--contact-bar-h)+env(safe-area-inset-bottom))] lg:pb-0">
        {/* Breadcrumb nav */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          {data.category ? (
            <span className="rounded-md bg-muted px-2 py-1">
              {resolveCategoryName(data.category)}
            </span>
          ) : null}
          {data.benefits.length > 0 ? <BenefitsBadge benefits={data.benefits} /> : null}
        </div>

        {/* 2-col grid: left (1fr) / right sticky (372px) */}
        <div
          className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_372px]"
        >
          <main className="space-y-6">
          <RecentlyViewedRecorder
            advert={{
              id: data.advert.id,
              categoryId: data.advert.category_id ?? null,
              title: data.advert.title,
              price: data.advert.price ?? null,
              currency: data.advert.currency ?? null,
              location: data.advert.location ?? null,
              image: primaryImageUrl,
            }}
          />
          {/* One-time share banner right after publishing (?published=1) */}
          <Suspense fallback={null}>
            <PublishedShareBanner title={data.advert.title} adId={data.advert.id} />
          </Suspense>
          {showCompletionBanner && completion ? (
            <ListingCompletionBanner
              title={translate("post.fast_completion_title", "Complete the listing")}
              body={translate(
                "post.fast_completion_body",
                "Add a few category details so buyers can compare it faster.",
              )}
              progressLabel={translateFallback(
                t,
                "post.fast_completion_progress",
                "{filled}/{target} details added",
                {
                  filled: completion.filledCount,
                  target: completion.targetCount,
                },
              )}
              ctaLabel={translate("post.fast_completion_cta", "Add details")}
              editHref={completionEditHref}
            />
          ) : null}

          <AdvertGallery images={galleryImages} />

          {/* Condition pill + location + date meta */}
          <div className="flex flex-wrap items-center gap-[10px]">
            <span
              className="inline-flex items-center"
              style={{
                height: "27px",
                padding: "0 12px",
                borderRadius: "999px",
                background: "oklch(0.56 0.13 178 / 0.12)",
                color: "var(--priD)",
                font: "700 12px Inter",
              }}
            >
              {sellerVerified
                ? translate("advert.verified_seller", "Verified seller")
                : translate("advert.seller_checks_pending", "Seller checks pending")}
            </span>
            <span className="inline-flex items-center gap-[5px] text-muted-foreground" style={{ font: "500 13px Inter" }}>
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {locationText}
            </span>
            {createdText ? (
              <span className="text-muted-foreground" style={{ font: "500 13px Inter" }}>
                · {translate("advert.posted", "Posted")} {createdText}
              </span>
            ) : null}
          </div>

          {displayedTranslation ? (
            <AdvertTranslationProvider enabled>
              {/* Title + price + LikeToggle */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <h1
                      className="tracking-tight text-foreground"
                      style={{ font: "800 28px/1.2 Inter", letterSpacing: "-0.02em" }}
                    >
                      <AdvertTranslatedTitle
                        original={data.advert.title}
                        translated={displayedTranslation.title}
                      />
                    </h1>
                    <AdvertTranslationControls
                      badgeLabel={translationBadgeLabel}
                      showOriginalLabel={translate("advert.translation_show_original", "Show original")}
                    />
                  </div>
                  <LikeToggle advertId={data.advert.id} initialCount={likeCount} variant="inline" />
                </div>
                <div
                  className="tracking-tight text-foreground"
                  style={{ font: "800 32px Inter", letterSpacing: "-0.02em" }}
                >
                  {priceText}
                </div>
              </div>

              {/* Key-specs strip: per-category priority chips */}
              <KeySpecsStrip
                categoryType={listingDomain}
                specifics={data.specifics ?? {}}
                locale={locale}
                makeName={getMakeName(data.make)}
                modelName={getModelName(data.model)}
                location={data.advert.location ?? null}
                t={t}
              />

              {/* Document badges: Car-Pass / EPC / Safety / Microchip */}
              <DocumentBadges
                categoryType={listingDomain}
                specifics={data.specifics ?? {}}
                t={translate}
              />

              {/* Seller trust panel ABOVE the description (council verdict: on
                  mobile this is the shortest path to a confident contact) */}
              {canSeeSeller ? (
                <SellerCard seller={data.seller} locale={locale} {...sellerCardLabels} />
              ) : (
                <SellerIdentityGate />
              )}

              {/* Description */}
              <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
                <h2 className="mb-2 text-lg font-medium">
                  {translate("advert.description", "Description")}
                </h2>
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                  <AdvertTranslatedDescription
                    original={data.advert.description ?? null}
                    translated={displayedTranslation.description}
                    emptyLabel={translate("advert.no_description", "No description has been added yet.")}
                  />
                </p>
              </section>
            </AdvertTranslationProvider>
          ) : (
            <>
              {/* Title + price + LikeToggle */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h1
                    className="tracking-tight text-foreground"
                    style={{ font: "800 28px/1.2 Inter", letterSpacing: "-0.02em" }}
                  >
                    {data.advert.title}
                  </h1>
                  <LikeToggle advertId={data.advert.id} initialCount={likeCount} variant="inline" />
                </div>
                <div
                  className="tracking-tight text-foreground"
                  style={{ font: "800 32px Inter", letterSpacing: "-0.02em" }}
                >
                  {priceText}
                </div>
              </div>

              {/* Key-specs strip: per-category priority chips */}
              <KeySpecsStrip
                categoryType={listingDomain}
                specifics={data.specifics ?? {}}
                locale={locale}
                makeName={getMakeName(data.make)}
                modelName={getModelName(data.model)}
                location={data.advert.location ?? null}
                t={t}
              />

              {/* Document badges: Car-Pass / EPC / Safety / Microchip */}
              <DocumentBadges
                categoryType={listingDomain}
                specifics={data.specifics ?? {}}
                t={translate}
              />

              {/* Seller trust panel ABOVE the description (council verdict: on
                  mobile this is the shortest path to a confident contact) */}
              {canSeeSeller ? (
                <SellerCard seller={data.seller} locale={locale} {...sellerCardLabels} />
              ) : (
                <SellerIdentityGate />
              )}

              {/* Description */}
              <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
                <h2 className="mb-2 text-lg font-medium">
                  {translate("advert.description", "Description")}
                </h2>
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
                  {data.advert.description ??
                    translate("advert.no_description", "No description has been added yet.")}
                </p>
              </section>
            </>
          )}

          <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-medium">
                  {translate("advert.trust.title", "Trust and safety")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {translate(
                    "advert.trust.body",
                    "Review seller checks and keep the conversation in LyVoX before arranging payment or delivery.",
                  )}
                </p>
              </div>
            </div>

            <ol className="grid gap-3 sm:grid-cols-2">
              {trustTimeline.map((item) => (
                <li
                  key={item.title}
                  className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/30 p-3"
                >
                  {item.verified ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-3 flex items-start gap-2 rounded-md bg-primary/5 p-3 text-xs text-muted-foreground">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {translate(
                  "advert.trust.anti_phishing",
                  "Avoid external payment links and requests to move the conversation to another app.",
                )}
              </span>
            </div>
          </section>

      {/* F13: catalog groups renderer (tabs/sections); falls back to legacy flat list */}
      {catalogGroups.length > 0 ? (
        <CatalogDetailsSection
          groups={catalogGroups}
          fields={catalogFields}
          values={catalogSpecificValues}
          locale={locale}
        />
      ) : showDetails ? (
        <AdvertDetails
          title={translate("advert.vehicle_specs", "Vehicle specifications")}
          details={detailItems}
          optionsTitle={translate("advert.options", "Options")}
          options={optionLabels}
        />
      ) : null}

      {/* KB block: generation + insights with disclaimer, or ambiguous generation CTA */}
      {(showGeneration && data.selectedGeneration) || showInsights ? (
        <section className="rounded-md border border-border/80 bg-card shadow-sm">
          {/* Native accordion: the KB text stays in server HTML (indexed in
              full weight) but stops dominating the mobile scroll. */}
          <details className="group p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <h2 className="text-lg font-medium">
                {translate("advert.insights.title", "Model information")}
              </h2>
              <ChevronDown
                className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="mt-4">

          {showGeneration && data.selectedGeneration ? (
            <div className="mb-4 space-y-4">
              {data.selectedGeneration.code ? (
                <div>
                  <span className="text-sm font-semibold">
                    {translate("advert.generation.code", "Code")}:{" "}
                    {data.selectedGeneration.code}
                  </span>
                  {data.selectedGeneration.facelift ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({translate("advert.generation.facelift", "Facelift")})
                    </span>
                  ) : null}
                </div>
              ) : null}

              {data.selectedGeneration.start_year || data.selectedGeneration.end_year ? (
                <div className="text-sm text-muted-foreground">
                  {translate("advert.generation.years", "Production years")}:{" "}
                  {data.selectedGeneration.start_year}
                  {data.selectedGeneration.end_year
                    ? ` - ${data.selectedGeneration.end_year}`
                    : ` - ${translate("advert.generation.present", "present")}`}
                </div>
              ) : null}

              {generationLocale?.summary ? (
                <p className="text-sm text-foreground/90">{generationLocale.summary}</p>
              ) : null}

              {generationLocale?.pros.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-green-600 dark:text-green-400">
                    {translate("advert.insights.pros", "Pros")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {generationLocale.pros.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {generationLocale?.cons.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                    {translate("advert.insights.cons", "Cons")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {generationLocale.cons.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {generationLocale?.inspectionTips.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.inspection_tips", "Inspection tips")}
                  </h3>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {generationLocale.inspectionTips.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data.selectedGeneration.production_countries?.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.generation.production_countries", "Production countries")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {data.selectedGeneration.production_countries.map((country, index) => (
                      <span
                        key={`${country}-${index}`}
                        className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium"
                      >
                        {country}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {showInsights && data.insights ? (
            <div className="space-y-6">
              {translatedInsights?.pros.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-green-600 dark:text-green-400">
                    {translate("advert.insights.pros", "Pros")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {translatedInsights.pros.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {translatedInsights?.cons.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                    {translate("advert.insights.cons", "Cons")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {translatedInsights.cons.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex items-start gap-2">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {translatedInsights?.inspectionTips.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.inspection_tips", "Inspection tips")}
                  </h3>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {translatedInsights.inspectionTips.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {translatedInsights?.notableFeatures.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.notable_features", "Notable features")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {translatedInsights.notableFeatures.map((item, index) => (
                      <span
                        key={`${item}-${index}`}
                        className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {translatedInsights?.engineExamples.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.engine_examples", "Engine examples")}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {translatedInsights.engineExamples.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {translatedInsights?.commonIssues.length ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    {translate("advert.insights.common_issues", "Common issues")}
                  </h3>
                  <ul className="list-inside list-disc space-y-1 text-sm text-orange-600 dark:text-orange-400">
                    {translatedInsights.commonIssues.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {showScores ? (
                <div className="flex gap-4 border-t pt-2">
                  {reliabilityScoreDisplay !== null ? (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        {translate("advert.insights.reliability", "Reliability")}:{" "}
                      </span>
                      <span className="text-sm font-medium">{reliabilityScoreDisplay}</span>
                    </div>
                  ) : null}
                  {popularityScoreDisplay !== null ? (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        {translate("advert.insights.popularity", "Popularity")}:{" "}
                      </span>
                      <span className="text-sm font-medium">{popularityScoreDisplay}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* KB disclaimer — always visible when KB content is shown */}
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            {translate(
              "advert.kb.disclaimer",
              "Reference info. LyVoX knowledge base — general model information, not a guarantee for this specific item.",
            )}
          </p>
            </div>
          </details>
        </section>
      ) : listingDomain === "vehicle" && data.generations && data.generations.length > 0 ? (
        /* Ambiguous generation CTA — bug #1996 fix: no silent guess on the detail page */
        <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-medium">
            {translate("advert.kb.no_generation_title", "About this model")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate(
              "advert.kb.no_generation_body",
              "The production generation was not specified. Edit the listing to add it and unlock model insights.",
            )}
          </p>
          {editHref ? (
            <a
              href={editHref}
              className="mt-3 inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {translate("advert.kb.no_generation_edit_link", "Edit listing")} →
            </a>
          ) : null}
          {/* TODO §13: KB for non-transport categories (electronics/pets/fashion) */}
        </section>
      ) : null}

          </main>

          <div className="flex flex-col gap-4 lg:sticky lg:top-5">
            <AdvertContactPanel
              advert={favoriteAdvert}
              seller={canSeeSeller ? data.seller : { ...data.seller, displayName: null }}
              currentUserId={currentUserId}
              editHref={editHref}
              sellerName={canSeeSeller ? sellerName : ""}
              canSeeSeller={canSeeSeller}
              isBusiness={!!data.businessData}
            />
            {data.businessData ? (
              <TraderPanel business={data.businessData} t={translate} locale={locale} />
            ) : null}
          </div>
        </div>

        {/* Reviews + leave-review form — below the grid, max-width 760px */}
        <div className="max-w-[760px] space-y-5">
          {currentUserId && currentUserId !== data.seller.id ? (
            <LeaveReviewForm advertId={data.advert.id} />
          ) : null}
        </div>

      {similarAdverts.length ? (
        <SimilarAdverts
          title={translate("advert.similar_listings", "Similar listings")}
          adverts={similarAdverts}
        />
      ) : null}
    </div>

    {/* Mobile sticky Contact bar (lg:hidden) — wired to same startChat flow */}
    <AdvertMobileContactBar
      advertId={data.advert.id}
      sellerId={data.seller.id}
      currentUserId={currentUserId}
      priceText={priceText}
      editHref={editHref}
    />
    </>
  );
  } catch (error) {
    const err = error as any;
    const message =
      typeof err?.message === "string"
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error";
    const stack =
      typeof err?.stack === "string" ? String(err.stack).split("\n").slice(0, 3).join("\n") : undefined;
    console.error("AdvertPage render error (unhandled)", { id: resolvedId, error: err, message, stack });
    advertDebug("Render failure", {
      advertId: resolvedId,
      message,
      stack,
    });
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold">Could not load the page</h1>
        <p className="text-sm text-muted-foreground">
          We could not load this listing. Please refresh the page or try again later.
        </p>
        {isDevEnvironment && message ? (
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground">
            {message}
            {stack ? `\n${stack}` : ""}
          </pre>
        ) : null}
      </div>
    );
  }
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function resolveLocaleTag(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? "en-GB";
}

function createTranslator(messages: Messages): TFunction {
  const source = isPlainObject(messages) ? messages : {};
  return (key, params) => {
    const translation = key
      .split(".")
      .reduce<any>((acc, part) => {
        if (acc && typeof acc === "object" && acc !== null && Object.prototype.hasOwnProperty.call(acc, part)) {
          return acc[part];
        }
        return undefined;
      }, source);

    let result =
      typeof translation === "string"
        ? translation
        : translation !== undefined
          ? String(translation)
          : key;

    if (params) {
      result = result.replace(/\{(\w+)\}/g, (match, variable) => {
        return params[variable] !== undefined ? String(params[variable]) : match;
      });
    }

    return result;
  };
}

function translateFallback(
  t: TFunction,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  const value = t(key, params);
  return value === key ? fallback : value;
}

const COMPLETION_SCHEMA_FIELD_TARGET = 3;

function normalizeCatalogSpecificValues(
  specifics: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { ...specifics };

  for (const [key, value] of Object.entries(specifics)) {
    if (!key.startsWith("catalog_field_")) {
      continue;
    }

    const fieldKey = key.replace("catalog_field_", "");
    if (fieldKey && values[fieldKey] === undefined) {
      values[fieldKey] = value;
    }
  }

  return values;
}

function getCatalogCompletion(
  groups: CatalogSchemaGroup[],
  specifics: Record<string, unknown>,
): { filledCount: number; targetCount: number; totalCount: number } | null {
  const fieldKeys = new Set<string>();

  for (const group of groups) {
    for (const field of group.fields ?? []) {
      if (typeof field.field_key === "string" && field.field_key.trim().length > 0) {
        fieldKeys.add(field.field_key);
      }
    }
  }

  if (fieldKeys.size === 0) {
    return null;
  }

  let filledCount = 0;
  for (const fieldKey of fieldKeys) {
    const value = specifics[fieldKey] ?? specifics[`catalog_field_${fieldKey}`];
    if (isFilledSpecificValue(value)) {
      filledCount += 1;
    }
  }

  return {
    filledCount,
    targetCount: Math.min(COMPLETION_SCHEMA_FIELD_TARGET, fieldKeys.size),
    totalCount: fieldKeys.size,
  };
}

function isFilledSpecificValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return true;
}

async function loadViewerVerified(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const supabase = await supabaseServer();
    return await isViewerVerified(supabase, userId);
  } catch (error) {
    console.warn("Failed to resolve viewer verification", error);
    return false; // fail-closed: hide identity if we can't confirm
  }
}

function getMakeName(make: VehicleMake | null): string | null {
  if (!make) {
    return null;
  }
  const localized = make.vehicle_make_i18n?.find((entry) => entry.name)?.name;
  return localized ?? make.name_en ?? null;
}

function getModelName(model: VehicleModel | null): string | null {
  if (!model) {
    return null;
  }
  const localized = model.vehicle_model_i18n?.find((entry) => entry.name)?.name;
  return localized ?? model.name_en ?? null;
}

function getColorName(color: VehicleColor | null, locale: Locale): string | null {
  if (!color) {
    return null;
  }
  const map: Record<Locale, keyof VehicleColor> = {
    en: "name_en",
    fr: "name_fr",
    nl: "name_nl",
    ru: "name_ru",
    de: "name_de",
  };
  const key = map[locale] ?? "name_en";
  return (
    (color[key] as string | null) ??
    color.name_en ??
    color.name_nl ??
    color.name_fr ??
    color.name_de ??
    color.name_ru ??
    null
  );
}

function translateInsights(
  insights: VehicleInsights | null,
  locale: Locale,
): TranslatedInsights | null {
  if (!insights) {
    return null;
  }

  const translation = insights.vehicle_generation_insights_i18n?.find(
    (entry) => entry.locale === locale,
  );

  const base: TranslatedInsights = {
    pros: insights.pros ?? [],
    cons: insights.cons ?? [],
    inspectionTips: insights.inspection_tips ?? [],
    notableFeatures: insights.notable_features ?? [],
    engineExamples: insights.engine_examples ?? [],
    commonIssues: insights.common_issues ?? [],
  };

  if (!translation) {
    return base;
  }

  return {
    pros: translation.pros ?? base.pros,
    cons: translation.cons ?? base.cons,
    inspectionTips: translation.inspection_tips ?? base.inspectionTips,
    notableFeatures: translation.notable_features ?? base.notableFeatures,
    engineExamples: translation.engine_examples ?? base.engineExamples,
    commonIssues: translation.common_issues ?? base.commonIssues,
  };
}

function getGenerationLocaleData(
  generation: VehicleGeneration,
  locale: Locale,
): GenerationLocaleData {
  const translation = generation.vehicle_generation_i18n?.find(
    (entry) => entry.locale === locale,
  );

  return {
    summary: translation?.summary ?? generation.summary ?? null,
    pros: translation?.pros ?? [],
    cons: translation?.cons ?? [],
    inspectionTips: translation?.inspection_tips ?? [],
  };
}

function buildDetailItems({
  specifics,
  locale,
  makeName,
  modelName,
  colorName,
  t,
}: {
  specifics: Record<string, any>;
  locale: Locale;
  makeName: string | null;
  modelName: string | null;
  colorName: string | null;
  t: TFunction;
}): DetailItem[] {
  const details: DetailItem[] = [];

  if (makeName) {
    details.push({ label: translateFallback(t, "advert.make", "Make"), value: makeName });
  }

  if (modelName) {
    details.push({ label: translateFallback(t, "advert.model", "Model"), value: modelName });
  }

  if (colorName) {
    details.push({ label: translateFallback(t, "advert.color", "Color"), value: colorName });
  }

  const labels: Record<string, string> = {
    year: translateFallback(t, "advert.year", "Year"),
    steering_wheel: translateFallback(t, "advert.steering_wheel", "Steering wheel"),
    body_type: translateFallback(t, "advert.body_type", "Body type"),
    doors: translateFallback(t, "advert.doors", "Doors"),
    power: translateFallback(t, "advert.power", "Power"),
    engine_type: translateFallback(t, "advert.engine_type", "Engine type"),
    engine_volume: translateFallback(t, "advert.engine_volume", "Engine volume"),
    transmission: translateFallback(t, "advert.transmission", "Transmission"),
    drive: translateFallback(t, "advert.drive", "Drive"),
    mileage: translateFallback(t, "advert.mileage", "Mileage"),
    vehicle_condition: translateFallback(t, "advert.condition", "Condition"),
    customs_cleared: translateFallback(t, "advert.customs_cleared", "Customs cleared"),
    under_warranty: translateFallback(t, "advert.warranty", "Warranty"),
    owners_count: translateFallback(t, "advert.owners", "Owners"),
    vin: translateFallback(t, "advert.vin", "VIN"),
  };

  for (const [key, value] of Object.entries(specifics)) {
    if (SPEC_KEY_EXCLUSIONS.has(key) || key.startsWith("option_")) {
      continue;
    }

    const label = labels[key];
    if (!label) {
      continue;
    }

    if (key === "customs_cleared" || key === "under_warranty") {
      const bool =
        value === true ||
        value === "true" ||
        value === "yes" ||
        value === 1 ||
        value === "1";
      details.push({
        label,
        value: bool
          ? translateFallback(t, "common.yes", "Yes")
          : translateFallback(t, "common.no", "No"),
      });
      continue;
    }

    const formatted = formatSpecValue(key, value, locale, t);
    if (formatted) {
      details.push({ label, value: formatted });
    }
  }

  return details;
}

function buildOptionLabels({
  specifics,
  vehicleOptions,
  locale,
  t,
}: {
  specifics: Record<string, any>;
  vehicleOptions: VehicleOption[];
  locale: Locale;
  t: TFunction;
}): string[] {
  const labels: string[] = [];

  for (const [key, value] of Object.entries(specifics)) {
    if (!key.startsWith("option_")) continue;
    if (!isTruthyOption(value)) continue;

    const optionKey = key.replace("option_", "");
    const label = getOptionLabel(optionKey, vehicleOptions, locale, t);
    if (label && !labels.includes(label)) {
      labels.push(label);
    }
  }

  return labels;
}

function isTruthyOption(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const str = String(value).toLowerCase();
  return str !== "false" && str !== "0" && str !== "no" && str !== "";
}

function getOptionLabel(
  optionKey: string,
  options: VehicleOption[],
  locale: Locale,
  t: TFunction,
): string {
  const [category, ...codeParts] = optionKey.split("_");
  if (!category || !codeParts.length) {
    return optionKey;
  }
  const code = codeParts.join("_");

  const option = options.find(
    (item) => item.category === category && item.code === code,
  );
  if (option) {
    const localeMap: Record<Locale, keyof VehicleOption> = {
      en: "name_en",
      fr: "name_fr",
      nl: "name_nl",
      ru: "name_ru",
      de: "name_de",
    };
    const key = localeMap[locale] ?? "name_en";
    return (
      (option[key] as string | null) ??
      option.name_en ??
      option.name_nl ??
      option.name_fr ??
      option.name_de ??
      option.name_ru ??
      optionKey
    );
  }

  const fallback: Record<string, string> = {
    air_conditioning: translateFallback(t, "advert.option_ac", "Air conditioning"),
    navigation: translateFallback(t, "advert.option_nav", "Navigation"),
    parking_sensors: translateFallback(t, "advert.option_parking", "Parking sensors"),
    leather_seats: translateFallback(t, "advert.option_leather", "Leather seats"),
    sunroof: translateFallback(t, "advert.option_sunroof", "Sunroof"),
    multimedia: translateFallback(t, "advert.option_multimedia", "Multimedia"),
    safety_abs: translateFallback(t, "advert.option_safety_abs", "ABS"),
    safety_asr: translateFallback(t, "advert.option_safety_asr", "ASR"),
    comfort_heated_seats:
      translateFallback(t, "advert.option_comfort_heated_seats", "Heated seats"),
  };

  return fallback[code] ?? optionKey;
}

function formatSpecValue(
  key: string,
  value: unknown,
  locale: Locale,
  t: TFunction,
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  const raw = String(value);

  if (key === "mileage") {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return `${num.toLocaleString(resolveLocaleTag(locale))} km`;
  }

  if (key === "power") {
    return `${raw} ${translateFallback(t, "advert.hp", "hp")}`;
  }

  if (key === "engine_volume") {
    return `${raw} ${translateFallback(t, "advert.liters", "L")}`;
  }

  if (key === "owners_count") {
    return raw;
  }

  if (
    ["steering_wheel", "drive", "engine_type", "transmission", "vehicle_condition"].includes(
      key,
    )
  ) {
    return translateSpecValue(raw, t);
  }

  return raw;
}

function translateSpecValue(value: string, t: TFunction): string {
  const map: Record<string, string> = {
    right: translateFallback(t, "advert.value_right", "Right"),
    left: translateFallback(t, "advert.value_left", "Left"),
    rwd: translateFallback(t, "advert.value_rwd", "Rear wheel drive"),
    fwd: translateFallback(t, "advert.value_fwd", "Front wheel drive"),
    awd: translateFallback(t, "advert.value_awd", "All wheel drive"),
    "4wd": translateFallback(t, "advert.value_4wd", "Four wheel drive"),
    electric: translateFallback(t, "advert.value_electric", "Electric"),
    hybrid: translateFallback(t, "advert.value_hybrid", "Hybrid"),
    petrol: translateFallback(t, "advert.value_petrol", "Petrol"),
    diesel: translateFallback(t, "advert.value_diesel", "Diesel"),
    automatic: translateFallback(t, "advert.value_automatic", "Automatic"),
    manual: translateFallback(t, "advert.value_manual", "Manual"),
    cvt: translateFallback(t, "advert.value_cvt", "CVT"),
    not_damaged: translateFallback(t, "advert.value_not_damaged", "Not damaged"),
    damaged: translateFallback(t, "advert.value_damaged", "Damaged"),
    salvage: translateFallback(t, "advert.value_salvage", "Salvage"),
  };

  const normalized = value.toLowerCase().trim();
  if (map[normalized]) {
    return map[normalized];
  }

  for (const [key, translation] of Object.entries(map)) {
    if (normalized.includes(key)) {
      return value.replace(new RegExp(key, "gi"), translation);
    }
  }

  return value;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numberValue)) {
    return null;
  }
  return numberValue;
}

function formatScore(score: unknown): string | null {
  const numeric = normalizeNullableNumber(score);
  if (numeric === null) {
    return null;
  }
  return `${numeric.toFixed(1)}/10`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}
