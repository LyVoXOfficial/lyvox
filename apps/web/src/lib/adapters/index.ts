import { isCapabilityEnabled, type Capability } from "@/lib/capabilities";
import type { IdentityAdapter, OtpAdapter, PaymentsAdapter } from "./types";

// Disabled defaults: the seam is live, but until a real provider is wired in Phase B
// (a contract + credentials), every call resolves "unsupported". Swapping in a provider
// = replace the default below + flip the capability flag; call sites never change.
const disabledIdentity: IdentityAdapter = { verify: async () => ({ status: "unsupported" }) };
const disabledOtp: OtpAdapter = { send: async () => ({ status: "unsupported" }) };
const disabledPayments: PaymentsAdapter = { createPayout: async () => ({ status: "unsupported" }) };

function gated<T>(cap: Capability, adapter: T, env: NodeJS.ProcessEnv): T | null {
  return isCapabilityEnabled(cap, env) ? adapter : null;
}

export function getIdentityAdapter(env: NodeJS.ProcessEnv = process.env): IdentityAdapter | null {
  return gated("stripe_identity", disabledIdentity, env);
}
export function getOtpAdapter(env: NodeJS.ProcessEnv = process.env): OtpAdapter | null {
  return gated("whatsapp_otp", disabledOtp, env);
}
export function getPaymentsAdapter(env: NodeJS.ProcessEnv = process.env): PaymentsAdapter | null {
  return gated("payments_escrow", disabledPayments, env);
}

export type { IdentityAdapter, OtpAdapter, PaymentsAdapter } from "./types";
