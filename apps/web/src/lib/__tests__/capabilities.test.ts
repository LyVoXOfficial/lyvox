import { describe, it, expect } from "vitest";
import {
  isCapabilityEnabled,
  CAPABILITY_ENV,
  isFailClosedCapability,
  isLaunchMode,
  launchModeAllows,
} from "@/lib/capabilities";

describe("capability flags", () => {
  it("defaults every capability to OFF when env is empty", () => {
    const env = {};
    for (const cap of Object.keys(CAPABILITY_ENV) as (keyof typeof CAPABILITY_ENV)[]) {
      expect(isCapabilityEnabled(cap, env)).toBe(false);
    }
  });
  it("treats only the literal string 'true' as enabled", () => {
    expect(isCapabilityEnabled("itsme", { CAPABILITY_ITSME: "true" })).toBe(true);
    expect(isCapabilityEnabled("itsme", { CAPABILITY_ITSME: "1" })).toBe(false);
    expect(isCapabilityEnabled("itsme", { CAPABILITY_ITSME: "TRUE" })).toBe(false);
  });
  it("maps each capability to its CAPABILITY_* env name", () => {
    expect(CAPABILITY_ENV.payments_escrow).toBe("CAPABILITY_PAYMENTS_ESCROW");
    expect(CAPABILITY_ENV.paid_boosts).toBe("CAPABILITY_PAID_BOOSTS");
    expect(CAPABILITY_ENV.advert_translations).toBe("CAPABILITY_ADVERT_TRANSLATIONS");
    expect(CAPABILITY_ENV.web_push).toBe("CAPABILITY_WEB_PUSH");
  });
  it("models the commercial release boundary independently from provider capabilities", () => {
    expect(isLaunchMode("contact_only")).toBe(true);
    expect(isLaunchMode("contracted_integrations")).toBe(false);
    expect(launchModeAllows("contact_only", "paid_platform_services")).toBe(false);
    expect(launchModeAllows("marketplace_payments", "paid_platform_services")).toBe(true);
  });
  it("fails closed for money, paid ranking and contracted identity capabilities", () => {
    expect(isFailClosedCapability("paid_boosts")).toBe(true);
    expect(isFailClosedCapability("boost_ranking")).toBe(true);
    expect(isFailClosedCapability("itsme")).toBe(true);
    expect(isFailClosedCapability("advert_translations")).toBe(false);
  });
});
