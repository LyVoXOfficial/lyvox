import "server-only";

import {
  CAPABILITY_ENV,
  launchModeAllows,
  type Capability,
  type LaunchMode,
} from "@/lib/capabilities";
import {
  capabilitySettingKey,
  getSettingRecords,
  LAUNCH_MODE_SETTING_KEY,
  MONEY_EMERGENCY_STOP_SETTING_KEY,
  type CapabilityControlResolution,
} from "@/lib/settings/platformSettings";
import { isFailClosedCapability, isMoneyCapability } from "@/lib/capabilities";
import {
  getIntegrationHealthSnapshots,
  type IntegrationHealthSnapshot,
} from "@/lib/integrations/health";

export type ApprovalId =
  | "operator_entity_ready"
  | "vat_accounting_ready"
  | "commercial_terms_approved"
  | "stripe_live_ready"
  | "twilio_dpa_approved"
  | "itsme_contract_approved"
  | "whatsapp_contract_approved"
  | "identity_contract_approved"
  | "marketplace_legal_signoff"
  | "psd2_aml_signoff"
  | "escrow_provider_contract";

export type CapabilityDefinition = {
  label: string;
  description: string;
  requiredEnv: readonly string[];
  requiredApprovals: readonly ApprovalId[];
  minimumLaunchMode: LaunchMode;
  implementation: "ready" | "partial" | "stub";
  publicStatus: boolean;
  dependencies?: readonly string[];
  healthRequired?: boolean;
};

/**
 * Product and integration truth. `implementation` is part of the effective
 * decision so a configured placeholder can never be advertised as available.
 */
export const CAPABILITY_REGISTRY: Record<Capability, CapabilityDefinition> = {
  pro_subscriptions: {
    label: "Pro subscriptions",
    description: "Recurring LyVoX Pro plan sold through Stripe Checkout.",
    requiredEnv: [
      "NEXT_PUBLIC_SITE_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRO_PRICE_ID",
    ],
    requiredApprovals: [
      "operator_entity_ready",
      "vat_accounting_ready",
      "commercial_terms_approved",
      "stripe_live_ready",
    ],
    minimumLaunchMode: "paid_platform_services",
    implementation: "partial",
    publicStatus: true,
    dependencies: ["stripe_billing"],
    healthRequired: true,
  },
  paid_boosts: {
    label: "Paid listing boosts",
    description: "One-time sale of listing visibility benefits through Stripe.",
    requiredEnv: ["NEXT_PUBLIC_SITE_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    requiredApprovals: [
      "operator_entity_ready",
      "vat_accounting_ready",
      "commercial_terms_approved",
      "stripe_live_ready",
    ],
    minimumLaunchMode: "paid_platform_services",
    implementation: "partial",
    publicStatus: true,
    dependencies: ["stripe_billing"],
    healthRequired: true,
  },
  stripe_identity: {
    label: "Stripe Identity",
    description: "Contracted identity verification adapter.",
    requiredEnv: ["STRIPE_SECRET_KEY", "STRIPE_IDENTITY_WEBHOOK_SECRET"],
    requiredApprovals: ["identity_contract_approved"],
    minimumLaunchMode: "contact_only",
    implementation: "stub",
    publicStatus: false,
    dependencies: ["stripe_identity"],
    healthRequired: true,
  },
  itsme: {
    label: "itsme verification",
    description: "Contracted Belgian identity verification adapter.",
    requiredEnv: [
      "ITSME_CLIENT_ID",
      "ITSME_CLIENT_SECRET",
      "ITSME_REDIRECT_URI",
    ],
    requiredApprovals: ["itsme_contract_approved"],
    minimumLaunchMode: "contact_only",
    implementation: "stub",
    publicStatus: false,
    dependencies: ["itsme"],
    healthRequired: true,
  },
  whatsapp_otp: {
    label: "WhatsApp verification",
    description: "Contracted WhatsApp OTP adapter.",
    requiredEnv: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
    requiredApprovals: ["whatsapp_contract_approved"],
    minimumLaunchMode: "contact_only",
    implementation: "stub",
    publicStatus: false,
    dependencies: ["whatsapp"],
    healthRequired: true,
  },
  sms_otp: {
    label: "SMS phone verification",
    description: "Belgian mobile verification through Twilio SMS.",
    requiredEnv: [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_FROM",
      "TURNSTILE_SECRET_KEY",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ],
    requiredApprovals: ["twilio_dpa_approved"],
    minimumLaunchMode: "contact_only",
    implementation: "partial",
    publicStatus: true,
    dependencies: ["twilio_sms"],
    healthRequired: true,
  },
  payments_escrow: {
    label: "Marketplace escrow and payouts",
    description:
      "Transactional marketplace payment, escrow, payout and dispute adapter.",
    requiredEnv: ["ESCROW_PROVIDER_API_KEY", "ESCROW_PROVIDER_WEBHOOK_SECRET"],
    requiredApprovals: [
      "marketplace_legal_signoff",
      "psd2_aml_signoff",
      "escrow_provider_contract",
    ],
    minimumLaunchMode: "marketplace_payments",
    implementation: "stub",
    publicStatus: false,
    dependencies: ["escrow_provider"],
    healthRequired: true,
  },
  discover_v2: {
    label: "Discover v2",
    description: "Alternative discovery experience.",
    requiredEnv: [],
    requiredApprovals: [],
    minimumLaunchMode: "contact_only",
    implementation: "partial",
    publicStatus: true,
  },
  boost_ranking: {
    label: "Boost ranking",
    description:
      "Ranking application for existing boost entitlements; never permits checkout.",
    requiredEnv: [],
    requiredApprovals: [],
    minimumLaunchMode: "contact_only",
    implementation: "partial",
    publicStatus: true,
  },
  advert_translations: {
    label: "Advert translations",
    description:
      "Machine-generated advert translations through the configured provider.",
    requiredEnv: [
      "CRON_SECRET",
      "TRANSLATION_PROVIDER_URL",
      "TRANSLATION_PROVIDER_KEY",
    ],
    requiredApprovals: [],
    minimumLaunchMode: "contact_only",
    implementation: "ready",
    publicStatus: true,
    dependencies: ["translation_provider"],
    healthRequired: true,
  },
  web_push: {
    label: "Web Push",
    description:
      "Browser push registration and notification delivery lifecycle.",
    requiredEnv: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
    requiredApprovals: [],
    minimumLaunchMode: "contact_only",
    implementation: "partial",
    publicStatus: true,
  },
  error_tracking: {
    label: "Error tracking",
    description: "Server and browser error reporting through Sentry.",
    requiredEnv: ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"],
    requiredApprovals: [],
    minimumLaunchMode: "contact_only",
    implementation: "partial",
    publicStatus: false,
    dependencies: ["sentry"],
    healthRequired: true,
  },
  analytics_insights: {
    label: "Product analytics",
    description: "Consent-aware product analytics and performance insights.",
    requiredEnv: [],
    requiredApprovals: [],
    minimumLaunchMode: "contact_only",
    implementation: "partial",
    publicStatus: false,
  },
};

