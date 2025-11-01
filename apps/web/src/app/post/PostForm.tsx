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

// Schema for validation
const formSchema = z.object({
  title: z.string().min(5, "Слишком короткое название").max(100),
  description: z.string().min(20, "Слишком короткое описание").max(4000),
  price: z.number().positive("Цена должна быть положительной"),
  category_id: z.string().min(1, "Нужно выбрать категорию"),
  condition: z.enum(["new", "used", "for_parts"]),
  location: z.string().min(3, "Укажите местоположение").max(100),
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
      price: advertToEdit?.price ?? undefined, // Allow undefined for price
      category_id: advertToEdit?.category_id ?? "",
      condition: advertToEdit?.condition ?? "used",
      location: advertToEdit?.location ?? "",
    },
  });
  
  const onSubmit = async (values: FormData) => {
    setIsLoading(true);
    const method = advertId ? "PATCH" : "POST";
    const endpoint = advertId ? `/api/adverts/${advertId}` : "/api/adverts";

    try {
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify({ ...values, status: 'draft' }), // Save as draft initially
      });
      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || "Не удалось сохранить черновик");
      }
      
      const newAdvertId = result.advert.id;
      setAdvertId(newAdvertId);
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
        throw new Error(result.error || "Не удалось опубликовать");
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
                      <FormLabel>Описание</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Расскажите подробнее о товаре..." {...field} rows={5} />
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
                        <FormLabel>Цена (€)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Состояние</FormLabel>
                         <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                </div>
                 <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Местоположение</FormLabel>
                      <FormControl>
                        <Input placeholder="Город или адрес" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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