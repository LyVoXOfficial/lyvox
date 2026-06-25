"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
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
};

function pickImage(media: ProfileAdvert["media"]): string | null {
  return media ? getFirstImage(media) : null;
}

function AdvertCard({ ad, priceNotSet }: { ad: ProfileAdvert; priceNotSet: string }) {
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
          <div className="lyvox-image-placeholder flex h-full w-full items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-white/85" aria-hidden="true" />
          </div>
        )}
        {ad.status && (
          <div className="absolute right-2 top-2">
            <Badge className="capitalize">{ad.status}</Badge>
          </div>
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

export function ProfileAdvertsList({ adverts }: ProfileAdvertsListProps) {
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

  return (
    <Carousel
      opts={{
        align: "start",
      }}
      className="w-full"
    >
      <CarouselContent>
        {adverts.map((ad) => (
          <CarouselItem key={ad.id} className="md:basis-1/2 lg:basis-1/3">
            <div className="p-1">
              <AdvertCard ad={ad} priceNotSet={tr("profile.price_not_set", "Price not set")} />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
