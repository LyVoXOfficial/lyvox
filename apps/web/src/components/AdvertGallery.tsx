"use client";

import { useState } from "react";
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
  const normalized = images?.length ? images : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = normalized[activeIndex];

  const handleSelect = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeImage?.url || PLACEHOLDER_IMAGE}
          alt={activeImage?.alt || "Advert image"}
          width={activeImage?.width ?? undefined}
          height={activeImage?.height ?? undefined}
          className="h-full max-h-[460px] w-full bg-muted object-cover"
        />
      </div>

      {normalized.length > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {normalized.map((image, index) => (
            <button
              key={image.id ?? `${image.url}-${index}`}
              type="button"
              onClick={() => handleSelect(index)}
              className={cn(
                "relative overflow-hidden rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                index === activeIndex ? "ring-2 ring-emerald-500" : "opacity-80 hover:opacity-100",
              )}
              aria-label={image.alt || `Preview ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url || PLACEHOLDER_IMAGE}
                alt={image.alt || `Preview ${index + 1}`}
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

