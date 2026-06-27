"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/fetcher";
import { useI18n } from "@/i18n";

export function DeleteAccountSection() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const canSubmit = confirmText === "DELETE" && password.length > 0;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Reset on close
      setConfirmText("");
      setPassword("");
      setInlineError(null);
    }
    setOpen(next);
  };

  const handleSubmit = async () => {
    if (!canSubmit || isPending) return;
    setIsPending(true);
    setInlineError(null);

    try {
      const res = await apiFetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE", password }),
      });

      if (res.status === 200) {
        toast.success(tr("account.delete.success", "Your account has been permanently deleted."));
        window.location.href = "/";
        return;
      }

      if (res.status === 409) {
        setInlineError(
          tr(
            "account.delete.active_business",
            "Transfer or close your business before deleting your account.",
          ),
        );
        setPassword("");
        return;
      }

      if (res.status === 403) {
        setInlineError(tr("account.delete.wrong_password", "Incorrect password."));
        setPassword("");
        return;
      }

      // Other errors (400, 500, …)
      toast.error(tr("account.delete.error", "Something went wrong. Please try again."));
    } catch {
      // Network error or RateLimitedError
      toast.error(tr("account.delete.error", "Something went wrong. Please try again."));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="rounded-2xl border-destructive/50 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-extrabold tracking-tight text-destructive">
          <AlertTriangle className="size-5" aria-hidden="true" />
          {tr("account.delete.section_title", "Danger zone")}
        </CardTitle>
        <CardDescription>
          {tr(
            "account.delete.explain",
            'Permanently deletes your account, listings, photos and profile. Chat messages you sent are replaced with “[deleted]” so the other person keeps their thread. Some records are kept as required by law.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Retained-data note */}
        <div className="rounded-xl border border-border/70 bg-muted p-4 text-sm text-muted-foreground">
          <p>
            {tr(
              "account.delete.retained_note",
              "Kept under legal retention: billing and invoice records (~7 years, anonymised); ID-verification records subject to a legal hold; no other personal data is retained.",
            )}
          </p>
        </div>

        {/* Download your data */}
        <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {tr("account.delete.download_data", "Download your data")}
            </p>
            <p className="text-xs text-muted-foreground">
              {tr(
                "account.delete.download_data_desc",
                "Download a copy of your consent and data record before you leave.",
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/profile/consents?format=download" download>
              <Download className="size-4" aria-hidden="true" />
              {tr("account.delete.download_data", "Download your data")}
            </a>
          </Button>
        </div>

        {/* Delete button triggers dialog */}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full sm:w-auto">
              <Trash2 className="size-4" aria-hidden="true" />
              {tr("account.delete.button", "Delete my account")}
            </Button>
          </DialogTrigger>

          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                {tr("account.delete.dialog_title", "Permanently delete your account?")}
              </DialogTitle>
              <DialogDescription>
                {tr(
                  "account.delete.explain",
                  'Permanently deletes your account, listings, photos and profile. Chat messages you sent are replaced with "[deleted]" so the other person keeps their thread. Some records are kept as required by law.',
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Confirm phrase */}
              <div className="space-y-1.5">
                <label
                  htmlFor="delete-confirm-input"
                  className="text-sm font-medium leading-none"
                >
                  {tr("account.delete.type_confirm", 'Type DELETE to confirm')}
                </label>
                <Input
                  id="delete-confirm-input"
                  autoComplete="off"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  aria-label={tr("account.delete.type_confirm", 'Type DELETE to confirm')}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="delete-password-input"
                  className="text-sm font-medium leading-none"
                >
                  {tr("account.delete.password_label", "Current password")}
                </label>
                <Input
                  id="delete-password-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-label={tr("account.delete.password_label", "Current password")}
                />
              </div>

              {/* Inline error */}
              {inlineError && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {inlineError}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                {tr("account.delete.cancel", "Cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={!canSubmit || isPending}
                aria-disabled={!canSubmit || isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    {tr("account.delete.confirm", "Delete account")}
                  </>
                ) : (
                  tr("account.delete.confirm", "Delete account")
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
