"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  LayoutDashboard,
  ListChecks,
  LogIn,
  LogOut,
  Phone,
  UserCircle,
  UserPlus,
} from "lucide-react";
import { hasAdminRole, type SupabaseUserLike } from "@/lib/adminRole";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type MeResponse = {
  user: unknown;
  phone: { number?: string | null; verified?: boolean | null } | null;
  verifiedPhone?: boolean;
};

type MenuLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning";
};

export default function UserMenu() {
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let lastEmail: string | null = null;
    let phoneVerificationFetched = false;

    const fetchPhoneVerification = async (userEmail: string | null) => {
      if (userEmail === lastEmail && phoneVerificationFetched) {
        return;
      }
      lastEmail = userEmail ?? null;
      phoneVerificationFetched = false;

      if (!userEmail) {
        if (!cancelled) {
          setPhoneVerified(null);
        }
        return;
      }

      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data: MeResponse = await response.json().catch(() => ({ user: null, phone: null }));
        const verifiedFromPhone = typeof data?.phone?.verified === "boolean" ? data.phone.verified : null;
        const verifiedFallback = typeof data?.verifiedPhone === "boolean" ? data.verifiedPhone : null;
        if (!cancelled) {
          setPhoneVerified(verifiedFromPhone ?? verifiedFallback);
          phoneVerificationFetched = true;
        }
      } catch {
        if (!cancelled) {
          setPhoneVerified(null);
          phoneVerificationFetched = true;
        }
      }
    };

    const checkUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!cancelled) {
          if (user) {
            const userEmail = user.email ?? null;
            setEmail(userEmail);
            setIsAdmin(hasAdminRole(user as SupabaseUserLike));
            await fetchPhoneVerification(userEmail);
          } else {
            setEmail(null);
            setIsAdmin(false);
            setPhoneVerified(null);
            lastEmail = null;
            phoneVerificationFetched = false;
          }
        }
      } catch {
        if (!cancelled) {
          setEmail(null);
          setIsAdmin(false);
          setPhoneVerified(null);
          lastEmail = null;
        }
      }
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled) {
        if (session?.user) {
          const userEmail = session.user.email ?? null;
          setEmail(userEmail);
          setIsAdmin(hasAdminRole(session.user as SupabaseUserLike));
          fetchPhoneVerification(userEmail);
        } else {
          setEmail(null);
          setIsAdmin(false);
          setPhoneVerified(null);
          lastEmail = null;
        }
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const closeMenu = useCallback(() => setOpen(false), []);

  const signOut = async () => {
    // Clear the client Supabase session (localStorage) as well as the server cookie, otherwise the
    // browser keeps a stale session and the UI can still look "signed in" after signing out.
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.replace("/");
    }
  };

  if (!email) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border/80 bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {t("nav.sign_in")}
        </Link>
        <Link
          href="/register"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {t("nav.join")}
        </Link>
      </div>
    );
  }

  const accountLabel = email.split("@")[0] || t("nav.account");
  const initials = accountLabel.slice(0, 2).toUpperCase();
  const showPhoneVerification = phoneVerified === false;
  const menuLinks: MenuLink[] = [
    { href: "/profile", label: t("common.profile"), icon: UserCircle },
    { href: "/profile/adverts", label: t("nav.my_listings"), icon: ListChecks },
    { href: "/saved", label: t("saved.title"), icon: Bookmark },
    ...(showPhoneVerification
      ? [{ href: "/profile/phone", label: t("nav.verify_phone"), icon: Phone, tone: "warning" as const }]
      : []),
    ...(isAdmin
      ? [{ href: "/admin/reports", label: t("nav.admin_panel"), icon: LayoutDashboard }]
      : []),
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-2 rounded-md border border-border/80 bg-card px-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("nav.open_account_menu")}
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
          {initials}
        </span>
        <span className="hidden max-w-36 truncate sm:inline">{accountLabel}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-md border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-xl"
        >
          <div className="border-b border-border/70 px-3 py-2.5">
            <p className="text-xs font-medium uppercase text-muted-foreground">{t("nav.signed_in_as")}</p>
            <p className="truncate text-sm font-semibold">{email}</p>
          </div>

          <div className="py-1">
            {menuLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                    item.tone === "warning" && "text-amber-700 hover:bg-amber-50"
                  )}
                  role="menuitem"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            role="menuitem"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t("nav.sign_out")}
          </button>
        </div>
      )}
    </div>
  );
}
