"use client";

import { useState, type ReactNode } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import type { Locale } from "@/lib/i18n";

export interface BiometricEnrollButtonProps {
  onSuccess?: (factorId: string) => void;
  onError?: (error: Error) => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: ReactNode;
  locale?: Locale;
  showIcon?: boolean;
  friendlyName?: string;
}

const messages = {
  en: {
    button: "Add passkey",
    enrolling: "Registering...",
    success: "Passkey registered",
    notSupported: "This browser does not support passkeys",
    notAvailable: "No platform authenticator is available on this device",
    cancelled: "Registration cancelled",
    alreadyExists: "This passkey is already registered",
    genericError: "Could not register passkey",
  },
  nl: {
    button: "Passkey toevoegen",
    enrolling: "Registreren...",
    success: "Passkey geregistreerd",
    notSupported: "Deze browser ondersteunt geen passkeys",
    notAvailable: "Geen platform-authenticator beschikbaar op dit apparaat",
    cancelled: "Registratie geannuleerd",
    alreadyExists: "Deze passkey is al geregistreerd",
    genericError: "Kan passkey niet registreren",
  },
  fr: {
    button: "Ajouter une passkey",
    enrolling: "Enregistrement...",
    success: "Passkey enregistree",
    notSupported: "Ce navigateur ne prend pas en charge les passkeys",
    notAvailable: "Aucun authentificateur de plateforme disponible sur cet appareil",
    cancelled: "Enregistrement annule",
    alreadyExists: "Cette passkey est deja enregistree",
    genericError: "Impossible d'enregistrer la passkey",
  },
  ru: {
    button: "Add passkey",
    enrolling: "Registering...",
    success: "Passkey registered",
    notSupported: "This browser does not support passkeys",
    notAvailable: "No platform authenticator is available on this device",
    cancelled: "Registration cancelled",
    alreadyExists: "This passkey is already registered",
    genericError: "Could not register passkey",
  },
  de: {
    button: "Passkey hinzufuegen",
    enrolling: "Registrierung...",
    success: "Passkey registriert",
    notSupported: "Dieser Browser unterstuetzt keine Passkeys",
    notAvailable: "Auf diesem Geraet ist kein Plattform-Authenticator verfuegbar",
    cancelled: "Registrierung abgebrochen",
    alreadyExists: "Dieser Passkey ist bereits registriert",
    genericError: "Passkey konnte nicht registriert werden",
  },
} satisfies Record<Locale, Record<string, string>>;

function generateFriendlyName(): string {
  const platform = navigator.platform || "Unknown";
  const ua = navigator.userAgent;

  if (/iPhone|iPad|iPod/.test(ua)) {
    return "iPhone/iPad";
  }
  if (/Mac/.test(platform)) {
    return "MacBook";
  }
  if (/Win/.test(platform)) {
    return "Windows PC";
  }
  if (/Android/.test(ua)) {
    return "Android device";
  }
  if (/Linux/.test(platform)) {
    return "Linux device";
  }

  return "This device";
}

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
  const copy = messages[locale] ?? messages.en;

  const { isSupported, isPlatformAvailable, enroll } = useWebAuthn({
    autoLoad: false,
    onEnrollSuccess: (factorId) => {
      toast.success(copy.success);
      onSuccess?.(factorId);
    },
    onError: (error) => {
      switch (error.type) {
        case "NOT_SUPPORTED":
          toast.error(copy.notSupported);
          break;
        case "USER_CANCELLED":
          toast.error(copy.cancelled);
          break;
        case "INVALID_STATE":
          toast.error(copy.alreadyExists);
          break;
        default:
          toast.error(copy.genericError, {
            description: error.message,
          });
      }
      onError?.(new Error(error.message));
    },
  });

  const handleEnroll = async () => {
    if (!isSupported) {
      toast.error(copy.notSupported);
      return;
    }

    if (!isPlatformAvailable) {
      toast.error(copy.notAvailable);
      return;
    }

    setIsEnrolling(true);

    try {
      await enroll(friendlyName || generateFriendlyName());
    } finally {
      setIsEnrolling(false);
    }
  };

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
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {copy.enrolling}
        </>
      ) : (
        <>
          {showIcon && <Fingerprint className="size-4" aria-hidden="true" />}
          {children || copy.button}
        </>
      )}
    </Button>
  );
}

export default BiometricEnrollButton;
