"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, CheckCircle2, AlertTriangle, Copy, Check } from "lucide-react";
import { useTOTP } from "@/hooks/useTOTP";
import { toast } from "sonner";
import Image from "next/image";

interface TOTPEnrollmentProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TOTPEnrollment({ onSuccess, onCancel }: TOTPEnrollmentProps) {
  const [friendlyName, setFriendlyName] = useState("Authenticator App");
  const [verificationCode, setVerificationCode] = useState("");
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const { enroll, verify, isEnrolling, isVerifying } = useTOTP({
    onEnrollSuccess: () => {
      toast.success("TOTP успешно настроен!");
      onSuccess?.();
    },
    onVerifySuccess: () => {
      toast.success("TOTP подтвержден!");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleEnroll = async () => {
    const result = await enroll(friendlyName);

    if (result.success && result.factorId && result.qrCode && result.secret) {
      setEnrollData({
        factorId: result.factorId,
        qrCode: result.qrCode,
        secret: result.secret,
      });
    }
  };

  const handleVerify = async () => {
    if (!enrollData) return;

    const result = await verify(enrollData.factorId, verificationCode);

    if (result.success) {
      // Success handled by onVerifySuccess callback
    }
  };

  const copySecret = async () => {
    if (!enrollData) return;

    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setCopiedSecret(true);
      toast.success("Секретный ключ скопирован!");
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch (err) {
      toast.error("Не удалось скопировать");
    }
  };

  // Step 1: Initial state - show enrollment button
  if (!enrollData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Настройка двухфакторной аутентификации (2FA)
          </CardTitle>
          <CardDescription>
            Используйте приложение-аутентификатор для защиты вашего аккаунта
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="space-y-2">
              <p><strong>Поддерживаемые приложения:</strong></p>
              <ul className="list-inside list-disc space-y-1 text-sm">
                <li>Google Authenticator</li>
                <li>Microsoft Authenticator</li>
                <li>Authy</li>
                <li>1Password</li>
                <li>Bitwarden Authenticator</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="friendly-name">Название устройства (опционально)</Label>
            <Input
              id="friendly-name"
              type="text"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="Например: iPhone 14, Google Authenticator"
              disabled={isEnrolling}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleEnroll} disabled={isEnrolling} className="flex-1">
              {isEnrolling ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Настройка...
                </>
              ) : (
                "Начать настройку"
              )}
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={isEnrolling}>
                Отмена
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 2: Show QR code and verification
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Сканируйте QR-код
        </CardTitle>
        <CardDescription>
          Используйте приложение-аутентификатор для сканирования кода
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code */}
        <div className="flex flex-col items-center space-y-4">
          <div className="rounded-lg border p-4 bg-white">
            <Image
              src={enrollData.qrCode}
              alt="TOTP QR Code"
              width={200}
              height={200}
              unoptimized
            />
          </div>

          <Alert>
            <AlertDescription className="space-y-2">
              <p className="text-sm font-medium">Не можете отсканировать?</p>
              <p className="text-sm">Введите этот код вручную:</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {enrollData.secret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                  className="shrink-0"
                >
                  {copiedSecret ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {/* Verification Code Input */}
        <div className="space-y-2">
          <Label htmlFor="verification-code">
            Введите 6-значный код из приложения
          </Label>
          <Input
            id="verification-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            disabled={isVerifying}
            className="text-center text-2xl tracking-widest font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Код обновляется каждые 30 секунд
          </p>
        </div>

        {/* Verification Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleVerify}
            disabled={verificationCode.length !== 6 || isVerifying}
            className="flex-1"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Проверка...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 size-4" />
                Подтвердить
              </>
            )}
          </Button>
          {onCancel && (
            <Button
              variant="outline"
              onClick={() => {
                setEnrollData(null);
                setVerificationCode("");
                onCancel();
              }}
              disabled={isVerifying}
            >
              Отмена
            </Button>
          )}
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            <strong>Важно!</strong> Сохраните резервные коды или настройте второе устройство.
            Если вы потеряете доступ к приложению-аутентификатору, вы не сможете войти в свой аккаунт.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

