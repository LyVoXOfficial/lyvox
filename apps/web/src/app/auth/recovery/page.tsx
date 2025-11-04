"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, AlertCircle, Mail, ArrowLeft } from "lucide-react";

function RecoveryPageInner() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        toast.error("Ошибка отправки ссылки для восстановления");
      } else {
        setSent(true);
        toast.success("Ссылка для восстановления отправлена на email");
      }
    } catch (err) {
      toast.error("Не удалось отправить ссылку. Проверьте подключение к интернету");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <Mail className="size-6 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-semibold">Проверьте ваш email</h1>
          <p className="text-sm text-muted-foreground">
            Мы отправили ссылку для восстановления доступа на <strong>{email}</strong>
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="flex gap-3">
            <AlertCircle className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Не получили письмо?
              </p>
              <ul className="list-inside list-disc text-blue-700 dark:text-blue-300">
                <li>Проверьте папку Спам</li>
                <li>Убедитесь, что email указан правильно</li>
                <li>Попробуйте отправить ссылку повторно через несколько минут</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setSent(false)}
          >
            Отправить повторно
          </Button>
          <Link href="/login">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="mr-2 size-4" />
              Вернуться ко входу
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Восстановление доступа</h1>
        <p className="text-sm text-muted-foreground">
          Введите ваш email, и мы отправим вам ссылку для сброса пароля
        </p>
      </div>

      <form onSubmit={handleRecovery} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email адрес
          </label>
          <input
            id="email"
            type="email"
            placeholder="ваш-email@example.com"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Отправляем ссылку...
            </>
          ) : (
            "Отправить ссылку для восстановления"
          )}
        </Button>
      </form>

      <div className="text-center">
        <Link href="/login">
          <Button variant="ghost" className="text-sm">
            <ArrowLeft className="mr-2 size-4" />
            Вернуться ко входу
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function RecoveryPage() {
  return (
    <Suspense fallback={<p>Загрузка...</p>}>
      <RecoveryPageInner />
    </Suspense>
  );
}