export type CapabilityBlockerCode =
  | "emergency_off"
  | "config_unavailable"
  | "toggle_off"
  | "missing_keys"
  | "missing_approvals"
  | "launch_mode"
  | "implementation_incomplete"
  | "health_unknown"
  | "health_stale"
  | "integration_unhealthy";

export type CapabilityBlocker = {
  code: CapabilityBlockerCode;
  detail: string;
};

export type IntegrationStatus = {
  capability: Capability;
  label: string;
  description: string;
  desired: boolean;
  emergencyDisabled: boolean;
  capabilityEmergencyDisabled: boolean;
  globalMoneyEmergencyStopped: boolean;
  configAvailable: boolean;
  effective: boolean;
  hasKeys: boolean;
  missingKeys: string[];
  missingApprovals: ApprovalId[];
  launchMode: LaunchMode;
  minimumLaunchMode: LaunchMode;
  implementation: CapabilityDefinition["implementation"];
  health: IntegrationHealthSnapshot[];
  blockers: CapabilityBlocker[];
};

type ResolutionContext = {
  launchMode?: LaunchMode;
  control?: CapabilityControlResolution;
  moneyEmergencyStopped?: boolean;
  healthSnapshots?: IntegrationHealthSnapshot[];
  approvalValues?: Partial<Record<ApprovalId, boolean>>;
};

const isPresent = (value: string | undefined): boolean =>
  Boolean(value?.trim());

export function approvalSettingKey(approval: ApprovalId): string {
  return `approval:${approval}`;
}

function isApprovalValueValid(
  value: Record<string, unknown> | undefined,
): boolean {
  if (
    value?.approved !== true ||
    typeof value.evidenceRef !== "string" ||
    value.evidenceRef.trim().length < 3 ||
    typeof value.decidedAt !== "string" ||
    Number.isNaN(new Date(value.decidedAt).valueOf())
  ) {
    return false;
  }
  if (typeof value.expiresAt === "string") {
    const expiresAt = new Date(value.expiresAt);
    if (Number.isNaN(expiresAt.valueOf()) || expiresAt <= new Date())
      return false;
  }
  return true;
}

