"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/components/favorites/FavoritesProvider";
import { useI18n } from "@/i18n";

type Props = {
  advert: {
    id: string;
    title: string;
    price?: number | null;
    currency?: string | null;
    location?: string | null;
    image?: string | null;
    createdAt?: string | null;
    sellerVerified?: boolean;
  };
  className?: string;
};

export default function FavoriteToggle({ advert, className }: Props) {
  const { t } = useI18n();
  const { isFavorited, addFavorite, removeFavorite, isLoading } = useFavorites();
  const [pending, setPending] = useState(false);

  const favorited = isFavorited(advert.id);

  const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (pending || isLoading) return;
    setPending(true);

    try {
      if (favorited) {
        const result = await removeFavorite(advert.id);
        if (result.ok) {
          toast.success(t("favorites.removed") || "Removed from favorites");
        } else if (result.error === "unauthorized") {
          toast.info(t("favorites.login_required") || "Sign in to manage favorites");
        } else {
          toast.error(t("favorites.remove_failed") || "Failed to remove from favorites");
        }
      } else {
        const result = await addFavorite({
          id: advert.id,
          title: advert.title,
          price: advert.price,
          currency: advert.currency,
          location: advert.location,
          image: advert.image,
          createdAt: advert.createdAt,
          sellerVerified: advert.sellerVerified,
        });
        if (result.ok) {
          toast.success(t("favorites.added") || "Added to favorites");
        } else if (result.error === "unauthorized") {
          toast.info(t("favorites.login_required") || "Sign in to manage favorites");
        } else {
          toast.error(t("favorites.add_failed") || "Failed to add to favorites");
        }
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={favorited}
      aria-label={favorited ? t("favorites.remove") || "Remove from favorites" : t("favorites.add") || "Add to favorites"}
      className={cn(
        "rounded-full border px-2 py-1 text-xs font-medium transition-colors",
        favorited
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-900/40 dark:text-red-200"
          : "border-transparent bg-muted text-muted-foreground hover:bg-muted/70",
        (pending || isLoading) && "pointer-events-none opacity-60",
        className,
      )}
    >
      <Heart
        className={cn(
          "h-3.5 w-3.5 transition-colors",
          favorited ? "fill-red-500 text-red-500 dark:fill-red-300 dark:text-red-200" : "text-muted-foreground",
        )}
      />
    </button>
  );
}

