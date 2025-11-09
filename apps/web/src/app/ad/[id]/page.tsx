import { notFound } from "next/navigation";
import type { Metadata } from "next";

import AdvertGallery from "@/components/AdvertGallery";
import AdvertDetails from "@/components/AdvertDetails";
import ReportButton from "@/components/ReportButton";
import SellerCard from "@/components/SellerCard";
import SimilarAdverts from "@/components/SimilarAdverts";
import { formatCurrency, formatDate } from "@/i18n/format";
import { getI18nProps, getInitialLocale } from "@/i18n/server";
import { type Locale } from "@/lib/i18n";
import { getJsonLdScriptProps } from "@/lib/seo";
import { generateSlug, truncateDescription } from "@/lib/seo/catalog/common";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import type { Tables } from "@/lib/supabaseTypes";

const MEDIA_SIGNED_URL_TTL = 600;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://lyvox.be";

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
    const [currentUserId, locale] = await Promise.all([loadCurrentUserId(), getInitialLocale()]);
    const advertData = await loadAdvertData(id, currentUserId);

    if (!advertData) {
      return {};
    }

    const slug = generateSlug(advertData.advert.title);
    const canonical = `${BASE_URL}/ad/${advertData.advert.id}/${slug}`;
    const description = advertData.advert.description
      ? truncateDescription(advertData.advert.description, 160)
      : "";
    const primaryImage = advertData.media[0];
    const localeTag = resolveLocaleTag(locale);

    return {
      title: advertData.advert.title,
      description,
      alternates: {
        canonical,
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
                url: primaryImage.url,
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
        images: primaryImage ? [primaryImage.url] : undefined,
      },
    };
  } catch (error) {
    console.error("generateMetadata error", { id, error });
    return {};
  }
}