function buildIntegrationStatus(
  capability: Capability,
  env: Record<string, string | undefined>,
  context: Required<ResolutionContext>,
): IntegrationStatus {
  const definition = CAPABILITY_REGISTRY[capability];
  const launchMode = context.launchMode;
  const control = context.control;
  const moneyEmergencyStopped = isMoneyCapability(capability)
    ? context.moneyEmergencyStopped
    : false;
  const health = context.healthSnapshots;
  const missingKeys = definition.requiredEnv.filter(
    (key) => !isPresent(env[key]),
  );
  const missingApprovals = definition.requiredApprovals.filter(
    (approval) => context.approvalValues[approval] !== true,
  );

  const blockers: CapabilityBlocker[] = [];
  if (control.emergencyDisabled || moneyEmergencyStopped) {
    blockers.push({
      code: "emergency_off",
      detail: "Emergency stop is active.",
    });
  }
  if (!control.configAvailable && isFailClosedCapability(capability)) {
    blockers.push({
      code: "config_unavailable",
      detail: "Runtime configuration is unavailable; safe default is off.",
    });
  }
  if (!control.desired)
    blockers.push({ code: "toggle_off", detail: "Runtime toggle is off." });
  if (missingKeys.length) {
    blockers.push({
      code: "missing_keys",
      detail: `Missing: ${missingKeys.join(", ")}.`,
    });
  }
  if (missingApprovals.length) {
    blockers.push({
      code: "missing_approvals",
      detail: `Missing approvals: ${missingApprovals.join(", ")}.`,
    });
  }
  if (!launchModeAllows(launchMode, definition.minimumLaunchMode)) {
    blockers.push({
      code: "launch_mode",
      detail: `Requires ${definition.minimumLaunchMode}; current mode is ${launchMode}.`,
    });
  }
  if (definition.implementation !== "ready") {
    blockers.push({
      code: "implementation_incomplete",
      detail: `Implementation state is ${definition.implementation}.`,
    });
  }
  if (definition.healthRequired) {
    for (const snapshot of health) {
      if (snapshot.status === "unknown") {
        blockers.push({
          code: "health_unknown",
          detail: `${snapshot.integrationId} has no usable health evidence.`,
        });
      } else if (snapshot.stale) {
        blockers.push({
          code: "health_stale",
          detail: `${snapshot.integrationId} health evidence is stale.`,
        });
      } else if (snapshot.status !== "healthy") {
        blockers.push({
          code: "integration_unhealthy",
          detail: `${snapshot.integrationId} status is ${snapshot.status}.`,
        });
      }
    }
  }

  return {
    capability,
    label: definition.label,
    description: definition.description,
    desired: control.desired,
    emergencyDisabled: control.emergencyDisabled || moneyEmergencyStopped,
    capabilityEmergencyDisabled: control.emergencyDisabled,
    globalMoneyEmergencyStopped: moneyEmergencyStopped,
    configAvailable: control.configAvailable,
    effective: blockers.length === 0,
    hasKeys: missingKeys.length === 0,
    missingKeys,
    missingApprovals,
    launchMode,
    minimumLaunchMode: definition.minimumLaunchMode,
    implementation: definition.implementation,
    health,
    blockers,
  };
}

export async function getIntegrationStatus(
  capability: Capability,
  env: Record<string, string | undefined> = process.env,
): Promise<IntegrationStatus> {
  const [status] = await getIntegrationStatuses([capability], env);
  return status;
}

export async function getAllIntegrationStatuses(
  env: Record<string, string | undefined> = process.env,
): Promise<IntegrationStatus[]> {
  const capabilities = Object.keys(CAPABILITY_REGISTRY) as Capability[];
  return getIntegrationStatuses(capabilities, env);
}

