"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ReportButton from "@/components/ReportButton";

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
});

type Media = { id: string; url: string; sort: number | null };
type Advert = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  location: string | null;
  created_at: string;
};

export default function AdvertPage() {
  const { id } = useParams<{ id: string }>();
  const [advert, setAdvert] = useState<Advert | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const { data: adv } = await supabase
        .from("adverts")
        .select("id,title,description,price,location,created_at")
        .eq("id", id)
        .maybeSingle();

      if (!cancelled) {
        setAdvert(adv as Advert | null);
      }

      const { data: photos } = await supabase
        .from("media")
        .select("id,url,sort")
        .eq("advert_id", id)
        .order("sort", { ascending: true });

      if (!cancelled) {
        setMedia((photos ?? []) as Media[]);
        setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p>Загрузка…</p>;
  if (!advert) return <p className="text-sm text-red-600">Объявление не найдено</p>;

  const priceText =
    typeof advert.price === "number"
      ? priceFormatter.format(advert.price)
      : "Цена не указана";

  const locationText = advert.location ?? "Местоположение не указано";
  const createdText = dateFormatter.format(new Date(advert.created_at));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{advert.title}</h1>
        <ReportButton advertId={advert.id} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          {media.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {media.map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={m.id}
                  src={m.url}
                  alt=""
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ))}
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-muted/60 text-center text-sm text-muted-foreground">
              <div className="flex h-full items-center justify-center">Фото отсутствуют</div>
            </div>
          )}
        </div>

        <aside className="w-full max-w-xs space-y-3 rounded-2xl border p-4 text-sm">
          <div className="text-xl font-semibold">{priceText}</div>
          <div className="text-muted-foreground">{locationText}</div>
          <div className="text-xs text-muted-foreground">Размещено: {createdText}</div>
        </aside>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Описание</h2>
        <p className="whitespace-pre-wrap text-sm text-foreground/90">
          {advert.description ?? "Описания пока нет."}
        </p>
      </section>
    </div>
  );
}
