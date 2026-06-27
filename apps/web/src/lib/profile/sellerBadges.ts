export type SellerBadge =
  | "verified_business"
  | "vat_registered"
  | "id_verified"
  | "phone_verified"
  | "email_verified"
  | "established_seller";

/**
 * Precedence order (§8.4): tier1 first, then tier2, then tier3.
 * This fixed array determines the output order — we filter by earned membership.
 */
const PRECEDENCE: SellerBadge[] = [
  "id_verified",        // tier1
  "verified_business",  // tier1
  "vat_registered",     // tier2 (business)
  "phone_verified",     // tier2 (individual)
  "established_seller", // tier3
  "email_verified",     // tier3
];

const CAP = 3;

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
  return PRECEDENCE.filter((badge) => earned.has(badge)).slice(0, CAP);
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