export async function getIntegrationStatuses(
  capabilities: readonly Capability[],
  env: Record<string, string | undefined> = process.env,
): Promise<IntegrationStatus[]> {
  const approvalIds = Array.from(
    new Set(
      capabilities.flatMap(
        (capability) => CAPABILITY_REGISTRY[capability].requiredApprovals,
      ),
    ),
  );
  const integrationIds = Array.from(
    new Set(
      capabilities.flatMap(
        (capability) => CAPABILITY_REGISTRY[capability].dependencies ?? [],
      ),
    ),
  );
  const settingKeys = [
    LAUNCH_MODE_SETTING_KEY,
    MONEY_EMERGENCY_STOP_SETTING_KEY,
    ...capabilities.map(capabilitySettingKey),
    ...approvalIds.map(approvalSettingKey),
  ];

  let settingsAvailable = true;
  const [settingRecords, healthSnapshots] = await Promise.all([
    getSettingRecords(settingKeys).catch(() => {
      settingsAvailable = false;
      return new Map();
    }),
    getIntegrationHealthSnapshots(integrationIds),
  ]);

  const launchValue = settingRecords.get(LAUNCH_MODE_SETTING_KEY)?.value;
  const launchMode =
    typeof launchValue?.mode === "string" &&
    ["contact_only", "paid_platform_services", "marketplace_payments"].includes(
      launchValue.mode,
    )
      ? (launchValue.mode as LaunchMode)
      : "contact_only";
  const moneyEmergencyStopped =
    settingRecords.get(MONEY_EMERGENCY_STOP_SETTING_KEY)?.value.stopped !==
    false;
  const approvalValues = Object.fromEntries(
    approvalIds.map((approval) => [
      approval,
      isApprovalValueValid(
        settingRecords.get(approvalSettingKey(approval))?.value,
      ),
    ]),
  ) as Partial<Record<ApprovalId, boolean>>;

  return capabilities.map((capability) => {
    const value = settingRecords.get(capabilitySettingKey(capability))?.value;
    const fallbackDesired = isFailClosedCapability(capability)
      ? false
      : env[CAPABILITY_ENV[capability]] === "true";
    const control: CapabilityControlResolution =
      value && typeof value.enabled === "boolean"
        ? {
            desired: value.enabled,
            emergencyDisabled: value.emergencyDisabled === true,
            configAvailable: settingsAvailable,
            source: "runtime",
          }
        : {
            desired: fallbackDesired,
            emergencyDisabled: value?.emergencyDisabled === true,
            configAvailable: settingsAvailable,
            source: isFailClosedCapability(capability)
              ? "safe_default"
              : "environment",
          };

    return buildIntegrationStatus(capability, env, {
      launchMode,
      control,
      moneyEmergencyStopped,
      healthSnapshots: healthSnapshots.filter((snapshot) =>
        (CAPABILITY_REGISTRY[capability].dependencies ?? []).includes(
          snapshot.integrationId,
        ),
      ),
      approvalValues,
    });
  });
}

export function isPublicCapability(capability: Capability): boolean {
  return CAPABILITY_REGISTRY[capability].publicStatus;
}

export type InfrastructureDefinition = {
  id: string;
  label: string;
  requiredEnv: readonly string[];
  anyOf?: readonly (readonly string[])[];
  externalCheck?: string;
};

export const INFRASTRUCTURE_REGISTRY: readonly InfrastructureDefinition[] = [
  {
    id: "supabase_core",
    label: "Supabase core",
    requiredEnv: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
  },
  {
    id: "stripe_billing",
    label: "Stripe billing",
    requiredEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  {
    id: "twilio_sms",
    label: "Twilio SMS",
    requiredEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"],
  },
  {
    id: "upstash",
    label: "Upstash rate limiting and config cache",
    requiredEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  },
  {
    id: "turnstile",
    label: "Cloudflare Turnstile",
    requiredEnv: ["TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
  },
  {
    id: "transactional_email",
    label: "Transactional email",
    requiredEnv: ["EMAIL_FROM"],
    anyOf: [["RESEND_API_KEY"], ["SENDGRID_API_KEY"]],
  },
  {
    id: "openai_moderation",
    label: "OpenAI moderation",
    requiredEnv: ["OPENAI_API_KEY"],
    externalCheck:
      "Supabase Edge Function secrets must be verified separately.",
  },
  {
    id: "translation_provider",
    label: "Translation provider",
    requiredEnv: ["TRANSLATION_PROVIDER_URL", "TRANSLATION_PROVIDER_KEY"],
  },
  {
    id: "sentry",
    label: "Sentry",
    requiredEnv: ["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"],
  },
  { id: "cron", label: "Scheduled jobs", requiredEnv: ["CRON_SECRET"] },
  {
    id: "itsme",
    label: "itsme",
    requiredEnv: [
      "ITSME_CLIENT_ID",
      "ITSME_CLIENT_SECRET",
      "ITSME_REDIRECT_URI",
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    requiredEnv: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
  },
  {
    id: "stripe_identity",
    label: "Stripe Identity",
    requiredEnv: ["STRIPE_SECRET_KEY", "STRIPE_IDENTITY_WEBHOOK_SECRET"],
  },
  {
    id: "escrow_provider",
    label: "Escrow provider",
    requiredEnv: ["ESCROW_PROVIDER_API_KEY", "ESCROW_PROVIDER_WEBHOOK_SECRET"],
  },
] as const;

export type InfrastructureStatus = InfrastructureDefinition & {
  ready: boolean;
  missingKeys: string[];
};

export function getInfrastructureStatuses(
  env: Record<string, string | undefined> = process.env,
): InfrastructureStatus[] {
  return INFRASTRUCTURE_REGISTRY.map((definition) => {
    const missingKeys = definition.requiredEnv.filter(
      (key) => !isPresent(env[key]),
    );
    const anyOfReady =
      !definition.anyOf ||
      definition.anyOf.some((group) =>
        group.every((key) => isPresent(env[key])),
      );
    if (!anyOfReady && definition.anyOf) {
      missingKeys.push(...definition.anyOf.flat());
    }
    return { ...definition, ready: missingKeys.length === 0, missingKeys };
  });
}
