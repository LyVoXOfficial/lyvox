import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY_ENV, type Capability } from "@/lib/capabilities";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const getLaunchModeMock = vi.fn();
const getMoneyEmergencyStopMock = vi.fn();
const getSettingMock = vi.fn();
const resolveCapabilityControlMock = vi.fn();
const getSettingRecordsMock = vi.fn();
const getIntegrationHealthSnapshotsMock = vi.fn();

vi.mock("@/lib/settings/platformSettings", () => ({
  LAUNCH_MODE_SETTING_KEY: "platform.launch_mode",
  MONEY_EMERGENCY_STOP_SETTING_KEY: "platform.money_emergency_stop",
  capabilitySettingKey: (capability: string) => `capability:${capability}`,
  getSettingRecords: (...args: unknown[]) => getSettingRecordsMock(...args),
  getLaunchMode: () => getLaunchModeMock(),
  getMoneyEmergencyStop: () => getMoneyEmergencyStopMock(),
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  resolveCapabilityControl: (...args: unknown[]) =>
    resolveCapabilityControlMock(...args),
}));

vi.mock("@/lib/integrations/health", () => ({
  getIntegrationHealthSnapshots: (...args: unknown[]) =>
    getIntegrationHealthSnapshotsMock(...args),
}));

const {
  CAPABILITY_REGISTRY,
  getIntegrationStatus,
  getInfrastructureStatuses,
  getIntegrationStatuses,
  INFRASTRUCTURE_REGISTRY,
} = await import("../registry");

