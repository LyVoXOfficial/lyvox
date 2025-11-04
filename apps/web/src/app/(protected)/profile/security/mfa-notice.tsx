"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function WebAuthnNotAvailableNotice() {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="size-4" />
      <AlertTitle>WebAuthn (Biometric) MFA недоступен</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          WebAuthn/Passkeys не поддерживается в текущей версии Supabase для пользовательских проектов.
        </p>
        <p>
          <strong>Доступные методы MFA:</strong>
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>✅ <strong>TOTP</strong> - App Authenticator (Google Authenticator, Authy, 1Password)</li>
          <li>⚠️ <strong>Phone MFA</strong> - SMS/WhatsApp (требует Pro план)</li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function TOTPRecommendation() {
  return (
    <Alert className="mb-6">
      <Info className="size-4" />
      <AlertTitle>Рекомендация: Используйте TOTP</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          TOTP (Time-based One-Time Password) - это надежный метод двухфакторной аутентификации,
          который используют Google, GitHub, Microsoft и другие крупные компании.
        </p>
        <p>
          <strong>Как включить:</strong>
        </p>
        <ol className="list-inside list-decimal space-y-1">
          <li>Установите приложение-аутентификатор (Google Authenticator, Authy, 1Password)</li>
          <li>Используйте Supabase JavaScript SDK для регистрации TOTP фактора</li>
          <li>Отсканируйте QR-код в приложении</li>
          <li>Введите 6-значный код для подтверждения</li>
        </ol>
        <p className="mt-2">
          <a 
            href="https://supabase.com/docs/guides/auth/auth-mfa/totp" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            Документация по TOTP MFA →
          </a>
        </p>
      </AlertDescription>
    </Alert>
  );
}

