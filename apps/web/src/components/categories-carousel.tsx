"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Category } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Item = Category;

export default function CategoriesCarousel() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("level", 1)
        .eq("is_active", true)
        .order("sort", { ascending: true });
      if (!error && data) {
        const unique = Array.from(new Map(data.map((c) => [c.slug, c])).values());
        setItems(unique as Item[]);
      }
      setLoading(false);
    })();
  }, []);

  const scrollBy = (delta: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Загрузка категорий…</p>;
  }

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Категории временно недоступны.</p>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Назад"
        onClick={() => scrollBy(-240)}
        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory px-10 py-2"
      >
        {items.map((cat) => {
          const Icon = getCategoryIcon(cat.icon, cat.level);
          return (
            <Link
              key={cat.slug}
              href={`/c/${cat.path}`}
              className="snap-start flex w-28 flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-center text-xs font-medium text-zinc-900">
                {cat.name_ru}
              </span>
              <span className="text-center text-[10px] text-zinc-500">Показать</span>
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Вперёд"
        onClick={() => scrollBy(240)}
        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute inset-y-0 left-6 w-16 bg-gradient-to-r from-white" />
      <div className="pointer-events-none absolute inset-y-0 right-6 w-16 bg-gradient-to-l from-white" />
    </div>
  );
}
