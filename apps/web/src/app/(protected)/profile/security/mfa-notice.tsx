"use client";

import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useI18n } from "@/i18n";

export function WebAuthnNotAvailableNotice() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  return (
    <Alert className="mb-6 rounded-xl border-border/70 bg-muted text-foreground shadow-[var(--shadow-soft)]">
      <AlertTriangle className="size-4 text-muted-foreground" />
      <AlertTitle>{tr("profile.passkeys_unavailable_title", "Passkeys are not available for this account yet")}</AlertTitle>
      <AlertDescription className="mt-2 space-y-2 text-muted-foreground">
        <p>
          {tr(
            "profile.passkeys_unavailable_desc",
            "LyVoX currently uses authenticator-app codes for MFA. Passkeys and WebAuthn will be added only when the provider path is stable enough for account recovery.",
          )}
        </p>
        <p className="font-medium">{tr("profile.protection_today", "Available account protection today:")}</p>
        <ul className="list-inside list-disc space-y-1">
          <li>{tr("profile.protection_totp", "TOTP authenticator apps such as Google Authenticator, 1Password, Authy, or Microsoft Authenticator.")}</li>
          <li>{tr("profile.protection_signals", "Verified email and phone signals used across seller trust surfaces.")}</li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}

export function TOTPRecommendation() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  return (
    <Alert className="mb-6 rounded-xl border-border/70 shadow-[var(--shadow-soft)]">
      <Info className="size-4" />
      <AlertTitle>{tr("profile.totp_rec_title", "Use an authenticator app for stronger account protection")}</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          {tr(
            "profile.totp_rec_desc",
            "Time-based one-time passwords are a reliable two-factor method used by major account systems. They protect your LyVoX account even if a password is exposed.",
          )}
        </p>
        <ol className="list-inside list-decimal space-y-1">
          <li>{tr("profile.totp_step_install", "Install an authenticator app.")}</li>
          <li>{tr("profile.totp_step_scan", "Scan the QR code from LyVoX.")}</li>
          <li>{tr("profile.totp_step_code", "Enter the six-digit code to finish setup.")}</li>
        </ol>
        <p className="mt-2">
          <a
            href="https://supabase.com/docs/guides/auth/auth-mfa/totp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            {tr("profile.totp_docs_link", "Read the TOTP MFA documentation")}
          </a>
        </p>
      </AlertDescription>
    </Alert>
  );
}
