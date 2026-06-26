"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/fetcher";

type LikesContextValue = {
  isLiked: (advertId: string) => boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  addLike: (advertId: string) => Promise<{ ok: boolean; error?: string }>;
  removeLike: (advertId: string) => Promise<{ ok: boolean; error?: string }>;
};

const LikesContext = createContext<LikesContextValue | null>(null);

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.assign("/login?next=" + encodeURIComponent(window.location.pathname));
  }
}

export function LikesProvider({ children }: { children: ReactNode }) {
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/api/likes?limit=500", { credentials: "include" });
      const payload = await response.json().catch(() => ({ ok: false }));
      if (response.status === 401 || !payload?.ok || !payload?.data?.authenticated) {
        setLiked(new Set());
        setIsAuthenticated(Boolean(payload?.data?.authenticated));
        return;
      }
      setLiked(new Set((payload.data.items as Array<{ advert_id: string }>).map((i) => i.advert_id)));
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const addLike = useCallback(async (advertId: string) => {
    try {
      const response = await apiFetch("/api/likes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ advert_id: advertId }),
      });
      if (response.status === 401) { setIsAuthenticated(false); redirectToLogin(); return { ok: false, error: "unauthorized" }; }
      const payload = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !payload?.ok) return { ok: false, error: payload?.error ?? "unknown" };
      setLiked((prev) => new Set(prev).add(advertId));
      return { ok: true };
    } catch { return { ok: false, error: "network" }; }
  }, []);

  const removeLike = useCallback(async (advertId: string) => {
    try {
      const response = await apiFetch(`/api/likes/${advertId}`, { method: "DELETE", credentials: "include" });
      if (response.status === 401) { setIsAuthenticated(false); redirectToLogin(); return { ok: false, error: "unauthorized" }; }
      const payload = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !payload?.ok) return { ok: false, error: payload?.error ?? "unknown" };
      setLiked((prev) => { const next = new Set(prev); next.delete(advertId); return next; });
      return { ok: true };
    } catch { return { ok: false, error: "network" }; }
  }, []);

  const value = useMemo<LikesContextValue>(() => ({
    isLiked: (id) => liked.has(id), isLoading, isAuthenticated, addLike, removeLike,
  }), [liked, isLoading, isAuthenticated, addLike, removeLike]);

  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export function useLikes(): LikesContextValue {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error("useLikes must be used within LikesProvider");
  return ctx;
}
