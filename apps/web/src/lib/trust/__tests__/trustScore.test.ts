import { describe, it, expect } from "vitest";
import {
  computeTrustScore,
  bayesianRating,
  TRUST_SCORE_WEIGHTS,
  type TrustScoreInputs,
} from "../trustScore";

const base: TrustScoreInputs = {
  verifiedEmail: false,
  verifiedPhone: false,
  itsmeVerified: false,
  accountAgeDays: 0,
  activeAdverts: 0,
  completedDeals: 0,
  disputeCount: 0,
  activeRiskFlags: 0,
};

// ── Identity ─────────────────────────────────────────────────────────────────

describe("computeTrustScore — identity", () => {
  it("all unverified → 0 pts", () => {
    expect(computeTrustScore(base).identity).toBe(0);
  });

  it("verified_email only → 5 pts", () => {
    expect(computeTrustScore({ ...base, verifiedEmail: true }).identity).toBe(5);
  });

  it("verified_phone only → 15 pts", () => {
    expect(computeTrustScore({ ...base, verifiedPhone: true }).identity).toBe(15);
  });

  it("itsme_verified only → 20 pts", () => {
    expect(computeTrustScore({ ...base, itsmeVerified: true }).identity).toBe(20);
  });

  it("all three verified → 40 pts (max identity)", () => {
    expect(
      computeTrustScore({ ...base, verifiedEmail: true, verifiedPhone: true, itsmeVerified: true }).identity,
    ).toBe(40);
  });
});

// ── Activity ──────────────────────────────────────────────────────────────────

describe("computeTrustScore — activity", () => {
  it("day 0, 0 adverts → 0 pts", () => {
    expect(computeTrustScore(base).activity).toBe(0);
  });

  it("30 days = 1 month → 2 pts", () => {
    expect(computeTrustScore({ ...base, accountAgeDays: 30 }).activity).toBe(2);
  });

  it("age caps at ACCOUNT_AGE_MONTHS_MAX months (10 pts)", () => {
    const maxMonths = TRUST_SCORE_WEIGHTS.ACCOUNT_AGE_MONTHS_MAX;
    const maxPts = maxMonths * TRUST_SCORE_WEIGHTS.ACCOUNT_AGE_PTS_PER_MONTH;
    expect(
      computeTrustScore({ ...base, accountAgeDays: (maxMonths + 10) * 30 }).activity,
    ).toBe(maxPts);
  });

  it("1 active advert → 2 pts", () => {
    expect(computeTrustScore({ ...base, activeAdverts: 1 }).activity).toBe(2);
  });

  it("adverts cap at ACTIVE_ADVERTS_MAX (10 pts)", () => {
    const maxAdverts = TRUST_SCORE_WEIGHTS.ACTIVE_ADVERTS_MAX;
    const maxPts = maxAdverts * TRUST_SCORE_WEIGHTS.ACTIVE_ADVERTS_PTS_EACH;
    expect(
      computeTrustScore({ ...base, activeAdverts: maxAdverts + 20 }).activity,
    ).toBe(maxPts);
  });

  it("fully saturated → activity = 20 (hard ceiling)", () => {
    expect(computeTrustScore({ ...base, accountAgeDays: 9999, activeAdverts: 9999 }).activity).toBe(20);
  });
});

// ── Deals (F3-gated) ──────────────────────────────────────────────────────────

describe("computeTrustScore — deals (F3-gated)", () => {
  it("0 deals → 0 pts (graceful degradation before F3)", () => {
    expect(computeTrustScore(base).deals).toBe(0);
  });

  it("5 completed deals → 15 pts", () => {
    expect(computeTrustScore({ ...base, completedDeals: 5 }).deals).toBe(15);
  });

  it("deals cap at DEAL_MAX_COUNT × DEAL_PTS_EACH = 30", () => {
    expect(computeTrustScore({ ...base, completedDeals: 9999 }).deals).toBe(30);
  });

  it("dispute deduction reduces deal pts (10 deals – 1 dispute → 30 – 5 = 25)", () => {
    expect(
      computeTrustScore({ ...base, completedDeals: 10, disputeCount: 1 }).deals,
    ).toBe(25);
  });

  it("dispute penalty caps at DISPUTE_PENALTY_MAX; deals never go below 0", () => {
    expect(
      computeTrustScore({ ...base, completedDeals: 1, disputeCount: 9999 }).deals,
    ).toBe(0);
  });
});

