"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { loginSchema } from "@/lib/validations/auth";
import { logger } from "@/lib/errorLogger";
import { Loader2, Mail, Lock, Chrome } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { FaGoogle, FaFacebook, FaGithub } from "react-icons/fa";

function LoginPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [activeTab, setActiveTab] = useState<"password" | "magic-link">("password");

  // Display errors from callback redirect
  const callbackError = searchParams.get("error");
  const callbackMessage = searchParams.get("message");

  // Show callback errors on mount
  useEffect(() => {
    if (callbackError && callbackMessage) {
      toast.error(callbackMessage, { id: callbackError });
    }
  }, [callbackError, callbackMessage]);

  // Real-time validation while typing (only after user touched the field)
  useEffect(() => {
    if (!touched || !email) {
      setValidationError(null);
      return;
    }

    const validationResult = loginSchema.safeParse({ email: email.trim() });
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      setValidationError(firstError.message);
    } else {
      setValidationError(null);
    }
  }, [email, touched]);

  // Password login handler
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationError(null);

    try {
      // Client-side validation
      const validationResult = loginSchema.safeParse({ email: email.trim() });
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        setValidationError(firstError.message);
        toast.error(firstError.message);
        return;
      }

      if (!password || password.length < 8) {
        setValidationError("Пароль должен содержать минимум 8 символов");
        toast.error("Пароль должен содержать минимум 8 символов");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validationResult.data.email,
        password,
      });

      if (error) {
        // Handle specific Supabase errors
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Неверный email или пароль");
        } else if (error.message.includes("Email not confirmed")) {
          toast.error("Пожалуйста, подтвердите ваш email перед входом");
        } else if (error.message.includes("Too many requests")) {
          toast.error("Слишком много попыток. Попробуйте позже");
        } else {
          toast.error("Ошибка входа. Попробуйте позже");
        }
        logger.error("Password login failed", {
          component: "LoginPage",
          action: "handlePasswordLogin",
          metadata: {
            code: error.status,
            email: validationResult.data.email,
          },
          error,
        });
      } else if (data.session) {
        toast.success("Вход выполнен успешно");
        const next = searchParams.get("next") ?? "/profile";
        router.push(next);
      }
    } catch (err) {
      logger.error("Password login exception", {
        component: "LoginPage",
        action: "handlePasswordLogin",
        error: err,
      });
      toast.error("Не удалось подключиться к серверу. Проверьте интернет-соединение");
    } finally {
      setLoading(false);
    }
  };

  // Magic link login handler
  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationError(null);

    try {
      const validationResult = loginSchema.safeParse({ email: email.trim() });
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        setValidationError(firstError.message);
        toast.error(firstError.message);
        return;
      }

      const redirectUrl = new URL("/auth/callback", window.location.origin);
      const next = searchParams.get("next") ?? "/profile";
      redirectUrl.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOtp({
        email: validationResult.data.email,
        options: { 
          emailRedirectTo: redirectUrl.toString(),
          shouldCreateUser: false,
          data: {
            rememberDevice,
          },
        },
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          toast.error("Пожалуйста, подтвердите ваш email перед входом");
        } else if (error.message.includes("Invalid email")) {
          toast.error("Неверный формат email");
        } else if (error.message.includes("Too many requests")) {
          toast.error("Слишком много попыток. Попробуйте позже");
        } else if (error.message.includes("User not found")) {
          toast.error("Пользователь не найден. Зарегистрируйтесь сначала");
        } else {
          toast.error("Ошибка входа. Попробуйте позже");
        }
        logger.error("Magic link login failed", {
          component: "LoginPage",
          action: "handleMagicLinkLogin",
          metadata: {
            code: error.status,
            email: validationResult.data.email,
          },
          error,
        });
      } else {
        toast.success("Ссылка для входа отправлена на email");
      }
    } catch (err) {
      logger.error("Magic link login exception", {
        component: "LoginPage",
        action: "handleMagicLinkLogin",
        error: err,
      });
      toast.error("Не удалось подключиться к серверу. Проверьте интернет-соединение");
    } finally {
      setLoading(false);
    }
  };

  // Social OAuth handler
  const handleSocialLogin = async (provider: "google" | "facebook" | "github") => {
    setLoading(true);
    try {
      const redirectUrl = new URL("/auth/callback", window.location.origin);
      const next = searchParams.get("next") ?? "/profile";
      redirectUrl.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl.toString(),
        },
      });

      if (error) {
        toast.error(`Ошибка входа через ${provider}`);
        logger.error("Social login failed", {
          component: "LoginPage",
          action: "handleSocialLogin",
          metadata: { provider },
          error,
        });
      }
    } catch (err) {
      logger.error("Social login exception", {
        component: "LoginPage",
        action: "handleSocialLogin",
        metadata: { provider },
        error: err,
      });
      toast.error("Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  };

  const next = searchParams.get("next");
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Вход в аккаунт</h1>
        <p className="text-sm text-muted-foreground">
          Выберите способ входа в систему
        </p>
      </div>

      {/* Social OAuth Buttons */}
      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => handleSocialLogin("google")}
          disabled={loading}
        >
          <FaGoogle className="mr-2 size-4" />
          Войти через Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => handleSocialLogin("facebook")}
          disabled={loading}
        >
          <FaFacebook className="mr-2 size-4" />
          Войти через Facebook
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-300 dark:border-zinc-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white dark:bg-zinc-950 px-2 text-zinc-500">или</span>
        </div>
      </div>

      {/* Tabs for Password / Magic Link */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "password" | "magic-link")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">
            <Lock className="mr-2 size-4" />
            Пароль
          </TabsTrigger>
          <TabsTrigger value="magic-link">
            <Mail className="mr-2 size-4" />
            Ссылка
          </TabsTrigger>
        </TabsList>

        {/* Password Tab */}
        <TabsContent value="password" className="space-y-4">
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-password">Email адрес</Label>
              <Input
                id="email-password"
                type="email"
                placeholder="ваш-email@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                onBlur={() => setTouched(true)}
                required
                disabled={loading}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? "email-error" : undefined}
              />
              {validationError && (
                <p id="email-error" className="text-sm text-red-600">
                  {validationError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading || !!validationError} 
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Вход...
                </>
              ) : (
                "Войти"
              )}
            </Button>
          </form>
        </TabsContent>

        {/* Magic Link Tab */}
        <TabsContent value="magic-link" className="space-y-4">
          <form onSubmit={handleMagicLinkLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-magic">Email адрес</Label>
              <Input
                id="email-magic"
                type="email"
                placeholder="ваш-email@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                onBlur={() => setTouched(true)}
                required
                disabled={loading}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? "email-error-magic" : undefined}
              />
              {validationError && (
                <p id="email-error-magic" className="text-sm text-red-600">
                  {validationError}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-device"
                checked={rememberDevice}
                onCheckedChange={(checked) => setRememberDevice(checked === true)}
                disabled={loading}
              />
              <label
                htmlFor="remember-device"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Запомнить это устройство на 30 дней
              </label>
            </div>

            <Button 
              type="submit" 
              disabled={loading || !!validationError} 
              variant="outline" 
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Отправляем ссылку...
                </>
              ) : (
                "Отправить ссылку на email"
              )}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {/* Links */}
      <div className="space-y-2 text-center text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">
          Нет аккаунта?{" "}
          <Link href={registerHref} className="font-medium underline hover:text-zinc-900 dark:hover:text-zinc-100">
            Зарегистрироваться
          </Link>
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">
          Забыли пароль?{" "}
          <Link 
            href="/auth/recovery" 
            className="font-medium underline hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Восстановить доступ
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<p>Загрузка...</p>}>
        <LoginPageInner />
      </Suspense>
    </main>
  );
}
