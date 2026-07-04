"use client";

import Link from "next/link";
import type { Category } from "@/lib/types";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { useI18n } from "@/i18n";
import { localizeHref } from "@/lib/i18n";

function getLocalizedCategoryName(cat: Category, locale: string): string {
  if (locale === "nl") return cat.name_nl || cat.name_en || cat.name_ru || cat.slug;
  if (locale === "fr") return cat.name_fr || cat.name_en || cat.name_ru || cat.slug;
  if (locale === "de") return cat.name_de || cat.name_en || cat.name_ru || cat.slug;
  if (locale === "ru") return cat.name_ru || cat.name_en || cat.slug;
  return cat.name_en || cat.name_ru || cat.slug;
}

export default function CategoryList({ items, base = "/c" }: { items: Category[]; base?: string }) {
  const { locale, t } = useI18n();
  const filtered = (items ?? []).filter((cat) => cat.is_active !== false);

  if (!filtered.length) {
    return <p className="text-sm text-muted-foreground">{t("category.no_categories")}</p>;
  }

  const uniqueItems = Array.from(new Map(filtered.map((item) => [item.slug, item])).values());

  return (
    <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {uniqueItems.map((cat) => {
        const Icon = getCategoryIcon(cat.icon, cat.level);
        const href = localizeHref(`${base}/${cat.path}`, locale);
        const label = getLocalizedCategoryName(cat, locale);
        return (
          <li key={cat.id}>
            <Link
              href={href}
              className="flex items-start gap-3 rounded-md border border-border/80 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <span className="mt-1 rounded-md bg-secondary p-2 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-semibold text-foreground">{label}</span>
                {cat.level <= 2 ? (
                  <span className="block text-xs text-muted-foreground">{t("footer.browse_listings")}</span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
