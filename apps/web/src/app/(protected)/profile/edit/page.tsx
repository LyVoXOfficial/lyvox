import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getI18nProps } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Редактировать профиль | LyVoX",
  description: "Редактирование информации профиля",
};

export default async function ProfileEditPage() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/profile/edit");
  }

  // Get profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const { locale, messages } = await getI18nProps();

  return (
    <main className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <Link href="/profile">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Назад к профилю
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Редактировать профиль</CardTitle>
          <CardDescription>
            Обновите информацию вашего профиля
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="display_name">Отображаемое имя</Label>
              <Input
                id="display_name"
                name="display_name"
                type="text"
                defaultValue={profile?.display_name || ""}
                placeholder="Введите ваше имя"
              />
              <p className="text-xs text-muted-foreground">
                Это имя будет видно другим пользователям
              </p>
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email нельзя изменить
              </p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile?.phone || ""}
                placeholder="+32 XXX XX XX XX"
              />
              <p className="text-xs text-muted-foreground">
                Используется для связи с покупателями
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Сохранить изменения
              </Button>
              <Link href="/profile">
                <Button type="button" variant="outline">
                  Отмена
                </Button>
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground mb-4">
              <strong>Примечание:</strong> Редактирование профиля будет реализовано
              в следующей версии с помощью Server Actions.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

