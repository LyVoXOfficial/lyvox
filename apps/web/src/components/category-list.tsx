"use client";

import Link from "next/link";
import type { Category } from "@/lib/types";
import { getCategoryIcon } from "@/lib/categoryIcons";

export default function CategoryList({ items, base = "/c" }: { items: Category[]; base?: string }) {
  if (!items?.length) {
    return <p className="text-sm text-muted-foreground">Список пуст.</p>;
  }

  const uniqueItems = Array.from(new Map(items.map((item) => [item.slug, item])).values());

  return (
    <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {uniqueItems.map((cat) => {
        const Icon = getCategoryIcon(cat.icon, cat.level);
        const href = `${base}/${cat.path}`;
        return (
          <li key={cat.id}>
            <Link
              href={href}
              className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <span className="mt-1 rounded-lg bg-zinc-100 p-2 text-zinc-600">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-medium text-zinc-900">{cat.name_ru}</span>
                {cat.level <= 2 ? (
                  <span className="block text-xs text-zinc-500">Показать объявления</span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
