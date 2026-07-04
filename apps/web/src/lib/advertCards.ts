export type SearchApiItem = {
  id: string;
  category_id?: string | null;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  created_at?: string | null;
  seller_verified?: boolean | null;
  like_count?: number | null;
};

export type AdvertCard = {
  id: string;
  categoryId: string | null;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  image: string | null;
  createdAt: string | null;
  sellerVerified: boolean;
  likeCount: number;
};

export function mapSearchItemToCard(item: SearchApiItem): AdvertCard {
  return {
    id: item.id,
    categoryId: item.category_id ?? null,
    title: item.title,
    price: item.price ?? null,
    currency: item.currency ?? null,
    location: item.location ?? null,
    image: item.image ?? null,
    createdAt: item.created_at ?? null,
    sellerVerified: Boolean(item.seller_verified),
    likeCount: item.like_count ?? 0,
  };
}
