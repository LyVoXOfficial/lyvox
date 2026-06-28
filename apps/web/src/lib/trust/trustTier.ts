export type TrustTier = "new" | "rising" | "trusted" | "top";

export interface TrustTierInfo {
  tier: TrustTier;
  /** i18n key — pass to t() to get the localised label */
  labelKey: string;
  colorVariant: "muted" | "teal-light" | "teal" | "gold";
}

const TIERS: {
  maxScore: number;
  tier: TrustTier;
  labelKey: string;
  colorVariant: TrustTierInfo["colorVariant"];
}[] = [
  { maxScore: 14,  tier: "new",     labelKey: "trust_score.tier_new",     colorVariant: "muted" },
  { maxScore: 34,  tier: "rising",  labelKey: "trust_score.tier_rising",  colorVariant: "teal-light" },
  { maxScore: 59,  tier: "trusted", labelKey: "trust_score.tier_trusted", colorVariant: "teal" },
  { maxScore: 100, tier: "top",     labelKey: "trust_score.tier_top",     colorVariant: "gold" },
];

export function deriveTrustTier(score: number): TrustTierInfo {
  const clamped = Math.max(0, Math.min(100, score));
  const entry = TIERS.find((t) => clamped <= t.maxScore) ?? TIERS[TIERS.length - 1];
  return { tier: entry.tier, labelKey: entry.labelKey, colorVariant: entry.colorVariant };
}
