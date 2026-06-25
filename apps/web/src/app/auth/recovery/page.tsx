"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";

function RecoveryPageInner() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        toast.error("Could not send the recovery link.");
      } else {
        setSent(true);
        toast.success("Recovery link sent. Check your email.");
      }
    } catch {
      toast.error("Could not send the link. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-[minmax(0,1fr)_440px] md:py-16">
        <section className="flex flex-col justify-center gap-6">
          <Link
            href="/login"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>

          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Account recovery
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Reset access without exposing account details.
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              We send a single-use recovery link to the email on your account. The link expires
              automatically, so request a new one if it has already been used.
            </p>
          </div>
        </section>

        <Card className="rounded-md border-border/80 shadow-lg shadow-black/5">
          {sent ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-emerald-50">
                  <Mail className="size-6 text-emerald-600" aria-hidden="true" />
                </div>
                <CardTitle className="text-2xl">Check your email</CardTitle>
                <CardDescription>
                  We sent a recovery link to <span className="font-medium text-foreground">{email}</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-md border border-border/80 bg-muted/40 p-4">
                  <p className="text-sm font-medium">No email yet?</p>
                  <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
                      Check spam, promotions, or quarantine folders.
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
                      Confirm the email address is typed correctly.
                    </li>
                    <li className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden="true" />
                      Wait a few minutes before requesting another link.
                    </li>
                  </ul>
                </div>

                <Button variant="outline" className="h-11 w-full" onClick={() => setSent(false)}>
                  Send another link
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/login">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Return to sign in
                  </Link>
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-2xl">Recover access</CardTitle>
                <CardDescription>Enter your account email and we will send a reset link.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRecovery} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="h-11 w-full">
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Sending link...
                      </>
                    ) : (
                      "Send recovery link"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}

export default function RecoveryPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
          Loading recovery...
        </main>
      }
    >
      <RecoveryPageInner />
    </Suspense>
  );
}
