export type ComparableAdvert = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  categoryId: string | null;
  categoryName: string | null;
  condition: string | null;
  image: string | null;
  createdAt: string | null;
  sellerVerified: boolean;
  sellerTrustScore: number;
  specifics: Record<string, unknown>;
};

export type ComparisonScores = {
  priceScore: number;
  conditionScore: number;
  trustScore: number;
  ageScore: number;
  totalScore: number;
};

export type ComparisonResult = {
  advert: ComparableAdvert;
  scores: ComparisonScores;
};
