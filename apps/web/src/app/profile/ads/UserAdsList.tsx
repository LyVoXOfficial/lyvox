"use client";

import { useState } from "react";
import Link from "next/link";

type AdvertItem = {
  id: string;
  title: string;
  price: number | null;
  location: string | null;
  image: string | null;
  status: string | null;
  createdAt: string | null;
};

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
});

function statusLabel(status: string | null) {
  switch (status) {
    case "active":
      return "Активно";
    case "draft":
      return "Черновик";
    case "archived":
      return "Архив";
    case "inactive":
      return "Неактивно";
    default:
      return "—";
  }
}

export default function UserAdsList({ initialAds }: { initialAds: AdvertItem[] }) {
  const [ads, setAds] = useState(initialAds);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить объявление? Отменить будет нельзя.")) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/adverts/${id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || response.statusText);
      }

      setAds((prev) => prev.filter((ad) => ad.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось удалить объявление",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (!ads.length) {
    return (
      <div className="space-y-2 rounded-2xl border p-6 text-sm text-muted-foreground">
        <p>У вас пока нет объявлений.</p>
        <p>
          Создайте первое объявление на странице {" "}
          <Link href="/post" className="underline">
            «Подать объявление»
          </Link>
          .
        </p>
        {error && <p className="text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {ads.map((ad) => {
        const priceText =
          typeof ad.price === "number"
            ? priceFormatter.format(ad.price)
            : "Цена не указана";
        const locationText = ad.location ?? "Местоположение не указано";
        const createdText = ad.createdAt
          ? dateFormatter.format(new Date(ad.createdAt))
          : "—";

        return (
          <div
            key={ad.id}
            className="flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-1 gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ad.image ?? "/placeholder.png"}
                alt=""
                className="h-24 w-24 flex-shrink-0 rounded-xl object-cover"
              />
              <div className="space-y-1">
                <Link
                  href={`/ad/${ad.id}`}
                  className="text-base font-medium hover:underline"
                >
                  {ad.title}
                </Link>
                <div className="text-sm text-foreground/80">{priceText}</div>
                <div className="text-xs text-muted-foreground">{locationText}</div>
                <div className="text-xs text-muted-foreground">
                  Статус: {statusLabel(ad.status)} · Создано: {createdText}
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 gap-2">
              <Link
                href={`/post?edit=${ad.id}`}
                className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Редактировать
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(ad.id)}
                className="rounded-xl border px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                disabled={deletingId === ad.id}
              >
                {deletingId === ad.id ? "Удаляем..." : "Удалить"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
