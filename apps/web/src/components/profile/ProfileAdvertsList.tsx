"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { type ProfileAdvert } from "@/lib/profileTypes";
import { getFirstImage } from "@/lib/media/getFirstImage";
import { useI18n } from "@/i18n";

type ProfileAdvertsListProps = {
  adverts: ProfileAdvert[];
  /**
   * "carousel" (default) — the original horizontal carousel used by the
   * owner dashboard and pro cabinet.
   * "grid" — 3-col desktop / 2-col mobile grid used on the public seller
   * profile page (mockup lines 604-611 / 647-651).
   */
  variant?: "carousel" | "grid";
};

function pickImage(media: ProfileAdvert["media"]): string | null {
  return media ? getFirstImage(media) : null;
}

/** Card used in carousel mode (original AdvertCard — unchanged) */
function CarouselAdvertCard({ ad, priceNotSet }: { ad: ProfileAdvert; priceNotSet: string }) {
  const initial = pickImage(ad.media);
  const [imgSrc, setImgSrc] = useState<string | null>(initial);

  return (
    <div className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-hi)]">
      <Link href={`/ad/${ad.id}`} className="relative block aspect-square overflow-hidden">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={ad.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            unoptimized
            onError={() => setImgSrc(null)}
          />
        ) : (
          <div className="lyvox-image-placeholder flex h-full w-full items-center justify-center" />
        )}
      </Link>
      <div className="space-y-1 p-4">
        <h3 className="truncate font-extrabold tracking-tight text-foreground">
          <Link href={`/ad/${ad.id}`}>{ad.title}</Link>
        </h3>
        <p className="text-lg font-bold text-foreground">
          {ad.price ? `${ad.price.toLocaleString()} €` : priceNotSet}
        </p>
        <p className="truncate text-sm text-muted-foreground">{ad.location}</p>
      </div>
    </div>
  );
}

/**
 * Minimal card for the public seller profile grid (mockup lines 606-611).
 * Matches: aspect-4/3 gradient placeholder, bold price, 2-line title, location.
 * No FavoriteToggle / LikeToggle — avoids context provider deps on this public route.
 */
function GridAdvertCard({ ad, priceNotSet }: { ad: ProfileAdvert; priceNotSet: string }) {
  const initial = pickImage(ad.media);
  const [imgSrc, setImgSrc] = useState<string | null>(initial);

  return (
    <article
      className="group overflow-hidden bg-card border border-[var(--border)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shHi)]"
      style={{ borderRadius: "var(--r)", boxShadow: "var(--shS)" }}
    >
      {/* Image area — 4:3 aspect (desktop), fixed 110px (mobile via CSS) */}
      <Link
        href={`/ad/${ad.id}`}
        className="relative block overflow-hidden"
        style={{ aspectRatio: "4/3" }}
        aria-label={ad.title}
      >
        {imgSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imgSrc}
            alt={ad.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={() => setImgSrc(null)}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(70% 90% at 30% 20%, oklch(0.90 0.10 168 / 0.9), transparent 70%), radial-gradient(60% 80% at 85% 90%, oklch(0.78 0.12 200 / 0.8), transparent 70%), linear-gradient(135deg, oklch(0.93 0.05 190), oklch(0.86 0.07 178))",
            }}
          />
        )}
      </Link>

      {/* Card body */}
      <div style={{ padding: "12px" }}>
        {/* Price */}
        <div style={{ font: "800 17px Inter, system-ui, sans-serif" }}>
          {ad.price != null ? `€${ad.price.toLocaleString()}` : priceNotSet}
        </div>
        {/* Title — 2-line clamp */}
        <Link
          href={`/ad/${ad.id}`}
          className="block hover:text-primary"
          style={{
            font: "600 13px/1.3 Inter, system-ui, sans-serif",
            margin: "4px 0 6px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
            minHeight: "34px",
          }}
        >
          {ad.title}
        </Link>
        {/* Location */}
        {ad.location && (
          <span style={{ font: "500 12px Inter, system-ui, sans-serif", color: "var(--muted-foreground)" }}>
            {ad.location}
          </span>
        )}
      </div>
    </article>
  );
}

export function ProfileAdvertsList({ adverts, variant = "carousel" }: ProfileAdvertsListProps) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };

  if (!adverts || adverts.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <p>{tr("profile.no_adverts_found", "You don't have any adverts yet")}</p>
      </div>
    );
  }

  /* ── Grid variant (public seller profile page) ── */
  if (variant === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {adverts.map((ad) => (
          <GridAdvertCard
            key={ad.id}
            ad={ad}
            priceNotSet={tr("profile.price_not_set", "Price not set")}
          />
        ))}
      </div>
    );
  }

  /* ── Carousel variant (default — owner dashboard / pro cabinet) ── */
  return (
    <Carousel opts={{ align: "start" }} className="w-full">
      <CarouselContent>
        {adverts.map((ad) => (
          <CarouselItem key={ad.id} className="md:basis-1/2 lg:basis-1/3">
            <div className="p-1">
              <CarouselAdvertCard
                ad={ad}
                priceNotSet={tr("profile.price_not_set", "Price not set")}
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
