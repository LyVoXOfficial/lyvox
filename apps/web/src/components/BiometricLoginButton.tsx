"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import type { Locale } from "@/lib/i18n";

export interface BiometricLoginButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: ReactNode;
  locale?: Locale;
  showIcon?: boolean;
  redirectTo?: string;
  factorId?: string;
  autoVerify?: boolean;
}

const messages = {
  en: {
    button: "Sign in with passkey",
    verifying: "Verifying...",
    success: "Identity verified",
    notSupported: "This browser does not support passkeys",
    notAvailable: "No platform authenticator is available",
    noCredentials: "No passkeys are registered for this account",
    cancelled: "Verification cancelled",
    failed: "Verification failed",
    genericError: "Could not verify passkey",
  },
  nl: {
    button: "Inloggen met passkey",
    verifying: "Verifieren...",
    success: "Identiteit geverifieerd",
    notSupported: "Deze browser ondersteunt geen passkeys",
    notAvailable: "Geen platform-authenticator beschikbaar",
    noCredentials: "Er zijn geen passkeys voor dit account geregistreerd",
    cancelled: "Verificatie geannuleerd",
    failed: "Verificatie mislukt",
    genericError: "Kan passkey niet verifieren",
  },
  fr: {
    button: "Se connecter avec une passkey",
    verifying: "Verification...",
    success: "Identite verifiee",
    notSupported: "Ce navigateur ne prend pas en charge les passkeys",
    notAvailable: "Aucun authentificateur de plateforme disponible",
    noCredentials: "Aucune passkey n'est enregistree pour ce compte",
    cancelled: "Verification annulee",
    failed: "Verification echouee",
    genericError: "Impossible de verifier la passkey",
  },
  ru: {
    button: "Sign in with passkey",
    verifying: "Verifying...",
    success: "Identity verified",
    notSupported: "This browser does not support passkeys",
    notAvailable: "No platform authenticator is available",
    noCredentials: "No passkeys are registered for this account",
    cancelled: "Verification cancelled",
    failed: "Verification failed",
    genericError: "Could not verify passkey",
  },
  de: {
    button: "Mit Passkey anmelden",
    verifying: "Pruefung...",
    success: "Identitaet verifiziert",
    notSupported: "Dieser Browser unterstuetzt keine Passkeys",
    notAvailable: "Kein Plattform-Authenticator verfuegbar",
    noCredentials: "Fuer dieses Konto sind keine Passkeys registriert",
    cancelled: "Pruefung abgebrochen",
    failed: "Pruefung fehlgeschlagen",
    genericError: "Passkey konnte nicht verifiziert werden",
  },
} satisfies Record<Locale, Record<string, string>>;

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
  const copy = messages[locale] ?? messages.en;

  const { isSupported, isPlatformAvailable, credentials, isLoading, verify } = useWebAuthn({
    autoLoad: true,
    onVerifySuccess: () => {
      toast.success(copy.success, {
        icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      });

      if (onSuccess) {
        onSuccess();
      } else if (redirectTo) {
        router.push(redirectTo);
      }
    },
    onError: (error) => {
      switch (error.type) {
        case "NOT_SUPPORTED":
          toast.error(copy.notSupported);
          break;
        case "USER_CANCELLED":
          toast.error(copy.cancelled);
          break;
        case "VERIFICATION_FAILED":
          toast.error(copy.failed, {
            description: error.message,
          });
          break;
        default:
          toast.error(copy.genericError, {
            description: error.message,
          });
      }
      onError?.(new Error(error.message));
    },
  });

  const handleVerify = useCallback(async () => {
    if (!isSupported) {
      toast.error(copy.notSupported);
      return;
    }

    if (!isPlatformAvailable) {
      toast.error(copy.notAvailable);
      return;
    }

    if (credentials.length === 0) {
      toast.error(copy.noCredentials);
      return;
    }

    setIsVerifying(true);

    try {
      await verify(factorId);
    } finally {
      setIsVerifying(false);
    }
  }, [copy, credentials.length, factorId, isPlatformAvailable, isSupported, verify]);

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
  }, [
    autoVerify,
    credentials.length,
    handleVerify,
    hasAutoVerified,
    isLoading,
    isPlatformAvailable,
    isSupported,
  ]);

  if (!isSupported) {
    return null;
  }

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
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {copy.verifying}
        </>
      ) : isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading...
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

export default BiometricLoginButton;
