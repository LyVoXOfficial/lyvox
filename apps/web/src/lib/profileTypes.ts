export type ProfileAdvertMedia = {
  url: string | null;
  signedUrl: string | null;
  sort: number | null;
};

export type ProfileAdvert = {
  id: string;
  title: string;
  price: number | null;
  status: string | null;
  created_at: string;
  location: string | null;
  media: ProfileAdvertMedia[] | null;
};

export type ProfileFavorite = {
  advertId: string;
  favoritedAt: string | null;
  advert: {
    id: string;
    title: string;
    price: number | null;
    currency: string | null;
    location: string | null;
    createdAt: string | null;
    image: string | null;
    sellerVerified: boolean;
  } | null;
};

export type ProfileReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author: {
    display_name: string | null;
  } | null;
};

export type ProfileData = {
  id: string;
  display_name: string | null;
  created_at: string | null;
  verified_email: boolean | null;
  verified_phone: boolean | null;
  trust_score: number;
  adverts: ProfileAdvert[] | null;
  favorites: ProfileFavorite[] | null;
  reviews: ProfileReview[] | null;
};