"use client";

import Link from "next/link";
import { CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import ReportButton from "@/components/ReportButton";
import VerificationBadge from "@/components/VerificationBadge";
import FavoriteToggle from "@/components/favorites/FavoriteToggle";
import BenefitsBadge from "@/components/BenefitsBadge";
import { useI18n } from "@/i18n";

type Props = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
  benefits?: Array<{
    benefit_type: string;
    valid_until: string;
  }>;
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
  benefits,
}: Props) {
  const { t, locale } = useI18n();
  const translate = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const localeTag =
    locale === "nl" ? "nl-BE" : locale === "fr" ? "fr-BE" : locale === "de" ? "de-BE" : locale === "ru" ? "ru-RU" : "en-BE";
  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat(localeTag, {
        style: "currency",
        currency: currency ?? "EUR",
        maximumFractionDigits: 0,
      }),
    [currency, localeTag],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    [localeTag],
  );
  const priceText =
    typeof price === "number"
      ? priceFormatter.format(price)
      : translate("advert.price_not_set", "Price on request");
  const locationText =
    location ?? translate("advert.location_unknown", "Location not set");
  const createdText = createdAt ? dateFormatter.format(new Date(createdAt)) : null;
  const verifiedLabel = translate("advert.verified_seller", "Verified");
  const verifiedTooltip =
    translate("advert.verified_seller_tooltip", "Seller confirmed email and phone");

  return (
    <article className="group overflow-hidden rounded-xl border border-border/70 bg-card shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-hi)]">
      <div className="relative">
        <Link href={`/ad/${id}`} className="block aspect-[4/3] overflow-hidden">
          {image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={image}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="lyvox-image-placeholder flex h-full w-full items-center justify-center">
              <ShieldCheck className="h-10 w-10 text-white/85" aria-hidden="true" />
            </div>
          )}
        </Link>
        <div className="absolute right-2 top-2 flex gap-2">
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
        {benefits && benefits.length > 0 && (
          <div className="absolute left-2 top-2 z-10">
            <BenefitsBadge benefits={benefits} />
          </div>
        )}
      </div>
      <div className="space-y-2.5 p-3">
        <Link
          href={`/ad/${id}`}
          className="block min-h-[2.5rem] line-clamp-2 text-sm font-semibold leading-5 tracking-normal hover:text-primary"
        >
          {title}
        </Link>
        <div className="text-lg font-bold tracking-tight text-foreground">{priceText}</div>
        <div className="flex min-h-4 items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{locationText}</span>
        </div>
        <div className="flex min-h-4 items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{createdText ?? translate("common.recent", "Recent")}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="min-h-[22px] min-w-0">
            {sellerVerified ? (
              <VerificationBadge
                icon={ShieldCheck}
                label={verifiedLabel}
                verified={true}
                tooltip={verifiedTooltip}
                className="max-w-full"
              />
            ) : null}
          </div>
          <div className="sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            <ReportButton advertId={id} />
          </div>
        </div>
      </div>
    </article>
  );
}
