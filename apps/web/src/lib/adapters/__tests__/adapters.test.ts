import { beforeEach, describe, it, expect, vi } from "vitest";

const getIntegrationStatusMock = vi.fn();
vi.mock("@/lib/integrations/registry", () => ({
  getIntegrationStatus: (...args: unknown[]) => getIntegrationStatusMock(...args),
}));

import { getIdentityAdapter, getOtpAdapter, getPaymentsAdapter } from "@/lib/adapters";

describe("provider adapter seams", () => {
  beforeEach(() => {
    getIntegrationStatusMock.mockReset().mockResolvedValue({ effective: false });
  });

  it("returns null for every adapter when its effective capability is OFF", async () => {
    const env = {};
    await expect(getIdentityAdapter(env)).resolves.toBeNull();
    await expect(getOtpAdapter(env)).resolves.toBeNull();
    await expect(getPaymentsAdapter(env)).resolves.toBeNull();
  });
  it("keeps the provider seam unsupported even if a caller injects an effective status", async () => {
    getIntegrationStatusMock.mockResolvedValue({ effective: true });
    const env = { CAPABILITY_STRIPE_IDENTITY: "true" };
    const adapter = await getIdentityAdapter(env);
    expect(adapter).not.toBeNull();
    await expect(adapter!.verify({ subjectId: "u1" })).resolves.toEqual({ status: "unsupported" });
  });
});
