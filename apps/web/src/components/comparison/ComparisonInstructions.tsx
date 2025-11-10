"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "comparison-instructions-dismissed";

type Props = {
  className?: string;
};

export default function ComparisonInstructions({ className }: Props) {
  const { t } = useI18n();
  const [hydrated, setHydrated] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY) === "1";
    setVisible(!dismissed);
    setHydrated(true);
  }, []);

  if (!hydrated || !visible) {
    return null;
  }

  const handleDismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // storage might be unavailable (Safari private mode, etc.)
    }
  };

  return (
    <Alert className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-start gap-3">
        <Info className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <AlertTitle className="text-sm font-semibold text-foreground">
            {t("comparison.instructions_title")}
          </AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            {t("comparison.instructions_body")}
          </AlertDescription>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={handleDismiss}>
        {t("comparison.instructions_dismiss")}
      </Button>
    </Alert>
  );
}

