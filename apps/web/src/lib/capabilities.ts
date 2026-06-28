/**
 * Decision 3 (activation-ready): every company-gated capability is built now but
 * gated OFF here. Flip a capability on by setting its CAPABILITY_* env var to the
 * literal string "true" (in Vercel/.env) — no code change, no deploy.
 */
export type Capability =
  | "pro_subscriptions"
  | "stripe_identity"
  | "itsme"
  | "whatsapp_otp"
  | "payments_escrow"
  | "discover_v2";

export const CAPABILITY_ENV: Record<Capability, string> = {
  pro_subscriptions: "CAPABILITY_PRO_SUBSCRIPTIONS",
  stripe_identity: "CAPABILITY_STRIPE_IDENTITY",
  itsme: "CAPABILITY_ITSME",
  whatsapp_otp: "CAPABILITY_WHATSAPP_OTP",
  payments_escrow: "CAPABILITY_PAYMENTS_ESCROW",
  discover_v2: "CAPABILITY_DISCOVER_V2",
};

export function isCapabilityEnabled(
  cap: Capability,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[CAPABILITY_ENV[cap]] === "true";
}
