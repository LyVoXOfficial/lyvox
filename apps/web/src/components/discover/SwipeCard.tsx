"use client";

import { ThumbsUp, MapPin, ImageOff, BadgeCheck, Sparkles } from "lucide-react";
import FavoriteToggle from "@/components/favorites/FavoriteToggle";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import type { DeckCard } from "@/lib/discover/deck";

export type SwipeHint = "like" | "pass" | "act" | "down" | null;

const LIKE_THRESHOLD = 3;

// Hours since createdAt that qualify as "new"
const NEW_HOURS = 48;

function formatPrice(price: number | null, currency: string | null): string | null {
  if (price == null) return null;
  const sym = currency === "EUR" || !currency ? "€" : currency;
  return `${price.toLocaleString()} ${sym}`;
}

function isNew(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const ms = Date.now() - new Date(createdAt).getTime();
  return ms < NEW_HOURS * 3600 * 1000;
}

/**
 * Presentational swipe card — no gesture logic.
 * The deck owns pointer handling and passes a transform via `style`.
 * Never renders the seller's name (identity stays gated until contact).
 *
 * Photo gallery: left/right tap zones (leftmost/rightmost 30% of card) page through images.
 * Only renders dots + zones when images.length > 1 (deferred until search API returns multiple).
 */
export default function SwipeCard({
  card,
  hint = null,
  hintStrength = 0,
  style,
  className,
  photoIndex = 0,
  onPhotoChange,
}: {
  card: DeckCard;
  hint?: SwipeHint;
  /** 0–1, controls hint overlay opacity */
  hintStrength?: number;
  style?: React.CSSProperties;
  className?: string;
  photoIndex?: number;
  onPhotoChange?: (idx: number) => void;
}) {
  const { t } = useI18n();
  const price = formatPrice(card.price, card.currency);
  const image = card.images[photoIndex] ?? card.images[0] ?? null;
  const hasGallery = card.images.length > 1;
  const cardIsNew = isNew(card.createdAt);

  const handlePhotoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasGallery || !onPhotoChange) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const zone = rect.width * 0.3;
    if (relX < zone) {
      onPhotoChange(Math.max(0, photoIndex - 1));
    } else if (relX > rect.width - zone) {
      onPhotoChange(Math.min(card.images.length - 1, photoIndex + 1));
    }
  };

  // Hint stamp styles
  const hintConfig: Record<NonNullable<SwipeHint>, { border: string; bg: string; text: string; rotate: string }> = {
    like: { border: "border-emerald-400", bg: "bg-emerald-400/20", text: "text-emerald-300", rotate: "rotate-[-8deg]" },
    pass: { border: "border-rose-400", bg: "bg-rose-400/20", text: "text-rose-300", rotate: "rotate-[8deg]" },
    act: { border: "border-sky-400", bg: "bg-sky-400/20", text: "text-sky-300", rotate: "rotate-[-8deg]" },
    down: { border: "border-purple-400", bg: "bg-purple-400/20", text: "text-purple-300", rotate: "rotate-[4deg]" },
  };

  const hintText: Record<NonNullable<SwipeHint>, string> = {
    like: t("discover.like"),
    pass: t("discover.pass"),
    act: t("discover.act"),
    down: t("discover.less_like_this"),
  };

  return (
    <div
      style={style}
      className={cn(
        "absolute inset-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl",
        className,
      )}
    >
      {/* Photo + gallery zones */}
      <div
        className="absolute inset-0 bg-muted"
        onClick={handlePhotoTap}
        role={hasGallery ? "button" : undefined}
        aria-label={hasGallery ? t("discover.coach.tap") : undefined}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={card.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-10 w-10" aria-hidden="true" />
            <span className="text-sm">{t("discover.no_photo")}</span>
          </div>
        )}
      </div>

      {/* Gallery dots (top left) — only when >1 images */}
      {hasGallery ? (
        <div className="absolute left-3 top-3 flex gap-1" aria-hidden="true">
          {card.images.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                i === photoIndex ? "w-4 bg-white" : "bg-white/60",
              )}
            />
          ))}
        </div>
      ) : null}

      {/* Top-right badges row: Verified + New */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
        {cardIsNew ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-semibold text-white shadow">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {t("discover.new_badge")}
          </span>
        ) : null}
        {card.sellerVerified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-xs font-semibold text-white shadow">
            <BadgeCheck className="h-3 w-3" aria-hidden="true" />
            {t("discover.verified_seller")}
          </span>
        ) : null}
        <FavoriteToggle
          variant="overlay"
          advert={{
            id: card.id,
            title: card.title,
            price: card.price,
            currency: card.currency,
            location: card.location,
            image: card.images[0] ?? null,
            createdAt: card.createdAt,
            sellerVerified: card.sellerVerified,
          }}
        />
      </div>

      {/* Bottom scrim + details */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 pt-20 text-white">
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
              {card.likeCount >= LIKE_THRESHOLD ? (
                <span className="inline-flex items-center gap-1 text-white/80">
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                  {card.likeCount}
                </span>
              ) : null}
            </div>
            {/* Trust signal row */}
            {card.sellerVerified ? (
              <p className="mt-1 text-xs text-emerald-300/90">
                {t("discover.verified_seller")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Directional hint stamp while dragging */}
      {hint && hintStrength > 0.1 ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-start justify-center"
          style={{ opacity: Math.min(hintStrength, 1) }}
        >
          <span
            className={cn(
              "mt-8 rounded-md border-2 px-4 py-1.5 text-xl font-extrabold uppercase tracking-wide",
              hintConfig[hint].border,
              hintConfig[hint].bg,
              hintConfig[hint].text,
              hintConfig[hint].rotate,
            )}
          >
            {hintText[hint]}
          </span>
        </div>
      ) : null}
    </div>
  );
}
