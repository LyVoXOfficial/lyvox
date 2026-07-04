export const runtime = "nodejs";
export const revalidate = 300;

import type { Metadata } from "next";
import { supabaseService } from "@/lib/supabaseService";
import type { Category } from "@/lib/types";
import CategoryList from "@/components/category-list";
import { getI18nProps } from "@/i18n/server";
import { localizeHref } from "@/lib/i18n";
import { languageAlternates, localizedCanonical } from "@/lib/seo/localizedUrls";

export async function generateMetadata(): Promise<Metadata> {
  const { locale, messages } = await getI18nProps();
  const title = `${messages?.common?.categories ?? "Categories"} | LyVoX`;

  return {
    title,
    alternates: {
      canonical: localizedCanonical("/c", locale),
      languages: languageAlternates("/c"),
    },
  };
}

export default async function CategoriesIndex() {
  const { locale, messages } = await getI18nProps();
  const t = (key: string, fallback: string): string => {
    const value = key.split(".").reduce<any>((acc, part) => (acc ? acc[part] : undefined), messages);
    return typeof value === "string" ? value : fallback;
  };
  const supabase = await supabaseService();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("level", 1)
    .eq("is_active", true)
    .order("sort", { ascending: true });

  const items = error ? [] : ((data as Category[]) ?? []);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          {t("common.categories", "Categories")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("category.indexSubtitle", "Choose a section to browse listings and subcategories.")}
        </p>
      </header>
      {items.length ? (
        <CategoryList items={items} base={localizeHref("/c", locale)} />
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">
            {t("category.unavailable", "Categories are temporarily unavailable.")}
          </p>
        </div>
      )}
    </div>
  );
}
