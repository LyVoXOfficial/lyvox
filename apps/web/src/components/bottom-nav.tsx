"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid3x3, Home, MoreHorizontal, Plus, User } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPattern?: (path: string, href: string) => boolean;
};

export default function BottomNav() {
  const path = usePathname();
  const { t } = useI18n();
  const moreLabel = t("common.more");

  const defaultMatch = (currentPath: string, href: string): boolean => {
    if (href === "/") {
      return currentPath === "/";
    }
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const items: NavItem[] = [
    {
      href: "/",
      label: t("common.home") || "Home",
      icon: Home,
      matchPattern: (currentPath, href) => currentPath === href,
    },
    {
      href: "/c",
      label: t("common.categories") || "Categories",
      icon: Grid3x3,
      matchPattern: defaultMatch,
    },
    {
      href: "/post",
      label: t("nav.sell") || "Sell",
      icon: Plus,
      matchPattern: defaultMatch,
    },
    {
      href: "/profile",
      label: t("common.profile") || "Profile",
      icon: User,
      matchPattern: defaultMatch,
    },
    {
      href: "/more",
      label: moreLabel === "common.more" ? "More" : moreLabel,
      icon: MoreHorizontal,
      matchPattern: (currentPath, href) => currentPath === href || currentPath.startsWith("/more"),
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid h-14 grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchPattern
            ? item.matchPattern(path, item.href)
            : defaultMatch(path, item.href);

          if (item.href === "/post") {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-1"
                aria-label={item.label}
              >
                <span className="lyvox-cta-gradient -mt-5 flex h-12 w-12 items-center justify-center rounded-full text-primary-foreground ring-4 ring-background">
                  <Plus className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-[11px] font-semibold leading-none text-primary">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                "hover:bg-muted/50 active:bg-muted",
                isActive ? "font-medium text-primary" : "text-muted-foreground",
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground")}
                aria-hidden="true"
              />
              <span className="leading-none">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-t-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
