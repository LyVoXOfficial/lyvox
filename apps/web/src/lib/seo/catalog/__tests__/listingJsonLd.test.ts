import { describe, it, expect } from "vitest";
import { buildListingJsonLd, type ListingJsonLdInput } from "@/lib/seo/catalog/listingJsonLd";

function base(overrides: Partial<ListingJsonLdInput> = {}): ListingJsonLdInput {
  return {
    domain: "generic",
    id: "ad-1",
    title: "Test listing",
    description: "A description",
    url: "https://lyvox.be/ad/ad-1/test-listing",
    images: ["https://img/1.jpg"],
    price: 1000,
    currency: "EUR",
    location: "Brussels",
    createdAt: "2026-06-28T00:00:00.000Z",
    specifics: {},
    seller: { displayName: "Jane", isBusiness: false },
    ...overrides,
  };
}

describe("buildListingJsonLd — F12 per-category structured data", () => {
  // ── No undefined values ever leak into output ───────────────────────────
  it("(a) never emits undefined values (clean JSON-LD)", () => {
    const json = buildListingJsonLd(base({ specifics: {} }));
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("undefined");
    // baseline always valid
    expect(json["@context"]).toBe("https://schema.org");
    expect(json.name).toBe("Test listing");
  });

  // ── Specifics-less row (seeded ad) still produces valid Product ─────────
  it("(b) empty specifics → valid Product with offer + seller", () => {
    const json = buildListingJsonLd(base({ domain: "generic", specifics: {} }));
    expect(json["@type"]).toBe("Product");
    expect(json.offers).toMatchObject({ "@type": "Offer", price: 1000, priceCurrency: "EUR" });
    expect(json.seller).toEqual({ "@type": "Person", name: "Jane" });
  });

  // ── Vehicle (rich specifics persisted) ──────────────────────────────────
  it("(c) vehicle → Car with mileage, fuel, transmission, engine", () => {
    const json = buildListingJsonLd(
      base({
        domain: "vehicle",
        vehicle: { brandName: "BMW", modelName: "5 Series", colorName: "Black" },
        specifics: {
          year: 2018,
          mileage: 80000,
          engine_type: "diesel",
          transmission: "automatic",
          engine_volume: 2.0,
          power: 190,
          doors: 4,
          body_type: "sedan",
          vin: "WBA12345",
        },
      }),
    );

    expect(json["@type"]).toBe("Car");
    expect(json.brand).toEqual({ "@type": "Brand", name: "BMW" });
    expect(json.model).toBe("5 Series");
    expect(json.color).toBe("Black");
    expect(json.vehicleModelDate).toBe("2018");
    expect(json.mileageFromOdometer).toMatchObject({ value: 80000, unitCode: "KMT" });
    expect(json.fuelType).toBe("diesel");
    expect(json.vehicleTransmission).toBe("automatic");
    expect(json.numberOfDoors).toBe(4);
    expect(json.vehicleEngine).toMatchObject({
      "@type": "EngineSpecification",
      engineDisplacement: { value: 2.0, unitCode: "LTR" },
      enginePower: { value: 190, unitCode: "BHP" },
    });
    expect(json.vehicleIdentificationNumber).toBe("WBA12345");
  });

  it("(d) vehicle with empty specifics → Car baseline, no engine/mileage keys", () => {
    const json = buildListingJsonLd(
      base({ domain: "vehicle", vehicle: { brandName: "Audi", modelName: null, colorName: null }, specifics: {} }),
    );
    expect(json["@type"]).toBe("Car");
    expect(json.brand).toEqual({ "@type": "Brand", name: "Audi" });
    expect(json).not.toHaveProperty("mileageFromOdometer");
    expect(json).not.toHaveProperty("vehicleEngine");
    expect(json).not.toHaveProperty("model");
  });

  // ── Real estate ─────────────────────────────────────────────────────────
  it("(e) real_estate → RealEstateListing with floorSize, rooms, EPC, address", () => {
    const json = buildListingJsonLd(
      base({
        domain: "real_estate",
        specifics: {
          area_sqm: 120,
          rooms: 5,
          bedrooms: 3,
          bathrooms: 2,
          epc_rating: "B",
          municipality: "Gent",
          postcode: "9000",
        },
      }),
    );

    expect(json["@type"]).toBe("RealEstateListing");
    expect(json.floorSize).toMatchObject({ value: 120, unitCode: "MTK" });
    expect(json.numberOfRooms).toBe(5);
    expect(json.numberOfBedrooms).toBe(3);
    expect(json.numberOfBathroomsTotal).toBe(2);
    expect(json.address).toMatchObject({ addressLocality: "Gent", postalCode: "9000", addressCountry: "BE" });
    expect(json.additionalProperty).toEqual([
      { "@type": "PropertyValue", name: "Energy Performance Certificate", value: "B" },
    ]);
  });

  it("(f) real_estate with empty specifics falls back to advert location for address", () => {
    const json = buildListingJsonLd(base({ domain: "real_estate", location: "Antwerp", specifics: {} }));
    expect(json["@type"]).toBe("RealEstateListing");
    expect(json.address).toMatchObject({ addressLocality: "Antwerp", addressCountry: "BE" });
    expect(json).not.toHaveProperty("floorSize");
  });

  // ── Jobs ────────────────────────────────────────────────────────────────
  it("(g) jobs → JobPosting with baseSalary, employmentType, hiringOrganization", () => {
    const json = buildListingJsonLd(
      base({
        domain: "jobs",
        price: null, // jobs don't use Offer
        specifics: {
          company_name: "Acme NV",
          employment_type: "full_time",
          salary_min: 3000,
          salary_max: 4000,
          salary_type: "month",
          application_deadline: "2026-09-01",
        },
      }),
    );

    expect(json["@type"]).toBe("JobPosting");
    expect(json.title).toBe("Test listing");
    expect(json.employmentType).toBe("FULL_TIME");
    expect(json.hiringOrganization).toEqual({ "@type": "Organization", name: "Acme NV" });
    expect(json.validThrough).toBe("2026-09-01");
    expect(json.baseSalary).toMatchObject({
      "@type": "MonetaryAmount",
      currency: "EUR",
      value: { value: 3000, maxValue: 4000, unitText: "MONTH" },
    });
    // JobPosting must NOT carry an Offer
    expect(json).not.toHaveProperty("offers");
  });

  it("(h) jobs with no salary → JobPosting without baseSalary", () => {
    const json = buildListingJsonLd(base({ domain: "jobs", price: null, specifics: { employment_type: "part_time" } }));
    expect(json["@type"]).toBe("JobPosting");
    expect(json.employmentType).toBe("PART_TIME");
    expect(json).not.toHaveProperty("baseSalary");
  });

  // ── Electronics → Product ───────────────────────────────────────────────
  it("(i) electronics → Product baseline", () => {
    const json = buildListingJsonLd(base({ domain: "electronics", specifics: {} }));
    expect(json["@type"]).toBe("Product");
    expect(json.offers).toMatchObject({ price: 1000 });
  });

  // ── Seller node: business → Organization ────────────────────────────────
  it("(j) business seller → Organization with trade name", () => {
    const json = buildListingJsonLd(
      base({ domain: "generic", seller: { displayName: "Jane", isBusiness: true, businessName: "Acme NV" } }),
    );
    expect(json.seller).toEqual({ "@type": "Organization", name: "Acme NV" });
  });

  it("(k) business seller without business name falls back to displayName", () => {
    const json = buildListingJsonLd(
      base({ domain: "generic", seller: { displayName: "Acme owner", isBusiness: true } }),
    );
    expect(json.seller).toEqual({ "@type": "Organization", name: "Acme owner" });
  });

  it("(l) private seller with no display name → seller omitted", () => {
    const json = buildListingJsonLd(
      base({ domain: "generic", seller: { displayName: null, isBusiness: false } }),
    );
    expect(json).not.toHaveProperty("seller");
  });

  // ── No price → no offers ────────────────────────────────────────────────
  it("(m) null price → Product without offers", () => {
    const json = buildListingJsonLd(base({ domain: "generic", price: null }));
    expect(json).not.toHaveProperty("offers");
  });

  // ── No images → no image key ────────────────────────────────────────────
  it("(n) no images → image key omitted", () => {
    const json = buildListingJsonLd(base({ domain: "generic", images: [] }));
    expect(json).not.toHaveProperty("image");
  });
});
