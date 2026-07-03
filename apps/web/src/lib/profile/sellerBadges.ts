import {
  SELLER_BADGE_CAP,
  SELLER_BADGE_PRECEDENCE,
  type SellerBadgeSignalKey,
} from "@/lib/trust/signalPolicy";

export type SellerBadge =
  | Exclude<SellerBadgeSignalKey, "verified_email" | "verified_phone">
  | "email_verified"
  | "phone_verified";

const POLICY_TO_LEGACY_BADGE = {
  verified_email: "email_verified",
  verified_phone: "phone_verified",
  verified_business: "verified_business",
  vat_registered: "vat_registered",
  id_verified: "id_verified",
  established_seller: "established_seller",
} satisfies Record<SellerBadgeSignalKey, SellerBadge>;

const PRECEDENCE: SellerBadge[] = SELLER_BADGE_PRECEDENCE.map(
  (badge) => POLICY_TO_LEGACY_BADGE[badge],
);

export function deriveSellerBadges(input: {
  sellerType: "individual" | "business";
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  idVerified: boolean;
  entityVerified: boolean;
  hasVat: boolean;
  createdAt: string | null;
  activeListings: number;
  now?: Date;
}): SellerBadge[] {
  const now = input.now ?? new Date();

  const earned = new Set<SellerBadge>();

  // tier1
  if (input.idVerified) {
    earned.add("id_verified");
  }
  if (input.sellerType === "business" && input.entityVerified) {
    earned.add("verified_business");
  }

  // tier2
  if (input.sellerType === "business" && input.hasVat && input.entityVerified) {
    earned.add("vat_registered");
  }
  if (input.verifiedPhone) {
    earned.add("phone_verified");
  }

  // tier3
  if (isEstablished(input.createdAt, input.activeListings, now)) {
    earned.add("established_seller");
  }
  if (input.verifiedEmail) {
    earned.add("email_verified");
  }

  // Apply precedence order and cap
  return PRECEDENCE.filter((badge) => earned.has(badge)).slice(0, SELLER_BADGE_CAP);
}

function isEstablished(
  createdAt: string | null,
  activeListings: number,
  now: Date,
): boolean {
  if (createdAt === null) return false;
  if (activeListings < 1) return false;

  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return false;

  // Threshold: exactly 12 months before now (UTC)
  const threshold = new Date(now);
  threshold.setUTCMonth(threshold.getUTCMonth() - 12);

  // Account must be at or before the threshold (old enough)
  return created <= threshold;
}
