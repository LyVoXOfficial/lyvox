import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mail, Phone, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { VerifyEmailClient } from "./VerifyEmailClient";
import { VerifyPhoneClient } from "./VerifyPhoneClient";

export const metadata = {
  title: "Верификация аккаунта | LyVoX",
  description: "Подтвердите email и телефон для размещения объявлений",
};

export default async function VerifyPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/verify");
  }

  // Get profile verification status
  const { data: profile } = await supabase
    .from("profiles")
    .select("verified_email, verified_phone, phone")
    .eq("id", user.id)
    .maybeSingle();

  const verifiedEmail = profile?.verified_email ?? false;
  const verifiedPhone = profile?.verified_phone ?? false;
  const phone = profile?.phone;

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

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Верификация аккаунта</h1>
          <p className="text-muted-foreground mt-2">
            Подтвердите email и телефон, чтобы размещать объявления
          </p>
        </div>

        {/* Verification Status Alert */}
        {!verifiedEmail || !verifiedPhone ? (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="size-5 text-amber-600 dark:text-amber-500" />
                <CardTitle className="text-amber-900 dark:text-amber-100">
                  Требуется верификация
                </CardTitle>
              </div>
              <CardDescription className="text-amber-800 dark:text-amber-200">
                Для размещения объявлений необходимо подтвердить email и телефон.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-600 dark:text-green-500" />
                <CardTitle className="text-green-900 dark:text-green-100">
                  Аккаунт полностью верифицирован
                </CardTitle>
              </div>
              <CardDescription className="text-green-800 dark:text-green-200">
                Вы можете размещать объявления без ограничений.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/post">
                <Button>Разместить объявление</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Email Verification Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="size-5" />
                <CardTitle>Email адрес</CardTitle>
              </div>
              {verifiedEmail ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="mr-1 size-3" />
                  Подтвержден
                </Badge>
              ) : (
                <Badge variant="destructive">Не подтвержден</Badge>
              )}
            </div>
            <CardDescription>
              {user.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verifiedEmail ? (
              <p className="text-sm text-muted-foreground">
                Ваш email подтвержден. Вы будете получать уведомления на этот адрес.
              </p>
            ) : (
              <VerifyEmailClient email={user.email!} />
            )}
          </CardContent>
        </Card>

        {/* Phone Verification Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="size-5" />
                <CardTitle>Номер телефона</CardTitle>
              </div>
              {verifiedPhone ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="mr-1 size-3" />
                  Подтвержден
                </Badge>
              ) : (
                <Badge variant="destructive">Не подтвержден</Badge>
              )}
            </div>
            <CardDescription>
              {phone || "Телефон не указан"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verifiedPhone ? (
              <p className="text-sm text-muted-foreground">
                Ваш телефон подтвержден. Покупатели смогут связаться с вами по этому номеру.
              </p>
            ) : (
              <VerifyPhoneClient userId={user.id} currentPhone={phone} />
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>Нужна помощь?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Не получили письмо?</strong> Проверьте папку "Спам" или запросите повторно.
            </p>
            <p>
              <strong>Проблемы с телефоном?</strong> Убедитесь, что номер указан в международном формате.
            </p>
            <p>
              <strong>Всё ещё нужна помощь?</strong>{" "}
              <Link href="/contacts" className="text-primary underline">
                Свяжитесь с нами
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

