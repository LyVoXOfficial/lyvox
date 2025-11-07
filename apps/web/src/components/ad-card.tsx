"use client";

import Link from "next/link";
import ReportButton from "@/components/ReportButton";

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeZone: "UTC", // Use UTC to prevent hydration mismatch
});

type Props = {
  id: string;
  title: string;
  price?: number | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
};

export default function AdCard({
  id,
  title,
  price,
  location,
  image,
  createdAt,
}: Props) {
  const priceText =
    typeof price === "number" ? priceFormatter.format(price) : "Цена не указана";
  const locationText = location ?? "Местоположение не указано";
  const createdText = createdAt ? dateFormatter.format(new Date(createdAt)) : null;

  return (
    <article className="overflow-hidden rounded-lg border transition hover:shadow-sm">
      <Link href={`/ad/${id}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image ?? "/placeholder.png"}
          alt={title}
          loading="lazy"
          className="aspect-square w-full bg-muted object-cover transition group-hover:opacity-95"
        />
      </Link>
      <div className="space-y-1 p-3">
        <Link
          href={`/ad/${id}`}
          className="block line-clamp-2 font-medium hover:underline"
        >
          {title}
        </Link>
        <div className="text-sm text-foreground/80">{priceText}</div>
        <div className="text-xs text-muted-foreground">{locationText}</div>
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
          <span>{createdText ?? ""}</span>
          <ReportButton advertId={id} />
        </div>
      </div>
    </article>
  );
}
