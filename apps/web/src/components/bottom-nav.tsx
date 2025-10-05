"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Главная" },
  { href: "/c", label: "Категории" },
  { href: "/post", label: "Разместить" },
  { href: "/profile", label: "Профиль" },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-white h-14 pb-[env(safe-area-inset-bottom)]">
      <nav className="grid grid-cols-4 h-14 text-xs">
        {items.map((it) => {
          const active = path === it.href || (it.href !== "/" && path.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center justify-center ${active ? "font-semibold" : ""}`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
