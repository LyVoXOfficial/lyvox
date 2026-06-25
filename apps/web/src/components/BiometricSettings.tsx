"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  Info,
  Laptop,
  Loader2,
  Smartphone,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { BiometricEnrollButton } from "@/components/BiometricEnrollButton";
import type { Locale } from "@/lib/i18n";
import type { BiometricCredential } from "@/lib/webauthn";

export interface BiometricSettingsProps {
  locale?: Locale;
  className?: string;
}

const messages = {
  en: {
    title: "Passkeys",
    description: "Manage device-bound sign-in keys for faster account access.",
    supported: "This browser supports passkeys",
    notSupported: "This browser does not support passkeys",
    platformAvailable: "A platform authenticator is available on this device",
    platformNotAvailable: "No platform authenticator is available on this device",
    noDevices: "No passkeys registered",
    noDevicesDescription: "Add a passkey for faster sign-in with Face ID, Touch ID, or Windows Hello.",
    devices: "Registered passkeys",
    devicesCount: "{count} passkey(s) registered",
    addDevice: "Add passkey",
    confirmRemoveTitle: "Remove this passkey?",
    confirmRemoveDescription: "You can add this device again later, but it will no longer be available for sign-in.",
    cancel: "Cancel",
    remove: "Remove",
    removed: "Passkey removed",
    removeFailed: "Could not remove passkey",
    lastUsed: "Last used: {date}",
    createdAt: "Added: {date}",
    loading: "Loading...",
    infoTitle: "How passkeys protect your account",
    infoDescription: "Passkeys use your device authenticator. Biometric data stays on the device and is not shared with LyVoX.",
  },
  nl: {
    title: "Passkeys",
    description: "Beheer apparaatsleutels voor snellere accounttoegang.",
    supported: "Deze browser ondersteunt passkeys",
    notSupported: "Deze browser ondersteunt geen passkeys",
    platformAvailable: "Een platform-authenticator is beschikbaar op dit apparaat",
    platformNotAvailable: "Geen platform-authenticator beschikbaar op dit apparaat",
    noDevices: "Geen passkeys geregistreerd",
    noDevicesDescription: "Voeg een passkey toe voor sneller inloggen met Face ID, Touch ID of Windows Hello.",
    devices: "Geregistreerde passkeys",
    devicesCount: "{count} passkey(s) geregistreerd",
    addDevice: "Passkey toevoegen",
    confirmRemoveTitle: "Deze passkey verwijderen?",
    confirmRemoveDescription: "U kunt dit apparaat later opnieuw toevoegen, maar het is niet langer beschikbaar voor aanmelding.",
    cancel: "Annuleren",
    remove: "Verwijderen",
    removed: "Passkey verwijderd",
    removeFailed: "Kan passkey niet verwijderen",
    lastUsed: "Laatst gebruikt: {date}",
    createdAt: "Toegevoegd: {date}",
    loading: "Laden...",
    infoTitle: "Hoe passkeys uw account beschermen",
    infoDescription: "Passkeys gebruiken de authenticator van uw apparaat. Biometrische gegevens blijven op het apparaat en worden niet gedeeld met LyVoX.",
  },
  fr: {
    title: "Passkeys",
    description: "Gerez les cles liees aux appareils pour un acces plus rapide au compte.",
    supported: "Ce navigateur prend en charge les passkeys",
    notSupported: "Ce navigateur ne prend pas en charge les passkeys",
    platformAvailable: "Un authentificateur de plateforme est disponible sur cet appareil",
    platformNotAvailable: "Aucun authentificateur de plateforme disponible sur cet appareil",
    noDevices: "Aucune passkey enregistree",
    noDevicesDescription: "Ajoutez une passkey pour une connexion plus rapide avec Face ID, Touch ID ou Windows Hello.",
    devices: "Passkeys enregistrees",
    devicesCount: "{count} passkey(s) enregistree(s)",
    addDevice: "Ajouter une passkey",
    confirmRemoveTitle: "Supprimer cette passkey ?",
    confirmRemoveDescription: "Vous pourrez ajouter cet appareil plus tard, mais il ne sera plus disponible pour la connexion.",
    cancel: "Annuler",
    remove: "Supprimer",
    removed: "Passkey supprimee",
    removeFailed: "Impossible de supprimer la passkey",
    lastUsed: "Derniere utilisation : {date}",
    createdAt: "Ajoutee : {date}",
    loading: "Chargement...",
    infoTitle: "Comment les passkeys protegent votre compte",
    infoDescription: "Les passkeys utilisent l'authentificateur de votre appareil. Les donnees biometriques restent sur l'appareil et ne sont pas partagees avec LyVoX.",
  },
  ru: {
    title: "Passkeys",
    description: "Manage device-bound sign-in keys for faster account access.",
    supported: "This browser supports passkeys",
    notSupported: "This browser does not support passkeys",
    platformAvailable: "A platform authenticator is available on this device",
    platformNotAvailable: "No platform authenticator is available on this device",
    noDevices: "No passkeys registered",
    noDevicesDescription: "Add a passkey for faster sign-in with Face ID, Touch ID, or Windows Hello.",
    devices: "Registered passkeys",
    devicesCount: "{count} passkey(s) registered",
    addDevice: "Add passkey",
    confirmRemoveTitle: "Remove this passkey?",
    confirmRemoveDescription: "You can add this device again later, but it will no longer be available for sign-in.",
    cancel: "Cancel",
    remove: "Remove",
    removed: "Passkey removed",
    removeFailed: "Could not remove passkey",
    lastUsed: "Last used: {date}",
    createdAt: "Added: {date}",
    loading: "Loading...",
    infoTitle: "How passkeys protect your account",
    infoDescription: "Passkeys use your device authenticator. Biometric data stays on the device and is not shared with LyVoX.",
  },
  de: {
    title: "Passkeys",
    description: "Verwalten Sie geraetegebundene Anmeldeschluessel fuer schnelleren Kontozugriff.",
    supported: "Dieser Browser unterstuetzt Passkeys",
    notSupported: "Dieser Browser unterstuetzt keine Passkeys",
    platformAvailable: "Ein Plattform-Authenticator ist auf diesem Geraet verfuegbar",
    platformNotAvailable: "Kein Plattform-Authenticator auf diesem Geraet verfuegbar",
    noDevices: "Keine Passkeys registriert",
    noDevicesDescription: "Fuegen Sie einen Passkey fuer schnellere Anmeldung mit Face ID, Touch ID oder Windows Hello hinzu.",
    devices: "Registrierte Passkeys",
    devicesCount: "{count} Passkey(s) registriert",
    addDevice: "Passkey hinzufuegen",
    confirmRemoveTitle: "Diesen Passkey entfernen?",
    confirmRemoveDescription: "Sie koennen dieses Geraet spaeter erneut hinzufuegen, aber es ist nicht mehr fuer die Anmeldung verfuegbar.",
    cancel: "Abbrechen",
    remove: "Entfernen",
    removed: "Passkey entfernt",
    removeFailed: "Passkey konnte nicht entfernt werden",
    lastUsed: "Zuletzt verwendet: {date}",
    createdAt: "Hinzugefuegt: {date}",
    loading: "Laden...",
    infoTitle: "Wie Passkeys Ihr Konto schuetzen",
    infoDescription: "Passkeys verwenden den Authenticator Ihres Geraets. Biometrische Daten bleiben auf dem Geraet und werden nicht mit LyVoX geteilt.",
  },
} satisfies Record<Locale, Record<string, string>>;

