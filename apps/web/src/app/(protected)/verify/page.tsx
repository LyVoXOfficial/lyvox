import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, Phone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseServer } from "@/lib/supabaseServer";
import { VerifyEmailClient } from "./VerifyEmailClient";
import { VerifyPhoneClient } from "./VerifyPhoneClient";

export const metadata = {
  title: "Account verification | LyVoX",
  description: "Verify email and phone details before publishing listings.",
};

export default async function VerifyPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/verify");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("verified_email, verified_phone, phone")
    .eq("id", user.id)
    .maybeSingle();

  const verifiedEmail = profile?.verified_email ?? false;
  const verifiedPhone = profile?.verified_phone ?? false;
  const phone = profile?.phone;
  const isFullyVerified = verifiedEmail && verifiedPhone;

  return (
    <main className="bg-background">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:py-10">
        <Button asChild variant="ghost" size="sm" className="px-0">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to profile
          </Link>
        </Button>

        <header className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Trust checks
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Account verification</h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Verify email and phone details to improve marketplace trust and unlock safer publishing flows.
            </p>
          </div>

          <Card
            className={
              isFullyVerified
                ? "rounded-md border-emerald-200 bg-emerald-50"
                : "rounded-md border-amber-200 bg-amber-50"
            }
          >
            <CardHeader>
              <div className="flex items-start gap-3">
                {isFullyVerified ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden="true" />
                )}
                <div>
                  <CardTitle className={isFullyVerified ? "text-emerald-950" : "text-amber-950"}>
                    {isFullyVerified ? "Ready to publish" : "Verification required"}
                  </CardTitle>
                  <CardDescription className={isFullyVerified ? "text-emerald-800" : "text-amber-800"}>
                    {isFullyVerified
                      ? "Your account has the required trust checks."
                      : "Complete both checks before posting with full trust signals."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {isFullyVerified ? (
              <CardContent>
                <Button asChild>
                  <Link href="/post">Post a listing</Link>
                </Button>
              </CardContent>
            ) : null}
          </Card>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-md border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                  <CardTitle>Email address</CardTitle>
                </div>
                {verifiedEmail ? (
                  <Badge className="bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="destructive">Not verified</Badge>
                )}
              </div>
              <CardDescription>{user.email}</CardDescription>
            </CardHeader>
            <CardContent>
              {verifiedEmail ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  Your email is verified. Marketplace updates and buyer/seller notifications can reach this address.
                </p>
              ) : (
                <VerifyEmailClient email={user.email!} />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-md border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
                  <CardTitle>Phone number</CardTitle>
                </div>
                {verifiedPhone ? (
                  <Badge className="bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="destructive">Not verified</Badge>
                )}
              </div>
              <CardDescription>{phone || "No phone number added"}</CardDescription>
            </CardHeader>
            <CardContent>
              {verifiedPhone ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  Your phone is verified. Buyers can use stronger trust signals when deciding to contact you.
                </p>
              ) : (
                <VerifyPhoneClient userId={user.id} currentPhone={phone} />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-md border-border/80 bg-muted/30">
          <CardHeader>
            <CardTitle>Need help?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground md:grid-cols-3">
            <p>
              <strong className="text-foreground">No email?</strong> Check spam or request another confirmation email.
            </p>
            <p>
              <strong className="text-foreground">Phone issue?</strong> Use international format such as +32.
            </p>
            <p>
              <strong className="text-foreground">Still blocked?</strong>{" "}
              <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
                Contact support
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
