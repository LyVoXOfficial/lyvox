/**
 * BiometricLoginButton - кнопка для входа через биометрию
 * 
 * Показывает кнопку "Войти с биометрией", которая запускает процесс
 * верификации через Touch ID, Face ID, Windows Hello и т.д.
 * 
 * @example
 * <BiometricLoginButton 
 *   onSuccess={() => router.push("/profile")}
 *   variant="outline"
 * />
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { toast } from "sonner";
import { Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";

// ============================================================================
// Types
// ============================================================================

export interface BiometricLoginButtonProps {
  /** Callback при успешной верификации */
  onSuccess?: () => void;
  /** Callback при ошибке */
  onError?: (error: Error) => void;
  /** Вариант кнопки */
  variant?: "default" | "outline" | "secondary" | "ghost";
  /** Размер кнопки */
  size?: "default" | "sm" | "lg" | "icon";
  /** Дополнительные CSS классы */
  className?: string;
  /** Текст кнопки (по умолчанию из локализации) */
  children?: React.ReactNode;
  /** Локаль для сообщений */
  locale?: Locale;
  /** Показывать ли иконку */
  showIcon?: boolean;
  /** Автоматически перенаправлять после успеха */
  redirectTo?: string;
  /** ID конкретного фактора для верификации (если не указан, используется первый доступный) */
  factorId?: string;
  /** Автоматически запустить верификацию при монтировании */
  autoVerify?: boolean;
}

// ============================================================================
// Messages
// ============================================================================

const messages = {
  en: {
    button: "Sign in with Biometric",
    verifying: "Verifying...",
    success: "Successfully verified!",
    notSupported: "Your browser doesn't support biometric authentication",
    notAvailable: "No biometric authenticator available",
    noCredentials: "No biometric keys registered. Please add one first",
    cancelled: "Verification cancelled",
    failed: "Verification failed",
    genericError: "Failed to verify",
  },
  nl: {
    button: "Inloggen met biometrie",
    verifying: "Verifiëren...",
    success: "Succesvol geverifieerd!",
    notSupported: "Uw browser ondersteunt geen biometrische authenticatie",
    notAvailable: "Geen biometrische authenticator beschikbaar",
    noCredentials: "Geen biometrische sleutels geregistreerd. Voeg er eerst een toe",
    cancelled: "Verificatie geannuleerd",
    failed: "Verificatie mislukt",
    genericError: "Verificatie mislukt",
  },
  fr: {
    button: "Se connecter avec la biométrie",
    verifying: "Vérification...",
    success: "Vérifié avec succès !",
    notSupported: "Votre navigateur ne prend pas en charge l'authentification biométrique",
    notAvailable: "Aucun authentificateur biométrique disponible",
    noCredentials: "Aucune clé biométrique enregistrée. Veuillez en ajouter une d'abord",
    cancelled: "Vérification annulée",
    failed: "Échec de la vérification",
    genericError: "Échec de la vérification",
  },
  ru: {
    button: "Войти с биометрией",
    verifying: "Проверка...",
    success: "Успешно верифицировано!",
    notSupported: "Ваш браузер не поддерживает биометрическую авторизацию",
    notAvailable: "Нет доступного биометрического аутентификатора",
    noCredentials: "Нет зарегистрированных биометрических ключей. Сначала добавьте один",
    cancelled: "Верификация отменена",
    failed: "Верификация не удалась",
    genericError: "Не удалось выполнить верификацию",
  },
  de: {
    button: "Mit Biometrie anmelden",
    verifying: "Überprüfung...",
    success: "Erfolgreich verifiziert!",
    notSupported: "Ihr Browser unterstützt keine biometrische Authentifizierung",
    notAvailable: "Kein biometrischer Authentifikator verfügbar",
    noCredentials: "Keine biometrischen Schlüssel registriert. Bitte fügen Sie zuerst einen hinzu",
    cancelled: "Überprüfung abgebrochen",
    failed: "Überprüfung fehlgeschlagen",
    genericError: "Überprüfung fehlgeschlagen",
  },
};

// ============================================================================
// Component
// ============================================================================

export function BiometricLoginButton({
  onSuccess,
  onError,
  variant = "outline",
  size = "default",
  className,
  children,
  locale = "en",
  showIcon = true,
  redirectTo,
  factorId,
  autoVerify = false,
}: BiometricLoginButtonProps) {
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasAutoVerified, setHasAutoVerified] = useState(false);

  const {
    isSupported,
    isPlatformAvailable,
    credentials,
    isLoading,
    verify,
  } = useWebAuthn({
    autoLoad: true,
    onVerifySuccess: () => {
      toast.success(messages[locale].success, {
        icon: <ShieldCheck className="size-4" />,
      });
      
      if (onSuccess) {
        onSuccess();
      } else if (redirectTo) {
        router.push(redirectTo);
      }
    },
    onError: (error) => {
      // Обработка конкретных типов ошибок
      switch (error.type) {
        case "NOT_SUPPORTED":
          toast.error(messages[locale].notSupported);
          break;
        case "USER_CANCELLED":
          toast.error(messages[locale].cancelled);
          break;
        case "VERIFICATION_FAILED":
          toast.error(messages[locale].failed, {
            description: error.message,
          });
          break;
        default:
          toast.error(messages[locale].genericError, {
            description: error.message,
          });
      }
      onError?.(new Error(error.message));
    },
  });

  // Автоматическая верификация при монтировании
  useEffect(() => {
    if (
      autoVerify &&
      !hasAutoVerified &&
      !isLoading &&
      isSupported &&
      isPlatformAvailable &&
      credentials.length > 0
    ) {
      setHasAutoVerified(true);
      void handleVerify();
    }
  }, [autoVerify, hasAutoVerified, isLoading, isSupported, isPlatformAvailable, credentials]);

  // Обработчик клика
  const handleVerify = async () => {
    // Проверка поддержки
    if (!isSupported) {
      toast.error(messages[locale].notSupported);
      return;
    }

    if (!isPlatformAvailable) {
      toast.error(messages[locale].notAvailable);
      return;
    }

    // Проверка наличия зарегистрированных ключей
    if (credentials.length === 0) {
      toast.error(messages[locale].noCredentials);
      return;
    }

    setIsVerifying(true);

    try {
      // Запускаем верификацию
      await verify(factorId);
    } finally {
      setIsVerifying(false);
    }
  };

  // Если браузер не поддерживает, не показываем кнопку
  if (!isSupported) {
    return null;
  }

  // Если нет зарегистрированных ключей и это не autoVerify, показываем disabled кнопку
  const isDisabled = 
    isVerifying || 
    isLoading || 
    !isPlatformAvailable || 
    credentials.length === 0;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleVerify}
      disabled={isDisabled}
    >
      {isVerifying ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {messages[locale].verifying}
        </>
      ) : isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          {showIcon && <Fingerprint className="size-4" />}
          {children || messages[locale].button}
        </>
      )}
    </Button>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default BiometricLoginButton;




