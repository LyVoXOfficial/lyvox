"use client";

import { useState } from "react";
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
import { Shield, Smartphone, Trash2, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { useTOTP, type TOTPFactor } from "@/hooks/useTOTP";
import { TOTPEnrollment } from "./TOTPEnrollment";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface TOTPSettingsProps {
  className?: string;
}

export function TOTPSettings({ className }: TOTPSettingsProps) {
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [factorToRemove, setFactorToRemove] = useState<string | null>(null);
  const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);

  const { factors, isLoading, unenroll, refresh } = useTOTP({
    autoLoad: true,
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleRemove = async (factorId: string) => {
    setRemovingFactorId(factorId);

    try {
      const success = await unenroll(factorId);

      if (success) {
        toast.success("Аутентификатор удален");
        setFactorToRemove(null);
      } else {
        toast.error("Не удалось удалить аутентификатор");
      }
    } catch (error) {
      toast.error("Произошла ошибка");
    } finally {
      setRemovingFactorId(null);
    }
  };

  const handleEnrollmentSuccess = () => {
    setShowEnrollment(false);
    refresh();
    toast.success("Двухфакторная аутентификация настроена!");
  };

  if (showEnrollment) {
    return (
      <div className={className}>
        <TOTPEnrollment
          onSuccess={handleEnrollmentSuccess}
          onCancel={() => setShowEnrollment(false)}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Двухфакторная аутентификация (TOTP)
          </CardTitle>
          <CardDescription>
            Защитите свой аккаунт с помощью приложения-аутентификатора
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Banner */}
          {factors.length > 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    2FA включена
                  </h3>
                  <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                    Ваш аккаунт защищен двухфакторной аутентификацией
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
              <div className="flex items-start gap-3">
                <Shield className="size-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                    2FA отключена
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                    Рекомендуем включить для дополнительной защиты аккаунта
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Factors List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : factors.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Ваши аутентификаторы:</h4>
              {factors.map((factor) => (
                <FactorCard
                  key={factor.id}
                  factor={factor}
                  onRemove={() => setFactorToRemove(factor.id)}
                  isRemoving={removingFactorId === factor.id}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              Аутентификаторы не настроены
            </p>
          )}

          {/* Add Button */}
          <Button
            onClick={() => setShowEnrollment(true)}
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            <Plus className="mr-2 size-4" />
            Добавить аутентификатор
          </Button>

          {/* Info */}
          <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <p className="font-medium">Как это работает:</p>
            <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
              <li>Установите приложение-аутентификатор (Google Authenticator, Authy и т.д.)</li>
              <li>Отсканируйте QR-код в приложении</li>
              <li>Введите 6-значный код для подтверждения</li>
              <li>При следующем входе нужно будет ввести код из приложения</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={factorToRemove !== null} onOpenChange={() => setFactorToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить аутентификатор?</AlertDialogTitle>
            <AlertDialogDescription>
              После удаления вам больше не потребуется вводить код при входе.
              Это снизит безопасность вашего аккаунта.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => factorToRemove && handleRemove(factorToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Factor Card Component
// ============================================================================

interface FactorCardProps {
  factor: TOTPFactor;
  onRemove: () => void;
  isRemoving: boolean;
}

function FactorCard({ factor, onRemove, isRemoving }: FactorCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="rounded-full bg-primary/10 p-2">
            <Smartphone className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{factor.friendly_name || "Authenticator App"}</p>
              {factor.status === "verified" ? (
                <Badge variant="default" className="text-xs">
                  Активен
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Не подтвержден
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Добавлен {formatDistanceToNow(new Date(factor.created_at), { addSuffix: true, locale: ru })}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={isRemoving}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {isRemoving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

