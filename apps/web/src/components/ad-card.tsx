"use client";

import Link from "next/link";
import { MapPin, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import ReportButton from "@/components/ReportButton";
import FavoriteToggle from "@/components/favorites/FavoriteToggle";
import LikeToggle from "@/components/likes/LikeToggle";
import BenefitsBadge from "@/components/BenefitsBadge";
import { useI18n } from "@/i18n";
import { recordCategoryClick } from "@/lib/discovery/sessionIntent";
import { localizeHref } from "@/lib/i18n";

type Props = {
  id: string;
  categoryId?: string | null;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
  likeCount?: number;
  benefits?: Array<{
    benefit_type: string;
    valid_until: string;
  }>;
  priority?: boolean;
  /** Optional condition label shown as a pill top-left (e.g. "Like new", "Used"). Additive — no existing callers pass this yet. */
  condition?: string;
};

export default function AdCard({
  id,
  categoryId,
  title,
  price,
  currency,
  location,
  image,
  createdAt,
  sellerVerified,
  likeCount,
  benefits,
  priority = false,
  condition,
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

  // Price display:
  //   price === 0  → gradient "Free" text
  //   price > 0    → formatted currency
  //   price null   → i18n "Price on request"
  const isFree = price === 0;
  const priceText =
    typeof price === "number" && !isFree
      ? priceFormatter.format(price)
      : !isFree
        ? translate("advert.price_not_set", "Price on request")
        : null;

  const locationText =
    location ?? translate("advert.location_unknown", "Location not set");
  const verifiedLabel = translate("advert.verified_seller", "Verified");
  const verifiedTooltip =
    translate("advert.verified_seller_tooltip", "Seller confirmed email and phone");
  const recordOpenIntent = () => {
    recordCategoryClick(categoryId);
  };
  const adHref = localizeHref(`/ad/${id}`, locale);

  return (
    <article
      className="group overflow-hidden bg-card border border-[var(--border)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shHi)]"
      style={{
        borderRadius: "var(--r)",
        boxShadow: "var(--shS)",
      }}
    >
      {/* ── Image area (4:3) ── */}
      <div className="relative" style={{ aspectRatio: "4/3" }}>
        <Link
          href={adHref}
          className="block h-full w-full overflow-hidden"
          style={{ borderRadius: "var(--r) var(--r) 0 0" }}
          onClick={recordOpenIntent}
        >
          {image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={image}
              alt={title}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            /* Soft teal/mint radial-gradient placeholder matching mockup */
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(70% 90% at 30% 20%, oklch(0.90 0.10 168 / 0.9), transparent 70%), radial-gradient(60% 80% at 85% 90%, oklch(0.78 0.12 200 / 0.8), transparent 70%), linear-gradient(135deg, oklch(0.93 0.05 190), oklch(0.86 0.07 178))",
              }}
            />
          )}
        </Link>

        {/* Condition pill — top-left (only when condition is provided) */}
        {condition ? (
          <span
            className="pointer-events-none absolute left-[11px] top-[11px] inline-flex items-center font-bold text-[11px] text-foreground"
            style={{
              height: "25px",
              padding: "0 11px",
              borderRadius: "999px",
              background: "oklch(1 0 0 / 0.92)",
              boxShadow: "var(--shS)",
            }}
          >
            {condition}
          </span>
        ) : null}

        {/* Favorite heart button — top-right */}
        <div className="absolute right-[10px] top-[10px]">
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

        {/* Benefits badge (Boost etc.) — bottom-left */}
        {benefits && benefits.length > 0 && (
          <div className="absolute bottom-[11px] left-[11px] z-10">
            <BenefitsBadge benefits={benefits} />
          </div>
        )}
      </div>

      {/* ── Card body ── */}
      <div style={{ padding: "14px" }}>
        {/* Price */}
        <div className="font-extrabold tracking-tight tabular-nums" style={{ fontSize: "19px", letterSpacing: "-0.01em" }}>
          {isFree ? (
            <span
              className="lyvox-trust-gradient"
              style={{
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                display: "inline",
                boxShadow: "none",
              }}
            >
              {translate("advert.free", "Free")}
            </span>
          ) : (
            priceText
          )}
        </div>

        {/* Title — 2-line clamp, min-height matches mockup's 38px */}
        <Link
          href={adHref}
          className="block hover:text-primary"
          onClick={recordOpenIntent}
          style={{
            fontWeight: 600,
            fontSize: "14px",
            lineHeight: 1.35,
            margin: "6px 0 9px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
            minHeight: "38px",
          }}
        >
          {title}
        </Link>

        {/* Location with pin icon */}
        <div
          className="flex items-center gap-[5px] text-muted-foreground"
          style={{ fontWeight: 500, fontSize: "12.5px" }}
        >
          <MapPin className="h-[14px] w-[14px] shrink-0" aria-hidden="true" />
          <span className="truncate">{locationText}</span>
        </div>

        {/* Footer divider row: Verified / Private chip + like count + (hover) report */}
        <div
          className="flex items-center justify-between"
          style={{
            marginTop: "11px",
            paddingTop: "10px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {/* Left: Verified or Private chip — exact mockup styles (lines 161 / 207) */}
          <div className="min-w-0 flex-1">
            {sellerVerified ? (
              /* Verified chip: shield icon (--pri) + text (--priD), no background */
              <span
                className="inline-flex min-w-0 max-w-full items-center gap-[6px] font-bold"
                style={{ fontSize: "12.5px", color: "var(--priD)" }}
                title={verifiedTooltip}
              >
                <ShieldCheck
                  className="h-[14px] w-[14px] shrink-0"
                  aria-hidden="true"
                  style={{ color: "var(--primary)" }}
                />
                <span className="truncate">{verifiedLabel}</span>
              </span>
            ) : (
              /* Private chip: grey dot + text */
              <span
                className="inline-flex min-w-0 max-w-full items-center gap-[6px] font-bold"
                style={{ fontSize: "12.5px", color: "var(--mintI)" }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "999px",
                    background: "oklch(0.62 0.025 198)",
                    flexShrink: 0,
                  }}
                />
                <span className="truncate">{translate("advert.private_seller", "Private")}</span>
              </span>
            )}
          </div>

          {/* Right: like count + report (hover-only on desktop) */}
          <div className="flex shrink-0 items-center gap-2">
            <LikeToggle advertId={id} initialCount={likeCount ?? 0} variant="inline" />
            <div className="sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
              <ReportButton advertId={id} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
