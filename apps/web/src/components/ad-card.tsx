"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import ReportButton from "@/components/ReportButton";
import VerificationBadge from "@/components/VerificationBadge";
import FavoriteToggle from "@/components/favorites/FavoriteToggle";
import { useI18n } from "@/i18n";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeZone: "UTC", // Use UTC to prevent hydration mismatch
});

type Props = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
};

export default function AdCard({
  id,
  title,
  price,
  currency,
  location,
  image,
  createdAt,
  sellerVerified,
}: Props) {
  const { t } = useI18n();
  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: currency ?? "EUR",
        maximumFractionDigits: 0,
      }),
    [currency],
  );
  const priceText =
    typeof price === "number"
      ? priceFormatter.format(price)
      : t("advert.price_not_set") || "Цена не указана";
  const locationText =
    (location ?? t("advert.location_unknown")) || "Местоположение не указано";
  const createdText = createdAt ? dateFormatter.format(new Date(createdAt)) : null;
  const verifiedLabel = t("advert.verified_seller") || "Проверенный продавец";
  const verifiedTooltip =
    t("advert.verified_seller_tooltip") || "Продавец подтвердил email и телефон";

  return (
    <article className="overflow-hidden rounded-lg border transition hover:shadow-sm">
      <div className="relative">
        <Link href={`/ad/${id}`} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image ?? "/placeholder.svg"}
            alt={title}
            loading="lazy"
            className="aspect-square w-full bg-muted object-cover transition group-hover:opacity-95"
          />
        </Link>
        <div className="absolute right-3 top-3 flex gap-2">
          <FavoriteToggle
            variant="overlay"
            advert={{
              id,
              title,
              price,
              currency,
              location,
              image: image ?? undefined,
              createdAt,
              sellerVerified,
            }}
          />
        </div>
      </div>
      <div className="space-y-2 p-3">
        <Link
          href={`/ad/${id}`}
          className="block line-clamp-2 font-medium hover:underline"
        >
          {title}
        </Link>
        <div className="text-sm text-foreground/80">{priceText}</div>
        <div className="text-xs text-muted-foreground">{locationText}</div>
        <div className="text-xs text-muted-foreground">{createdText ?? ""}</div>
        <div className="flex items-center justify-between pt-2">
          <div className="min-h-[20px]">
            {sellerVerified ? (
              <VerificationBadge
                icon={ShieldCheck}
                label={verifiedLabel}
                verified={true}
                tooltip={verifiedTooltip}
              />
            ) : null}
          </div>
          <ReportButton advertId={id} />
        </div>
      </div>
    </article>
  );
}
