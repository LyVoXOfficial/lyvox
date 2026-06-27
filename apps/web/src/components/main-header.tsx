"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import CategoryTree from "@/components/CategoryTree";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import NotificationBell from "@/components/NotificationBell";
import SearchBar from "@/components/SearchBar";
import { SiteLogo } from "@/components/site-logo";
import UserMenu from "@/components/UserMenu";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

type MeResponse = {
  user: unknown | null;
};

const hasUserPayload = (payload: MeResponse | { user?: unknown } | null | undefined) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  return !!(payload as { user?: unknown }).user;
};

/** Hamburger / menu lines icon used in the Categories chip */
const MenuLinesIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export default function MainHeader() {
  const { t } = useI18n();
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoriesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (active) {
          setHasSession(!!user);
        }
      } catch {
        if (active) {
          setHasSession(false);
        }
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        setHasSession(!!session?.user);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoriesDropdownRef.current && !categoriesDropdownRef.current.contains(event.target as Node)) {
        setCategoriesOpen(false);
      }
    };

    if (categoriesOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [categoriesOpen]);

  const handlePostClick = async () => {
    let session = hasSession;

    if (session === null) {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const json = await response.json().catch(() => null);
        // /api/me wraps its payload in the createSuccessResponse {ok,data} envelope;
        // unwrap to the inner payload (tolerant of a flat shape too).
        const data: MeResponse = (json?.data ?? json ?? { user: null }) as MeResponse;
        session = hasUserPayload(data);
        setHasSession(session);
      } catch {
        session = false;
        setHasSession(false);
      }
    }

    if (session) {
      router.push("/post");
    } else {
      const next = encodeURIComponent("/post");
      router.push(`/register?next=${next}`);
    }
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-border"
      style={{
        background: "oklch(1 0 0 / .85)",
        backdropFilter: "saturate(1.4) blur(14px)",
        WebkitBackdropFilter: "saturate(1.4) blur(14px)",
      }}
    >
      {/* ── Desktop layout ─────────────────────────────── */}
      <div className="mx-auto hidden max-w-[1200px] items-center gap-[14px] px-6 md:flex" style={{ height: 66 }}>
        {/* Logo */}
        <div className="shrink-0">
          <SiteLogo size="md" />
        </div>

        {/* Categories chip */}
        <div ref={categoriesDropdownRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setCategoriesOpen((v) => !v)}
            className="inline-flex h-[43px] items-center gap-[7px] rounded-[var(--rm)] border border-border bg-card px-[14px] text-[14px] font-semibold text-foreground transition-colors hover:bg-secondary"
            aria-expanded={categoriesOpen}
            aria-haspopup="true"
          >
            <MenuLinesIcon />
            {t("common.categories") || "Categories"}
          </button>
          {categoriesOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-[var(--r)] border border-border bg-card shadow-[var(--shHi)]">
              <CategoryTree variant="dropdown" onCategorySelect={() => setCategoriesOpen(false)} />
            </div>
          )}
        </div>

        {/* Search pill — flex-1 */}
        <SearchBar variant="header" className="min-w-0 flex-1" />

        {/* Language chip */}
        <div className="shrink-0 [&_button]:h-[43px] [&_button]:rounded-[var(--rm)] [&_button]:border-border [&_button]:bg-card [&_button]:px-[12px] [&_button]:text-[13px] [&_button]:font-semibold [&_button]:text-muted-foreground">
          <LanguageSwitcher />
        </div>

        {/* Post a listing CTA */}
        <button
          type="button"
          onClick={handlePostClick}
          className="lyvox-cta-gradient inline-flex h-[44px] shrink-0 items-center gap-[7px] rounded-[var(--rm)] border-0 px-[17px] text-[14px] font-bold text-white"
          style={{ boxShadow: "0 4px 14px oklch(0.55 0.13 178 / .35)" }}
        >
          <Plus className="h-[17px] w-[17px]" aria-hidden="true" />
          {t("common.post") || "Post a listing"}
        </button>

        {/* Notification bell + Avatar */}
        <NotificationBell />
        <UserMenu />
      </div>

      {/* ── Mobile layout: logo + search + lang + avatar ───
           Categories and Post are accessible via the bottom nav (/c and /post).
           No hamburger needed; the Sheet drawer is removed to match the mockup. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:hidden">
        {/* Logo (small variant) */}
        <div className="shrink-0">
          <SiteLogo size="sm" />
        </div>

        {/* Search pill — flex-1 */}
        <SearchBar variant="header" className="min-w-0 flex-1" />

        {/* Language + Avatar */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="[&_button]:h-[30px] [&_button]:rounded-full [&_button]:border-border [&_button]:bg-card [&_button]:px-[10px] [&_button]:text-[12px] [&_button]:font-semibold [&_button]:text-muted-foreground">
            <LanguageSwitcher />
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
