"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import UserMenu from "@/components/UserMenu";
import SearchBar from "@/components/SearchBar";
import CategoryTree from "@/components/CategoryTree";
import { useI18n } from "@/i18n";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { SiteLogo } from "@/components/site-logo";

type MeResponse = {
  user: unknown | null;
};

const hasUser = (payload: MeResponse | { user?: unknown } | null | undefined) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const candidate = (payload as { user?: unknown }).user;
  return !!candidate;
};

export default function MainHeader() {
  const { t } = useI18n();
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const categoriesDropdownRef = useRef<HTMLDivElement>(null);

  // Check session on mount and listen for auth changes
  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        // Try direct Supabase check first (more reliable)
        const { data: { user } } = await supabase.auth.getUser();
        
        if (active) {
          const hasUser = !!user;
          console.log("Header: User check:", hasUser, user?.email);
          setHasSession(hasUser);
        }
      } catch (error) {
        console.error("Header: Error checking session:", error);
        if (active) {
          setHasSession(false);
        }
      }
    };

    // Check session immediately on mount
    checkSession();

    // Listen for custom auth events (fired from auth callback)
    const handleAuthChange = () => {
      if (active) {
        console.log("Auth state changed event received, updating header...");
        checkSession();
      }
    };

    window.addEventListener("auth-state-change", handleAuthChange);

    // Also check on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden && active) {
        console.log("Visibility changed, checking session...");
        checkSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Check more frequently (every 5 seconds)
    const intervalId = setInterval(checkSession, 5000);

    // Listen to Supabase auth state changes directly
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Supabase auth event in header:", event, "Has session:", !!session);
      if (active) {
        // Update immediately for any auth event
        const hasUser = !!session?.user;
        setHasSession(hasUser);
      }
    });

    return () => {
      active = false;
      window.removeEventListener("auth-state-change", handleAuthChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(intervalId);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Close categories dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoriesDropdownRef.current &&
        !categoriesDropdownRef.current.contains(event.target as Node)
      ) {
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
        const data: MeResponse = await response.json().catch(() => ({ user: null }));
        session = hasUser(data);
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
    <div className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-6xl items-center gap-3 px-4">
        {/* Logo */}
        <div className="shrink-0">
          <SiteLogo />
        </div>

        {/* Categories Dropdown - Desktop */}
        <div ref={categoriesDropdownRef} className="relative hidden md:block">
          <Button
            variant="outline"
            onClick={() => setCategoriesOpen(!categoriesOpen)}
            className="gap-2"
            aria-expanded={categoriesOpen}
            aria-haspopup="true"
          >
            {t("common.categories") || "Категории"}
            <svg
              className={cn(
                "h-4 w-4 transition-transform",
                categoriesOpen && "rotate-180"
              )}
              viewBox="0 0 12 8"
              aria-hidden
            >
              <path
                d="M10.59 1.59 6 6.17 1.41 1.59 0 3l6 6 6-6z"
                fill="currentColor"
              />
            </svg>
          </Button>
          {categoriesOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white border rounded-md shadow-lg z-50">
              <CategoryTree
                variant="dropdown"
                onCategorySelect={() => setCategoriesOpen(false)}
              />
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex-1 min-w-0">
          <SearchBar className="w-full" />
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Button onClick={handlePostClick}>{t("common.post")}</Button>
          <UserMenu />
        </div>

        {/* Mobile Menu Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <div className="flex flex-col gap-4 mt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t("common.categories") || "Категории"}</h2>
              </div>
              <CategoryTree
                variant="drawer"
                onCategorySelect={() => setMobileMenuOpen(false)}
              />
              <div className="border-t pt-4 mt-auto space-y-2">
                <Button onClick={handlePostClick} className="w-full">
                  {t("common.post")}
                </Button>
                <div className="px-2">
                  <UserMenu />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
