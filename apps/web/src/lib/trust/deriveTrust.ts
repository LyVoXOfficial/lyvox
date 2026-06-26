export type HumanLevel = "L0" | "L1" | "L2" | "L3" | "L4";
export type BusinessLevel = "B0" | "B1";

export function deriveHumanLevel(p: {
  authenticated: boolean; verifiedEmail: boolean; verifiedPhone: boolean; idVerified: boolean;
}): HumanLevel {
  if (!p.authenticated) return "L0";
  if (!p.verifiedEmail) return "L1";
  if (!p.verifiedPhone) return "L2";
  if (!p.idVerified) return "L3";
  return "L4";
}

export function deriveBusinessLevel(b: { exists: boolean; entityVerified: boolean }): BusinessLevel {
  return b.exists && b.entityVerified ? "B1" : "B0";
}

const HUMAN_RANK: Record<HumanLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
const BUSINESS_RANK: Record<BusinessLevel, number> = { B0: 0, B1: 1 };

export function canSellAsBusiness(human: HumanLevel, business: BusinessLevel): boolean {
  return HUMAN_RANK[human] >= HUMAN_RANK.L3 && BUSINESS_RANK[business] >= BUSINESS_RANK.B1;
}
