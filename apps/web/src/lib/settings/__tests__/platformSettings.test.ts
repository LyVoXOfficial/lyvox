import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const redisGet = vi.fn();
const redisSet = vi.fn();
const redisDel = vi.fn();
let redisInstance: {
  get: typeof redisGet;
  set: typeof redisSet;
  del: typeof redisDel;
} | null = {
  get: redisGet,
  set: redisSet,
  del: redisDel,
};

vi.mock("@/lib/redis", () => ({
  getRedis: () => redisInstance,
}));

const maybeSingleMock = vi.fn();
const inMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabaseService", () => ({
  supabaseService: async () => ({
    from: (table: string) => {
      expect(table).toBe("platform_settings");
      return {
        select: () => ({
          eq: () => ({ maybeSingle: maybeSingleMock }),
          in: inMock,
        }),
      };
    },
  }),
}));

vi.mock("@/lib/supabaseServer", () => ({
  supabaseServer: async () => ({ rpc: rpcMock }),
}));

const {
  getSetting,
  setSetting,
  activateEmergencyStop,
  invalidateSetting,
  resolveCapability,
  resolveCapabilityControl,
  getLaunchMode,
  getCommercialBoundary,
  capabilitySettingKey,
  isIntegrityCriticalSettingKey,
  LAUNCH_MODE_SETTING_KEY,
  SETTINGS_CACHE_TTL_SEC,
} = await import("../platformSettings");

const CACHE = (key: string) => `settings:v2:${key}`;
const dbRecord = (key: string, value: Record<string, unknown>) => ({
  key,
  value,
  revision: 0,
  updated_at: "2026-07-10T00:00:00.000Z",
  updated_by: null,
});
const cacheRecord = (key: string, value: Record<string, unknown>) => ({
  key,
  value,
  revision: 0,
  updatedAt: "2026-07-10T00:00:00.000Z",
  updatedBy: null,
});

beforeEach(() => {
  redisGet.mockReset();
  redisSet.mockReset();
  redisDel.mockReset();
  maybeSingleMock.mockReset();
  inMock.mockReset();
  rpcMock.mockReset();
  redisInstance = { get: redisGet, set: redisSet, del: redisDel };
});

