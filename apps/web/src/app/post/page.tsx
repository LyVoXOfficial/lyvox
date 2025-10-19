"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import UploadGallery from "@/components/upload-gallery";
import type { Category } from "@/lib/types";

type FormData = {
  title: string;
  description: string;
  price: number | null;
  category_id: string;
  location: string;
};

function PostPageInner() {
  const sp = useSearchParams();
  const editId = useMemo(() => sp.get("edit"), [sp]);

  const [userId, setUserId] = useState<string | null>(null);
  const [advertId, setAdvertId] = useState<string | null>(editId || null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState<boolean>(!!editId);

  const { register, handleSubmit, reset, setValue } = useForm<FormData>({
    defaultValues: {
      title: "",
      description: "",
      price: null,
      category_id: "",
      location: "",
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase
      .from("categories")
      .select("id,name_ru,level,sort")
      .order("level", { ascending: true })
      .order("sort", { ascending: true })
      .then(({ data }) => {
        if (data) setCategories(data as Category[]);
      });
  }, []);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      setLoading(true);
      const { data: ad, error } = await supabase
        .from("adverts")
        .select("id,user_id,title,description,price,category_id,location,status")
        .eq("id", editId)
        .maybeSingle();

      if (error || !ad) {
        alert("Объявление не найдено");
        setLoading(false);
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      if (ad.user_id !== u.user?.id) {
        alert("У вас нет прав редактировать это объявление");
        window.location.href = "/";
        return;
      }

      setAdvertId(ad.id);
      setValue("title", ad.title ?? "");
      setValue("description", ad.description ?? "");
      setValue("price", ad.price ?? null);
      setValue("category_id", ad.category_id ?? "");
      setValue("location", ad.location ?? "");
      setLoading(false);
    })();
  }, [editId, setValue]);

  const createDraft = async () => {
    if (!userId) return alert("Войдите, чтобы создать объявление");
    setCreating(true);

    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("level", 1)
      .order("sort", { ascending: true })
      .limit(1)
      .maybeSingle();

    const categoryId = cat?.id;

    const { data, error } = await supabase
      .from("adverts")
      .insert({
        user_id: userId,
        category_id: categoryId,
        title: "Черновик объявления",
        status: "draft",
      })
      .select("id")
      .single();

    setCreating(false);

    if (error) {
      alert("Ошибка создания черновика: " + error.message);
    } else {
      setAdvertId(data!.id);
      reset({ title: "", description: "", price: null, category_id: categoryId ?? "", location: "" });
      const url = new URL(window.location.href);
      url.searchParams.set("edit", data!.id);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const onSubmit = async (values: FormData) => {
    if (!values.title?.trim()) return alert("Введите название");
    if (!values.category_id) return alert("Выберите категорию");

    if (!advertId) {
      alert("Сначала создайте черновик");
      return;
    }

    const payload = {
      title: values.title,
      description: values.description,
      price: values.price,
      category_id: values.category_id,
      location: values.location,
      status: "active" as const,
    };

    const { error } = await supabase
      .from("adverts")
      .update(payload)
      .eq("id", advertId);

    if (error) {
      alert("Ошибка сохранения: " + error.message);
    } else {
      alert("Объявление опубликовано!");
      window.location.href = `/ad/${advertId}`;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">
        {editId ? "Редактировать объявление" : "Создать объявление"}
      </h1>

      {!advertId && !editId ? (
        <div>
          <Button disabled={!userId || creating} onClick={createDraft}>
            {creating ? "Создание..." : "Создать черновик"}
          </Button>
        </div>
      ) : null}

      {loading ? (
        <p>Загрузка...</p>
      ) : advertId ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block mb-1">Название</label>
            <input
              type="text"
              {...register("title", { required: true })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1">Описание</label>
            <textarea
              {...register("description")}
              className="w-full border rounded px-3 py-2"
              rows={6}
            />
          </div>

          <div>
            <label className="block mb-1">Цена (€)</label>
            <input
              type="number"
              step="0.01"
              {...register("price")}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1">Категория</label>
            <select
              {...register("category_id", { required: true })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Выберите...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ru}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1">Локация</label>
            <input
              type="text"
              {...register("location")}
              placeholder="Например: Brussels"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-2">Фото</label>
            <UploadGallery advertId={advertId} />
          </div>

          <Button type="submit">{editId ? "Обновить и опубликовать" : "Опубликовать"}</Button>
        </form>
      ) : (
        <p>Сначала создайте черновик (или откройте страницу с параметром ?edit=&lt;id&gt;)</p>
      )}
    </div>
  );
}

export default function PostPage() {
  return (
    <Suspense fallback={<p>Загрузка...</p>}>
      <PostPageInner />
    </Suspense>
  );
}
