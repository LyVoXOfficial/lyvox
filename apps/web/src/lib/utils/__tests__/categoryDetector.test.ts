import { describe, expect, it } from "vitest";

import { resolvePostFlowMode } from "../categoryDetector";

describe("resolvePostFlowMode", () => {
  it("routes jackets and other simple goods to the fast goods flow", () => {
    expect(resolvePostFlowMode("lichnye-veshchi/odezhda-i-obuv/kurtki")).toBe("fast_goods");
    expect(resolvePostFlowMode("dlya-doma-hobbi-i-detey/mebel/divany")).toBe("fast_goods");
  });

  it("routes vehicle categories to the vehicle deep flow", () => {
    expect(resolvePostFlowMode("transport/avtomobili")).toBe("vehicle_deep");
    expect(resolvePostFlowMode("cars/sedans")).toBe("vehicle_deep");
  });

  it("routes real estate categories to the real estate deep flow", () => {
    expect(resolvePostFlowMode("nedvizhimost/arenda-kvartir")).toBe("real_estate_deep");
    expect(resolvePostFlowMode("real-estate/apartment")).toBe("real_estate_deep");
  });

  it("routes job categories to the job deep flow", () => {
    expect(resolvePostFlowMode("rabota-i-karera/vakansii")).toBe("job_deep");
    expect(resolvePostFlowMode("jobs/full-time")).toBe("job_deep");
  });

  it("keeps the generic flow only for an unselected category", () => {
    expect(resolvePostFlowMode("")).toBe("generic");
    expect(resolvePostFlowMode(null)).toBe("generic");
    expect(resolvePostFlowMode(undefined)).toBe("generic");
  });
});
