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
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{
        background: "oklch(1 0 0 / .96)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div className="grid grid-cols-5 items-start pt-[9px]" style={{ height: 76 }}>
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
                className="flex flex-col items-center gap-[5px]"
                aria-label={item.label}
              >
                <span
                  className="lyvox-cta-gradient grid place-items-center rounded-full border-4 border-[oklch(1_0_0/.96)]"
                  style={{
                    width: 46,
                    height: 46,
                    marginTop: -22,
                    boxShadow: "0 6px 16px oklch(0.55 0.13 178 / .4)",
                  }}
                >
                  <Plus className="h-[22px] w-[22px] text-white" aria-hidden="true" />
                </span>
                <span className="text-[10.5px] font-bold leading-none text-primary">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-[4px] text-[10.5px] font-semibold transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn("h-[22px] w-[22px] transition-colors", isActive ? "text-primary" : "text-muted-foreground")}
                aria-hidden="true"
              />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
