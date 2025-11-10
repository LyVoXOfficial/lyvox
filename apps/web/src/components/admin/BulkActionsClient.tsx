"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/i18n";
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

interface BulkActionsClientProps {
  totalCount: number;
  formId: string;
}

export default function BulkActionsClient({
  totalCount,
  formId,
}: BulkActionsClientProps) {
  const { t } = useI18n();
  const [selectedCount, setSelectedCount] = useState(0);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update selected count when checkboxes change
  useEffect(() => {
    const updateCount = () => {
      const checkboxes = document.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="ids"][form="${formId}"]:checked`
      );
      setSelectedCount(checkboxes.length);
    };

    // Initial count
    updateCount();

    // Listen for changes
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][name="ids"][form="${formId}"]`
    );
    checkboxes.forEach((cb) => {
      cb.addEventListener("change", updateCount);
    });

    return () => {
      checkboxes.forEach((cb) => {
        cb.removeEventListener("change", updateCount);
      });
    };
  }, [formId, totalCount]);

  const allSelected = selectedCount === totalCount && totalCount > 0;

  const handleSelectAll = (checked: boolean) => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][name="ids"][form="${formId}"]`
    );
    checkboxes.forEach((cb) => {
      cb.checked = checked;
    });
    setSelectedCount(checked ? totalCount : 0);
  };

  const handleBulkAction = (action: string) => {
    if (selectedCount === 0) return;
    setConfirmAction(action);
  };

  const handleConfirm = () => {
    if (!confirmAction) return;

    setIsSubmitting(true);
    const form = document.getElementById(formId) as HTMLFormElement;
    if (form) {
      // Find the button with the action value
      const actionButton = form.querySelector(
        `button[name="action"][value="${confirmAction}"]`
      ) as HTMLButtonElement;
      if (actionButton) {
        // Create a form data and submit
        const formData = new FormData(form);
        formData.set("action", confirmAction);
        
        // Submit using the form's action
        actionButton.click();
      }
    }
    setConfirmAction(null);
    setTimeout(() => {
      setIsSubmitting(false);
    }, 2000);
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "accept":
        return t("admin.reports.actions.accept").toLowerCase();
      case "accept_unpublish":
        return t("admin.reports.actions.accept_unpublish").toLowerCase();
      case "reject":
        return t("admin.reports.actions.reject").toLowerCase();
      default:
        return "";
    }
  };

  return (
    <>
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/10">
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all-bulk"
            checked={allSelected}
            onCheckedChange={(checked) => {
              handleSelectAll(checked === true);
            }}
            aria-label={t("admin.reports.table.select_all")}
          />
          <label
            htmlFor="select-all-bulk"
            className="text-sm font-medium cursor-pointer"
          >
            {t("admin.reports.table.select_all")} ({selectedCount}/{totalCount})
          </label>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button
            type="button"
            size="sm"
            disabled={selectedCount === 0 || isSubmitting}
            onClick={() => handleBulkAction("accept")}
          >
            {t("admin.reports.actions.accept")} ({selectedCount})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedCount === 0 || isSubmitting}
            onClick={() => handleBulkAction("accept_unpublish")}
          >
            {t("admin.reports.actions.accept_unpublish")} ({selectedCount})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={selectedCount === 0 || isSubmitting}
            onClick={() => handleBulkAction("reject")}
          >
            {t("admin.reports.actions.reject")} ({selectedCount})
          </Button>
        </div>

        {isSubmitting && (
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{t("common.loading")}...</span>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common.confirm")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && (
                <>
                  {t("admin.reports.actions.bulk_confirm", {
                    action: getActionLabel(confirmAction),
                    count: selectedCount,
                  })}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

