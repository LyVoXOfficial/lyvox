"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiFetch } from "@/lib/fetcher";
import { CURRENT_YEAR, VEHICLE_DATA, VEHICLE_MAKES } from "@/data/vehicles";
import { Button } from "@/components/ui/button";
import UploadGallery from "@/components/upload-gallery";
import type { Category } from "@/lib/types";

type FormData = {
  title: string;
  description: string;
  price: number | null;
  category_id: string;
  location: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_mileage: string;
  vehicle_condition: string;
};

function PostPageInner() {
  const sp = useSearchParams();
  const editId = useMemo(() => sp.get("edit"), [sp]);

  const [userId, setUserId] = useState<string | null>(null);
  const [advertId, setAdvertId] = useState<string | null>(editId || null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState<boolean>(!!editId);

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: {
      title: "",
      description: "",
      price: null,
      category_id: "",
      location: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_year: "",
      vehicle_mileage: "",
      vehicle_condition: "",
    },
  });

  const selectedCategoryId = watch("category_id");
  const selectedMake = watch("vehicle_make");
  const selectedModelName = watch("vehicle_model");

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const selectedCategoryPath = selectedCategory?.path ?? "";
  const isTransportCategory = useMemo(
    () => selectedCategoryPath.startsWith("transport"),
    [selectedCategoryPath],
  );
  const isPassengerVehicleCategory = useMemo(
    () => selectedCategoryPath.includes("transport/legkovye-avtomobili"),
    [selectedCategoryPath],
  );

  const vehicleModels = useMemo(
    () => (isPassengerVehicleCategory && selectedMake ? VEHICLE_DATA[selectedMake] ?? [] : []),
    [isPassengerVehicleCategory, selectedMake],
  );

  const selectedModel = useMemo(
    () => vehicleModels.find((model) => model.name === selectedModelName) ?? null,
    [vehicleModels, selectedModelName],
  );

  const yearOptions = useMemo(() => {
    if (!isPassengerVehicleCategory || !selectedModel) return [];
    const end = selectedModel.yearEnd ?? CURRENT_YEAR;
    const years: string[] = [];
    for (let y = end; y >= selectedModel.yearStart; y -= 1) {
      years.push(String(y));
    }
    return years;
  }, [isPassengerVehicleCategory, selectedModel]);

  useEffect(() => {
    if (!isTransportCategory) {
      setValue("vehicle_make", "");
      setValue("vehicle_model", "");
      setValue("vehicle_year", "");
      setValue("vehicle_mileage", "");
      setValue("vehicle_condition", "");
    }
  }, [isTransportCategory, setValue]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase
      .from("categories")
      .select("id,name_ru,level,sort,path")
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
      setValue("vehicle_condition", ad.condition ?? "");

      const { data: specificsData } = await supabase
        .from("ad_item_specifics")
        .select("specifics")
        .eq("advert_id", ad.id)
        .maybeSingle();

      const specifics = specificsData?.specifics as Record<string, unknown> | null;
      if (specifics) {
        const vehicleMake =
          typeof specifics["vehicle_make"] === "string" ? (specifics["vehicle_make"] as string) : "";
        const vehicleModel =
          typeof specifics["vehicle_model"] === "string" ? (specifics["vehicle_model"] as string) : "";
        const vehicleYear =
          typeof specifics["vehicle_year"] === "number" || typeof specifics["vehicle_year"] === "string"
            ? String(specifics["vehicle_year"])
            : "";
        const vehicleMileage =
          typeof specifics["vehicle_mileage"] === "number" || typeof specifics["vehicle_mileage"] === "string"
            ? String(specifics["vehicle_mileage"])
            : "";

        if (vehicleMake) setValue("vehicle_make", vehicleMake);
        if (vehicleModel) setValue("vehicle_model", vehicleModel);
        if (vehicleYear) setValue("vehicle_year", vehicleYear);
        if (vehicleMileage) setValue("vehicle_mileage", vehicleMileage);
      }
      setLoading(false);
    })();
  }, [editId, setValue]);

  const createDraft = async () => {
    if (!userId) return alert("������, �⮡� ᮧ���� �������");
    setCreating(true);
    try {
      const response = await apiFetch("/api/adverts", { method: "POST" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error ?? "CREATE_FAILED");
      }
      const categoryId: string = payload.advert?.category_id ?? "";
      setAdvertId(payload.advert.id);
      reset({
        title: "",
        description: "",
        price: null,
        category_id: categoryId,
        location: "",
        vehicle_make: "",
        vehicle_model: "",
        vehicle_year: "",
        vehicle_mileage: "",
        vehicle_condition: "",
      });
      const url = new URL(window.location.href);
      url.searchParams.set("edit", payload.advert.id);
      window.history.replaceState(null, "", url.toString());
    } catch (err) {
      console.error("CREATE_DRAFT_ERROR", err);
      alert("�訡�� ᮧ����� �୮����. ��������");
    } finally {
      setCreating(false);
    }
  };  const onSubmit = async (values: FormData) => {
    if (!values.title?.trim()) return alert("?????? ????????");
    if (!values.category_id) return alert("???? ??????");

    if (!advertId) {
      alert("????? ????? ?????");
      return;
    }

    const normalizedMake = values.vehicle_make.trim();
    const normalizedModel = values.vehicle_model.trim();
    const vehicleYear = values.vehicle_year ? Number(values.vehicle_year) : null;
    const vehicleMileage = values.vehicle_mileage ? Number(values.vehicle_mileage) : null;
    const transportModels = normalizedMake ? VEHICLE_DATA[normalizedMake] ?? [] : [];
    const modelMeta = transportModels.find((model) => model.name === normalizedModel) ?? null;

    if (isPassengerVehicleCategory) {
      if (!normalizedMake) return alert("???? ?????");
      if (!normalizedModel) return alert("???? ??????");
      if (!values.vehicle_year) return alert("???? ??? ???????");
      if (!modelMeta) return alert("??? ?????? ?? ??????");
      if (vehicleYear === null || Number.isNaN(vehicleYear)) return alert("???????? ??? ???????? ???");

      const maxYear = modelMeta.yearEnd ?? CURRENT_YEAR;
      if (vehicleYear < modelMeta.yearStart || vehicleYear > maxYear) {
        return alert(`???? ???????? ?? ${modelMeta.yearStart} ?? ${maxYear}`);
      }

      if (!values.vehicle_mileage) return alert("???? ?????? ??????? (????)");
      if (vehicleMileage === null || Number.isNaN(vehicleMileage) || vehicleMileage < 0) {
        return alert("???????? ???????? ?????????");
      }

      if (!values.vehicle_condition) return alert("???? ??????? ???????? ?????????");
    }

    const vehiclePayload = isPassengerVehicleCategory
      ? {
          make: normalizedMake,
          model: normalizedModel,
          year: vehicleYear,
          mileage: vehicleMileage,
          condition: values.vehicle_condition,
        }
      : undefined;

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
          status: "active",
          vehicle: vehiclePayload,
        }),
      });

      const payload = await response.json();
      if (!payload.ok) {
        console.error("ADVERT_UPDATE_ERROR", payload);
        alert("???? ???????: " + (payload.error ?? "unknown"));
        return;
      }

      alert("???????? ??????????!");
      window.location.href = `/ad/${advertId}`;
    } catch (err) {
      console.error("ADVERT_UPDATE_EXCEPTION", err);
      alert("������ ������. �������� �����.");
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

          {isTransportCategory ? (
            <div className="space-y-4 border rounded px-4 py-4">
              {!isPassengerVehicleCategory ? (
                <p className="text-sm text-muted-foreground">
                  Select the "Legkovye avtomobili" subcategory to provide make, model, and year details.
                </p>
              ) : null}
              <div>
                <label className="block mb-1">?????</label>
                <select
                  {...register("vehicle_make", {
                    onChange: (event) => {
                      const newMake = event.target.value;
                      if (!newMake || newMake !== selectedMake) {
                        setValue("vehicle_model", "");
                        setValue("vehicle_year", "");
                      }
                    },
                  })}
                  className="w-full border rounded px-3 py-2"
                  disabled={!isPassengerVehicleCategory}
                >
                  <option value="">????...</option>
                  {VEHICLE_MAKES.map((make) => (
                    <option key={make} value={make}>
                      {make}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1">??????</label>
                <select
                  {...register("vehicle_model", {
                    onChange: (event) => {
                      const newModel = event.target.value;
                      if (!newModel || newModel !== selectedModelName) {
                        setValue("vehicle_year", "");
                      }
                    },
                  })}
                  className="w-full border rounded px-3 py-2"
                  disabled={!isPassengerVehicleCategory || !selectedMake}
                >
                  <option value="">{selectedMake ? "????..." : "?????? ?? ?????"}</option>
                  {vehicleModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1">???</label>
                <select
                  {...register("vehicle_year")}
                  className="w-full border rounded px-3 py-2"
                  disabled={!isPassengerVehicleCategory || !selectedModel}
                >
                  <option value="">{selectedModel ? "????..." : "?????? ??????"}</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1">??????? (????)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  {...register("vehicle_mileage")}
                  className="w-full border rounded px-3 py-2"
                  disabled={!isPassengerVehicleCategory}
                />
              </div>

              <div>
                <label className="block mb-1">???????? ?????????</label>
                <select
                  {...register("vehicle_condition")}
                  className="w-full border rounded px-3 py-2"
                  disabled={!isPassengerVehicleCategory}
                >
                  <option value="">????...</option>
                  <option value="new">?????</option>
                  <option value="excellent">??????</option>
                  <option value="good">???????</option>
                  <option value="needs_repair">??????? ????????</option>
                </select>
              </div>

              {selectedModel ? (
                <p className="text-sm text-muted-foreground">
                  ????? ????: {selectedModel.bodyType}. ??????: {selectedModel.country}.
                </p>
              ) : null}
            </div>
          ) : null}

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
