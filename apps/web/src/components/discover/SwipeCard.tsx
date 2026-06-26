"use client";

import { ThumbsUp, MapPin, ImageOff } from "lucide-react";
import FavoriteToggle from "@/components/favorites/FavoriteToggle";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { DeckCard } from "@/lib/discover/deck";

export type SwipeHint = "like" | "pass" | "act" | null;

function formatPrice(price: number | null, currency: string | null): string | null {
  if (price == null) return null;
  const sym = currency === "EUR" || !currency ? "€" : currency;
  return `${price.toLocaleString()} ${sym}`;
}

/**
 * Presentational swipe card — no gesture logic (the deck owns pointer handling and passes a
 * transform via `style`). Never renders the seller's name (identity stays gated).
 */
export default function SwipeCard({
  card,
  hint = null,
  style,
  className,
}: {
  card: DeckCard;
  hint?: SwipeHint;
  style?: React.CSSProperties;
  className?: string;
}) {
  const { t } = useI18n();
  const price = formatPrice(card.price, card.currency);

  return (
    <div
      style={style}
      className={cn(
        "absolute inset-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl",
        className,
      )}
    >
      {/* Photo */}
      <div className="absolute inset-0 bg-muted">
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image} alt={card.title} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-10 w-10" aria-hidden="true" />
            <span className="text-sm">{t("discover.no_photo")}</span>
          </div>
        )}
      </div>

      {/* Bottom scrim + details */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16 text-white">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold drop-shadow">{card.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {price ? <span className="font-semibold">{price}</span> : null}
              {card.location ? (
                <span className="inline-flex items-center gap-1 text-white/80">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {card.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-white/80">
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                {card.likeCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Favorite heart (independent of swipe) */}
      <div className="absolute right-3 top-3">
        <FavoriteToggle
          variant="overlay"
          advert={{
            id: card.id,
            title: card.title,
            price: card.price,
            currency: card.currency,
            location: card.location,
            image: card.image,
            createdAt: card.createdAt,
            sellerVerified: card.sellerVerified,
          }}
        />
      </div>

      {/* Directional hint while dragging */}
      {hint ? (
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <span
            className={cn(
              "mt-8 rounded-md border-2 px-4 py-1.5 text-xl font-extrabold uppercase tracking-wide rotate-[-8deg]",
              hint === "like" && "border-emerald-400 bg-emerald-400/20 text-emerald-300",
              hint === "pass" && "border-rose-400 bg-rose-400/20 text-rose-300",
              hint === "act" && "border-sky-400 bg-sky-400/20 text-sky-300",
            )}
          >
            {hint === "like" ? t("discover.like") : hint === "pass" ? t("discover.pass") : t("discover.act")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
