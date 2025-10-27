"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import UploadGallery from "@/components/upload-gallery";
import type { Category } from "@/lib/types";

type FormData = {
  title: string;
  description: string;
  price: number | null;
  category_id: string;
  location: string;
  condition: string;
  specifics: { [key: string]: string }; // For dynamic key/value pairs
};

function PostPageInner() {
  const sp = useSearchParams();
  const editId = useMemo(() => sp.get("edit"), [sp]);

  const [userId, setUserId] = useState<string | null>(null);
  const [advertId, setAdvertId] = useState<string | null>(editId || null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState<boolean>(!!editId);
  const [specificsFields, setSpecificsFields] = useState<Array<{ key: string; value: string }>>([]);

  const { register, handleSubmit, reset, setValue, watch, control } = useForm<FormData>({
    defaultValues: {
      title: "",
      description: "",
      price: null,
      category_id: "",
      location: "",
      condition: "",
      specifics: {},
    },
  });

  const selectedCategoryId = watch("category_id");
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase
      .from("categories")
      .select("id,name_ru,path,is_active")
      .eq("is_active", true)
      .order("sort", { ascending: true })
      .order("name_ru", { ascending: true })
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
        .select("id,user_id,title,description,price,category_id,location,status,condition")
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
      setValue("condition", ad.condition ?? "");

      const { data: specificsData } = await supabase
        .from("ad_item_specifics")
        .select("specifics")
        .eq("advert_id", ad.id)
        .maybeSingle();

      const specifics = specificsData?.specifics as Record<string, string> | null;
      if (specifics) {
        const loadedSpecificsFields = Object.entries(specifics).map(([key, value]) => ({ key, value }));
        setSpecificsFields(loadedSpecificsFields);
        setValue("specifics", specifics);
      }
      setLoading(false);
    })();
  }, [editId, setValue]);

  const createDraft = async () => {
    if (!userId) return alert("Пожалуйста, войдите, чтобы разместить объявление");
    setCreating(true);
    try {
      const response = await apiFetch("/api/adverts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Черновик",
          description: "",
          price: 0,
          category_id: categories.find((c) => c.is_active)?.id || "", // Default to first active category
          location: "",
          condition: "",
          status: "draft",
        }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error ?? "CREATE_FAILED");
      }
      setAdvertId(payload.advert.id);
      reset({
        title: "Черновик",
        description: "",
        price: 0,
        category_id: payload.advert?.category_id ?? "",
        location: "",
        condition: "",
        specifics: {},
      });
      const url = new URL(window.location.href);
      url.searchParams.set("edit", payload.advert.id);
      window.history.replaceState(null, "", url.toString());
    } catch (err) {
      console.error("CREATE_DRAFT_ERROR", err);
      alert("Не удалось создать черновик. Попробуйте снова.");
    } finally {
      setCreating(false);
    }
  };
  const onSubmit = async (values: FormData) => {
    if (!values.title?.trim()) return alert("Введите название");
    if (!values.description?.trim()) return alert("Введите описание");
    if (!values.price || values.price <= 0) return alert("Введите цену");
    if (!values.category_id) return alert("Выберите категорию");
    if (!values.condition) return alert("Выберите состояние");

    if (!advertId) {
      alert("Сначала создайте черновик");
      return;
    }

    try {
      const response = await apiFetch(`/api/adverts/${advertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          price: values.price,
          category_id: values.category_id,
          location: values.location,
          condition: values.condition,
          status: "active",
          specifics: values.specifics, // Pass specifics directly
        }),
      });

      const payload = await response.json();
      if (!payload.ok) {
        console.error("ADVERT_UPDATE_ERROR", payload);
        alert("Ошибка при обновлении: " + (payload.error ?? "unknown"));
        return;
      }

      alert("Объявление опубликовано!");
      window.location.href = `/ad/${advertId}`;
    } catch (err) {
      console.error("ADVERT_UPDATE_EXCEPTION", err);
      alert("Ошибка связи. Попробуйте позже.");
    }
  };

  const addSpecificsField = () => {
    setSpecificsFields([...specificsFields, { key: "", value: "" }]);
  };

  const updateSpecificsField = (index: number, field: "key" | "value", newValue: string) => {
    const updatedFields = specificsFields.map((item, i) =>
      i === index ? { ...item, [field]: newValue } : item,
    );
    setSpecificsFields(updatedFields);
    const newSpecifics = updatedFields.reduce((acc, item) => {
      if (item.key.trim() && item.value.trim()) {
        acc[item.key.trim()] = item.value.trim();
      }
      return acc;
    }, {} as { [key: string]: string });
    setValue("specifics", newSpecifics, { shouldDirty: true, shouldValidate: true });
  };

  const removeSpecificsField = (index: number) => {
    const updatedFields = specificsFields.filter((_, i) => i !== index);
    setSpecificsFields(updatedFields);
    const newSpecifics = updatedFields.reduce((acc, item) => {
      if (item.key.trim() && item.value.trim()) {
        acc[item.key.trim()] = item.value.trim();
      }
      return acc;
    }, {} as { [key: string]: string });
    setValue("specifics", newSpecifics, { shouldDirty: true, shouldValidate: true });
  };

  if (loading) {
    return <p>Загрузка...</p>;
  }

  if (!userId && !advertId) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-semibold">Подать объявление</h1>
        <p>Пожалуйста, <a href="/login" className="text-blue-600 hover:underline">войдите</a>, чтобы разместить объявление.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-semibold">
        {editId ? "Редактировать объявление" : "Создать объявление"}
      </h1>

      {!advertId && !editId && (
        <div>
          <Button disabled={creating} onClick={createDraft}>
            {creating ? "Создание..." : "Создать черновик"}
          </Button>
        </div>
      )}

      {advertId ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">Основная информация</h2>
            <div>
              <label htmlFor="title" className="block mb-1">Название</label>
              <input
                type="text"
                id="title"
                {...register("title", { required: true })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="description" className="block mb-1">Описание</label>
              <textarea
                id="description"
                {...register("description", { required: true })}
                className="w-full border rounded px-3 py-2"
                rows={6}
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Цена и состояние</h2>
            <div>
              <label htmlFor="price" className="block mb-1">Цена (€)</label>
              <input
                type="number"
                id="price"
                step="0.01"
                {...register("price", { required: true, valueAsNumber: true, min: 0 })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="condition" className="block mb-1">Состояние</label>
              <select
                id="condition"
                {...register("condition", { required: true })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Выберите...</option>
                <option value="new">Новый</option>
                <option value="used">Б/у</option>
                <option value="for_parts">На запчасти</option>
              </select>
            </div>
            <p className="text-sm text-gray-500">Валюта: EUR (фиксировано)</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Категория</h2>
            <div>
              <label htmlFor="category_id" className="block mb-1">Категория</label>
              <select
                id="category_id"
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
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Локация</h2>
            <div>
              <label htmlFor="location" className="block mb-1">Локация</label>
              <input
                type="text"
                id="location"
                {...register("location")}
                placeholder="Например: Brussels"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Характеристики товара</h2>
            <div className="space-y-2">
              {specificsFields.map((field, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Ключ (например, год)"
                    value={field.key}
                    onChange={(e) => updateSpecificsField(index, "key", e.target.value)}
                    className="w-1/2 border rounded px-3 py-2"
                  />
                  <input
                    type="text"
                    placeholder="Значение (например, 2015)"
                    value={field.value}
                    onChange={(e) => updateSpecificsField(index, "value", e.target.value)}
                    className="w-1/2 border rounded px-3 py-2"
                  />
                  <Button type="button" onClick={() => removeSpecificsField(index)} variant="outline">
                    Удалить
                  </Button>
                </div>
              ))}
              <Button type="button" onClick={addSpecificsField} variant="outline">
                Добавить характеристику
              </Button>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Фотографии</h2>
            <UploadGallery advertId={advertId} />
          </section>

          <Button type="submit" className="w-full">
            {editId ? "Обновить и опубликовать" : "Опубликовать"}
          </Button>
        </form>
      ) : (
        <p>Сначала создайте черновик (или откройте страницу с параметром ?edit=<id>)</p>
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
