export const runtime = "nodejs";
export const revalidate = 300;

import { supabaseService } from "@/lib/supabaseService";
import type { Category } from "@/lib/types";
import CategoryList from "@/components/category-list";
import { getI18nProps } from "@/i18n/server";

export default async function CategoriesIndex() {
  const { messages } = await getI18nProps();
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-normal text-foreground">{t("common.categories", "Categories")}</h1>
      <p className="text-sm text-muted-foreground">
        Choose a section to browse listings and subcategories.
      </p>
      {items.length ? (
        <CategoryList items={items} base="/c" />
      ) : (
        <p className="text-sm text-muted-foreground">Categories are temporarily unavailable.</p>
      )}
    </div>
  );
}
