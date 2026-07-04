import { describe, it, expect } from "vitest";
import { isCapabilityEnabled, CAPABILITY_ENV } from "@/lib/capabilities";

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
    expect(CAPABILITY_ENV.advert_translations).toBe("CAPABILITY_ADVERT_TRANSLATIONS");
    expect(CAPABILITY_ENV.web_push).toBe("CAPABILITY_WEB_PUSH");
  });
});
