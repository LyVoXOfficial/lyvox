import { beforeEach, describe, expect, it, vi } from "vitest";

const getIntegrationStatusMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/integrations/registry", () => ({
  getIntegrationStatus: (...args: unknown[]) => getIntegrationStatusMock(...args),
}));
vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ from: fromMock }),
}));

const { GET } = await import("../route");

describe("GET /api/billing/products", () => {
  beforeEach(() => vi.resetAllMocks());

  it("does not read the product catalogue when paid boosts are ineffective", async () => {
    getIntegrationStatusMock.mockResolvedValue({ effective: false });
    const response = await GET();
    expect(response.status).toBe(404);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns only active products explicitly owned by paid_boosts", async () => {
    getIntegrationStatusMock.mockResolvedValue({ effective: true });
    const orderMock = vi.fn().mockResolvedValue({
      data: [{ code: "boost_7d", capability: "paid_boosts", duration_days: 7 }],
      error: null,
    });
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: orderMock,
    };
    fromMock.mockReturnValue(chain);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.products).toHaveLength(1);
    expect(body.data.products[0]).toMatchObject({ capability: "paid_boosts", duration_days: 7 });
  });
});
