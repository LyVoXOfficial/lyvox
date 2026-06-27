"use client";

import { useCookieConsent } from "./CookieConsentProvider";

interface CookieSettingsButtonProps {
  label: string;
  className?: string;
}

export function CookieSettingsButton({ label, className }: CookieSettingsButtonProps) {
  const { openPreferences } = useCookieConsent();
  return (
    <button
      type="button"
      onClick={openPreferences}
      className={className}
    >
      {label}
    </button>
  );
}
