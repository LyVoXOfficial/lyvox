import { describe, it, expect } from "vitest";
import { getIdentityAdapter, getOtpAdapter, getPaymentsAdapter } from "@/lib/adapters";

describe("provider adapter seams", () => {
  it("returns null for every adapter when its capability is OFF (default)", () => {
    const env = {};
    expect(getIdentityAdapter(env)).toBeNull();
    expect(getOtpAdapter(env)).toBeNull();
    expect(getPaymentsAdapter(env)).toBeNull();
  });
  it("returns the disabled default adapter when the capability is ON but no provider is wired", async () => {
    const env = { CAPABILITY_STRIPE_IDENTITY: "true" };
    const adapter = getIdentityAdapter(env);
    expect(adapter).not.toBeNull();
    await expect(adapter!.verify({ subjectId: "u1" })).resolves.toEqual({ status: "unsupported" });
  });
});
