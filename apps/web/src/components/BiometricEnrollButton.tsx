/**
 * BiometricEnrollButton - кнопка для регистрации биометрического ключа
 * 
 * Показывает кнопку "Добавить биометрию", которая запускает процесс
 * регистрации Touch ID, Face ID, Windows Hello и т.д.
 * 
 * @example
 * <BiometricEnrollButton 
 *   onSuccess={(factorId) => console.log("Enrolled:", factorId)}
 *   variant="default"
 * />
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { toast } from "sonner";
import { Fingerprint, Loader2 } from "lucide-react";
import type { Locale } from "@/lib/i18n";

// ============================================================================
// Types
// ============================================================================

export interface BiometricEnrollButtonProps {
  /** Callback при успешной регистрации */
  onSuccess?: (factorId: string) => void;
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
  /** Дружественное имя устройства (по умолчанию генерируется автоматически) */
  friendlyName?: string;
}

// ============================================================================
// Messages
// ============================================================================

const messages = {
  en: {
    button: "Add Biometric",
    enrolling: "Registering...",
    success: "Biometric key registered successfully!",
    notSupported: "Your browser doesn't support biometric authentication",
    notAvailable: "No biometric authenticator available on this device",
    cancelled: "Registration cancelled",
    alreadyExists: "This biometric key is already registered",
    genericError: "Failed to register biometric key",
  },
  nl: {
    button: "Biometrie toevoegen",
    enrolling: "Registreren...",
    success: "Biometrische sleutel succesvol geregistreerd!",
    notSupported: "Uw browser ondersteunt geen biometrische authenticatie",
    notAvailable: "Geen biometrische authenticator beschikbaar op dit apparaat",
    cancelled: "Registratie geannuleerd",
    alreadyExists: "Deze biometrische sleutel is al geregistreerd",
    genericError: "Kan biometrische sleutel niet registreren",
  },
  fr: {
    button: "Ajouter la biométrie",
    enrolling: "Enregistrement...",
    success: "Clé biométrique enregistrée avec succès !",
    notSupported: "Votre navigateur ne prend pas en charge l'authentification biométrique",
    notAvailable: "Aucun authentificateur biométrique disponible sur cet appareil",
    cancelled: "Enregistrement annulé",
    alreadyExists: "Cette clé biométrique est déjà enregistrée",
    genericError: "Impossible d'enregistrer la clé biométrique",
  },
  ru: {
    button: "Добавить биометрию",
    enrolling: "Регистрация...",
    success: "Биометрический ключ успешно зарегистрирован!",
    notSupported: "Ваш браузер не поддерживает биометрическую авторизацию",
    notAvailable: "На этом устройстве нет биометрического аутентификатора",
    cancelled: "Регистрация отменена",
    alreadyExists: "Этот биометрический ключ уже зарегистрирован",
    genericError: "Не удалось зарегистрировать биометрический ключ",
  },
  de: {
    button: "Biometrie hinzufügen",
    enrolling: "Registrierung...",
    success: "Biometrischer Schlüssel erfolgreich registriert!",
    notSupported: "Ihr Browser unterstützt keine biometrische Authentifizierung",
    notAvailable: "Auf diesem Gerät ist kein biometrischer Authentifikator verfügbar",
    cancelled: "Registrierung abgebrochen",
    alreadyExists: "Dieser biometrische Schlüssel ist bereits registriert",
    genericError: "Biometrischer Schlüssel konnte nicht registriert werden",
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Генерирует дружественное имя для устройства
 */
function generateFriendlyName(): string {
  const platform = navigator.platform || "Unknown";
  const ua = navigator.userAgent;
  
  // Определяем тип устройства
  if (/iPhone|iPad|iPod/.test(ua)) {
    return "iPhone/iPad";
  } else if (/Mac/.test(platform)) {
    return "MacBook";
  } else if (/Win/.test(platform)) {
    return "Windows PC";
  } else if (/Android/.test(ua)) {
    return "Android Device";
  } else if (/Linux/.test(platform)) {
    return "Linux Device";
  }
  
  return "This Device";
}

// ============================================================================
// Component
// ============================================================================

export function BiometricEnrollButton({
  onSuccess,
  onError,
  variant = "default",
  size = "default",
  className,
  children,
  locale = "en",
  showIcon = true,
  friendlyName,
}: BiometricEnrollButtonProps) {
  const [isEnrolling, setIsEnrolling] = useState(false);
  
  const {
    isSupported,
    isPlatformAvailable,
    enroll,
    error: hookError,
  } = useWebAuthn({
    autoLoad: false,
    onEnrollSuccess: (factorId) => {
      toast.success(messages[locale].success);
      onSuccess?.(factorId);
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
        case "INVALID_STATE":
          toast.error(messages[locale].alreadyExists);
          break;
        default:
          toast.error(messages[locale].genericError, {
            description: error.message,
          });
      }
      onError?.(new Error(error.message));
    },
  });

  // Обработчик клика
  const handleEnroll = async () => {
    // Проверка поддержки
    if (!isSupported) {
      toast.error(messages[locale].notSupported);
      return;
    }

    if (!isPlatformAvailable) {
      toast.error(messages[locale].notAvailable);
      return;
    }

    setIsEnrolling(true);
    
    try {
      // Генерируем имя устройства если не задано
      const deviceName = friendlyName || generateFriendlyName();
      
      // Запускаем регистрацию
      await enroll(deviceName);
    } finally {
      setIsEnrolling(false);
    }
  };

  // Если браузер не поддерживает, не показываем кнопку
  if (!isSupported) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleEnroll}
      disabled={isEnrolling || !isPlatformAvailable}
    >
      {isEnrolling ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {messages[locale].enrolling}
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

export default BiometricEnrollButton;


