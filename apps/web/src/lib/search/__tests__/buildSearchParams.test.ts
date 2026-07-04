import { describe, expect, it } from "vitest";
import { buildOutsideRadiusParams, buildRelaxedParams, buildSearchRequestParams } from "../buildSearchParams";

describe("buildSearchRequestParams", () => {
  it("includes geospatial params only when both coordinates are present", () => {
    const params = buildSearchRequestParams({
      query: "bike",
      location: "Geel",
      lat: "51.165",
      lng: "4.99",
      radiusKm: "20",
      sourceParams: new URLSearchParams("catalog_field_brand=Gazelle"),
    });

    expect(params.get("q")).toBe("bike");
    expect(params.has("location")).toBe(false);
    expect(params.get("lat")).toBe("51.165");
    expect(params.get("lng")).toBe("4.99");
    expect(params.get("radius_km")).toBe("20");
    expect(params.get("catalog_field_brand")).toBe("Gazelle");
  });

  it("keeps text location search when coordinates are incomplete", () => {
    const params = buildSearchRequestParams({
      location: "Geel",
      lat: "51.165",
      radiusKm: "20",
    });

    expect(params.get("location")).toBe("Geel");
    expect(params.has("lat")).toBe(false);
    expect(params.has("lng")).toBe(false);
    expect(params.has("radius_km")).toBe(false);
  });
});

describe("buildOutsideRadiusParams", () => {
  it("expands radius for the outside-radius fetch", () => {
    const params = buildOutsideRadiusParams({
      location: "Geel",
      lat: "51.165",
      lng: "4.99",
      radiusKm: "20",
      page: 2,
    });

    expect(params?.get("radius_km")).toBe("60");
    expect(params?.get("page")).toBe("0");
  });
});

describe("buildRelaxedParams", () => {
  it("returns null when there is nothing to relax", () => {
    expect(
      buildRelaxedParams({ query: "bike", categoryId: "cat-1", location: "Gent" }),
    ).toBeNull();
  });

  it("drops price, condition and verified while keeping query/category/location", () => {
    const params = buildRelaxedParams({
      query: "bike",
      categoryId: "cat-1",
      location: "Gent",
      priceMin: "100",
      priceMax: "500",
      condition: "used",
      verifiedOnly: true,
    });

    expect(params).not.toBeNull();
    expect(params?.get("q")).toBe("bike");
    expect(params?.get("category_id")).toBe("cat-1");
    expect(params?.get("location")).toBe("Gent");
    expect(params?.has("price_min")).toBe(false);
    expect(params?.has("price_max")).toBe(false);
    expect(params?.has("condition")).toBe(false);
    expect(params?.has("verified_only")).toBe(false);
    expect(params?.get("page")).toBe("0");
  });

  it("relaxes when only a verified-only filter is present", () => {
    const params = buildRelaxedParams({ query: "bike", verifiedOnly: true });
    expect(params).not.toBeNull();
    expect(params?.has("verified_only")).toBe(false);
  });
});
