"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Menu, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

export default function MainHeader() {
  const { t } = useI18n();
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    <div className="sticky top-0 z-40 border-b border-border/75 bg-background/95 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <div className="shrink-0">
          <SiteLogo />
        </div>

        <div ref={categoriesDropdownRef} className="relative hidden md:block">
          <Button
            variant="outline"
            onClick={() => setCategoriesOpen((value) => !value)}
            className="h-10 gap-2 border-border/80 bg-card px-3 shadow-sm"
            aria-expanded={categoriesOpen}
            aria-haspopup="true"
          >
            {t("common.categories") || "Categories"}
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", categoriesOpen && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
          {categoriesOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-[360px] overflow-hidden rounded-md border border-border/80 bg-card shadow-xl">
              <CategoryTree variant="dropdown" onCategorySelect={() => setCategoriesOpen(false)} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <SearchBar className="w-full" />
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <LanguageSwitcher />
          <Button onClick={handlePostClick} className="h-10 gap-2 px-4 shadow-sm">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("common.post") || "Post listing"}
          </Button>
          <div className="hidden items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 xl:flex">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("nav.trust_first") || "Trust-first"}
          </div>
          <NotificationBell />
          <UserMenu />
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <div className="mt-4 flex min-h-full flex-col gap-5">
              <div className="flex items-center justify-between">
                <SiteLogo />
              </div>
              <CategoryTree variant="drawer" onCategorySelect={() => setMobileMenuOpen(false)} />
              <div className="mt-auto space-y-3 border-t border-border pt-4">
                <div className="px-2">
                  <LanguageSwitcher />
                </div>
                <Button onClick={handlePostClick} className="w-full gap-2">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("common.post") || "Post listing"}
                </Button>
                <div className="flex items-center justify-between gap-3 px-2">
                  <NotificationBell />
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