describe("capability registry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getLaunchModeMock.mockResolvedValue("contact_only");
    getMoneyEmergencyStopMock.mockResolvedValue({
      stopped: false,
      configAvailable: true,
    });
    getSettingMock.mockResolvedValue({
      approved: true,
      evidenceRef: "evidence-1",
      decidedAt: "2026-07-10T00:00:00.000Z",
    });
    resolveCapabilityControlMock.mockResolvedValue({
      desired: true,
      emergencyDisabled: false,
      configAvailable: true,
      source: "runtime",
    });
    getIntegrationHealthSnapshotsMock.mockImplementation(
      async (ids: string[]) =>
        ids.map((integrationId) => ({
          integrationId,
          status: "healthy",
          checkedAt: "2026-07-10T00:00:00.000Z",
          expiresAt: "2099-01-01T00:00:00.000Z",
          latencyMs: 10,
          safeErrorCode: null,
          stale: false,
        })),
    );
    getSettingRecordsMock.mockImplementation(async (keys: string[]) => {
      const records = new Map<string, Record<string, unknown>>();
      for (const key of keys) {
        let value: Record<string, unknown> | null = null;
        if (key === "platform.launch_mode") {
          value = { mode: await getLaunchModeMock() };
        } else if (key === "platform.money_emergency_stop") {
          value = { stopped: (await getMoneyEmergencyStopMock()).stopped };
        } else if (key.startsWith("capability:")) {
          const control = await resolveCapabilityControlMock(
            key.slice("capability:".length),
          );
          value = {
            enabled: control.desired,
            emergencyDisabled: control.emergencyDisabled,
          };
        } else if (key.startsWith("approval:")) {
          value = await getSettingMock(key);
        }
        if (value) {
          records.set(key, {
            key,
            value,
            revision: 0,
            updatedAt: "2026-07-10T00:00:00.000Z",
            updatedBy: null,
          });
        }
      }
      return records;
    });
  });

  it("has one complete definition for every capability", () => {
    expect(Object.keys(CAPABILITY_REGISTRY).sort()).toEqual(
      Object.keys(CAPABILITY_ENV).sort(),
    );
  });

  it("documents every registry key in both the env template and boot inventory", () => {
    const envExample = readFileSync(
      join(process.cwd(), ".env.example"),
      "utf8",
    );
    const envSource = readFileSync(
      join(process.cwd(), "apps", "web", "src", "lib", "env.ts"),
      "utf8",
    );
    const keys = new Set([
      ...Object.values(CAPABILITY_REGISTRY).flatMap(
        (definition) => definition.requiredEnv,
      ),
      ...INFRASTRUCTURE_REGISTRY.flatMap((definition) => [
        ...definition.requiredEnv,
        ...(definition.anyOf?.flat() ?? []),
      ]),
    ]);

    for (const key of keys) {
      expect(envExample, `${key} missing from .env.example`).toMatch(
        new RegExp(`^${key}=`, "m"),
      );
      expect(envSource, `${key} missing from env.ts`).toContain(`"${key}"`);
    }
  });

  it("blocks money in contact_only even with live-looking keys, approvals and desired ON", async () => {
    const env = {
      STRIPE_SECRET_KEY: "sk_live_present",
      STRIPE_WEBHOOK_SECRET: "whsec_live_present",
      STRIPE_PRO_PRICE_ID: "price_live_present",
    };
    const status = await getIntegrationStatus("pro_subscriptions", env);

    expect(status.effective).toBe(false);
    expect(status.launchMode).toBe("contact_only");
    expect(status.blockers.map((blocker) => blocker.code)).toContain(
      "launch_mode",
    );
  });

  it("keeps a configured placeholder ineffective and names implementation as the blocker", async () => {
    const env = {
      ITSME_CLIENT_ID: "client",
      ITSME_CLIENT_SECRET: "secret",
      ITSME_REDIRECT_URI: "https://www.lyvox.be/auth/itsme",
    };
    const status = await getIntegrationStatus("itsme", env);

    expect(status.effective).toBe(false);
    expect(status.implementation).toBe("stub");
    expect(status.blockers.map((blocker) => blocker.code)).toContain(
      "implementation_incomplete",
    );
  });

  it("returns missing key names but never their values", async () => {
    const status = await getIntegrationStatus("advert_translations", {
      CRON_SECRET: "do-not-leak-this",
      TRANSLATION_PROVIDER_URL: "https://provider.test",
    });
    const serialized = JSON.stringify(status);

    expect(status.missingKeys).toEqual(["TRANSLATION_PROVIDER_KEY"]);
    expect(serialized).not.toContain("do-not-leak-this");
  });

  it("allows a fully configured ready non-money capability", async () => {
    const status = await getIntegrationStatus("advert_translations", {
      CRON_SECRET: "cron",
      TRANSLATION_PROVIDER_URL: "https://provider.test",
      TRANSLATION_PROVIDER_KEY: "provider-key",
    });

    expect(status.effective).toBe(true);
    expect(status.blockers).toEqual([]);
  });

  it("honours an emergency-only runtime row over an environment-enabled capability", async () => {
    getSettingRecordsMock.mockResolvedValue(
      new Map([
        [
          "platform.launch_mode",
          {
            key: "platform.launch_mode",
            value: { mode: "contact_only" },
            revision: 0,
            updatedAt: "2026-07-10T00:00:00.000Z",
            updatedBy: null,
          },
        ],
        [
          "platform.money_emergency_stop",
          {
            key: "platform.money_emergency_stop",
            value: { stopped: false },
            revision: 0,
            updatedAt: "2026-07-10T00:00:00.000Z",
            updatedBy: null,
          },
        ],
        [
          "capability:advert_translations",
          {
            key: "capability:advert_translations",
            value: { emergencyDisabled: true },
            revision: 1,
            updatedAt: "2026-07-10T00:00:00.000Z",
            updatedBy: null,
          },
        ],
      ]),
    );

    const status = await getIntegrationStatus("advert_translations", {
      CAPABILITY_ADVERT_TRANSLATIONS: "true",
      CRON_SECRET: "cron",
      TRANSLATION_PROVIDER_URL: "https://provider.test",
      TRANSLATION_PROVIDER_KEY: "provider-key",
    });

    expect(status.desired).toBe(true);
    expect(status.emergencyDisabled).toBe(true);
    expect(status.effective).toBe(false);
    expect(status.blockers[0]?.code).toBe("emergency_off");
  });

  it("gives emergency stop precedence over otherwise positive money inputs", async () => {
    getLaunchModeMock.mockResolvedValue("paid_platform_services");
    getMoneyEmergencyStopMock.mockResolvedValue({
      stopped: true,
      configAvailable: true,
    });
    const status = await getIntegrationStatus("paid_boosts", {
      STRIPE_SECRET_KEY: "stripe",
      STRIPE_WEBHOOK_SECRET: "webhook",
    });

    expect(status.effective).toBe(false);
    expect(status.blockers[0]?.code).toBe("emergency_off");
  });

  it("supports any-of infrastructure credentials without exposing values", () => {
    const statuses = getInfrastructureStatuses({
      EMAIL_FROM: "LyVoX <support@lyvox.be>",
      RESEND_API_KEY: "resend-secret",
    });
    const email = statuses.find(
      (status) => status.id === "transactional_email",
    );

    expect(email?.ready).toBe(true);
    expect(JSON.stringify(email)).not.toContain("resend-secret");
  });

  it("never permits unknown capabilities through the typed registry", () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        CAPABILITY_REGISTRY,
        "not_real" as Capability,
      ),
    ).toBe(false);
  });

  it("loads all controls and shared approvals in one DB-authoritative snapshot", async () => {
    await getIntegrationStatuses(["pro_subscriptions", "paid_boosts"], {
      STRIPE_SECRET_KEY: "stripe",
      STRIPE_WEBHOOK_SECRET: "webhook",
      STRIPE_PRO_PRICE_ID: "price",
    });

    expect(getSettingRecordsMock).toHaveBeenCalledTimes(1);
    const keys = getSettingRecordsMock.mock.calls[0]?.[0] as string[];
    expect(
      keys.filter((key) => key === "approval:stripe_live_ready"),
    ).toHaveLength(1);
  });
});
