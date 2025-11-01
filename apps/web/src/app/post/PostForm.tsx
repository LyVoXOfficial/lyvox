"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Category } from "@/lib/types";
import { apiFetch } from "@/lib/fetcher";
import UploadGallery from "@/components/upload-gallery";

// Schema for validation - соответствует требованиям API из docs/API_REFERENCE.md
const formSchema = z.object({
  title: z.string().min(3, "Название должно содержать минимум 3 символа").max(100),
  description: z.string().min(10, "Описание должно содержать минимум 10 символов").max(4000).optional().or(z.literal("")),
  price: z.coerce.number().nonnegative("Цена должна быть положительной или 0").nullable().optional(),
  category_id: z.string().uuid("Нужно выбрать категорию"),
  condition: z.enum(["new", "used", "for_parts"]).optional(),
  location: z.string().max(100).optional().or(z.literal("")),
  currency: z.enum(["EUR", "USD", "GBP", "RUB"]).default("EUR"),
});

type FormData = z.infer<typeof formSchema>;

type PostFormProps = {
  categories: Category[];
  userId: string;
  advertToEdit?: any; // Simplified for now
};

const STEPS = {
  DETAILS: 1,
  PHOTOS: 2,
  CONFIRM: 3,
};

export function PostForm({ categories, userId, advertToEdit }: PostFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(STEPS.DETAILS);
  const [isLoading, setIsLoading] = useState(false);
  const [advertId, setAdvertId] = useState<string | null>(advertToEdit?.id ?? null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: advertToEdit?.title ?? "",
      description: advertToEdit?.description ?? "",
      price: advertToEdit?.price ?? null,
      category_id: advertToEdit?.category_id ?? "",
      condition: advertToEdit?.condition ?? undefined,
      location: advertToEdit?.location ?? "",
      currency: advertToEdit?.currency ?? "EUR",
    },
  });
  
  const onSubmit = async (values: FormData) => {
    setIsLoading(true);
    const method = advertId ? "PATCH" : "POST";
    const endpoint = advertId ? `/api/adverts/${advertId}` : "/api/adverts";

    try {
      let response: Response;

      if (advertId) {
        // PATCH - обновление существующего объявления
        // Подготовка данных согласно требованиям API
        // Преобразуем пустые строки в null для опциональных полей
        const payload: Record<string, unknown> = {
          title: values.title,
          category_id: values.category_id,
          currency: values.currency || "EUR",
        };

        // Опциональные поля - только если не пустые
        if (values.description && values.description.trim().length >= 10) {
          payload.description = values.description;
        }

        if (values.price !== null && values.price !== undefined && values.price >= 0) {
          payload.price = values.price;
        } else {
          payload.price = null;
        }

        if (values.location && values.location.trim().length > 0) {
          payload.location = values.location.trim();
        } else {
          payload.location = null;
        }

        if (values.condition) {
          payload.condition = values.condition;
        }

        response = await apiFetch(endpoint, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        // POST - создание нового черновика (без body согласно API_REFERENCE.md)
        response = await apiFetch(endpoint, {
          method: "POST",
        });
        
        const createResult = await response.json();
        if (!createResult.ok) {
          throw new Error(createResult.message || createResult.error || "Не удалось создать черновик");
        }

        const newAdvertId = createResult.data?.advert?.id || createResult.advert?.id;
        if (!newAdvertId) {
          throw new Error("Не получен ID созданного объявления");
        }
        setAdvertId(newAdvertId);

        // Теперь обновляем созданный черновик с данными формы
        const updatePayload: Record<string, unknown> = {
          title: values.title,
          category_id: values.category_id,
          currency: values.currency || "EUR",
        };

        if (values.description && values.description.trim().length >= 10) {
          updatePayload.description = values.description;
        }

        if (values.price !== null && values.price !== undefined && values.price >= 0) {
          updatePayload.price = values.price;
        } else {
          updatePayload.price = null;
        }

        if (values.location && values.location.trim().length > 0) {
          updatePayload.location = values.location.trim();
        } else {
          updatePayload.location = null;
        }

        if (values.condition) {
          updatePayload.condition = values.condition;
        }

        response = await apiFetch(`/api/adverts/${newAdvertId}`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        });
      }
      const result = await response.json();

      if (!result.ok) {
        const errorMessage = result.message || result.error || "Не удалось сохранить черновик";
        throw new Error(errorMessage);
      }
      
      // Для PATCH может вернуться advert в result, но ID уже есть в state
      // Для POST уже установили setAdvertId выше
      if (!advertId) {
        // Если все еще нет ID, попробуем получить из результата
        const returnedAdvertId = result.data?.advert?.id || result.advert?.id;
        if (returnedAdvertId) {
          setAdvertId(returnedAdvertId);
        }
      }
      
      toast.success("Черновик сохранен!");
      setStep(STEPS.PHOTOS);

    } catch (error: any) {
      toast.error("Ошибка", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const onPublish = async () => {
    if (!advertId) return;
    setIsLoading(true);
    try {
       const response = await apiFetch(`/api/adverts/${advertId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: 'active' }),
      });
      const result = await response.json();
       if (!result.ok) {
        const errorMessage = result.message || result.error || "Не удалось опубликовать";
        throw new Error(errorMessage);
      }
      toast.success("Объявление опубликовано!");
      router.push(`/ad/${advertId}`);
      router.refresh();

    } catch (error: any) {
       toast.error("Ошибка", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{advertId ? "Редактирование" : "Новое объявление"} - Шаг {step} из 3</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {step === STEPS.DETAILS && (
              <>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input placeholder="Например, iPhone 15 Pro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Категория</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите категорию" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name_ru}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание (опционально, минимум 10 символов)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Расскажите подробнее о товаре..." 
                          {...field} 
                          value={field.value ?? ""}
                          rows={5} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Цена (опционально)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0 или пусто" 
                            min="0"
                            step="0.01"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseFloat(e.target.value);
                              field.onChange(isNaN(val as number) ? null : val);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Валюта</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || "EUR"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="EUR" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="RUB">RUB (₽)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Состояние (опционально)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите состояние" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">Новое</SelectItem>
                            <SelectItem value="used">Б/у</SelectItem>
                            <SelectItem value="for_parts">На запчасти</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Местоположение (опционально)</FormLabel>
                        <FormControl>
                          <Input placeholder="Город или адрес" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {step === STEPS.PHOTOS && (
              <div>
                <h3 className="text-lg font-medium mb-4">Фотографии</h3>
                <p className="text-sm text-muted-foreground mb-4">Добавьте до 10 фотографий. Первое фото будет главным.</p>
                {advertId ? <UploadGallery advertId={advertId} /> : <p>Сначала сохраните черновик, чтобы добавить фото.</p>}
              </div>
            )}
            
            {step === STEPS.CONFIRM && (
               <div>
                <h3 className="text-lg font-medium mb-4">Проверьте и опубликуйте</h3>
                <p className="text-sm text-muted-foreground">Ваше объявление готово к публикации. Нажмите "Опубликовать", чтобы разместить его на сайте.</p>
              </div>
            )}

          </CardContent>
          <CardFooter className="flex justify-between">
            {step > STEPS.DETAILS && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Назад</Button>}
            {step === STEPS.DETAILS && <Button type="submit" disabled={isLoading}>Сохранить и к фото</Button>}
            {step === STEPS.PHOTOS && <Button type="button" onClick={() => setStep(STEPS.CONFIRM)}>Далее</Button>}
            {step === STEPS.CONFIRM && <Button type="button" onClick={onPublish} disabled={isLoading}>Опубликовать</Button>}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}