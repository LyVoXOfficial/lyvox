"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Category } from "@/lib/types";
import CategoryList from "@/components/category-list";

export default function CategoriesIndex() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("level", 1)
        .eq("is_active", true)
        .order("sort", { ascending: true });

      if (!error && data) setItems(data as Category[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900">Категории</h1>
      <p className="text-sm text-muted-foreground">
        Выберите раздел, чтобы перейти к объявлениям и подкатегориям.
      </p>
      {loading ? <p>Загрузка…</p> : <CategoryList items={items} base="/c" />}
    </div>
  );
}
