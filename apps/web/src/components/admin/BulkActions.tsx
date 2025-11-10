"use client";

import { useState, useTransition } from "react";
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

interface BulkActionsProps {
  totalCount: number;
  selectedCount: number;
  onSelectAll: (checked: boolean) => void;
  onBulkAction: (action: string) => void;
}

export default function BulkActions({
  totalCount,
  selectedCount,
  onSelectAll,
  onBulkAction,
}: BulkActionsProps) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const handleAction = (action: string) => {
    setConfirmAction(action);
  };

  const handleConfirm = () => {
    if (confirmAction) {
      startTransition(() => {
        onBulkAction(confirmAction);
        setConfirmAction(null);
      });
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "accept":
        return t("admin.reports.actions.accept");
      case "accept_unpublish":
        return t("admin.reports.actions.accept_unpublish");
      case "reject":
        return t("admin.reports.actions.reject");
      default:
        return "";
    }
  };

  return (
    <>
      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/10">
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={selectedCount === totalCount && totalCount > 0}
            onCheckedChange={(checked) => onSelectAll(checked === true)}
            aria-label={t("admin.reports.table.select_all")}
          />
          <label
            htmlFor="select-all"
            className="text-sm font-medium cursor-pointer"
          >
            {t("admin.reports.table.select_all")} ({selectedCount}/{totalCount})
          </label>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button
            type="button"
            size="sm"
            disabled={selectedCount === 0 || isPending}
            onClick={() => handleAction("accept")}
          >
            {t("admin.reports.actions.accept")} ({selectedCount})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedCount === 0 || isPending}
            onClick={() => handleAction("accept_unpublish")}
          >
            {t("admin.reports.actions.accept_unpublish")} ({selectedCount})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={selectedCount === 0 || isPending}
            onClick={() => handleAction("reject")}
          >
            {t("admin.reports.actions.reject")} ({selectedCount})
          </Button>
        </div>

        {isPending && (
          <div className="ml-auto text-sm text-muted-foreground">
            {t("common.loading")}...
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common.confirm", {}) || "Confirm action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && (
                <>
                  {t("admin.reports.actions.bulk_confirm", {
                    action: getActionLabel(confirmAction),
                    count: selectedCount,
                  }) || `Are you sure you want to ${getActionLabel(confirmAction).toLowerCase()} ${selectedCount} report(s)?`}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {t("common.confirm", {}) || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

