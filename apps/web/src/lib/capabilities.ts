/**
 * Deploy-time defaults for runtime capabilities.
 *
 * Non-money capabilities may use these values when the runtime settings store is
 * unavailable. Money capabilities never do: they require an explicit audited
 * runtime toggle and a launch mode that legally permits money movement.
 */
export type Capability =
  | "pro_subscriptions"
  | "paid_boosts"
  | "stripe_identity"
  | "itsme"
  | "whatsapp_otp"
  | "sms_otp"
  | "payments_escrow"
  | "discover_v2"
  | "boost_ranking"
  | "advert_translations"
  | "web_push"
  | "error_tracking"
  | "analytics_insights";

export const CAPABILITY_ENV: Record<Capability, string> = {
  pro_subscriptions: "CAPABILITY_PRO_SUBSCRIPTIONS",
  paid_boosts: "CAPABILITY_PAID_BOOSTS",
  stripe_identity: "CAPABILITY_STRIPE_IDENTITY",
  itsme: "CAPABILITY_ITSME",
  whatsapp_otp: "CAPABILITY_WHATSAPP_OTP",
  sms_otp: "CAPABILITY_SMS_OTP",
  payments_escrow: "CAPABILITY_PAYMENTS_ESCROW",
  discover_v2: "CAPABILITY_DISCOVER_V2",
  boost_ranking: "CAPABILITY_BOOST_RANKING",
  advert_translations: "CAPABILITY_ADVERT_TRANSLATIONS",
  web_push: "CAPABILITY_WEB_PUSH",
  error_tracking: "CAPABILITY_ERROR_TRACKING",
  analytics_insights: "CAPABILITY_ANALYTICS_INSIGHTS",
};

export const LAUNCH_MODES = [
  "contact_only",
  "paid_platform_services",
  "marketplace_payments",
] as const;

export type LaunchMode = (typeof LAUNCH_MODES)[number];

export const DEFAULT_LAUNCH_MODE: LaunchMode = "contact_only";

const LAUNCH_MODE_RANK: Record<LaunchMode, number> = {
  contact_only: 0,
  paid_platform_services: 1,
  marketplace_payments: 2,
};

export const MONEY_CAPABILITIES = [
  "pro_subscriptions",
  "paid_boosts",
  "payments_escrow",
] as const satisfies readonly Capability[];

const MONEY_CAPABILITY_SET = new Set<Capability>(MONEY_CAPABILITIES);

export const FAIL_CLOSED_CAPABILITIES = [
  ...MONEY_CAPABILITIES,
  "boost_ranking",
  "stripe_identity",
  "itsme",
  "whatsapp_otp",
  "sms_otp",
] as const satisfies readonly Capability[];

const FAIL_CLOSED_CAPABILITY_SET = new Set<Capability>(FAIL_CLOSED_CAPABILITIES);

export function isLaunchMode(value: unknown): value is LaunchMode {
  return typeof value === "string" && (LAUNCH_MODES as readonly string[]).includes(value);
}

export function launchModeAllows(current: LaunchMode, required: LaunchMode): boolean {
  return LAUNCH_MODE_RANK[current] >= LAUNCH_MODE_RANK[required];
}

export function isMoneyCapability(capability: Capability): boolean {
  return MONEY_CAPABILITY_SET.has(capability);
}

export function isFailClosedCapability(capability: Capability): boolean {
  return FAIL_CLOSED_CAPABILITY_SET.has(capability);
}

export function isCapabilityEnabled(
  cap: Capability,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[CAPABILITY_ENV[cap]] === "true";
}