export default async function AdvertPage({ params }: PageProps) {
  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  let currentUserId: string | null = null;
  let locale: Locale = "en";
  let messages: Messages = {};
  let data: AdvertData | null = null;

  try {
    const [resolvedUserId, i18n] = await Promise.all([loadCurrentUserId(), getI18nProps()]);
    currentUserId = resolvedUserId;
    locale = i18n.locale;
    messages = i18n.messages;
    data = await loadAdvertData(id, currentUserId);
  } catch (error) {
    console.error("AdvertPage load error", { id, error });
    notFound();
  }

  if (!data) {
    notFound();
  }

  const t = createTranslator(messages);

  const priceValue =
    data.advert.price !== null ? Number(data.advert.price) : null;
  const priceText =
    priceValue !== null && !Number.isNaN(priceValue)
      ? formatCurrency(priceValue, locale, data.advert.currency ?? "EUR")
      : t("advert.price_not_specified") || "Цена не указана";

  const locationText =
    data.advert.location ??
    t("advert.location_not_specified") ??
    "Местоположение не указано";

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
    alt: `${data.advert.title} — ${
      t("advert.gallery.image_alt", { index: index + 1 }) || `Photo ${index + 1}`
    }`,
    width: item.w ?? undefined,
    height: item.h ?? undefined,
  }));

  const translatedInsights = translateInsights(data.insights, locale);
  const generationLocale = data.selectedGeneration
    ? getGenerationLocaleData(data.selectedGeneration, locale)
    : null;

  const similarAdverts = await loadSimilarAdverts(
    data.advert.id,
    data.advert.category_id,
  );

  const slug = generateSlug(data.advert.title);
  const canonicalUrl = `${BASE_URL}/ad/${data.advert.id}/${slug}`;
  const imageUrls = galleryImages.map((image) => image.url).filter(Boolean);

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

    return byLocale[locale] ?? category.name_en ?? category.name_ru ?? category.slug;
  };

  const breadcrumbElements: Array<Record<string, unknown>> = [
    {
      "@type": "ListItem",
      position: 1,
      name: t("common.home") || "Home",
      item: BASE_URL,
    },
  ];

  if (data.categoryBreadcrumbs.length) {
    breadcrumbElements.push({
      "@type": "ListItem",
      position: breadcrumbElements.length + 1,
      name: t("common.categories") || "Категории",
      item: `${BASE_URL}/c`,
    });

    const sortedBreadcrumbs = [...data.categoryBreadcrumbs].sort(
      (a, b) => (a.level ?? 0) - (b.level ?? 0),
    );

    sortedBreadcrumbs.forEach((category) => {
      breadcrumbElements.push({
        "@type": "ListItem",
        position: breadcrumbElements.length + 1,
        name: resolveCategoryName(category),
        item: `${BASE_URL}/c/${category.path}`,
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

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": data.make ? "Car" : "Product",
    name: data.advert.title,
    description: data.advert.description ?? undefined,
    sku: data.advert.id,
    url: canonicalUrl,
    image: imageUrls,
    brand: brandName ? { "@type": "Brand", name: brandName } : undefined,
    color: colorName ?? undefined,
    offers: data.advert.price
      ? {
          "@type": "Offer",
          price: data.advert.price,
          priceCurrency: data.advert.currency ?? "EUR",
          availability: "https://schema.org/InStock",
          url: canonicalUrl,
        }
      : undefined,
    seller: {
      "@type": "Organization",
      "@id": `${BASE_URL}/user/${data.seller.id}`,
      name: data.seller.displayName ?? "LyVoX seller",
    },
    itemCondition: "https://schema.org/UsedCondition",
    datePosted: data.advert.created_at ?? undefined,
    locationCreated: data.advert.location ?? undefined,
  };

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
    (data.insights?.reliability_score !== null ||
      data.insights?.popularity_score !== null);

  return (
    <>
      <script {...getJsonLdScriptProps(productJsonLd)} />
      <script {...getJsonLdScriptProps(breadcrumbJsonLd)} />
      <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{data.advert.title}</h1>
        <ReportButton advertId={data.advert.id} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <AdvertGallery images={galleryImages} />
        </div>
        <aside className="w-full max-w-xs space-y-3 rounded-2xl border p-4 text-sm">
          <div className="text-xl font-semibold">{priceText}</div>
          <div className="text-muted-foreground">{locationText}</div>
          {createdText ? (
            <div className="text-xs text-muted-foreground">
              {t("advert.posted") || "Размещено"}: {createdText}
            </div>
          ) : null}
        </aside>
      </div>

      <SellerCard seller={data.seller} locale={locale} t={t} />

      {showDetails ? (
        <AdvertDetails
          title={t("advert.vehicle_specs") || "Характеристики автомобиля"}
          details={detailItems}
          optionsTitle={t("advert.options") || "Опции"}
          options={optionLabels}
        />
      ) : null}

      {showGeneration && data.selectedGeneration ? (
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            {t("advert.generation.title") || "Поколение"}
          </h2>

          <div className="space-y-4">
            {data.selectedGeneration.code ? (
              <div>
                <span className="text-sm font-semibold">
                  {t("advert.generation.code") || "Код"}:{" "}
                  {data.selectedGeneration.code}
                </span>
                {data.selectedGeneration.facelift ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({t("advert.generation.facelift") || "Рестайлинг"})
                  </span>
                ) : null}
              </div>
            ) : null}

            {data.selectedGeneration.start_year ||
            data.selectedGeneration.end_year ? (
              <div className="text-sm text-muted-foreground">
                {t("advert.generation.years") || "Годы производства"}:{" "}
                {data.selectedGeneration.start_year}
                {data.selectedGeneration.end_year
                  ? ` - ${data.selectedGeneration.end_year}`
                  : ` - ${t("advert.generation.present") || "н.в."}`}
              </div>
            ) : null}

            {generationLocale?.summary ? (
              <p className="text-sm text-foreground/90">
                {generationLocale.summary}
              </p>
            ) : null}

            {generationLocale?.pros.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-green-600 dark:text-green-400">
                  {t("advert.insights.pros") || "Плюсы"}
                </h3>
                <ul className="space-y-1 text-sm">
                  {generationLocale.pros.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {generationLocale?.cons.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                  {t("advert.insights.cons") || "Минусы"}
                </h3>
                <ul className="space-y-1 text-sm">
                  {generationLocale.cons.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex items-start gap-2">
                      <span className="text-red-600 dark:text-red-400">✗</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {generationLocale?.inspectionTips.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("advert.insights.inspection_tips") || "Советы по осмотру"}
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
                  {t("advert.generation.production_countries") ||
                    "Страны производства"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {data.selectedGeneration.production_countries.map(
                    (country, index) => (
                      <span
                        key={`${country}-${index}`}
                        className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium"
                      >
                        {country}
                      </span>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {showInsights && data.insights ? (
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            {t("advert.insights.title") || "Информация о модели"}
          </h2>

          <div className="space-y-6">
            {translatedInsights?.pros.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-green-600 dark:text-green-400">
                  {t("advert.insights.pros") || "Плюсы"}
                </h3>
                <ul className="space-y-1 text-sm">
                  {translatedInsights.pros.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {translatedInsights?.cons.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                  {t("advert.insights.cons") || "Минусы"}
                </h3>
                <ul className="space-y-1 text-sm">
                  {translatedInsights.cons.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex items-start gap-2">
                      <span className="text-red-600 dark:text-red-400">✗</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {translatedInsights?.inspectionTips.length ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  {t("advert.insights.inspection_tips") || "Советы по осмотру"}
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
                  {t("advert.insights.notable_features") || "Примечательные особенности"}
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
                  {t("advert.insights.engine_examples") || "Примеры двигателей"}
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
                  {t("advert.insights.common_issues") || "Общие проблемы"}
                </h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-orange-600 dark:text-orange-400">
                  {translatedInsights.commonIssues.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.insights.reliability_score !== null ||
            data.insights.popularity_score !== null ? (
              <div className="flex gap-4 border-t pt-2">
                {data.insights.reliability_score !== null ? (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {t("advert.insights.reliability") || "Надежность"}:{" "}
                    </span>
                    <span className="text-sm font-medium">
                      {data.insights.reliability_score.toFixed(1)}/10
                    </span>
                  </div>
                ) : null}
                {data.insights.popularity_score !== null ? (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {t("advert.insights.popularity") || "Популярность"}:{" "}
                    </span>
                    <span className="text-sm font-medium">
                      {data.insights.popularity_score.toFixed(1)}/10
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {similarAdverts.length ? (
        <SimilarAdverts
          title={t("advert.similar_listings") || "Похожие объявления"}
          adverts={similarAdverts}
        />
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-medium">
          {t("advert.description") || "Описание"}
        </h2>
        <p className="whitespace-pre-wrap text-sm text-foreground/90">
          {data.advert.description ??
            t("advert.no_description") ??
            "Описания пока нет."}
        </p>
      </section>
    </div>
    </>
  );
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
  return (key, params) => {
    const translation = key
      .split(".")
      .reduce<any>((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), messages);

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

async function loadCurrentUserId(): Promise<string | null> {
  try {
    const supabase = supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch (error) {
    console.warn("Failed to resolve current user", error);
    return null;
  }
}

async function loadVehicleInsights(
  client: ReturnType<typeof supabaseService>,
  generationId: string,
): Promise<VehicleInsights | null> {
  const { data, error } = await client
    .from("vehicle_generation_insights")
    .select("*")
    .eq("generation_id", generationId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn("Failed to load vehicle insights", { generationId, error });
    }
    return null;
  }

  const { data: translations, error: translationsError } = await client
    .from("vehicle_generation_insights_i18n")
    .select(
      "locale, pros, cons, inspection_tips, notable_features, engine_examples, common_issues",
    )
    .eq("generation_id", generationId);

  if (translationsError) {
    console.warn("Failed to load vehicle insights translations", {
      generationId,
      error: translationsError,
    });
  }

  return {
    ...(data as VehicleInsights),
    vehicle_generation_insights_i18n: translations ?? [],
  };
}

function determineGeneration(
  generations: VehicleGeneration[],
  specifics: Record<string, any>,
): VehicleGeneration | null {
  if (!generations.length) {
    return null;
  }

  const generationId = specifics.generation_id
    ? String(specifics.generation_id)
    : null;
  if (generationId) {
    const match = generations.find((generation) => generation.id === generationId);
    if (match) {
      return match;
    }
  }

  const advertYear = parseAdvertYear(specifics.year);
  if (advertYear) {
    const match = generations.find((generation) => {
      const startMatch =
        generation.start_year === null || generation.start_year <= advertYear;
      const endMatch =
        generation.end_year === null || generation.end_year >= advertYear;
      return startMatch && endMatch;
    });
    if (match) {
      return match;
    }
  }

  if (generations.length === 1) {
    return generations[0];
  }

  return null;
}

function parseAdvertYear(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function loadAdvertData(
  advertId: string,
  currentUserId: string | null,
): Promise<AdvertData | null> {
  const client = supabaseService();

  try {
    const { data: advert, error: advertError } = await client
      .from("adverts")
      .select(
        "id,user_id,category_id,title,description,price,currency,location,created_at,status",
      )
      .eq("id", advertId)
      .maybeSingle();

    if (advertError) {
      console.error("Failed to load advert record", { advertId, error: advertError });
      return null;
    }

    if (!advert) {
      return null;
    }

    if (advert.status !== "active" && advert.user_id !== currentUserId) {
      return null;
    }

  let category: CategorySummary | null = null;
  let categoryBreadcrumbs: CategorySummary[] = [];

  if (advert.category_id) {
    const { data: categoryRecord } = await client
      .from("categories")
      .select(
        "path, slug, level, name_en, name_nl, name_fr, name_de, name_ru",
      )
      .eq("id", advert.category_id)
      .maybeSingle();

    if (categoryRecord) {
      category = categoryRecord as CategorySummary;

      if (categoryRecord.path) {
        const crumbPaths = categoryRecord.path
          .split("/")
          .filter(Boolean)
          .map((_, idx, arr) => arr.slice(0, idx + 1).join("/"));

        if (crumbPaths.length) {
          const { data: breadcrumbRecords } = await client
            .from("categories")
            .select(
              "path, slug, level, name_en, name_nl, name_fr, name_de, name_ru",
            )
            .in("path", crumbPaths);

          if (breadcrumbRecords) {
            categoryBreadcrumbs = (breadcrumbRecords as CategorySummary[]).sort(
              (a, b) => (a.level ?? 0) - (b.level ?? 0),
            );
          }
        }
      }
    }
  }

  const { data: specificsRecord, error: specificsError } = await client
    .from("ad_item_specifics")
    .select("specifics")
    .eq("advert_id", advertId)
    .maybeSingle();

  if (specificsError) {
    console.error("Failed to load advert specifics", {
      advertId,
      error: specificsError,
    });
    return null;
  }

  const specifics = (specificsRecord?.specifics ?? {}) as Record<string, any>;

  const { data: mediaRows, error: mediaError } = await client
    .from("media")
    .select("id,url,sort,w,h")
    .eq("advert_id", advertId)
    .order("sort", { ascending: true });

  if (mediaError) {
    console.error("Failed to load advert media", { advertId, error: mediaError });
    return null;
  }

  const storage = client.storage.from("ad-media");
  const media: MediaItem[] = [];

  if (mediaRows) {
    for (const record of mediaRows as Array<{
      id: string;
      url: string | null;
      sort: number | null;
      w: number | null;
      h: number | null;
    }>) {
      if (!record.url) {
        continue;
      }

      if (
        record.url.startsWith("http://") ||
        record.url.startsWith("https://")
      ) {
        media.push({
          id: record.id,
          url: record.url,
          sort: record.sort ?? null,
          w: record.w ?? null,
          h: record.h ?? null,
        });
        continue;
      }

      const { data: signed, error: signedError } = await storage.createSignedUrl(
        record.url,
        MEDIA_SIGNED_URL_TTL,
      );

      if (signedError || !signed?.signedUrl) {
        console.warn("Failed to create signed URL for media file", {
          advertId,
          path: record.url,
          error: signedError,
        });
        continue;
      }

      media.push({
        id: record.id,
        url: signed.signedUrl,
        sort: record.sort ?? null,
        w: record.w ?? null,
        h: record.h ?? null,
      });
    }
  }

  let make: VehicleMake | null = null;
  const makeId = specifics.make_id ? String(specifics.make_id) : null;
  if (makeId) {
    const { data: makeData } = await client
      .from("vehicle_makes")
      .select("id, name_en, vehicle_make_i18n(name)")
      .eq("id", makeId)
      .maybeSingle();
    make = (makeData as VehicleMake) ?? null;
  }

  let model: VehicleModel | null = null;
  const modelId = specifics.model_id ? String(specifics.model_id) : null;
  if (modelId) {
    const { data: modelData } = await client
      .from("vehicle_models")
      .select("id, name_en, vehicle_model_i18n(name)")
      .eq("id", modelId)
      .maybeSingle();
    model = (modelData as VehicleModel) ?? null;
  }

  let color: VehicleColor | null = null;
  const colorId = specifics.color_id ? String(specifics.color_id) : null;
  if (colorId) {
    const { data: colorData } = await client
      .from("vehicle_colors")
      .select("id, name_en, name_nl, name_fr, name_de, name_ru")
      .eq("id", colorId)
      .maybeSingle();
    color = (colorData as VehicleColor) ?? null;
  }

  let generations: VehicleGeneration[] = [];
  if (modelId) {
    const { data: generationsData, error: generationsError } = await client
      .from("vehicle_generations")
      .select(
        "id, model_id, code, start_year, end_year, facelift, summary, production_countries, vehicle_generation_i18n(locale, summary, pros, cons, inspection_tips)",
      )
      .eq("model_id", modelId)
      .order("start_year", { ascending: true });

    if (generationsError) {
      console.warn("Failed to load vehicle generations", {
        modelId,
        error: generationsError,
      });
    } else if (generationsData) {
      generations = generationsData as VehicleGeneration[];
    }
  }

  const selectedGeneration = determineGeneration(generations, specifics);

  let insights: VehicleInsights | null = null;
  const insightsGenerationId =
    specifics.generation_id ??
    selectedGeneration?.id ??
    null;
  if (insightsGenerationId) {
    insights = await loadVehicleInsights(client, String(insightsGenerationId));
  }

  const { data: optionsData, error: optionsError } = await client
    .from("vehicle_options")
    .select("id, category, code, name_en, name_nl, name_fr, name_de, name_ru")
    .order("category", { ascending: true })
    .order("name_ru", { ascending: true });

  if (optionsError) {
    console.warn("Failed to load vehicle options catalog", {
      advertId,
      error: optionsError,
    });
  }

  const vehicleOptions = (optionsData ?? []) as VehicleOption[];

  const { data: profile } = await client
    .from("profiles")
    .select("display_name, verified_email, verified_phone, created_at")
    .eq("id", advert.user_id)
    .maybeSingle();

  const { data: trust } = await client
    .from("trust_score")
    .select("score")
    .eq("user_id", advert.user_id)
    .maybeSingle();

  const { count: activeAdvertsCount } = await client
    .from("adverts")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", advert.user_id)
    .eq("status", "active");

  const seller: SellerInfo = {
    id: advert.user_id,
    displayName: profile?.display_name ?? null,
    verifiedEmail: Boolean(profile?.verified_email),
    verifiedPhone: Boolean(profile?.verified_phone),
    trustScore: trust?.score ?? 0,
    createdAt: profile?.created_at ?? null,
    activeAdverts: activeAdvertsCount ?? 0,
  };

  return {
    advert,
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
  };
  } catch (error) {
    console.error("loadAdvertData unexpected error", { advertId, error });
    return null;
  }
}

async function loadSimilarAdverts(
  advertId: string,
  categoryId: string | null,
): Promise<SimilarAdvertItem[]> {
  if (!categoryId) {
    return [];
  }

  const client = supabaseService();

  try {
    const { data, error } = await client
      .from("adverts")
      .select(
        `
        id,
        title,
        price,
        currency,
        location,
        created_at,
        user_id,
        media(url, sort)
      `,
      )
      .eq("category_id", categoryId)
      .eq("status", "active")
      .neq("id", advertId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error || !data) {
      if (error) {
        console.warn("Failed to load similar adverts", { advertId, error });
      }
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

    return data.map((row) => {
      const media = Array.isArray(row.media) ? [...row.media] : [];
      media.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      const image = media.find((item) => item.url)?.url ?? null;

      return {
        id: row.id,
        title: row.title,
        price: row.price ? Number(row.price) : null,
        currency: row.currency ?? "EUR",
        location: row.location,
        createdAt: row.created_at ?? null,
        image,
        sellerVerified: verifiedMap.get(row.user_id ?? "") ?? false,
      };
    });
  } catch (error) {
    console.warn("Failed to load similar adverts (unexpected)", { advertId, error });
    return [];
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
  return (color[key] as string | null) ?? color.name_ru ?? color.name_en ?? null;
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
    details.push({ label: t("advert.make") || "Марка", value: makeName });
  }

  if (modelName) {
    details.push({ label: t("advert.model") || "Модель", value: modelName });
  }

  if (colorName) {
    details.push({ label: t("advert.color") || "Цвет", value: colorName });
  }

  const labels: Record<string, string> = {
    year: t("advert.year") || "Год",
    steering_wheel: t("advert.steering_wheel") || "Руль",
    body_type: t("advert.body_type") || "Тип кузова",
    doors: t("advert.doors") || "Двери",
    power: t("advert.power") || "Мощность",
    engine_type: t("advert.engine_type") || "Тип двигателя",
    engine_volume: t("advert.engine_volume") || "Объем двигателя",
    transmission: t("advert.transmission") || "Коробка передач",
    drive: t("advert.drive") || "Привод",
    mileage: t("advert.mileage") || "Пробег",
    vehicle_condition: t("advert.condition") || "Состояние",
    customs_cleared: t("advert.customs_cleared") || "Растаможен",
    under_warranty: t("advert.warranty") || "Гарантия",
    owners_count: t("advert.owners") || "Владельцев",
    vin: t("advert.vin") || "VIN",
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
        value: bool ? t("common.yes") || "Да" : t("common.no") || "Нет",
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
      option.name_ru ??
      option.name_en ??
      optionKey
    );
  }

  const fallback: Record<string, string> = {
    air_conditioning: t("advert.option_ac") || "Кондиционер",
    navigation: t("advert.option_nav") || "Навигация",
    parking_sensors: t("advert.option_parking") || "Парктроники",
    leather_seats: t("advert.option_leather") || "Кожаные сиденья",
    sunroof: t("advert.option_sunroof") || "Люк",
    multimedia: t("advert.option_multimedia") || "Мультимедиа",
    safety_abs: t("advert.option_safety_abs") || "ABS",
    safety_asr: t("advert.option_safety_asr") || "ASR",
    comfort_heated_seats:
      t("advert.option_comfort_heated_seats") || "Подогрев сидений",
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
    return `${raw} ${t("advert.hp") || "л.с."}`;
  }

  if (key === "engine_volume") {
    return `${raw} ${t("advert.liters") || "л"}`;
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
    right: t("advert.value_right") || "Right",
    left: t("advert.value_left") || "Left",
    rwd: t("advert.value_rwd") || "Rear wheel drive",
    fwd: t("advert.value_fwd") || "Front wheel drive",
    awd: t("advert.value_awd") || "All wheel drive",
    "4wd": t("advert.value_4wd") || "Four wheel drive",
    electric: t("advert.value_electric") || "Electric",
    hybrid: t("advert.value_hybrid") || "Hybrid",
    petrol: t("advert.value_petrol") || "Petrol",
    diesel: t("advert.value_diesel") || "Diesel",
    automatic: t("advert.value_automatic") || "Automatic",
    manual: t("advert.value_manual") || "Manual",
    cvt: t("advert.value_cvt") || "CVT",
    not_damaged: t("advert.value_not_damaged") || "Not damaged",
    damaged: t("advert.value_damaged") || "Damaged",
    salvage: t("advert.value_salvage") || "Salvage",
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

