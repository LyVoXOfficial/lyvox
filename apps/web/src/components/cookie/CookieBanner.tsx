"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useCookieConsent } from "./CookieConsentProvider";

/**
 * Layer-1 cookie consent banner.
 *
 * Belgian ePrivacy compliance requirements:
 * - "Reject all" and "Accept all" must have EQUAL visual prominence.
 * - No pre-ticked categories (there are no toggles on layer 1).
 * - No "X" dismiss that implies consent.
 * - Hidden during SSR and once a consent decision exists.
 */
export function CookieBanner() {
  const { decided, save, openPreferences } = useCookieConsent();
  const { t } = useI18n();
  const tr = (k: string, fallback: string) => {
    const v = t(k);
    return v === k ? fallback : v;
  };

  // Guard against SSR / hydration mismatch: render nothing until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Show banner only when mounted AND no decision has been made.
  if (!mounted || decided) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg p-4 md:p-6"
    >
      <div className="mx-auto max-w-4xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Text */}
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-sm">
            {tr("cookie.banner_title", "We use cookies")}
          </p>
          <p className="text-muted-foreground text-xs">
            {tr(
              "cookie.banner_body",
              "We use cookies to improve your experience. You can accept, reject, or customise your preferences."
            )}{" "}
            <a
              href="/legal/cookies"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              {tr("cookie.learn_more", "Learn more")}
            </a>
          </p>
        </div>

        {/* Buttons — EQUAL prominence: same variant ("secondary") + same size */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {/* Customize — link-style, does NOT imply consent */}
          <button
            type="button"
            onClick={openPreferences}
            className="text-xs underline underline-offset-2 hover:text-foreground text-muted-foreground transition-colors px-1"
          >
            {tr("cookie.customize", "Customize")}
          </button>

          {/*
           * EQUAL PROMINENCE: both buttons use variant="secondary" + size="sm".
           * Belgian ePrivacy: reject must not be visually subordinate to accept.
           */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-variant="secondary"
            onClick={() => save({ functional: false, analytics: false })}
          >
            {tr("cookie.reject_all", "Reject all")}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-variant="secondary"
            onClick={() => save({ functional: true, analytics: true })}
          >
            {tr("cookie.accept_all", "Accept all")}
          </Button>
        </div>
      </div>
    </div>
  );
}