describe("getSetting", () => {
  it("returns the cached value without touching the DB (cache hit)", async () => {
    redisGet.mockResolvedValue(cacheRecord("ui:notice", { enabled: true }));

    const value = await getSetting("ui:notice");

    expect(value).toEqual({ enabled: true });
    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("on cache miss reads the DB and caches the positive result with the TTL", async () => {
    redisGet.mockResolvedValue(null);
    maybeSingleMock.mockResolvedValue({
      data: dbRecord("ui:notice", { enabled: false }),
      error: null,
    });

    const value = await getSetting("ui:notice");

    expect(value).toEqual({ enabled: false });
    expect(redisSet).toHaveBeenCalledWith(
      CACHE("ui:notice"),
      cacheRecord("ui:notice", { enabled: false }),
      { ex: SETTINGS_CACHE_TTL_SEC },
    );
  });

  it("returns null for an absent key and does NOT cache the absence (positive-only)", async () => {
    redisGet.mockResolvedValue(null);
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const value = await getSetting("ui:missing");

    expect(value).toBeNull();
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("throws on a DB error and caches nothing (no negative caching of transient failures)", async () => {
    redisGet.mockResolvedValue(null);
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    await expect(getSetting("ui:notice")).rejects.toThrow(/boom/);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("degrades to a DB read when Redis get throws (cache is best-effort)", async () => {
    redisGet.mockRejectedValue(new Error("redis down"));
    maybeSingleMock.mockResolvedValue({
      data: dbRecord("ui:notice", { enabled: true }),
      error: null,
    });

    const value = await getSetting("ui:notice");

    expect(value).toEqual({ enabled: true });
  });

  it("works with no Redis configured (reads DB directly, no cache calls)", async () => {
    redisInstance = null;
    maybeSingleMock.mockResolvedValue({
      data: dbRecord("ui:notice", { enabled: true }),
      error: null,
    });

    const value = await getSetting("ui:notice");

    expect(value).toEqual({ enabled: true });
    expect(redisGet).not.toHaveBeenCalled();
  });

  it("never trusts Redis for platform, capability or approval authority", async () => {
    redisGet.mockResolvedValue(
      cacheRecord("capability:itsme", { enabled: true }),
    );
    maybeSingleMock.mockResolvedValue({
      data: dbRecord("capability:itsme", { enabled: false }),
      error: null,
    });

    await expect(getSetting("capability:itsme")).resolves.toEqual({
      enabled: false,
    });
    expect(redisGet).not.toHaveBeenCalled();
    expect(redisSet).not.toHaveBeenCalled();
    expect(isIntegrityCriticalSettingKey("platform.money_emergency_stop")).toBe(
      true,
    );
    expect(isIntegrityCriticalSettingKey("approval:stripe_live_ready")).toBe(
      true,
    );
  });
});

describe("setSetting / invalidateSetting", () => {
  it("uses the audited RPC and invalidates the cache key", async () => {
    rpcMock.mockResolvedValue({ data: 4, error: null });

    await expect(
      setSetting(
        "capability:itsme",
        { enabled: true },
        {
          reason: "Enable after provider approval",
          expectedRevision: 3,
          requestId: "req-1",
        },
      ),
    ).resolves.toBe(4);

    expect(rpcMock).toHaveBeenCalledWith("set_platform_setting", {
      p_key: "capability:itsme",
      p_value: { enabled: true },
      p_reason: "Enable after provider approval",
      p_expected_revision: 3,
      p_request_id: "req-1",
    });
    expect(redisDel).toHaveBeenCalledWith(CACHE("capability:itsme"));
  });

  it("throws and does not invalidate when the upsert fails", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "write failed" },
    });

    await expect(
      setSetting(
        "capability:itsme",
        { enabled: true },
        {
          reason: "Provider approval",
          expectedRevision: 0,
        },
      ),
    ).rejects.toThrow(/write failed/);
    expect(redisDel).not.toHaveBeenCalled();
  });

  it("uses the atomic emergency patch RPC without a stale application revision", async () => {
    rpcMock.mockResolvedValue({ data: 8, error: null });

    await expect(
      activateEmergencyStop("capability:paid_boosts", {
        reason: "Incident response",
        requestId: "incident-1",
      }),
    ).resolves.toBe(8);

    expect(rpcMock).toHaveBeenCalledWith("activate_platform_emergency_stop", {
      p_key: "capability:paid_boosts",
      p_reason: "Incident response",
      p_request_id: "incident-1",
    });
    expect(redisDel).toHaveBeenCalledWith(CACHE("capability:paid_boosts"));
  });

  it("invalidateSetting is a no-op when Redis is unavailable", async () => {
    redisInstance = null;
    await expect(
      invalidateSetting("capability:itsme"),
    ).resolves.toBeUndefined();
  });

  it("invalidates the safe commercial sentinel when launch authority changes", async () => {
    await invalidateSetting(LAUNCH_MODE_SETTING_KEY);

    expect(redisDel).toHaveBeenCalledWith(CACHE(LAUNCH_MODE_SETTING_KEY));
    expect(redisDel).toHaveBeenCalledWith(
      "settings:v2:safe:commercial-blocked",
    );
  });
});

describe("getCommercialBoundary", () => {
  it("trusts only a cached blocked sentinel, never a cached open state", async () => {
    redisGet.mockResolvedValue(true);

    await expect(getCommercialBoundary()).resolves.toEqual({
      launchMode: "contact_only",
      reconciliationEnabled: false,
      configAvailable: true,
    });
    expect(inMock).not.toHaveBeenCalled();
  });

  it("reads one authoritative DB snapshot before opening webhook reconciliation", async () => {
    redisGet.mockResolvedValue(false);
    inMock.mockResolvedValue({
      data: [
        dbRecord("platform.launch_mode", { mode: "paid_platform_services" }),
        dbRecord("platform.stripe_reconciliation", { enabled: true }),
      ],
      error: null,
    });

    await expect(getCommercialBoundary()).resolves.toEqual({
      launchMode: "paid_platform_services",
      reconciliationEnabled: true,
      configAvailable: true,
    });
    expect(inMock).toHaveBeenCalledTimes(1);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("caches only the safe contact-only boundary and fails closed on DB error", async () => {
    redisGet.mockResolvedValue(null);
    inMock.mockResolvedValueOnce({
      data: [
        dbRecord("platform.launch_mode", { mode: "contact_only" }),
        dbRecord("platform.stripe_reconciliation", { enabled: false }),
      ],
      error: null,
    });

    await expect(getCommercialBoundary()).resolves.toMatchObject({
      launchMode: "contact_only",
      reconciliationEnabled: false,
    });
    expect(redisSet).toHaveBeenCalledWith(
      "settings:v2:safe:commercial-blocked",
      true,
      { ex: SETTINGS_CACHE_TTL_SEC },
    );

    redisGet.mockResolvedValue(null);
    inMock.mockResolvedValueOnce({
      data: null,
      error: { message: "db unavailable" },
    });
    await expect(getCommercialBoundary()).resolves.toEqual({
      launchMode: "contact_only",
      reconciliationEnabled: false,
      configAvailable: false,
    });
  });
});

describe("resolveCapability", () => {
  const env = { CAPABILITY_ITSME: "true" } as Record<
    string,
    string | undefined
  >;

  it("uses the toggle from platform_settings when present (overrides env)", async () => {
    maybeSingleMock.mockResolvedValue({
      data: dbRecord("capability:itsme", { enabled: false }),
      error: null,
    });

    const on = await resolveCapability("itsme", env);

    expect(on).toBe(false); // setting says off, even though env says true
  });

  it("uses a safe OFF default for sensitive capabilities when the setting is absent", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    expect(await resolveCapability("itsme", { CAPABILITY_ITSME: "true" })).toBe(
      false,
    );
    expect(
      await resolveCapability("itsme", { CAPABILITY_ITSME: undefined }),
    ).toBe(false);
  });

  it("fails closed when the store errors for a sensitive capability", async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "db down" },
    });

    const control = await resolveCapabilityControl("itsme", {
      CAPABILITY_ITSME: "true",
    });
    expect(control).toMatchObject({
      desired: false,
      configAvailable: false,
      source: "safe_default",
    });
  });

  it("allows an explicitly low-risk capability to use its env default", async () => {
    maybeSingleMock.mockResolvedValue({
      data: dbRecord("capability:advert_translations", { enabled: "yes" }),
      error: null,
    });

    expect(
      await resolveCapability("advert_translations", {
        CAPABILITY_ADVERT_TRANSLATIONS: "true",
      }),
    ).toBe(true);
  });

  it("honours emergencyDisabled even when a runtime row has no enabled field", async () => {
    maybeSingleMock.mockResolvedValue({
      data: dbRecord("capability:advert_translations", {
        emergencyDisabled: true,
      }),
      error: null,
    });

    await expect(
      resolveCapability("advert_translations", {
        CAPABILITY_ADVERT_TRANSLATIONS: "true",
      }),
    ).resolves.toBe(false);
  });

  it("defaults malformed or unavailable launch mode to contact_only", async () => {
    maybeSingleMock.mockResolvedValue({
      data: dbRecord("platform.launch_mode", { mode: "live_everything" }),
      error: null,
    });
    await expect(getLaunchMode()).resolves.toBe("contact_only");

    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: "db down" },
    });
    await expect(getLaunchMode()).resolves.toBe("contact_only");
  });

  it("capabilitySettingKey namespaces under capability:", () => {
    expect(capabilitySettingKey("pro_subscriptions")).toBe(
      "capability:pro_subscriptions",
    );
  });
});
