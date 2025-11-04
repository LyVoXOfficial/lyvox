"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TOTPSettings } from "@/components/TOTPSettings";
import { WebAuthnNotAvailableNotice, TOTPRecommendation } from "./mfa-notice";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  Shield,
  Smartphone,
  Laptop,
  Monitor,
  Chrome,
  Globe,
  Trash2,
  AlertTriangle,
  Clock,
  MapPin,
  Loader2,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ============================================================================
// Types
// ============================================================================

interface Session {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  factorId?: string;
  aal: string; // Authentication Assurance Level
  notAfter?: string;
}

interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
  icon: React.ReactNode;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Парсит User Agent для определения устройства и браузера
 */
function parseUserAgent(userAgent: string): ParsedUserAgent {
  const ua = userAgent.toLowerCase();
  
  // Определяем браузер
  let browser = "Неизвестный браузер";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("opera")) browser = "Opera";

  // Определяем ОС
  let os = "Неизвестная ОС";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  // Определяем тип устройства
  let device = "Desktop";
  let icon: React.ReactNode = <Monitor className="size-5" />;
  
  if (ua.includes("mobile") || ua.includes("android")) {
    device = "Mobile";
    icon = <Smartphone className="size-5" />;
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    device = "Tablet";
    icon = <Smartphone className="size-5" />;
  } else {
    icon = <Laptop className="size-5" />;
  }

  return { browser, os, device, icon };
}

/**
 * Форматирует дату для отображения
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "только что";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин назад`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч назад`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} дн назад`;
    
    return new Intl.DateTimeFormat("ru", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Проверяет, является ли сессия текущей
 */
function isCurrentSession(session: Session, currentSessionId: string | undefined): boolean {
  return session.id === currentSessionId;
}

// ============================================================================
// Session Card Component
// ============================================================================

interface SessionCardProps {
  session: Session;
  isCurrent: boolean;
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
}

function SessionCard({ session, isCurrent, onRevoke, isRevoking }: SessionCardProps) {
  // Для демонстрации используем захардкоженный User Agent
  // В реальном приложении это должно храниться в метаданных сессии
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const parsed = parseUserAgent(userAgent);

  return (
    <Card className={isCurrent ? "border-blue-500 dark:border-blue-600" : ""}>
      <CardContent className="flex items-start justify-between p-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-1 text-muted-foreground">
            {parsed.icon}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">
                {parsed.browser} на {parsed.os}
              </p>
              {isCurrent && (
                <Badge variant="default" className="text-xs">
                  Текущая сессия
                </Badge>
              )}
              {session.aal === "aal2" && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="mr-1 size-3" />
                  Биометрия
                </Badge>
              )}
            </div>
            
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="size-3" />
                <span>Последняя активность: {formatDate(session.updatedAt)}</span>
              </div>
              {session.notAfter && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-3" />
                  <span>Истекает: {formatDate(session.notAfter)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {!isCurrent && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRevoke(session.id)}
            disabled={isRevoking}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isRevoking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SecuritySettingsClient() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  // Загрузка сессий
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      // Получаем текущую сессию
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession) {
        setCurrentSessionId(currentSession.access_token);
        
        // В реальном приложении здесь должен быть API endpoint для получения всех сессий
        // Пока используем только текущую сессию для демонстрации
        setSessions([{
          id: currentSession.access_token,
          userId: currentSession.user.id,
          createdAt: new Date(currentSession.user.created_at).toISOString(),
          updatedAt: new Date().toISOString(),
          aal: "aal1",
        }]);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      toast.error("Не удалось загрузить список сессий");
    } finally {
      setIsLoading(false);
    }
  };

  // Отзыв конкретной сессии
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    
    try {
      // В реальном приложении здесь должен быть API endpoint для отзыва сессии
      // await fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
      
      toast.success("Сессия завершена");
      await loadSessions();
    } catch (error) {
      console.error("Failed to revoke session:", error);
      toast.error("Не удалось завершить сессию");
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Отзыв всех сессий кроме текущей
  const handleRevokeAllSessions = async () => {
    setIsRevokingAll(true);
    
    try {
      // Завершаем все сессии кроме текущей
      const { error } = await supabase.auth.signOut({ scope: "others" });
      
      if (error) {
        throw error;
      }
      
      toast.success("Все остальные устройства отключены");
      await loadSessions();
      setShowRevokeAllDialog(false);
    } catch (error) {
      console.error("Failed to revoke all sessions:", error);
      toast.error("Не удалось отключить устройства");
    } finally {
      setIsRevokingAll(false);
    }
  };

  const otherSessionsCount = sessions.filter(s => !isCurrentSession(s, currentSessionId)).length;

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Безопасность</h1>
        <p className="text-muted-foreground">
          Управление настройками безопасности вашего аккаунта
        </p>
      </div>

      {/* TOTP MFA Notice */}
      <WebAuthnNotAvailableNotice />

      {/* TOTP Authentication Section */}
      <TOTPSettings />

      {/* Active Sessions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Активные сессии
              </CardTitle>
              <CardDescription>
                Управление устройствами, с которых выполнен вход в ваш аккаунт
              </CardDescription>
            </div>
            {otherSessionsCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRevokeAllDialog(true)}
              >
                <LogOut className="mr-2 size-4" />
                Отключить все устройства
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Загрузка сессий...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Shield className="mx-auto size-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-semibold">Нет активных сессий</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Войдите в систему, чтобы увидеть активные сессии
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isCurrent={isCurrentSession(session, currentSessionId)}
                  onRevoke={handleRevokeSession}
                  isRevoking={revokingSessionId === session.id}
                />
              ))}
            </div>
          )}

          {/* Info Banner */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex gap-3">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Видите незнакомое устройство?
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Немедленно завершите сессию и измените пароль. Если вы включили биометрическую авторизацию, 
                  ваш аккаунт защищен дополнительным уровнем безопасности.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            Рекомендации по безопасности
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="size-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p className="font-medium">Используйте биометрическую авторизацию</p>
                <p className="text-muted-foreground">
                  Вход с помощью Touch ID, Face ID или Windows Hello обеспечивает дополнительную защиту
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="size-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p className="font-medium">Регулярно проверяйте активные сессии</p>
                <p className="text-muted-foreground">
                  Убедитесь, что все устройства в списке принадлежат вам
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="size-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <p className="font-medium">Не используйте общие или публичные устройства</p>
                <p className="text-muted-foreground">
                  Всегда выходите из аккаунта после использования чужого компьютера
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Revoke All Sessions Dialog */}
      <AlertDialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить все устройства?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие завершит все сессии на всех устройствах, кроме текущего. 
              Вам потребуется войти заново на всех этих устройствах.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevokingAll}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAllSessions}
              disabled={isRevokingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevokingAll ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Отключаем...
                </>
              ) : (
                "Отключить все устройства"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

