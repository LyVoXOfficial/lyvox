"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MfaChallenge({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (!active) return;
      if (listError) setError("Security factors could not be loaded.");
      const verified = data?.totp.find((factor) => factor.status === "verified") ?? null;
      setFactorId(verified?.id ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your authenticator app.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data?.id) {
      setError("The security challenge could not be started. Try again.");
      setSubmitting(false);
      return;
    }

    const verification = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (verification.error) {
      setError("That code was not accepted. Check the current code and try again.");
      setSubmitting(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md rounded-md">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-md border bg-muted">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>Confirm it is you</CardTitle>
        <CardDescription>
          Administration requires a fresh code from your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking security factors…</p>
        ) : factorId ? (
          <form className="space-y-4" onSubmit={verify}>
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Authentication code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? "Checking…" : "Continue to administration"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No verified authenticator factor is available. Enroll one before opening administration.
            </p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button asChild className="w-full">
              <Link href="/profile/security">Open security settings</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
