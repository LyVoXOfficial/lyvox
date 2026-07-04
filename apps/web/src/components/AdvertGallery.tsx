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
    <div className="space-y-3">
      {/* Main image — 16/11 aspect ratio per mockup, rounded --r */}
      <div
        className="relative overflow-hidden border border-border/70"
        style={{ aspectRatio: "16/11", borderRadius: "var(--r)" }}
      >
        {activeImage?.url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={activeImage.url}
            alt={activeImage?.alt || "Advert image"}
            width={activeImage?.width ?? undefined}
            height={activeImage?.height ?? undefined}
            loading="eager"
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="lyvox-image-placeholder flex h-full w-full items-center justify-center">
            <ShieldCheck className="h-16 w-16 text-white/85" aria-hidden="true" />
          </div>
        )}

        {/* Counter pill — overlaid bottom-right */}
        {normalized.length > 1 ? (
          <span
            className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1.5 px-3 font-semibold text-white"
            style={{
              height: "30px",
              borderRadius: "999px",
              background: "oklch(0.18 0.02 200 / 0.55)",
              fontSize: "12.5px",
              backdropFilter: "blur(4px)",
            }}
          >
            {activeIndex + 1} / {normalized.length}
          </span>
        ) : null}
      </div>

      {/* Thumbnail strip — 6-column, --rm border-radius */}
      {normalized.length > 1 ? (
        <div className="grid grid-cols-4 gap-2.5 md:grid-cols-6">
          {normalized.map((image, index) => (
            <button
              key={image.id ?? `${image.url}-${index}`}
              type="button"
              onClick={() => handleSelect(index)}
              className={cn(
                "relative aspect-square overflow-hidden border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                index === activeIndex
                  ? "border-2 border-primary"
                  : "border-border/70 opacity-80 hover:opacity-100",
              )}
              style={{ borderRadius: "var(--rm)" }}
              aria-label={image.alt || `Preview ${index + 1}`}
            >
              {image.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={image.url}
                  alt={image.alt || `Preview ${index + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="lyvox-image-placeholder flex h-full w-full items-center justify-center">
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
