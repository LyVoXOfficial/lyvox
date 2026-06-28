import { scoreCard } from "@/lib/taste";
import { isSeen } from "@/lib/seenAdverts";

// Richer card for the swipe deck than the feed's AdvertCard: it additionally carries
// sellerId (= advert.user_id, the chat peer_id) and categoryId, both already present in
// the /api/search response (RPC search_adverts returns user_id + category_id; the route
// passes them through). Used for taste-reranking and the swipe-up actions sheet.

export type DeckCard = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  images: string[];
  createdAt: string | null;
  sellerVerified: boolean;
  likeCount: number;
  sellerId: string | null;
  categoryId: string | null;
};

type RawSearchItem = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  images?: string[] | null;
  created_at?: string | null;
  seller_verified?: boolean | null;
  like_count?: number | null;
  user_id?: string | null;
  category_id?: string | null;
};

export function mapSearchItemToDeckCard(item: RawSearchItem): DeckCard {
  const images =
    Array.isArray(item.images) && item.images.length > 0
      ? item.images
      : item.image
        ? [item.image]
        : [];
  return {
    id: item.id,
    title: item.title,
    price: item.price ?? null,
    currency: item.currency ?? null,
    location: item.location ?? null,
    images,
    createdAt: item.created_at ?? null,
    sellerVerified: Boolean(item.seller_verified),
    likeCount: item.like_count ?? 0,
    sellerId: item.user_id ?? null,
    categoryId: item.category_id ?? null,
  };
}

// Themed "Drops" — each a different /api/search query feeding the same deck.
// Stage-1 presets use only existing query params (no geo "Near you").
export type Drop = { key: string; query: Record<string, string> };

export const DROPS: Drop[] = [
  { key: "just_listed", query: { sort_by: "created_at_desc" } },
  { key: "under_50", query: { price_max: "50", sort_by: "created_at_desc" } },
  { key: "verified", query: { verified_only: "true", sort_by: "created_at_desc" } },
  { key: "cheapest", query: { sort_by: "price_asc" } },
];

/** Stable sort by taste score (desc); equal scores keep source order (cold start = untouched). */
export function rerankByTaste(cards: DeckCard[]): DeckCard[] {
  return cards
    .map((card, index) => ({ card, index, score: scoreCard(card) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((d) => d.card);
}

/** Drop cards the deck has already shown. */
export function filterUnseen(cards: DeckCard[]): DeckCard[] {
  return cards.filter((c) => !isSeen(c.id));
}
