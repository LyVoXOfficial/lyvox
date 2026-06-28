/**
 * F12: Per-category schema.org JSON-LD dispatcher for ad detail pages.
 *
 * Design notes (verified against the codebase, not assumed):
 *   - Seeded ads carry NO ad_item_specifics; non-vehicle bespoke fields are not
 *     yet persisted to specifics. So every field read here is DEFENSIVE: absent
 *     keys are omitted, never emitted as `undefined`. The baseline (name,
 *     description, image, offers, url, seller) is always valid on its own.
 *   - Vehicle specifics ARE persisted (year, mileage, engine_type, …) so the
 *     Car branch is enriched; other domains light up automatically once their
 *     persistence lands.
 *   - The older lib/seo/catalog/{property,job,electronics}.ts generators were
 *     written against a typed-table shape whose keys diverge from the real form
 *     keys (e.g. electronics brand_id vs brand). They are intentionally NOT used
 *     here — this dispatcher maps the keys that actually exist.
 */

import type { CategoryType } from "@/lib/utils/categoryDetector";

export type ListingSeller = {
  displayName: string | null;
  isBusiness: boolean;
  businessName?: string | null;
};

export type ListingJsonLdInput = {
  domain: CategoryType;
  id: string;
  title: string;
  description: string | null;
  url: string;
  images: string[];
  price: number | null;
  currency: string;
  location: string | null;
  createdAt: string | null;
  specifics: Record<string, unknown>;
  vehicle?: {
    brandName: string | null;
    modelName: string | null;
    colorName: string | null;
  };
  seller: ListingSeller;
};

type JsonLd = Record<string, unknown>;

