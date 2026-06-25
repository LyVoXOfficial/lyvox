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
  const { ordered, isLoading, refresh } = useFavorites();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = mapSelectableItems(ordered);
  const totalFavorites = ordered.filter((favorite) => favorite.advert).length;
  const hiddenCount = Math.max(0, totalFavorites - items.length);
  const title = t("favorites.title") || "Favorites";

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <Heart className="h-3.5 w-3.5" aria-hidden="true" />
            Saved listings
          </div>
          <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/search">{t("common.search") || "Search listings"}</Link>
        </Button>
      </header>

      {hiddenCount > 0 ? (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            {t("favorites.hidden_inactive", { count: hiddenCount.toString() }) ||
              `${hiddenCount} ${hiddenCount === 1 ? "favorite" : "favorites"} hidden because the advert is no longer active.`}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <Card className="rounded-md border-border/80">
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("common.loading") || "Loading..."}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="rounded-md border-border/80">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-muted-foreground">
            <p>{t("favorites.empty_state") || "You have not saved any listings yet."}</p>
            <p>{t("favorites.empty_action") || "Browse the marketplace and save listings you want to compare later."}</p>
            <Button asChild>
              <Link href="/search">{t("common.search") || "Search listings"}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <FavoritesComparisonView items={items} isLoading={isLoading} />
      )}
    </main>
  );
}
