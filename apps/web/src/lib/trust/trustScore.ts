// Pure trust-score formula — no DB calls.
// The Bayesian trigger (refresh_seller_rating) and backfill SQL use the same constants.
// See docs/features/FOUNDATIONS-F1-F14.md for the design rationale.

export interface TrustScoreInputs {
  // Identity (0-40 pts)
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  itsmeVerified: boolean;
  // Activity (0-20 pts)
  accountAgeDays: number;
  activeAdverts: number;
  // Deals (0-30 pts, F3-gated — pass 0 until escrow is live)
  completedDeals: number;
  disputeCount: number;
  // Risk deductions
  activeRiskFlags: number; // count of true-valued keys in profiles.flags jsonb
}

export interface TrustScoreComponents {
  identity: number;    // 0-40
  activity: number;    // 0-20
  deals: number;       // 0-30 (0 until F3 opens)
  riskPenalty: number; // ≤ 0
  total: number;       // clamped to [0, 100]; max achievable is 90
}

export const TRUST_SCORE_WEIGHTS = {
  VERIFIED_EMAIL: 5,
  VERIFIED_PHONE: 15,
  ITSME_VERIFIED: 20,
  ACCOUNT_AGE_MONTHS_MAX: 5,
  ACCOUNT_AGE_PTS_PER_MONTH: 2,   // 5 months × 2 = 10 pts max
  ACTIVE_ADVERTS_MAX: 5,
  ACTIVE_ADVERTS_PTS_EACH: 2,     // 5 adverts × 2 = 10 pts max
  DEAL_PTS_EACH: 3,
  DEAL_MAX_COUNT: 10,              // 10 deals × 3 = 30 pts max
  DISPUTE_PENALTY_EACH: 5,
  DISPUTE_PENALTY_MAX: 15,
  RISK_FLAG_PENALTY_EACH: 5,
  RISK_FLAG_PENALTY_MAX: 20,
} as const;

export function computeTrustScore(inputs: TrustScoreInputs): TrustScoreComponents {
  const W = TRUST_SCORE_WEIGHTS;

  const identity =
    (inputs.verifiedEmail ? W.VERIFIED_EMAIL : 0) +
    (inputs.verifiedPhone ? W.VERIFIED_PHONE : 0) +
    (inputs.itsmeVerified ? W.ITSME_VERIFIED : 0);

  const ageMonths = Math.floor(inputs.accountAgeDays / 30);
  const activityAge = Math.min(ageMonths, W.ACCOUNT_AGE_MONTHS_MAX) * W.ACCOUNT_AGE_PTS_PER_MONTH;
  const activityAdverts = Math.min(inputs.activeAdverts, W.ACTIVE_ADVERTS_MAX) * W.ACTIVE_ADVERTS_PTS_EACH;
  const activity = activityAge + activityAdverts;

  const dealsGross = Math.min(inputs.completedDeals, W.DEAL_MAX_COUNT) * W.DEAL_PTS_EACH;
  const disputeDeduction = Math.min(inputs.disputeCount * W.DISPUTE_PENALTY_EACH, W.DISPUTE_PENALTY_MAX);
  const deals = Math.max(0, dealsGross - disputeDeduction);

  const riskRaw = Math.min(inputs.activeRiskFlags * W.RISK_FLAG_PENALTY_EACH, W.RISK_FLAG_PENALTY_MAX);
  // Avoid -0: only negate when there is an actual penalty.
  const riskPenalty = riskRaw > 0 ? -riskRaw : 0;

  const total = Math.max(0, Math.min(100, identity + activity + deals + riskPenalty));

  return { identity, activity, deals, riskPenalty, total };
}

/**
 * Bayesian-smoothed seller rating. Fixes the "new seller looks perfect" bug
 * (profiles.rating defaults to 5.0 for sellers with zero reviews).
 *
 * Formula: (m * C + sum_ratings) / (m + n)
 *   m  = priorWeight — virtual prior reviews anchoring toward the global mean
 *   C  = globalAvg  — platform-wide baseline (3.5 on a 1–5 scale)
 *   n  = reviewCount
 *   sum_ratings = n × raw_average
 *
 * For n=0: result = C = 3.5   (not 5.0)
 * For n→∞: result → true average (prior washed out)
 */
export function bayesianRating(
  reviewCount: number,
  sumRatings: number,
  priorWeight = 5,
  globalAvg = 3.5,
): number {
  // Guard: callers must pass positive prior; negative review counts are a caller bug.
  if (priorWeight <= 0 || reviewCount < 0) return globalAvg;
  const numerator = priorWeight * globalAvg + sumRatings;
  const denominator = priorWeight + reviewCount;
  return Math.round((numerator / denominator) * 100) / 100;
}
