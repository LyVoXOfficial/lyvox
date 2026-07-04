import "server-only";

export interface TranslationProvider {
  readonly name: string;
  translate(text: string, from: string, to: string): Promise<string | null>;
}

export class NoopProvider implements TranslationProvider {
  readonly name = "noop";

  async translate(): Promise<string | null> {
    return null;
  }
}

type ExternalProviderOptions = {
  url: string;
  key: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type ExternalTranslationResponse = {
  translation?: unknown;
  text?: unknown;
};

export class ExternalProvider implements TranslationProvider {
  readonly name = "external";
  private readonly url: string;
  private readonly key: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor({ url, key, timeoutMs = 10_000, fetchImpl = fetch }: ExternalProviderOptions) {
    this.url = url;
    this.key = key;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async translate(text: string, from: string, to: string): Promise<string | null> {
    const trimmed = text.trim();
    if (!trimmed) return "";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify({ text: trimmed, from, to }),
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const json = (await response.json()) as ExternalTranslationResponse;
      const translated = typeof json.translation === "string" ? json.translation : json.text;
      return typeof translated === "string" ? translated : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function getTranslationProvider(
  env: Record<string, string | undefined> = process.env,
): TranslationProvider {
  const url = env.TRANSLATION_PROVIDER_URL;
  const key = env.TRANSLATION_PROVIDER_KEY;

  if (url && key) {
    return new ExternalProvider({ url, key });
  }

  return new NoopProvider();
}
