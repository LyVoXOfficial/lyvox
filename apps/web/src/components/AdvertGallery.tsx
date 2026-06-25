"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type GalleryImage = {
  id: string;
  url: string | null;
  alt?: string;
  width?: number;
  height?: number;
};

type AdvertGalleryProps = {
  images: GalleryImage[];
};

const PLACEHOLDER_IMAGE = "/placeholder.svg";

export default function AdvertGallery({ images }: AdvertGalleryProps) {
  const normalized = Array.isArray(images)
    ? images.filter((item): item is GalleryImage => Boolean(item && (item.url || PLACEHOLDER_IMAGE)))
    : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = normalized[activeIndex];

  const handleSelect = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[var(--shadow-card)]">
        {activeImage?.url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={activeImage.url}
            alt={activeImage?.alt || "Advert image"}
            width={activeImage?.width ?? undefined}
            height={activeImage?.height ?? undefined}
            className="aspect-[4/3] max-h-[460px] w-full object-cover"
          />
        ) : (
          <div className="lyvox-image-placeholder flex aspect-[4/3] max-h-[460px] w-full items-center justify-center">
            <ShieldCheck className="h-16 w-16 text-white/85" aria-hidden="true" />
          </div>
        )}
      </div>

      {normalized.length > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {normalized.map((image, index) => (
            <button
              key={image.id ?? `${image.url}-${index}`}
              type="button"
              onClick={() => handleSelect(index)}
              className={cn(
                "relative overflow-hidden rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                index === activeIndex ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100",
              )}
              aria-label={image.alt || `Preview ${index + 1}`}
            >
              {image.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={image.url}
                  alt={image.alt || `Preview ${index + 1}`}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="lyvox-image-placeholder flex aspect-square w-full items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-white/85" aria-hidden="true" />
                </div>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
