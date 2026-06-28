import { describe, it, expect } from "vitest";
import { deriveTrustTier } from "../trustTier";

describe("deriveTrustTier", () => {
  it("score 0 → new", () => {
    expect(deriveTrustTier(0).tier).toBe("new");
    expect(deriveTrustTier(0).labelKey).toBe("trust_score.tier_new");
    expect(deriveTrustTier(0).colorVariant).toBe("muted");
  });

  it("score 14 → new (boundary)", () => {
    expect(deriveTrustTier(14).tier).toBe("new");
  });

  it("score 15 → rising", () => {
    expect(deriveTrustTier(15).tier).toBe("rising");
    expect(deriveTrustTier(15).labelKey).toBe("trust_score.tier_rising");
    expect(deriveTrustTier(15).colorVariant).toBe("teal-light");
  });

  it("score 34 → rising (boundary)", () => {
    expect(deriveTrustTier(34).tier).toBe("rising");
  });

  it("score 35 → trusted", () => {
    expect(deriveTrustTier(35).tier).toBe("trusted");
    expect(deriveTrustTier(35).labelKey).toBe("trust_score.tier_trusted");
    expect(deriveTrustTier(35).colorVariant).toBe("teal");
  });

  it("score 59 → trusted (boundary)", () => {
    expect(deriveTrustTier(59).tier).toBe("trusted");
  });

  it("score 60 → top", () => {
    expect(deriveTrustTier(60).tier).toBe("top");
    expect(deriveTrustTier(60).labelKey).toBe("trust_score.tier_top");
    expect(deriveTrustTier(60).colorVariant).toBe("gold");
  });

  it("score 100 → top", () => {
    expect(deriveTrustTier(100).tier).toBe("top");
  });

  it("clamps negative scores to 0 (→ new)", () => {
    expect(deriveTrustTier(-5).tier).toBe("new");
  });

  it("clamps scores above 100 to 100 (→ top)", () => {
    expect(deriveTrustTier(150).tier).toBe("top");
  });
});