function formatDate(dateString: string, locale: Locale): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale === "ru" ? "en" : locale, {
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

function getDeviceIcon(friendlyName: string) {
  const name = friendlyName.toLowerCase();

  if (name.includes("iphone") || name.includes("ipad") || name.includes("android")) {
    return <Smartphone className="size-5" aria-hidden="true" />;
  }
  if (name.includes("mac") || name.includes("windows") || name.includes("linux")) {
    return <Laptop className="size-5" aria-hidden="true" />;
  }

  return <Fingerprint className="size-5" aria-hidden="true" />;
}

interface DeviceCardProps {
  credential: BiometricCredential;
  locale: Locale;
  onRemove: (factorId: string) => void;
  isRemoving: boolean;
}

function DeviceCard({ credential, locale, onRemove, isRemoving }: DeviceCardProps) {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const copy = messages[locale] ?? messages.en;

  return (
    <>
      <Card className="rounded-md">
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-1 text-muted-foreground">
              {getDeviceIcon(credential.friendlyName)}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{credential.friendlyName}</p>
                <Badge variant="secondary" className="text-xs">
                  WebAuthn
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {copy.createdAt.replace("{date}", formatDate(credential.createdAt, locale))}
              </p>
              {credential.lastUsedAt && (
                <p className="text-xs text-muted-foreground">
                  {copy.lastUsed.replace("{date}", formatDate(credential.lastUsedAt, locale))}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowRemoveDialog(true)}
            disabled={isRemoving}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove passkey"
          >
            {isRemoving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmRemoveTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.confirmRemoveDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemove(credential.factorId);
                setShowRemoveDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {copy.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function BiometricSettings({ locale = "en", className }: BiometricSettingsProps) {
  const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);
  const copy = messages[locale] ?? messages.en;

  const {
    isSupported,
    isPlatformAvailable,
    credentials,
    isLoading,
    remove,
    refresh,
  } = useWebAuthn({
    autoLoad: true,
  });

  const handleRemove = async (factorId: string) => {
    setRemovingFactorId(factorId);

    try {
      const success = await remove(factorId);

      if (success) {
        toast.success(copy.removed);
      } else {
        toast.error(copy.removeFailed);
      }
    } catch {
      toast.error(copy.removeFailed);
    } finally {
      setRemovingFactorId(null);
    }
  };

  return (
    <div className={className}>
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="size-5" aria-hidden="true" />
            {copy.title}
          </CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              {isSupported ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                  <span className="text-emerald-700 dark:text-emerald-300">{copy.supported}</span>
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-destructive" aria-hidden="true" />
                  <span className="text-destructive">{copy.notSupported}</span>
                </>
              )}
            </div>
            {isSupported && (
              <div className="flex items-center gap-2 text-sm">
                {isPlatformAvailable ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                    <span className="text-emerald-700 dark:text-emerald-300">{copy.platformAvailable}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-4 text-amber-600" aria-hidden="true" />
                    <span className="text-amber-700 dark:text-amber-300">{copy.platformNotAvailable}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex gap-3">
              <Info className="size-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {copy.infoTitle}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {copy.infoDescription}
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="ml-2 text-sm text-muted-foreground">{copy.loading}</span>
            </div>
          ) : credentials.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <Fingerprint className="mx-auto size-12 text-muted-foreground/50" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold">{copy.noDevices}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{copy.noDevicesDescription}</p>
              <div className="mt-6">
                <BiometricEnrollButton locale={locale} onSuccess={() => void refresh()} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{copy.devices}</h3>
                  <p className="text-sm text-muted-foreground">
                    {copy.devicesCount.replace("{count}", String(credentials.length))}
                  </p>
                </div>
                <BiometricEnrollButton
                  locale={locale}
                  variant="outline"
                  size="sm"
                  onSuccess={() => void refresh()}
                >
                  {copy.addDevice}
                </BiometricEnrollButton>
              </div>

              <div className="space-y-2">
                {credentials.map((credential) => (
                  <DeviceCard
                    key={credential.id}
                    credential={credential}
                    locale={locale}
                    onRemove={handleRemove}
                    isRemoving={removingFactorId === credential.factorId}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BiometricSettings;
