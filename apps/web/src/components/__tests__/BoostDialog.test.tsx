import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import BoostDialog from "@/components/BoostDialog";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "en" }),
}));

describe("BoostDialog product truth", () => {
  beforeEach(() => fetchMock.mockReset());

  it("renders no paid CTA and makes no billing request when server truth is disabled", () => {
    render(<BoostDialog enabled={false} advertId="ad-1" trigger={<Button>Boost</Button>} />);
    expect(screen.queryByRole("button", { name: "Boost" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed while resolving a client-only capability", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<BoostDialog advertId="ad-1" trigger={<Button>Boost</Button>} />);

    expect(screen.queryByRole("button", { name: "Boost" })).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/capabilities/paid_boosts",
      { cache: "no-store" },
    ));
    expect(screen.queryByRole("button", { name: "Boost" })).toBeNull();
  });
});
