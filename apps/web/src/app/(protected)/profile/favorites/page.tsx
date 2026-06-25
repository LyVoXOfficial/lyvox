"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Heart, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FavoritesComparisonView from "@/components/favorites/FavoritesComparisonView";
import { useFavorites } from "@/components/favorites/FavoritesProvider";
import { useI18n } from "@/i18n";

function mapSelectableItems(ordered: ReturnType<typeof useFavorites>["ordered"]) {
  const activeItems = ordered.filter(
    (favorite) => favorite.advert && (favorite.advert.status ?? "active") === "active",
  );

  return activeItems.map((favorite) => ({
    id: favorite.advert.id,
    title: favorite.advert.title,
    price: favorite.advert.price ?? null,
    currency: favorite.advert.currency ?? null,
    location: favorite.advert.location ?? null,
    image: favorite.advert.image ?? null,
    createdAt: favorite.advert.createdAt ?? null,
    sellerVerified: favorite.advert.sellerVerified ?? false,
    status: favorite.advert.status ?? "active",
  }));
}

export default function FavoritesPage() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const { ordered, isLoading, refresh } = useFavorites();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = mapSelectableItems(ordered);
  const totalFavorites = ordered.filter((favorite) => favorite.advert).length;
  const hiddenCount = Math.max(0, totalFavorites - items.length);
  const title = tr("favorites.title", "Favorites");

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="lyvox-trust-gradient inline-flex items-center gap-2 rounded-xl px-3 py-1 text-xs font-medium text-white">
            <Heart className="h-3.5 w-3.5" aria-hidden="true" />
            {tr("favorites.saved_listings", "Saved listings")}
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{title}</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/search">{tr("common.search", "Search adverts")}</Link>
        </Button>
      </header>

      {hiddenCount > 0 ? (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            {t("favorites.hidden_inactive", { count: hiddenCount.toString() })}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-soft)]">
          <CardContent className="py-10 text-center text-muted-foreground">
            {tr("common.loading", "Loading…")}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="font-extrabold tracking-tight">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-muted-foreground">
            <p>{tr("favorites.empty_state", "You haven't saved any favorites yet")}</p>
            <p>{tr("favorites.empty_action", "Browse listings and tap the heart icon to save them")}</p>
            <Button asChild>
              <Link href="/search">{tr("common.search", "Search adverts")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <FavoritesComparisonView items={items} isLoading={isLoading} />
      )}
    </main>
  );
}
