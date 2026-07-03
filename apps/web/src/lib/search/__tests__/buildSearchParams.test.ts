import { describe, expect, it } from "vitest";
import { buildOutsideRadiusParams, buildSearchRequestParams } from "../buildSearchParams";

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
