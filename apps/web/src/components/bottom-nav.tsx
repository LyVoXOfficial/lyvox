"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/* ── Inline SVG icons — match the mockup stroke paths exactly ── */

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
    className={active ? "text-primary" : "text-muted-foreground"}>
    <path d="M3 11l9-7 9 7M5 10v9h14v-9" />
  </svg>
);

const SearchIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
    className={active ? "text-primary" : "text-muted-foreground"}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3-3" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.6" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const ChatIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
    className={active ? "text-primary" : "text-muted-foreground"}>
    <path d="M21 12a8 8 0 01-11.5 7.2L4 20l1-4.5A8 8 0 1121 12z" />
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
    className={active ? "text-primary" : "text-muted-foreground"}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

type NavItem = {
  href: string;
  labelKey: string;
  labelFallback: string;
  matchPattern?: (path: string, href: string) => boolean;
};

const defaultMatch = (currentPath: string, href: string): boolean => {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
};

export default function BottomNav() {
  const path = usePathname();
  const { t } = useI18n();

  const navItems: NavItem[] = [
    { href: "/", labelKey: "common.home", labelFallback: "Home", matchPattern: (p, h) => p === h },
    { href: "/search", labelKey: "common.search", labelFallback: "Search" },
    { href: "/post", labelKey: "nav.sell", labelFallback: "Post" },
    { href: "/chat", labelKey: "common.chat", labelFallback: "Chat" },
    { href: "/profile", labelKey: "common.profile", labelFallback: "Profile" },
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
        {navItems.map((item) => {
          const isActive = item.matchPattern
            ? item.matchPattern(path, item.href)
            : defaultMatch(path, item.href);

          const rawLabel = t(item.labelKey);
          const label = rawLabel === item.labelKey ? item.labelFallback : rawLabel;

          /* Centre slot — gradient Post button */
          if (item.href === "/post") {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-[5px]"
                aria-label={label}
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
                  <PlusIcon />
                </span>
                <span className="text-[10.5px] font-bold leading-none text-primary">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-[4px] text-[10.5px] transition-colors",
                isActive ? "font-semibold text-primary" : "font-semibold text-muted-foreground",
              )}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              {item.href === "/" && <HomeIcon active={isActive} />}
              {item.href === "/search" && <SearchIcon active={isActive} />}
              {item.href === "/chat" && <ChatIcon active={isActive} />}
              {item.href === "/profile" && <ProfileIcon active={isActive} />}
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
