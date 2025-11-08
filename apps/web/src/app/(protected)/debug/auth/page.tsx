"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabaseClient";
import { isWebAuthnSupported, isPlatformAuthenticatorAvailable } from "@/lib/webauthn";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Shield,
  Globe,
  Key,
  Clock,
  Database,
} from "lucide-react";

interface DiagnosticInfo {
  session: {
    exists: boolean;
    userId?: string;
    email?: string;
    expiresAt?: string;
    provider?: string;
    aal?: string;
  };
  environment: {
    supabaseUrl: string;
    nodeEnv: string;
    isLocalhost: boolean;
    isHttps: boolean;
    origin: string;
  };
  webAuthn: {
    supported: boolean;
    platformAvailable: boolean;
    userAgent: string;
  };
  storage: {
    localStorage: boolean;
    sessionStorage: boolean;
    cookies: boolean;
  };
}

export default function AuthDebugPage() {
  const [info, setInfo] = useState<DiagnosticInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDiagnostics = async () => {
    setLoading(true);
    
    try {
      // Get session info
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check WebAuthn support
      const webAuthnSupported = isWebAuthnSupported();
      const platformAvailable = webAuthnSupported 
        ? await isPlatformAuthenticatorAvailable() 
        : false;

      // Check storage availability
      const hasLocalStorage = (() => {
        try {
          localStorage.setItem('test', 'test');
          localStorage.removeItem('test');
          return true;
        } catch {
          return false;
        }
      })();

      const hasSessionStorage = (() => {
        try {
          sessionStorage.setItem('test', 'test');
          sessionStorage.removeItem('test');
          return true;
        } catch {
          return false;
        }
      })();

      const hasCookies = navigator.cookieEnabled;

      const appMetadata = (session?.user?.app_metadata ?? {}) as Record<string, unknown>;
      const userAal =
        typeof appMetadata.aal === "string" ? (appMetadata.aal as string) : null;

      const diagnostics: DiagnosticInfo = {
        session: {
          exists: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : undefined,
          provider: session?.user?.app_metadata?.provider,
          aal: userAal ?? undefined,
        },
        environment: {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set',
          nodeEnv: process.env.NODE_ENV || 'unknown',
          isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
          isHttps: window.location.protocol === 'https:',
          origin: window.location.origin,
        },
        webAuthn: {
          supported: webAuthnSupported,
          platformAvailable,
          userAgent: navigator.userAgent,
        },
        storage: {
          localStorage: hasLocalStorage,
          sessionStorage: hasSessionStorage,
          cookies: hasCookies,
        },
      };

      setInfo(diagnostics);
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  if (loading || !info) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Загрузка диагностики...</span>
        </div>
      </div>
    );
  }

  const StatusIcon = ({ condition }: { condition: boolean }) => {
    return condition ? (
      <CheckCircle2 className="size-5 text-green-600" />
    ) : (
      <XCircle className="size-5 text-red-600" />
    );
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Диагностика авторизации</h1>
        <p className="text-muted-foreground">
          Проверка настроек и доступности функций авторизации
        </p>
      </div>

      {/* Session Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="size-5" />
            <CardTitle>Информация о сессии</CardTitle>
          </div>
          <CardDescription>Текущее состояние авторизации пользователя</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Сессия активна</span>
            <div className="flex items-center gap-2">
              <StatusIcon condition={info.session.exists} />
              <Badge variant={info.session.exists ? "default" : "destructive"}>
                {info.session.exists ? "Да" : "Нет"}
              </Badge>
            </div>
          </div>
          
          {info.session.exists && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">User ID:</span>
                <code className="rounded bg-muted px-2 py-1 text-xs">
                  {info.session.userId}
                </code>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-mono text-xs">{info.session.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Provider:</span>
                <Badge variant="outline">{info.session.provider || 'email'}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">AAL Level:</span>
                <Badge variant="outline">{info.session.aal || 'aal1'}</Badge>
              </div>
              {info.session.expiresAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Истекает:</span>
                  <span className="flex items-center gap-1 text-xs">
                    <Clock className="size-3" />
                    {new Date(info.session.expiresAt).toLocaleString('ru')}
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Environment Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="size-5" />
            <CardTitle>Окружение</CardTitle>
          </div>
          <CardDescription>Настройки и параметры окружения</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">HTTPS</span>
            <div className="flex items-center gap-2">
              <StatusIcon condition={info.environment.isHttps} />
              <Badge variant={info.environment.isHttps ? "default" : "destructive"}>
                {info.environment.isHttps ? "Да" : "Нет"}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Origin:</span>
            <code className="rounded bg-muted px-2 py-1 text-xs">
              {info.environment.origin}
            </code>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Localhost:</span>
            <Badge variant={info.environment.isLocalhost ? "secondary" : "outline"}>
              {info.environment.isLocalhost ? "Да" : "Нет"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Node ENV:</span>
            <Badge variant="outline">{info.environment.nodeEnv}</Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Supabase URL:</span>
            <code className="max-w-xs truncate rounded bg-muted px-2 py-1 text-xs">
              {info.environment.supabaseUrl}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* WebAuthn Support */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-5" />
            <CardTitle>Биометрическая авторизация</CardTitle>
          </div>
          <CardDescription>Поддержка WebAuthn/Passkeys</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">WebAuthn поддерживается</span>
            <div className="flex items-center gap-2">
              <StatusIcon condition={info.webAuthn.supported} />
              <Badge variant={info.webAuthn.supported ? "default" : "destructive"}>
                {info.webAuthn.supported ? "Да" : "Нет"}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Платформенный аутентификатор</span>
            <div className="flex items-center gap-2">
              <StatusIcon condition={info.webAuthn.platformAvailable} />
              <Badge variant={info.webAuthn.platformAvailable ? "default" : "secondary"}>
                {info.webAuthn.platformAvailable ? "Доступен" : "Недоступен"}
              </Badge>
            </div>
          </div>
          
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex gap-2">
              <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  {info.webAuthn.supported 
                    ? info.webAuthn.platformAvailable
                      ? "Биометрия готова к использованию"
                      : "Биометрический сенсор не обнаружен на устройстве"
                    : "Браузер не поддерживает WebAuthn"
                  }
                </p>
                {!info.environment.isHttps && !info.environment.isLocalhost && (
                  <p className="text-amber-700 dark:text-amber-300">
                    ⚠️ WebAuthn требует HTTPS для работы в production
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">User Agent:</p>
            <code className="block rounded bg-muted p-2 text-[10px] leading-tight">
              {info.webAuthn.userAgent}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Storage Support */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="size-5" />
            <CardTitle>Хранилище данных</CardTitle>
          </div>
          <CardDescription>Доступность механизмов хранения</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">localStorage</span>
            <div className="flex items-center gap-2">
              <StatusIcon condition={info.storage.localStorage} />
              <Badge variant={info.storage.localStorage ? "default" : "destructive"}>
                {info.storage.localStorage ? "Доступно" : "Недоступно"}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">sessionStorage</span>
            <div className="flex items-center gap-2">
              <StatusIcon condition={info.storage.sessionStorage} />
              <Badge variant={info.storage.sessionStorage ? "default" : "destructive"}>
                {info.storage.sessionStorage ? "Доступно" : "Недоступно"}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Cookies</span>
            <div className="flex items-center gap-2">
              <StatusIcon condition={info.storage.cookies} />
              <Badge variant={info.storage.cookies ? "default" : "destructive"}>
                {info.storage.cookies ? "Включены" : "Отключены"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Действия</CardTitle>
          <CardDescription>Тестирование и обновление</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            onClick={loadDiagnostics} 
            variant="outline" 
            className="w-full"
          >
            <RefreshCw className="mr-2 size-4" />
            Обновить диагностику
          </Button>
          
          {info.session.exists && (
            <Button 
              onClick={() => supabase.auth.signOut()} 
              variant="destructive"
              className="w-full"
            >
              Выйти из аккаунта
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

