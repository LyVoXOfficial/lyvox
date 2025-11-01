export type Category = {
  id: string;
  parent_id: string | null;
  slug: string;
  level: number;
  name_ru: string;
  name_en?: string | null;
  name_nl?: string | null;
  name_fr?: string | null;
  path: string;
  sort: number | null;
  icon: string | null;
  is_active: boolean | null;
};
export type Advert = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  location: string | null;
  category_id: string;
  status: string;
  created_at: string;
};
