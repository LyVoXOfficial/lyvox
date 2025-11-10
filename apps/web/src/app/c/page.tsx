export const runtime = "nodejs";
export const revalidate = 300;

import { supabaseService } from "@/lib/supabaseService";
import type { Category } from "@/lib/types";
import CategoryList from "@/components/category-list";

export default async function CategoriesIndex() {
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
      <h1 className="text-2xl font-semibold text-zinc-900">Категории</h1>
      <p className="text-sm text-muted-foreground">
        Выберите раздел, чтобы перейти к объявлениям и подкатегориям.
      </p>
      {items.length ? (
        <CategoryList items={items} base="/c" />
      ) : (
        <p className="text-sm text-muted-foreground">Категории временно недоступны.</p>
      )}
    </div>
  );
}
