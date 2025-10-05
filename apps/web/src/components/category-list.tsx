"use client";

import Link from "next/link";
import type { Category } from "@/lib/types";

export default function CategoryList({ items, base = "/c" }: { items: Category[]; base?: string }) {
  if (!items?.length) return <p className="text-sm text-zinc-500">Пусто.</p>;

  return (
    <ul className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((cat) => (
        <li key={cat.id}>
          <Link
            href={`${base}/${cat.path}`}
            className="block border rounded-md p-3 hover:bg-zinc-50"
          >
            <div className="font-medium">{cat.name_ru}</div>
            <div className="text-xs text-zinc-500 mt-1">{cat.path}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