// ── Defensive readers ────────────────────────────────────────────────────────
function readString(specifics: Record<string, unknown>, key: string): string | undefined {
  const v = specifics[key];
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function readNumber(specifics: Record<string, unknown>, key: string): number | undefined {
  const v = specifics[key];
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Drop keys whose value is undefined so the emitted JSON-LD stays clean.
function compact<T extends JsonLd>(obj: T): T {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete obj[k];
  }
  return obj;
}

function sellerNode(seller: ListingSeller): JsonLd | undefined {
  if (seller.isBusiness) {
    const name = seller.businessName ?? seller.displayName;
    if (!name) return undefined;
    return { "@type": "Organization", name };
  }
  if (!seller.displayName) return undefined;
  return { "@type": "Person", name: seller.displayName };
}

// schema.org: `seller` is a property of Offer, not of Product/Car/RealEstateListing.
// So the seller node is nested inside the offer (when both exist).
function offerNode(input: ListingJsonLdInput): JsonLd | undefined {
  if (input.price === null) return undefined;
  const seller = sellerNode(input.seller);
  return compact({
    "@type": "Offer",
    price: input.price,
    priceCurrency: input.currency || "EUR",
    availability: "https://schema.org/InStock",
    url: input.url,
    seller,
  });
}

// ── Domain builders ──────────────────────────────────────────────────────────

function buildVehicle(input: ListingJsonLdInput): JsonLd {
  const { specifics, vehicle } = input;

  const mileage = readNumber(specifics, "mileage");
  const power = readNumber(specifics, "power");
  const engineVolume = readNumber(specifics, "engine_volume");
  const year = readNumber(specifics, "year");

  const additionalProperty: JsonLd[] = [];
  const drive = readString(specifics, "drive");
  if (drive) {
    additionalProperty.push({ "@type": "PropertyValue", name: "driveWheelConfiguration", value: drive });
  }

  return compact({
    "@context": "https://schema.org",
    "@type": "Car",
    name: input.title,
    description: input.description ?? undefined,
    sku: input.id,
    url: input.url,
    image: input.images.length ? input.images : undefined,
    brand: vehicle?.brandName ? { "@type": "Brand", name: vehicle.brandName } : undefined,
    model: vehicle?.modelName ?? undefined,
    color: vehicle?.colorName ?? undefined,
    vehicleModelDate: year !== undefined ? String(year) : undefined,
    mileageFromOdometer:
      mileage !== undefined
        ? { "@type": "QuantitativeValue", value: mileage, unitCode: "KMT" }
        : undefined,
    fuelType: readString(specifics, "engine_type"),
    vehicleTransmission: readString(specifics, "transmission"),
    bodyType: readString(specifics, "body_type"),
    numberOfDoors: readNumber(specifics, "doors"),
    vehicleEngine:
      engineVolume !== undefined || power !== undefined
        ? compact({
            "@type": "EngineSpecification",
            engineDisplacement:
              engineVolume !== undefined
                ? { "@type": "QuantitativeValue", value: engineVolume, unitCode: "LTR" }
                : undefined,
            enginePower:
              power !== undefined
                ? { "@type": "QuantitativeValue", value: power, unitCode: "BHP" }
                : undefined,
          })
        : undefined,
    vehicleIdentificationNumber: readString(specifics, "vin"),
    itemCondition: "https://schema.org/UsedCondition",
    offers: offerNode(input),
    datePosted: input.createdAt ?? undefined,
  });
}

function buildRealEstate(input: ListingJsonLdInput): JsonLd {
  const { specifics } = input;
  const area = readNumber(specifics, "area_sqm");
  const municipality = readString(specifics, "municipality");
  const postcode = readString(specifics, "postcode");
  const epc = readString(specifics, "epc_rating");

  const address =
    municipality || postcode || input.location
      ? compact({
          "@type": "PostalAddress",
          addressLocality: municipality ?? input.location ?? undefined,
          postalCode: postcode,
          addressCountry: "BE",
        })
      : undefined;

  return compact({
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: input.title,
    description: input.description ?? undefined,
    url: input.url,
    image: input.images.length ? input.images : undefined,
    datePosted: input.createdAt ?? undefined,
    address,
    floorSize:
      area !== undefined
        ? { "@type": "QuantitativeValue", value: area, unitCode: "MTK" }
        : undefined,
    numberOfRooms: readNumber(specifics, "rooms"),
    numberOfBedrooms: readNumber(specifics, "bedrooms"),
    numberOfBathroomsTotal: readNumber(specifics, "bathrooms"),
    additionalProperty: epc
      ? [{ "@type": "PropertyValue", name: "Energy Performance Certificate", value: epc }]
      : undefined,
    offers: offerNode(input),
  });
}

function buildJob(input: ListingJsonLdInput): JsonLd {
  const { specifics } = input;
  const salaryMin = readNumber(specifics, "salary_min");
  const salaryMax = readNumber(specifics, "salary_max");
  const companyName = readString(specifics, "company_name") ?? input.seller.businessName ?? undefined;
  const employmentType = readString(specifics, "employment_type");

  return compact({
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: input.title,
    description: input.description ?? undefined,
    datePosted: input.createdAt ?? undefined,
    validThrough: readString(specifics, "application_deadline"),
    // schema.org wants UPPER_CASE tokens (FULL_TIME, PART_TIME, …)
    employmentType: employmentType ? employmentType.toUpperCase() : undefined,
    hiringOrganization: companyName
      ? { "@type": "Organization", name: companyName }
      : undefined,
    jobLocation: input.location
      ? {
          "@type": "Place",
          address: { "@type": "PostalAddress", addressLocality: input.location, addressCountry: "BE" },
        }
      : undefined,
    baseSalary:
      salaryMin !== undefined
        ? compact({
            "@type": "MonetaryAmount",
            currency: input.currency || "EUR",
            value: compact({
              "@type": "QuantitativeValue",
              value: salaryMin,
              maxValue: salaryMax,
              unitText: (readString(specifics, "salary_type") ?? "MONTH").toUpperCase(),
            }),
          })
        : undefined,
  });
}

function buildProduct(input: ListingJsonLdInput, typeOverride?: string): JsonLd {
  const { specifics } = input;
  const brand = input.vehicle?.brandName ?? readString(specifics, "brand");

  return compact({
    "@context": "https://schema.org",
    "@type": typeOverride ?? "Product",
    name: input.title,
    description: input.description ?? undefined,
    sku: input.id,
    url: input.url,
    image: input.images.length ? input.images : undefined,
    brand: brand ? { "@type": "Brand", name: brand } : undefined,
    offers: offerNode(input),
    itemCondition: "https://schema.org/UsedCondition",
    datePosted: input.createdAt ?? undefined,
  });
}

/**
 * Build a single schema.org JSON-LD object for an ad, dispatched by category domain.
 * Always returns a valid object; enrichment fields are added only when present.
 */
export function buildListingJsonLd(input: ListingJsonLdInput): JsonLd {
  switch (input.domain) {
    case "vehicle":
      return buildVehicle(input);
    case "real_estate":
      return buildRealEstate(input);
    case "jobs":
      return buildJob(input);
    case "electronics":
    case "fashion":
    case "home":
    case "baby_kids":
    case "sports":
    case "pets":
    case "services":
    case "generic":
    default:
      return buildProduct(input);
  }
}
