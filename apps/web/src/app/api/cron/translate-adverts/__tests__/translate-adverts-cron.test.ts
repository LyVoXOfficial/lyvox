import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const serviceFromMock = vi.fn();
const getUserByIdMock = vi.fn();
const isCapabilityEnabledMock = vi.fn();
const getTranslationProviderMock = vi.fn();

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: serviceFromMock,
    auth: { admin: { getUserById: getUserByIdMock } },
  }),
}));

vi.mock("@/lib/capabilities", () => ({
  isCapabilityEnabled: (...args: unknown[]) => isCapabilityEnabledMock(...args),
}));

vi.mock("@/lib/translations/provider", () => ({
  getTranslationProvider: () => getTranslationProviderMock(),
}));

const { buildAdvertSourceHash } = await import("@/lib/translations/advertTranslations");
const { GET } = await import("../route");

const ADVERT_ID = "11111111-1111-4111-8111-111111111111";

function req(auth?: string) {
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = auth;
  return new Request("https://x.test/api/cron/translate-adverts", { headers });
}

function makeAdvert(overrides: Record<string, unknown> = {}) {
  return {
    id: ADVERT_ID,
    user_id: "user-1",
    title: "Fiets",
    description: "Blauwe stadsfiets",
    content_locale: "nl",
    updated_at: "2026-07-04T00:00:00Z",
    advert_translations: [],
    ...overrides,
  };
}

function makeAdvertsChain(rows: unknown[]) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: async () => ({ data: rows, error: null }),
  };
  return chain;
}

function makeTranslationsTable(calls: {
  inserts: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
}) {
  return {
    insert: (payload: Record<string, unknown>) => {
      calls.inserts.push(payload);
      return {
        select: () => ({
          single: async () => ({
            data: { id: `tr-${String(payload.target_locale)}`, status: "draft" },
            error: null,
          }),
        }),
      };
    },
    update: (payload: Record<string, unknown>) => {
      calls.updates.push(payload);
      const chain = {
        eq: () => chain,
        neq: () => chain,
        select: () => chain,
        maybeSingle: async () => ({ data: { id: "tr-published" }, error: null }),
      };
      return chain;
    },
  };
}

describe("GET /api/cron/translate-adverts", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "testsecret";
    delete process.env.TRANSLATE_INCLUDE_SEED;
    serviceFromMock.mockReset();
    getUserByIdMock.mockReset();
    isCapabilityEnabledMock.mockReset().mockReturnValue(true);
    getTranslationProviderMock.mockReset().mockReturnValue({
      name: "external",
      translate: vi.fn(async (text: string, _from: string, to: string) => `${text}-${to}`),
    });
  });

  afterEach(() => {
    process.env.CRON_SECRET = "testsecret";
    delete process.env.TRANSLATE_INCLUDE_SEED;
  });

  it("401 with no Authorization header", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("Bearer testsecret"));
    expect(res.status).toBe(401);
  });

  it("does no work when the advert translations capability is OFF", async () => {
    isCapabilityEnabledMock.mockReturnValue(false);

    const res = await GET(req("Bearer testsecret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.disabled).toBe(true);
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it("publishes generated translations for all target locales except source", async () => {
    const calls = { inserts: [] as Array<Record<string, unknown>>, updates: [] as Array<Record<string, unknown>> };
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "adverts") return makeAdvertsChain([makeAdvert()]);
      if (table === "advert_translations") return makeTranslationsTable(calls);
      throw new Error(`Unexpected table ${table}`);
    });

    const res = await GET(req("Bearer testsecret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.processed).toBe(1);
    expect(body.data.translated).toBe(4);
    expect(calls.inserts.map((row) => row.target_locale)).toEqual(["en", "fr", "ru", "de"]);
    expect(calls.updates).toHaveLength(4);
    expect(calls.updates.every((row) => row.status === "published")).toBe(true);
  });

  it("does not overwrite an already reviewed current translation", async () => {
    const advert = makeAdvert();
    const sourceHash = buildAdvertSourceHash(advert);
    const calls = { inserts: [] as Array<Record<string, unknown>>, updates: [] as Array<Record<string, unknown>> };
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "adverts") {
        return makeAdvertsChain([
          makeAdvert({
            advert_translations: [
              { target_locale: "fr", source_hash: sourceHash, status: "reviewed" },
            ],
          }),
        ]);
      }
      if (table === "advert_translations") return makeTranslationsTable(calls);
      throw new Error(`Unexpected table ${table}`);
    });

    const res = await GET(req("Bearer testsecret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.translated).toBe(3);
    expect(calls.inserts.map((row) => row.target_locale)).not.toContain("fr");
  });

  it("marks provider unavailability as draft rows without publishing", async () => {
    getTranslationProviderMock.mockReturnValue({
      name: "noop",
      translate: vi.fn(async () => null),
    });
    const calls = { inserts: [] as Array<Record<string, unknown>>, updates: [] as Array<Record<string, unknown>> };
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "adverts") return makeAdvertsChain([makeAdvert()]);
      if (table === "advert_translations") return makeTranslationsTable(calls);
      throw new Error(`Unexpected table ${table}`);
    });

    const res = await GET(req("Bearer testsecret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.unavailable).toBe(4);
    expect(body.data.translated).toBe(0);
    expect(calls.inserts.every((row) => row.status === "draft")).toBe(true);
    expect(calls.inserts.every((row) => row.model_or_provider === "noop:unavailable")).toBe(true);
    expect(calls.updates).toHaveLength(0);
  });
});
