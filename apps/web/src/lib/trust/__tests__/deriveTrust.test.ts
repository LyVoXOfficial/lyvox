import { describe, it, expect } from "vitest";
import { deriveHumanLevel, deriveBusinessLevel, canSellAsBusiness } from "@/lib/trust/deriveTrust";

describe("trust derivation (spec §6.7)", () => {
  it("ladders the human axis by backing fact", () => {
    expect(deriveHumanLevel({ authenticated: false, verifiedEmail: false, verifiedPhone: false, idVerified: false })).toBe("L0");
    expect(deriveHumanLevel({ authenticated: true, verifiedEmail: false, verifiedPhone: false, idVerified: false })).toBe("L1");
    expect(deriveHumanLevel({ authenticated: true, verifiedEmail: true, verifiedPhone: false, idVerified: false })).toBe("L2");
    expect(deriveHumanLevel({ authenticated: true, verifiedEmail: true, verifiedPhone: true, idVerified: false })).toBe("L3");
    expect(deriveHumanLevel({ authenticated: true, verifiedEmail: true, verifiedPhone: true, idVerified: true })).toBe("L4");
  });
  it("ladders the business axis", () => {
    expect(deriveBusinessLevel({ exists: false, entityVerified: false })).toBe("B0");
    expect(deriveBusinessLevel({ exists: true, entityVerified: false })).toBe("B0");
    expect(deriveBusinessLevel({ exists: true, entityVerified: true })).toBe("B1");
  });
  it("sell-as-business requires human≥L3 AND business≥B1", () => {
    expect(canSellAsBusiness("L3", "B1")).toBe(true);
    expect(canSellAsBusiness("L2", "B1")).toBe(false);
    expect(canSellAsBusiness("L4", "B0")).toBe(false);
  });
});
