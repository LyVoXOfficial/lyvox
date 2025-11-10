"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFavorites } from "@/components/favorites/FavoritesProvider";
import { useI18n } from "@/i18n";
import FavoritesComparisonView from "@/components/favorites/FavoritesComparisonView";

function mapSelectableItems(ordered: ReturnType<typeof useFavorites>["ordered"]) {
  return ordered
    .filter((favorite) => favorite.advert)
    .map((favorite) => ({
      id: favorite.advert.id,
      title: favorite.advert.title,
      price: favorite.advert.price ?? null,
      currency: favorite.advert.currency ?? null,
      location: favorite.advert.location ?? null,
      image: favorite.advert.image ?? null,
      createdAt: favorite.advert.createdAt ?? null,
      sellerVerified: favorite.advert.sellerVerified ?? false,
    }));
}

export default function FavoritesPage() {
  const { t } = useI18n();
  const { ordered, isLoading, refresh } = useFavorites();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = mapSelectableItems(ordered);

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          {t("favorites.title") || "Избранное"}
        </h1>
      </header>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("common.loading") || "Загрузка..."}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("favorites.title") || "Избранное"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-muted-foreground">
            <p>{t("favorites.empty_state") || "Вы ещё не добавили объявления в избранное"}</p>
            <p>{t("favorites.empty_action") || "Просматривайте каталог и нажмите на сердечко, чтобы сохранить понравившееся"}</p>
            <Button asChild>
              <Link href="/search">{t("common.search") || "Поиск объявлений"}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <FavoritesComparisonView items={items} isLoading={isLoading} />
      )}
    </main>
  );
}

