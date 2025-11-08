"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/fetcher";
import { logger } from "@/lib/errorLogger";

type FavoriteAdvertSummary = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  createdAt?: string | null;
  image?: string | null;
  sellerVerified?: boolean;
};

export type FavoriteItem = {
  advertId: string;
  favoritedAt: string | null;
  advert: FavoriteAdvertSummary;
};

type FavoritesContextValue = {
  items: Record<string, FavoriteItem>;
  ordered: FavoriteItem[];
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  isFavorited: (advertId: string) => boolean;
  addFavorite: (summary: FavoriteAdvertSummary) => Promise<{ ok: boolean; error?: string }>;
  removeFavorite: (advertId: string) => Promise<{ ok: boolean; error?: string }>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

type Props = {
  children: React.ReactNode;
};

function normalizeItems(items: FavoriteItem[]): Record<string, FavoriteItem> {
  return items.reduce<Record<string, FavoriteItem>>((acc, item) => {
    acc[item.advertId] = item;
    return acc;
  }, {});
}

export function FavoritesProvider({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Record<string, FavoriteItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/api/favorites?limit=200", {
        credentials: "include",
      });

      if (response.status === 401) {
        setItems({});
        setIsAuthenticated(false);
        setInitialized(true);
        return;
      }

      const payload = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !payload?.ok || !payload?.data) {
        logger.error("Failed to load favorites", {
          component: "FavoritesProvider",
          action: "refresh",
          metadata: { status: response.status },
          error: payload?.error,
        });
        setItems({});
        setIsAuthenticated(response.status !== 401);
        setInitialized(true);
        return;
      }

      const normalized = payload.data.items.map((item: any) => ({
        advertId: item.advert_id,
        favoritedAt: item.favorited_at ?? item.created_at ?? null,
        advert: {
          id: item.advert?.id ?? item.advert_id,
          title: item.advert?.title ?? "",
          price:
            typeof item.advert?.price === "number"
              ? item.advert.price
              : item.advert?.price
                ? Number(item.advert.price)
                : null,
          currency: item.advert?.currency ?? null,
          location: item.advert?.location ?? null,
          createdAt: item.advert?.created_at ?? null,
          image: item.advert?.image ?? null,
          sellerVerified: item.advert?.seller_verified ?? false,
        },
      })) as FavoriteItem[];

      setItems(normalizeItems(normalized));
      setIsAuthenticated(true);
      setInitialized(true);
    } catch (error) {
      logger.error("Error fetching favorites", {
        component: "FavoritesProvider",
        action: "refresh",
        error,
      });
      setItems({});
      setIsAuthenticated(false);
      setInitialized(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      void refresh();
    }
  }, [initialized, refresh]);

  const redirectToLogin = useCallback(() => {
    const search = searchParams?.toString();
    const redirect = search && search.length > 0 ? `${pathname}?${search}` : pathname;
    router.push(`/login?redirect=${encodeURIComponent(redirect ?? "/")}`);
  }, [pathname, router, searchParams]);

  const addFavorite = useCallback(
    async (summary: FavoriteAdvertSummary) => {
      try {
        const response = await apiFetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ advert_id: summary.id }),
        });

        if (response.status === 401) {
          setIsAuthenticated(false);
          redirectToLogin();
          return { ok: false, error: "unauthorized" };
        }

        const payload = await response.json().catch(() => ({ ok: false }));
        if (!response.ok || !payload?.ok) {
          logger.error("Failed to add favorite", {
            component: "FavoritesProvider",
            action: "addFavorite",
            metadata: { advertId: summary.id },
            error: payload?.error ?? response.statusText,
          });
          return { ok: false, error: payload?.error ?? "unknown" };
        }

        setItems((prev) => ({
          ...prev,
          [summary.id]: {
            advertId: summary.id,
            favoritedAt: new Date().toISOString(),
            advert: summary,
          },
        }));
        setIsAuthenticated(true);
        return { ok: true };
      } catch (error) {
        logger.error("Error adding favorite", {
          component: "FavoritesProvider",
          action: "addFavorite",
          metadata: { advertId: summary.id },
          error,
        });
        return { ok: false, error: "network" };
      }
    },
    [redirectToLogin],
  );

  const removeFavorite = useCallback(
    async (advertId: string) => {
      try {
        const response = await apiFetch(`/api/favorites/${advertId}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (response.status === 401) {
          setIsAuthenticated(false);
          redirectToLogin();
          return { ok: false, error: "unauthorized" };
        }

        const payload = await response.json().catch(() => ({ ok: false }));
        if (!response.ok || !payload?.ok) {
          logger.error("Failed to remove favorite", {
            component: "FavoritesProvider",
            action: "removeFavorite",
            metadata: { advertId },
            error: payload?.error ?? response.statusText,
          });
          return { ok: false, error: payload?.error ?? "unknown" };
        }

        setItems((prev) => {
          const next = { ...prev };
          delete next[advertId];
          return next;
        });
        setIsAuthenticated(true);
        return { ok: true };
      } catch (error) {
        logger.error("Error removing favorite", {
          component: "FavoritesProvider",
          action: "removeFavorite",
          metadata: { advertId },
          error,
        });
        return { ok: false, error: "network" };
      }
    },
    [redirectToLogin],
  );

  const ordered = useMemo(() => {
    return Object.values(items).sort((a, b) => {
      const aTime = a.favoritedAt ? Date.parse(a.favoritedAt) : 0;
      const bTime = b.favoritedAt ? Date.parse(b.favoritedAt) : 0;
      return bTime - aTime;
    });
  }, [items]);

  const value: FavoritesContextValue = useMemo(
    () => ({
      items,
      ordered,
      isLoading,
      isAuthenticated,
      refresh,
      isFavorited: (advertId: string) => advertId in items,
      addFavorite,
      removeFavorite,
    }),
    [items, ordered, isLoading, isAuthenticated, refresh, addFavorite, removeFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return context;
}

