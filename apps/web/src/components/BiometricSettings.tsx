/**
 * BiometricSettings - страница настроек биометрии в профиле
 * 
 * Полный интерфейс для управления биометрическими ключами:
 * - Просмотр зарегистрированных устройств
 * - Добавление новых ключей
 * - Удаление существующих ключей
 * - Информация о поддержке браузера
 * 
 * @example
 * <BiometricSettings locale="en" />
 */

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
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { BiometricEnrollButton } from "@/components/BiometricEnrollButton";
import { toast } from "sonner";
import { 
  Fingerprint, 
  Smartphone, 
  Laptop, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { BiometricCredential } from "@/lib/webauthn";

// ============================================================================
// Types
// ============================================================================

export interface BiometricSettingsProps {
  /** Локаль для интерфейса */
  locale?: Locale;
  /** Дополнительные CSS классы */
  className?: string;
}

// ============================================================================
// Messages
// ============================================================================

const messages = {
  en: {
    title: "Biometric Authentication",
    description: "Manage your biometric keys for fast and secure login",
    supported: "Your browser supports biometric authentication",
    notSupported: "Your browser doesn't support biometric authentication",
    platformAvailable: "Biometric authenticator available on this device",
    platformNotAvailable: "No biometric authenticator available on this device",
    noDevices: "No biometric keys registered",
    noDevicesDescription: "Add your first biometric key to enable fast login with Face ID, Touch ID, or Windows Hello",
    devices: "Registered Devices",
    devicesCount: "{count} device(s) registered",
    addDevice: "Add Device",
    removeDevice: "Remove Device",
    confirmRemoveTitle: "Remove biometric key?",
    confirmRemoveDescription: "Are you sure you want to remove this biometric key? You can add it again later",
    cancel: "Cancel",
    remove: "Remove",
    removed: "Biometric key removed",
    removeFailed: "Failed to remove biometric key",
    lastUsed: "Last used: {date}",
    createdAt: "Added: {date}",
    loading: "Loading...",
    refreshing: "Refreshing...",
    infoTitle: "About Biometric Authentication",
    infoDescription: "Biometric authentication allows you to log in quickly and securely using your device's built-in sensors like fingerprint readers or facial recognition. Your biometric data never leaves your device.",
  },
  nl: {
    title: "Biometrische authenticatie",
    description: "Beheer uw biometrische sleutels voor snelle en veilige login",
    supported: "Uw browser ondersteunt biometrische authenticatie",
    notSupported: "Uw browser ondersteunt geen biometrische authenticatie",
    platformAvailable: "Biometrische authenticator beschikbaar op dit apparaat",
    platformNotAvailable: "Geen biometrische authenticator beschikbaar op dit apparaat",
    noDevices: "Geen biometrische sleutels geregistreerd",
    noDevicesDescription: "Voeg uw eerste biometrische sleutel toe om snelle login met Face ID, Touch ID of Windows Hello in te schakelen",
    devices: "Geregistreerde apparaten",
    devicesCount: "{count} apparaat/apparaten geregistreerd",
    addDevice: "Apparaat toevoegen",
    removeDevice: "Apparaat verwijderen",
    confirmRemoveTitle: "Biometrische sleutel verwijderen?",
    confirmRemoveDescription: "Weet u zeker dat u deze biometrische sleutel wilt verwijderen? U kunt deze later opnieuw toevoegen",
    cancel: "Annuleren",
    remove: "Verwijderen",
    removed: "Biometrische sleutel verwijderd",
    removeFailed: "Kan biometrische sleutel niet verwijderen",
    lastUsed: "Laatst gebruikt: {date}",
    createdAt: "Toegevoegd: {date}",
    loading: "Laden...",
    refreshing: "Vernieuwen...",
    infoTitle: "Over biometrische authenticatie",
    infoDescription: "Met biometrische authenticatie kunt u snel en veilig inloggen met de ingebouwde sensoren van uw apparaat, zoals vingerafdrukscanner of gezichtsherkenning. Uw biometrische gegevens verlaten nooit uw apparaat.",
  },
  fr: {
    title: "Authentification biométrique",
    description: "Gérez vos clés biométriques pour une connexion rapide et sécurisée",
    supported: "Votre navigateur prend en charge l'authentification biométrique",
    notSupported: "Votre navigateur ne prend pas en charge l'authentification biométrique",
    platformAvailable: "Authentificateur biométrique disponible sur cet appareil",
    platformNotAvailable: "Aucun authentificateur biométrique disponible sur cet appareil",
    noDevices: "Aucune clé biométrique enregistrée",
    noDevicesDescription: "Ajoutez votre première clé biométrique pour activer la connexion rapide avec Face ID, Touch ID ou Windows Hello",
    devices: "Appareils enregistrés",
    devicesCount: "{count} appareil(s) enregistré(s)",
    addDevice: "Ajouter un appareil",
    removeDevice: "Supprimer l'appareil",
    confirmRemoveTitle: "Supprimer la clé biométrique ?",
    confirmRemoveDescription: "Êtes-vous sûr de vouloir supprimer cette clé biométrique ? Vous pourrez l'ajouter à nouveau plus tard",
    cancel: "Annuler",
    remove: "Supprimer",
    removed: "Clé biométrique supprimée",
    removeFailed: "Impossible de supprimer la clé biométrique",
    lastUsed: "Dernière utilisation : {date}",
    createdAt: "Ajouté : {date}",
    loading: "Chargement...",
    refreshing: "Actualisation...",
    infoTitle: "À propos de l'authentification biométrique",
    infoDescription: "L'authentification biométrique vous permet de vous connecter rapidement et en toute sécurité à l'aide des capteurs intégrés de votre appareil tels que les lecteurs d'empreintes digitales ou la reconnaissance faciale. Vos données biométriques ne quittent jamais votre appareil.",
  },
  ru: {
    title: "Биометрическая авторизация",
    description: "Управление биометрическими ключами для быстрого и безопасного входа",
    supported: "Ваш браузер поддерживает биометрическую авторизацию",
    notSupported: "Ваш браузер не поддерживает биометрическую авторизацию",
    platformAvailable: "Биометрический аутентификатор доступен на этом устройстве",
    platformNotAvailable: "На этом устройстве нет биометрического аутентификатора",
    noDevices: "Нет зарегистрированных биометрических ключей",
    noDevicesDescription: "Добавьте свой первый биометрический ключ для быстрого входа с Face ID, Touch ID или Windows Hello",
    devices: "Зарегистрированные устройства",
    devicesCount: "Зарегистрировано устройств: {count}",
    addDevice: "Добавить устройство",
    removeDevice: "Удалить устройство",
    confirmRemoveTitle: "Удалить биометрический ключ?",
    confirmRemoveDescription: "Вы уверены, что хотите удалить этот биометрический ключ? Вы сможете добавить его снова позже",
    cancel: "Отмена",
    remove: "Удалить",
    removed: "Биометрический ключ удален",
    removeFailed: "Не удалось удалить биометрический ключ",
    lastUsed: "Последнее использование: {date}",
    createdAt: "Добавлено: {date}",
    loading: "Загрузка...",
    refreshing: "Обновление...",
    infoTitle: "О биометрической авторизации",
    infoDescription: "Биометрическая авторизация позволяет быстро и безопасно входить в систему, используя встроенные датчики вашего устройства, такие как сканер отпечатков пальцев или распознавание лиц. Ваши биометрические данные никогда не покидают ваше устройство.",
  },
  de: {
    title: "Biometrische Authentifizierung",
    description: "Verwalten Sie Ihre biometrischen Schlüssel für schnelle und sichere Anmeldung",
    supported: "Ihr Browser unterstützt biometrische Authentifizierung",
    notSupported: "Ihr Browser unterstützt keine biometrische Authentifizierung",
    platformAvailable: "Biometrischer Authentifikator auf diesem Gerät verfügbar",
    platformNotAvailable: "Kein biometrischer Authentifikator auf diesem Gerät verfügbar",
    noDevices: "Keine biometrischen Schlüssel registriert",
    noDevicesDescription: "Fügen Sie Ihren ersten biometrischen Schlüssel hinzu, um die schnelle Anmeldung mit Face ID, Touch ID oder Windows Hello zu aktivieren",
    devices: "Registrierte Geräte",
    devicesCount: "{count} Gerät(e) registriert",
    addDevice: "Gerät hinzufügen",
    removeDevice: "Gerät entfernen",
    confirmRemoveTitle: "Biometrischen Schlüssel entfernen?",
    confirmRemoveDescription: "Sind Sie sicher, dass Sie diesen biometrischen Schlüssel entfernen möchten? Sie können ihn später erneut hinzufügen",
    cancel: "Abbrechen",
    remove: "Entfernen",
    removed: "Biometrischer Schlüssel entfernt",
    removeFailed: "Biometrischer Schlüssel konnte nicht entfernt werden",
    lastUsed: "Zuletzt verwendet: {date}",
    createdAt: "Hinzugefügt: {date}",
    loading: "Laden...",
    refreshing: "Aktualisieren...",
    infoTitle: "Über biometrische Authentifizierung",
    infoDescription: "Die biometrische Authentifizierung ermöglicht es Ihnen, sich schnell und sicher mit den integrierten Sensoren Ihres Geräts wie Fingerabdrucklesern oder Gesichtserkennung anzumelden. Ihre biometrischen Daten verlassen niemals Ihr Gerät.",
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Форматирует дату для отображения
 */
function formatDate(dateString: string, locale: Locale): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
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
 * Определяет иконку устройства по названию
 */
function getDeviceIcon(friendlyName: string) {
  const name = friendlyName.toLowerCase();
  
  if (name.includes("iphone") || name.includes("ipad") || name.includes("android")) {
    return <Smartphone className="size-5" />;
  } else if (name.includes("mac") || name.includes("windows") || name.includes("linux")) {
    return <Laptop className="size-5" />;
  }
  
  return <Fingerprint className="size-5" />;
}

// ============================================================================
// Device Card Component
// ============================================================================

interface DeviceCardProps {
  credential: BiometricCredential;
  locale: Locale;
  onRemove: (factorId: string) => void;
  isRemoving: boolean;
}

function DeviceCard({ credential, locale, onRemove, isRemoving }: DeviceCardProps) {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const msg = messages[locale];

  return (
    <>
      <Card>
        <CardContent className="flex items-start justify-between p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 text-muted-foreground">
              {getDeviceIcon(credential.friendlyName)}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{credential.friendlyName}</p>
                <Badge variant="secondary" className="text-xs">
                  WebAuthn
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {msg.createdAt.replace("{date}", formatDate(credential.createdAt, locale))}
              </p>
              {credential.lastUsedAt && (
                <p className="text-xs text-muted-foreground">
                  {msg.lastUsed.replace("{date}", formatDate(credential.lastUsedAt, locale))}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowRemoveDialog(true)}
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

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{msg.confirmRemoveTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {msg.confirmRemoveDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{msg.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemove(credential.factorId);
                setShowRemoveDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {msg.remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BiometricSettings({ locale = "en", className }: BiometricSettingsProps) {
  const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);

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

  const msg = messages[locale];

  // Обработчик удаления устройства
  const handleRemove = async (factorId: string) => {
    setRemovingFactorId(factorId);

    try {
      const success = await remove(factorId);
      
      if (success) {
        toast.success(msg.removed);
      } else {
        toast.error(msg.removeFailed);
      }
    } catch (error) {
      toast.error(msg.removeFailed);
    } finally {
      setRemovingFactorId(null);
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="size-5" />
            {msg.title}
          </CardTitle>
          <CardDescription>{msg.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Browser Support Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              {isSupported ? (
                <>
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span className="text-green-600">{msg.supported}</span>
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-destructive" />
                  <span className="text-destructive">{msg.notSupported}</span>
                </>
              )}
            </div>
            {isSupported && (
              <div className="flex items-center gap-2 text-sm">
                {isPlatformAvailable ? (
                  <>
                    <CheckCircle2 className="size-4 text-green-600" />
                    <span className="text-green-600">{msg.platformAvailable}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-4 text-amber-600" />
                    <span className="text-amber-600">{msg.platformNotAvailable}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Info Banner */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex gap-3">
              <Info className="size-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {msg.infoTitle}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {msg.infoDescription}
                </p>
              </div>
            </div>
          </div>

          {/* Devices List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">{msg.loading}</span>
            </div>
          ) : credentials.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Fingerprint className="mx-auto size-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-semibold">{msg.noDevices}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {msg.noDevicesDescription}
              </p>
              <div className="mt-6">
                <BiometricEnrollButton
                  locale={locale}
                  onSuccess={() => void refresh()}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">{msg.devices}</h3>
                  <p className="text-sm text-muted-foreground">
                    {msg.devicesCount.replace("{count}", String(credentials.length))}
                  </p>
                </div>
                <BiometricEnrollButton
                  locale={locale}
                  variant="outline"
                  size="sm"
                  onSuccess={() => void refresh()}
                >
                  {msg.addDevice}
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

// ============================================================================
// Default Export
// ============================================================================

export default BiometricSettings;


