import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const redisGet = vi.fn();
const redisSet = vi.fn();
const redisDel = vi.fn();
let redisInstance: { get: typeof redisGet; set: typeof redisSet; del: typeof redisDel } | null = {
  get: redisGet,
  set: redisSet,
  del: redisDel,
};

vi.mock("@/lib/redis", () => ({
  getRedis: () => redisInstance,
}));

const maybeSingleMock = vi.fn();
const upsertMock = vi.fn();

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: (table: string) => {
      expect(table).toBe("platform_settings");
      return {
        select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
        upsert: upsertMock,
      };
    },
  }),
}));

const {
  getSetting,
  setSetting,
  invalidateSetting,
  resolveCapability,
  capabilitySettingKey,
  SETTINGS_CACHE_TTL_SEC,
} = await import("../platformSettings");

const CACHE = (key: string) => `settings:v1:${key}`;

beforeEach(() => {
  redisGet.mockReset();
  redisSet.mockReset();
  redisDel.mockReset();
  maybeSingleMock.mockReset();
  upsertMock.mockReset();
  redisInstance = { get: redisGet, set: redisSet, del: redisDel };
});

describe("getSetting", () => {
  it("returns the cached value without touching the DB (cache hit)", async () => {
    redisGet.mockResolvedValue({ enabled: true });

    const value = await getSetting("capability:itsme");

    expect(value).toEqual({ enabled: true });
    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("on cache miss reads the DB and caches the positive result with the TTL", async () => {
    redisGet.mockResolvedValue(null);
    maybeSingleMock.mockResolvedValue({ data: { value: { enabled: false } }, error: null });

    const value = await getSetting("capability:itsme");

    expect(value).toEqual({ enabled: false });
    expect(redisSet).toHaveBeenCalledWith(
      CACHE("capability:itsme"),
      { enabled: false },
      { ex: SETTINGS_CACHE_TTL_SEC },
    );
  });

  it("returns null for an absent key and does NOT cache the absence (positive-only)", async () => {
    redisGet.mockResolvedValue(null);
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const value = await getSetting("capability:missing");

    expect(value).toBeNull();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("throws on a DB error and caches nothing (no negative caching of transient failures)", async () => {
    redisGet.mockResolvedValue(null);
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(getSetting("capability:itsme")).rejects.toThrow(/boom/);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("degrades to a DB read when Redis get throws (cache is best-effort)", async () => {
    redisGet.mockRejectedValue(new Error("redis down"));
    maybeSingleMock.mockResolvedValue({ data: { value: { enabled: true } }, error: null });

    const value = await getSetting("capability:itsme");

    expect(value).toEqual({ enabled: true });
  });

  it("works with no Redis configured (reads DB directly, no cache calls)", async () => {
    redisInstance = null;
    maybeSingleMock.mockResolvedValue({ data: { value: { enabled: true } }, error: null });

    const value = await getSetting("capability:itsme");

    expect(value).toEqual({ enabled: true });
    expect(redisGet).not.toHaveBeenCalled();
  });
});

describe("setSetting / invalidateSetting", () => {
  it("upserts and invalidates the cache key", async () => {
    upsertMock.mockResolvedValue({ error: null });

    await setSetting("capability:itsme", { enabled: true }, "admin-uuid");

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "capability:itsme",
        value: { enabled: true },
        updated_by: "admin-uuid",
      }),
      { onConflict: "key" },
    );
    expect(redisDel).toHaveBeenCalledWith(CACHE("capability:itsme"));
  });

  it("throws and does not invalidate when the upsert fails", async () => {
    upsertMock.mockResolvedValue({ error: { message: "write failed" } });

    await expect(setSetting("capability:itsme", { enabled: true })).rejects.toThrow(/write failed/);
    expect(redisDel).not.toHaveBeenCalled();
  });

  it("invalidateSetting is a no-op when Redis is unavailable", async () => {
    redisInstance = null;
    await expect(invalidateSetting("capability:itsme")).resolves.toBeUndefined();
  });
});

describe("resolveCapability", () => {
  const env = { CAPABILITY_ITSME: "true" } as Record<string, string | undefined>;

  it("uses the toggle from platform_settings when present (overrides env)", async () => {
    redisGet.mockResolvedValue({ enabled: false });

    const on = await resolveCapability("itsme", env);

    expect(on).toBe(false); // setting says off, even though env says true
  });

  it("falls back to the env default when the setting is absent", async () => {
    redisGet.mockResolvedValue(null);
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    expect(await resolveCapability("itsme", { CAPABILITY_ITSME: "true" })).toBe(true);
    expect(await resolveCapability("itsme", { CAPABILITY_ITSME: undefined })).toBe(false);
  });

  it("falls back to the env default when the store errors (never breaks the request)", async () => {
    redisGet.mockResolvedValue(null);
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "db down" } });

    expect(await resolveCapability("itsme", { CAPABILITY_ITSME: "true" })).toBe(true);
  });

  it("ignores a malformed setting value (no boolean `enabled`) and uses env", async () => {
    redisGet.mockResolvedValue({ enabled: "yes" });

    expect(await resolveCapability("itsme", { CAPABILITY_ITSME: "true" })).toBe(true);
  });

  it("capabilitySettingKey namespaces under capability:", () => {
    expect(capabilitySettingKey("pro_subscriptions")).toBe("capability:pro_subscriptions");
  });
});
