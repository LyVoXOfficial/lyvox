"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n";
import { Home, Grid3x3, PlusCircle, User, MoreHorizontal } from "lucide-react";
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

  // Default match function for exact match or starts with
  const defaultMatch = (path: string, href: string): boolean => {
    if (href === "/") {
      return path === "/";
    }
    return path === href || path.startsWith(`${href}/`);
  };

  const items: NavItem[] = [
    {
      href: "/",
      label: t("common.home") || "Главная",
      icon: Home,
      matchPattern: (path, href) => path === href,
    },
    {
      href: "/c",
      label: t("common.categories") || "Категории",
      icon: Grid3x3,
      matchPattern: defaultMatch,
    },
    {
      href: "/post",
      label: t("common.post") || "Подать",
      icon: PlusCircle,
      matchPattern: defaultMatch,
    },
    {
      href: "/profile",
      label: t("common.profile") || "Профиль",
      icon: User,
      matchPattern: defaultMatch,
    },
    {
      href: "/more",
      label: "Еще",
      icon: MoreHorizontal,
      matchPattern: (path, href) => path === href || path.startsWith("/more"),
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.matchPattern
            ? item.matchPattern(path, item.href)
            : defaultMatch(path, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-xs transition-colors",
                "hover:bg-muted/50 active:bg-muted",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
              <span className="leading-none">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-t-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}