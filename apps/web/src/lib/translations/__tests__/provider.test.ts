import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { ExternalProvider, NoopProvider, getTranslationProvider } = await import("../provider");

describe("translation providers", () => {
  it("uses NoopProvider when external credentials are absent", async () => {
    const provider = getTranslationProvider({});

    expect(provider).toBeInstanceOf(NoopProvider);
    await expect(provider.translate("Hallo", "nl", "fr")).resolves.toBeNull();
  });

  it("posts to the external provider and returns the translated text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translation: "Bonjour" }),
    });
    const provider = new ExternalProvider({
      url: "https://translate.example.test",
      key: "provider-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(provider.translate("Hallo", "nl", "fr")).resolves.toBe("Bonjour");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://translate.example.test");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer provider-key",
    });
    expect(JSON.parse(String(init.body))).toEqual({ text: "Hallo", from: "nl", to: "fr" });
  });

  it("returns null when the external provider is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    const provider = new ExternalProvider({
      url: "https://translate.example.test",
      key: "provider-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(provider.translate("Hallo", "nl", "fr")).resolves.toBeNull();
  });
});
