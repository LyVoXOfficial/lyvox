"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function WebAuthnNotAvailableNotice() {
  return (
    <Alert className="mb-6 border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="size-4 text-amber-700 dark:text-amber-300" />
      <AlertTitle>Passkeys are not available for this account yet</AlertTitle>
      <AlertDescription className="mt-2 space-y-2 text-amber-800 dark:text-amber-200">
        <p>
          LyVoX currently uses authenticator-app codes for MFA. Passkeys and WebAuthn will be added only when the provider path is stable enough for account recovery.
        </p>
        <p className="font-medium">Available account protection today:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>TOTP authenticator apps such as Google Authenticator, 1Password, Authy, or Microsoft Authenticator.</li>
          <li>Verified email and phone signals used across seller trust surfaces.</li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function TOTPRecommendation() {
  return (
    <Alert className="mb-6">
      <Info className="size-4" />
      <AlertTitle>Use an authenticator app for stronger account protection</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          Time-based one-time passwords are a reliable two-factor method used by major account systems. They protect your LyVoX account even if a password is exposed.
        </p>
        <ol className="list-inside list-decimal space-y-1">
          <li>Install an authenticator app.</li>
          <li>Scan the QR code from LyVoX.</li>
          <li>Enter the six-digit code to finish setup.</li>
        </ol>
        <p className="mt-2">
          <a
            href="https://supabase.com/docs/guides/auth/auth-mfa/totp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            Read the TOTP MFA documentation
          </a>
        </p>
      </AlertDescription>
    </Alert>
  );
}