// ── Risk penalty ─────────────────────────────────────────────────────────────

describe("computeTrustScore — risk penalty", () => {
  it("no flags → riskPenalty = 0", () => {
    expect(computeTrustScore(base).riskPenalty).toBe(0);
  });

  it("1 active flag → −5", () => {
    expect(computeTrustScore({ ...base, activeRiskFlags: 1 }).riskPenalty).toBe(-5);
  });

  it("4 flags → −20 (at penalty cap)", () => {
    expect(computeTrustScore({ ...base, activeRiskFlags: 4 }).riskPenalty).toBe(-20);
  });

  it("many flags → riskPenalty stays at −RISK_FLAG_PENALTY_MAX", () => {
    const maxPenalty = TRUST_SCORE_WEIGHTS.RISK_FLAG_PENALTY_MAX;
    expect(
      computeTrustScore({ ...base, activeRiskFlags: 9999 }).riskPenalty,
    ).toBe(-maxPenalty);
  });
});

// ── Total clamping ─────────────────────────────────────────────────────────────

describe("computeTrustScore — total", () => {
  it("all zeros → total = 0", () => {
    expect(computeTrustScore(base).total).toBe(0);
  });

  it("maximum achievable score is 90 (40 identity + 20 activity + 30 deals)", () => {
    const fullInputs: TrustScoreInputs = {
      verifiedEmail: true,
      verifiedPhone: true,
      itsmeVerified: true,
      accountAgeDays: 9999,
      activeAdverts: 9999,
      completedDeals: 9999,
      disputeCount: 0,
      activeRiskFlags: 0,
    };
    const result = computeTrustScore(fullInputs);
    expect(result.identity).toBe(40);
    expect(result.activity).toBe(20);
    expect(result.deals).toBe(30);
    expect(result.riskPenalty).toBe(0);
    expect(result.total).toBe(90);
  });

  it("heavy risk flags cannot push total below 0", () => {
    expect(computeTrustScore({ ...base, activeRiskFlags: 9999 }).total).toBe(0);
  });

  it("risk flags reduce total proportionally", () => {
    // email(5) + phone(15) + 1 flag(-5) = 15
    const result = computeTrustScore({
      ...base,
      verifiedEmail: true,
      verifiedPhone: true,
      activeRiskFlags: 1,
    });
    expect(result.total).toBe(15);
  });
});

// ── Bayesian rating ─────────────────────────────────────────────────────────────

describe("bayesianRating", () => {
  it("no reviews → 3.5, NOT 5.0 (fixes new-seller inflation)", () => {
    expect(bayesianRating(0, 0)).toBe(3.5);
  });

  it("1 review at 5 stars → pulled toward 3.5: (5×3.5 + 5)/(5+1) = 3.75", () => {
    expect(bayesianRating(1, 5)).toBe(3.75);
  });

  it("10 reviews at 5 stars → (5×3.5 + 50)/(5+10) = 4.5", () => {
    expect(bayesianRating(10, 50)).toBe(4.5);
  });

  it("1000 reviews at avg 4.8 → converges close to true average", () => {
    // (5×3.5 + 4800)/(5+1000) = 4817.5/1005 ≈ 4.79 (rounds to 4.79)
    const result = bayesianRating(1000, 4800);
    expect(result).toBeGreaterThanOrEqual(4.79);
    expect(result).toBeLessThan(4.81);
  });

  it("rounds to 2 decimal places", () => {
    // (5×3.5 + 4)/(5+1) = 21.5/6 = 3.583... → 3.58
    expect(bayesianRating(1, 4)).toBe(3.58);
  });

  it("priorWeight=0 edge case returns globalAvg without dividing by zero", () => {
    expect(bayesianRating(10, 50, 0, 3.5)).toBe(3.5);
  });

  it("negative reviewCount edge case returns globalAvg", () => {
    expect(bayesianRating(-1, 0)).toBe(3.5);
  });
});
