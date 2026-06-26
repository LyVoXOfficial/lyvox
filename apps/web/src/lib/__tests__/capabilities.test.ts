import { describe, it, expect } from "vitest";
import { isCapabilityEnabled, CAPABILITY_ENV } from "@/lib/capabilities";

describe("capability flags", () => {
  it("defaults every capability to OFF when env is empty", () => {
    const env = {} as NodeJS.ProcessEnv;
    for (const cap of Object.keys(CAPABILITY_ENV) as (keyof typeof CAPABILITY_ENV)[]) {
      expect(isCapabilityEnabled(cap, env)).toBe(false);
    }
  });
  it("treats only the literal string 'true' as enabled", () => {
    expect(isCapabilityEnabled("itsme", { CAPABILITY_ITSME: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isCapabilityEnabled("itsme", { CAPABILITY_ITSME: "1" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isCapabilityEnabled("itsme", { CAPABILITY_ITSME: "TRUE" } as NodeJS.ProcessEnv)).toBe(false);
  });
  it("maps each capability to its CAPABILITY_* env name", () => {
    expect(CAPABILITY_ENV.payments_escrow).toBe("CAPABILITY_PAYMENTS_ESCROW");
  });
});
