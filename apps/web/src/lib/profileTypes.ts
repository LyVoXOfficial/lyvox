export type ProfileAdvert = {
  id: string;
  title: string;
  price: number | null;
  status: string | null;
  created_at: string;
  location: string | null;
  media: { url: string | null; sort: number | null }[] | null;
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
  reviews: ProfileReview[] | null;
};