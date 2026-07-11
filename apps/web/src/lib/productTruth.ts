import "server-only";

import { getIntegrationStatuses } from "@/lib/integrations/registry";
import type { Capability } from "@/lib/capabilities";

export type PublicProductTruthSnapshot = {
  launchMode: "contact_only" | "paid_platform_services" | "marketplace_payments";
  contactOnly: boolean;
  paidBoosts: boolean;
  boostRanking: boolean;
  proSubscriptions: boolean;
  identityVerification: boolean;
  marketplacePayments: boolean;
  whatsappVerification: boolean;
  discoverV2: boolean;
};

/** Secret-free, server-derived source for public claims and CTA visibility. */
export async function getPublicProductTruthSnapshot(): Promise<PublicProductTruthSnapshot> {
  const capabilities = [
    "paid_boosts",
    "boost_ranking",
    "pro_subscriptions",
    "stripe_identity",
    "itsme",
    "payments_escrow",
    "whatsapp_otp",
    "discover_v2",
  ] as const satisfies readonly Capability[];
  const statuses = await getIntegrationStatuses(capabilities);
  const byCapability = new Map(statuses.map((status) => [status.capability, status]));
  const launchMode = statuses[0]?.launchMode ?? "contact_only";
  const effective = (capability: Capability) => byCapability.get(capability)?.effective === true;

  return {
    launchMode,
    contactOnly: launchMode === "contact_only",
    paidBoosts: effective("paid_boosts"),
    boostRanking: effective("boost_ranking"),
    proSubscriptions: effective("pro_subscriptions"),
    identityVerification: effective("stripe_identity") || effective("itsme"),
    marketplacePayments: effective("payments_escrow"),
    whatsappVerification: effective("whatsapp_otp"),
    discoverV2: effective("discover_v2"),
  };
}
