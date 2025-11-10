import { ComparableAdvert, ComparisonResult, ComparisonScores } from "@/lib/types/comparison";

const DEFAULT_SCORE = 50;
const CONDITION_SCORE_MAP: Record<string, number> = {
  new: 100,
  "like-new": 85,
  excellent: 75,
  good: 60,
  fair: 45,
  used: 35,
  damaged: 20,
};

const PRICE_WEIGHT = 0.4;
const CONDITION_WEIGHT = 0.2;
const TRUST_WEIGHT = 0.25;
const AGE_WEIGHT = 0.15;

function clampScore(value: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_SCORE;
  }
  return Math.max(0, Math.min(100, value));
}

export function calculatePriceScore(price: number | null, allPrices: (number | null)[]): number {
  const numericPrices = allPrices.filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

  if (!numericPrices.length || price === null || Number.isNaN(price)) {
    return DEFAULT_SCORE;
  }

  if (numericPrices.length === 1) {
    return 80;
  }

  const minPrice = Math.min(...numericPrices);
  const maxPrice = Math.max(...numericPrices);

  if (minPrice === maxPrice) {
    return 80;
  }

  const clampedPrice = Math.max(minPrice, Math.min(maxPrice, price));
  const normalized = (maxPrice - clampedPrice) / (maxPrice - minPrice);
  return clampScore(Math.round(normalized * 100));
}

export function calculateConditionScore(condition: string | null): number {
  if (!condition) {
    return DEFAULT_SCORE;
  }

  const normalized = condition.toLowerCase().trim();
  return CONDITION_SCORE_MAP[normalized] ?? DEFAULT_SCORE;
}

export function calculateTrustScore(trustScore: number | null | undefined): number {
  if (trustScore === null || trustScore === undefined) {
    return DEFAULT_SCORE;
  }

  return clampScore(Math.round(trustScore));
}

export function calculateAgeScore(createdAt: string | null, baseDate: Date = new Date()): number {
  if (!createdAt) {
    return DEFAULT_SCORE;
  }

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) {
    return DEFAULT_SCORE;
  }

  const diffMs = baseDate.getTime() - createdDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 0) {
    return 100;
  }

  if (diffDays <= 1) {
    return 100;
  }
  if (diffDays <= 3) {
    return 90;
  }
  if (diffDays <= 7) {
    return 75;
  }
  if (diffDays <= 14) {
    return 60;
  }
  if (diffDays <= 30) {
    return 40;
  }
  if (diffDays <= 60) {
    return 30;
  }
  return 20;
}

export function calculateTotalScore({ priceScore, conditionScore, trustScore, ageScore }: Omit<ComparisonScores, "totalScore">): number {
  const weighted =
    priceScore * PRICE_WEIGHT +
    conditionScore * CONDITION_WEIGHT +
    trustScore * TRUST_WEIGHT +
    ageScore * AGE_WEIGHT;

  return clampScore(Math.round(weighted));
}

export function compareAdverts(adverts: ComparableAdvert[], baseDate: Date = new Date()): ComparisonResult[] {
  const allPrices = adverts.map((advert) => advert.price);

  return adverts.map((advert) => {
    const priceScore = calculatePriceScore(advert.price, allPrices);
    const conditionScore = calculateConditionScore(advert.condition);
    const trustScore = calculateTrustScore(advert.sellerTrustScore);
    const ageScore = calculateAgeScore(advert.createdAt, baseDate);
    const totalScore = calculateTotalScore({ priceScore, conditionScore, trustScore, ageScore });

    return {
      advert,
      scores: {
        priceScore,
        conditionScore,
        trustScore,
        ageScore,
        totalScore,
      },
    };
  });
}
