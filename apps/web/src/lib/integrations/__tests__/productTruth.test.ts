import { beforeEach, describe, expect, it, vi } from "vitest";

const getIntegrationStatusesMock = vi.fn();

vi.mock("@/lib/integrations/registry", () => ({
  getIntegrationStatuses: (...args: unknown[]) => getIntegrationStatusesMock(...args),
}));

const { getPublicProductTruthSnapshot } = await import("@/lib/productTruth");

describe("public product truth snapshot", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getIntegrationStatusesMock.mockImplementation(async (capabilities: string[]) =>
      capabilities.map((capability) => ({ capability, effective: false, launchMode: "contact_only" })),
    );
  });

  it("projects a truthful contact-only product without internal blocker or secret details", async () => {
    const snapshot = await getPublicProductTruthSnapshot();

    expect(snapshot).toEqual({
      launchMode: "contact_only",
      contactOnly: true,
      paidBoosts: false,
      boostRanking: false,
      proSubscriptions: false,
      identityVerification: false,
      marketplacePayments: false,
      whatsappVerification: false,
      discoverV2: false,
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/missingKeys|blockers|SECRET|TOKEN/);
  });

  it("requires both paid boosts and ranking before paid-ranking claims can be true", async () => {
    getIntegrationStatusesMock.mockImplementation(async (capabilities: string[]) =>
      capabilities.map((capability) => ({
        capability,
        effective: capability === "paid_boosts",
        launchMode: "paid_platform_services",
      })),
    );

    const snapshot = await getPublicProductTruthSnapshot();
    expect(snapshot.paidBoosts).toBe(true);
    expect(snapshot.boostRanking).toBe(false);
  });

  it("exposes Discover only when its effective capability is ready", async () => {
    getIntegrationStatusesMock.mockImplementation(async (capabilities: string[]) =>
      capabilities.map((capability) => ({
        capability,
        effective: capability === "discover_v2",
        launchMode: "contact_only",
      })),
    );

    const snapshot = await getPublicProductTruthSnapshot();
    expect(snapshot.discoverV2).toBe(true);
  });
});
