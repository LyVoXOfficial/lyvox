import type { IdentityAdapter, OtpAdapter, PaymentsAdapter } from "./types";
import { getIntegrationStatus } from "@/lib/integrations/registry";

// Disabled defaults: the seam is live, but until a real provider is wired in Phase B
// (a contract + credentials), every call resolves "unsupported". Swapping in a provider
// = replace the default below + flip the capability flag; call sites never change.
const disabledIdentity: IdentityAdapter = { verify: async () => ({ status: "unsupported" }) };
const disabledOtp: OtpAdapter = { send: async () => ({ status: "unsupported" }) };
const disabledPayments: PaymentsAdapter = { createPayout: async () => ({ status: "unsupported" }) };

async function gated<T>(
  cap: "stripe_identity" | "whatsapp_otp" | "payments_escrow",
  adapter: T,
  env: Record<string, string | undefined>,
): Promise<T | null> {
  const status = await getIntegrationStatus(cap, env);
  return status.effective ? adapter : null;
}

export async function getIdentityAdapter(
  env: Record<string, string | undefined> = process.env,
): Promise<IdentityAdapter | null> {
  return gated("stripe_identity", disabledIdentity, env);
}
export async function getOtpAdapter(
  env: Record<string, string | undefined> = process.env,
): Promise<OtpAdapter | null> {
  return gated("whatsapp_otp", disabledOtp, env);
}
export async function getPaymentsAdapter(
  env: Record<string, string | undefined> = process.env,
): Promise<PaymentsAdapter | null> {
  return gated("payments_escrow", disabledPayments, env);
}

export type { IdentityAdapter, OtpAdapter, PaymentsAdapter } from "./types";
