"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Category } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { localizeHref } from "@/lib/i18n";

type Item = Category;

export default function CategoriesCarousel() {
  const { locale } = useI18n();
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
    return <p className="text-sm text-muted-foreground">Loading categories...</p>;
  }

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Categories are temporarily unavailable.</p>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Previous categories"
        onClick={() => scrollBy(-240)}
        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-card/90 p-2 shadow-sm backdrop-blur hover:bg-card"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-10 py-2"
      >
        {items.map((cat) => {
          const Icon = getCategoryIcon(cat.icon, cat.level);
          const label =
            locale === "nl"
              ? cat.name_nl
              : locale === "fr"
                ? cat.name_fr
                : locale === "de"
                  ? cat.name_de
                  : locale === "ru"
                    ? cat.name_ru
                    : cat.name_en;
          return (
            <Link
              key={cat.slug}
              href={localizeHref(`/c/${cat.path}`, locale)}
              className="group flex w-32 snap-start flex-col items-center gap-2.5 rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)] transition duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-card)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="line-clamp-2 min-h-8 text-center text-xs font-semibold leading-tight text-foreground group-hover:text-primary">
                {label || cat.name_en || cat.name_ru}
              </span>
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Next categories"
        onClick={() => scrollBy(240)}
        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-card/90 p-2 shadow-sm backdrop-blur hover:bg-card"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute inset-y-0 left-6 w-10 bg-gradient-to-r from-background" />
      <div className="pointer-events-none absolute inset-y-0 right-6 w-10 bg-gradient-to-l from-background" />
    </div>
  );
}
