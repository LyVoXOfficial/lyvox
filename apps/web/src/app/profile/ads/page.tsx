import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import UserAdsList from "./UserAdsList";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type AdvertRow = {
  id: string;
  title: string;
  price: number | null;
  location: string | null;
  status: string | null;
  created_at: string | null;
  media: { url: string | null; sort: number | null }[] | null;
};

type UserAdvert = {
  id: string;
  title: string;
  price: number | null;
  location: string | null;
  image: string | null;
  status: string | null;
  createdAt: string | null;
};

function pickImage(media: AdvertRow["media"]): string | null {
  if (!media?.length) return null;
  const sorted = [...media].sort((a, b) => {
    const sortA = a.sort ?? Number.MAX_SAFE_INTEGER;
    const sortB = b.sort ?? Number.MAX_SAFE_INTEGER;
    return sortA - sortB;
  });
  return sorted[0]?.url ?? null;
}

export default async function ProfileAdsPage() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 p-4">
        <h1 className="text-2xl font-semibold">Мои объявления</h1>
        <p>
          Вы не авторизованы. {" "}
          <Link href="/login" className="underline">
            Войти
          </Link>
        </p>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("adverts")
    .select(
      "id, title, price, location, status, created_at, media(url, sort)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const adverts = (data as AdvertRow[] | null) ?? [];

  const items: UserAdvert[] = adverts.map((advert) => ({
    id: advert.id,
    title: advert.title,
    price: advert.price,
    location: advert.location,
    image: pickImage(advert.media),
    status: advert.status,
    createdAt: advert.created_at,
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Мои объявления</h1>
        <Link
          href="/post"
          className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Новое объявление
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-600">
          Не удалось загрузить объявления: {error.message}
        </p>
      ) : items.length ? (
        <UserAdsList initialAds={items} />
      ) : (
        <div className="space-y-2 rounded-2xl border p-6 text-sm text-muted-foreground">
          <p>У вас пока нет объявлений.</p>
          <p>
            Создайте первое объявление на странице {" "}
            <Link href="/post" className="underline">
              «Подать объявление»
            </Link>
            .
          </p>
        </div>
      )}
    </main>
  );
}
