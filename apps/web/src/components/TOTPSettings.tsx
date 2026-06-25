"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { CheckCircle2, Loader2, Plus, Shield, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTOTP, type TOTPFactor } from "@/hooks/useTOTP";
import { TOTPEnrollment } from "./TOTPEnrollment";

interface TOTPSettingsProps {
  className?: string;
}

export function TOTPSettings({ className }: TOTPSettingsProps) {
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [factorToRemove, setFactorToRemove] = useState<string | null>(null);
  const [removingFactorId, setRemovingFactorId] = useState<string | null>(null);

  const { factors, isLoading, unenroll, refresh } = useTOTP({
    autoLoad: true,
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleRemove = async (factorId: string) => {
    setRemovingFactorId(factorId);

    try {
      const success = await unenroll(factorId);

      if (success) {
        toast.success("Authenticator removed");
        setFactorToRemove(null);
      } else {
        toast.error("Could not remove authenticator");
      }
    } catch {
      toast.error("Authenticator removal failed");
    } finally {
      setRemovingFactorId(null);
    }
  };

  const handleEnrollmentSuccess = () => {
    setShowEnrollment(false);
    void refresh();
    toast.success("Two-factor authentication is ready");
  };

  if (showEnrollment) {
    return (
      <div className={className}>
        <TOTPEnrollment
          onSuccess={handleEnrollmentSuccess}
          onCancel={() => setShowEnrollment(false)}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" aria-hidden="true" />
            Authenticator app codes
          </CardTitle>
          <CardDescription>
            Add a second factor so your seller account stays protected even if a password is exposed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {factors.length > 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <div className="flex-1">
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                    Two-factor authentication is enabled
                  </h3>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                    Sign-ins can require a short-lived code from your authenticator app.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 size-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                    Two-factor authentication is not enabled
                  </h3>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    We recommend enabling it before handling buyer conversations or paid listing boosts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          ) : factors.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Registered authenticators</h4>
              {factors.map((factor) => (
                <FactorCard
                  key={factor.id}
                  factor={factor}
                  onRemove={() => setFactorToRemove(factor.id)}
                  isRemoving={removingFactorId === factor.id}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No authenticator app is connected yet.
            </p>
          )}

          <Button
            onClick={() => setShowEnrollment(true)}
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add authenticator app
          </Button>

          <div className="rounded-md bg-muted p-4 text-sm">
            <p className="font-medium">How setup works</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
              <li>Install an authenticator app such as 1Password, Authy, Google Authenticator, or Microsoft Authenticator.</li>
              <li>Scan the LyVoX QR code inside the app.</li>
              <li>Enter the six-digit code to confirm the factor.</li>
              <li>Use the app code when LyVoX asks for an extra sign-in check.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={factorToRemove !== null} onOpenChange={() => setFactorToRemove(null)}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this authenticator?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing this factor lowers account protection. Add a replacement authenticator before removing your only second factor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => factorToRemove && handleRemove(factorToRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove authenticator
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface FactorCardProps {
  factor: TOTPFactor;
  onRemove: () => void;
  isRemoving: boolean;
}

function FactorCard({ factor, onRemove, isRemoving }: FactorCardProps) {
  return (
    <Card className="rounded-md">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Smartphone className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{factor.friendly_name || "Authenticator app"}</p>
              {factor.status === "verified" ? (
                <Badge variant="default" className="text-xs">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Not verified
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Added {formatDistanceToNow(new Date(factor.created_at), { addSuffix: true, locale: enUS })}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={isRemoving}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove authenticator"
        >
          {isRemoving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="size-4" aria-hidden="true" />
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
