"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabaseClient";

function meetsPasswordPolicy(password: string): boolean {
  const classes = [
    /[a-z]/u.test(password),
    /[A-Z]/u.test(password),
    /\d/u.test(password),
    /[^A-Za-z0-9]/u.test(password),
  ].filter(Boolean).length;
  return password.length >= 8 && classes >= 3;
}

export default function PasswordResetForm() {
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [sessionRevocationFailed, setSessionRevocationFailed] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!meetsPasswordPolicy(password)) {
      setError(
        tr(
          "account_recovery.password_weak",
          "Use at least 8 characters and 3 of: uppercase, lowercase, number, symbol.",
        ),
      );
      return;
    }
    if (password !== confirmation) {
      setError(tr("account_recovery.password_mismatch", "The passwords do not match."));
      return;
    }

    setSubmitting(true);
    let updateError: { message?: string } | null;
    try {
      ({ error: updateError } = await supabase.auth.updateUser({ password }));
    } catch {
      updateError = { message: "request_failed" };
    }
    if (updateError) {
      setError(
        tr(
          "account_recovery.update_failed",
          "The password could not be updated. Request a new recovery link and try again.",
        ),
      );
      setSubmitting(false);
      return;
    }

    // A recovered account should start from a clean authentication boundary.
    // Revoke all refresh sessions and require a fresh sign-in with the new password.
    let revocationFailed = false;
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
      revocationFailed = Boolean(signOutError);
    } catch {
      revocationFailed = true;
    }
    setPassword("");
    setConfirmation("");
    setSessionRevocationFailed(revocationFailed);
    setUpdated(true);
    setSubmitting(false);
  }

  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-10">
      <Card className="w-full rounded-md border-border/80 shadow-lg shadow-black/5">
        {updated ? (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40">
                <CheckCircle2 className="size-6 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              </div>
              <CardTitle>
                {tr("account_recovery.updated_title", "Password updated")}
              </CardTitle>
              <CardDescription>
                {sessionRevocationFailed
                  ? tr(
                      "account_recovery.updated_sessions_warning",
                      "The password changed, but LyVoX could not confirm that every other session was closed. Review active sessions now.",
                    )
                  : tr(
                      "account_recovery.updated_body",
                      "Your other sessions were closed. Sign in again with the new password.",
                    )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="h-11 w-full">
                <Link
                  href={sessionRevocationFailed ? "/profile/security" : "/login?password=updated"}
                >
                  {sessionRevocationFailed
                    ? tr("account_recovery.review_sessions", "Review active sessions")
                    : tr("account_recovery.back_to_login", "Return to sign in")}
                </Link>
              </Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-md border bg-muted">
                <KeyRound className="size-5" aria-hidden="true" />
              </div>
              <CardTitle>{tr("account_recovery.reset_title", "Choose a new password")}</CardTitle>
              <CardDescription>
                {tr(
                  "account_recovery.reset_body",
                  "Use a password you do not use for another service.",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">
                    {tr("account_recovery.new_password", "New password")}
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={submitting}
                    required
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    {tr(
                      "account_recovery.password_hint",
                      "At least 8 characters and 3 of: uppercase, lowercase, number, symbol.",
                    )}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">
                    {tr("account_recovery.confirm_password", "Confirm new password")}
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>
                {error ? (
                  <p className="text-sm font-medium text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button className="h-11 w-full" disabled={submitting} type="submit">
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      {tr("account_recovery.updating", "Updating password…")}
                    </>
                  ) : (
                    tr("account_recovery.update_password", "Update password")
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </section>
  );
}
