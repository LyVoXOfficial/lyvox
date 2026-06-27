"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { useCookieConsent } from "./CookieConsentProvider";

/**
 * Cookie Preference Center (layer 2 / modal).
 *
 * - Three rows: Necessary (always-on, disabled), Functional, Analytics.
 * - Initialises from existing consent; defaults OFF for fresh visitors.
 * - Footer: Save preferences | Reject all | Accept all.
 * - Reopenable any time (driven by provider preferencesOpen state).
 */
export function CookiePreferenceCenter() {
  const { consent, preferencesOpen, closePreferences, save } =
    useCookieConsent();
  const { t } = useI18n();
  const tr = (k: string, fallback: string) => {
    const v = t(k);
    return v === k ? fallback : v;
  };

  // Local toggle state — initialised from consent or defaults to false.
  const [functional, setFunctional] = useState<boolean>(
    consent?.functional ?? false
  );
  const [analytics, setAnalytics] = useState<boolean>(
    consent?.analytics ?? false
  );

  // Sync local state whenever the preference center is opened or consent changes.
  useEffect(() => {
    if (preferencesOpen) {
      setFunctional(consent?.functional ?? false);
      setAnalytics(consent?.analytics ?? false);
    }
  }, [preferencesOpen, consent]);

  const handleSave = () => {
    save({ functional, analytics });
    closePreferences();
  };

  const handleRejectAll = () => {
    save({ functional: false, analytics: false });
    closePreferences();
  };

  const handleAcceptAll = () => {
    save({ functional: true, analytics: true });
    closePreferences();
  };

  return (
    <Dialog open={preferencesOpen} onOpenChange={(open) => !open && closePreferences()}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {tr("cookie.prefs_title", "Cookie preferences")}
          </DialogTitle>
          <DialogDescription>
            {tr(
              "cookie.banner_body",
              "Manage which cookies you allow. Necessary cookies are always active."
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Preference rows */}
        <div className="space-y-4 py-2">
          {/* Necessary — always on */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-0.5">
              <label
                className="text-sm font-medium leading-none"
                htmlFor="switch-necessary"
              >
                {tr("cookie.necessary_label", "Necessary")}
              </label>
              <p className="text-xs text-muted-foreground">
                {tr(
                  "cookie.necessary_desc",
                  "Authentication, security, and this consent record."
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Switch
                id="switch-necessary"
                aria-label={tr("cookie.necessary_label", "Necessary")}
                checked={true}
                disabled={true}
              />
              <span className="text-[10px] text-muted-foreground">
                {tr("cookie.necessary_always", "Always active")}
              </span>
            </div>
          </div>

          {/* Functional */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-0.5">
              <label
                className="text-sm font-medium leading-none"
                htmlFor="switch-functional"
              >
                {tr("cookie.functional_label", "Functional")}
              </label>
              <p className="text-xs text-muted-foreground">
                {tr(
                  "cookie.functional_desc",
                  "Recently viewed, taste preferences, saved searches, seen adverts."
                )}
              </p>
            </div>
            <Switch
              id="switch-functional"
              aria-label={tr("cookie.functional_label", "Functional")}
              checked={functional}
              onCheckedChange={setFunctional}
            />
          </div>

          {/* Analytics */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-0.5">
              <label
                className="text-sm font-medium leading-none"
                htmlFor="switch-analytics"
              >
                {tr("cookie.analytics_label", "Analytics")}
              </label>
              <p className="text-xs text-muted-foreground">
                {tr(
                  "cookie.analytics_desc",
                  "Aggregate usage statistics (no analytics lib active yet)."
                )}
              </p>
            </div>
            <Switch
              id="switch-analytics"
              aria-label={tr("cookie.analytics_label", "Analytics")}
              checked={analytics}
              onCheckedChange={setAnalytics}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRejectAll}
            >
              {tr("cookie.reject_all", "Reject all")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAcceptAll}
            >
              {tr("cookie.accept_all", "Accept all")}
            </Button>
          </div>
          <Button type="button" variant="default" size="sm" onClick={handleSave}>
            {tr("cookie.save_prefs", "Save preferences")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
