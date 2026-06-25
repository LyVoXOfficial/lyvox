import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, Phone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseServer } from "@/lib/supabaseServer";
import { getI18nProps } from "@/i18n/server";
import { VerifyEmailClient } from "./VerifyEmailClient";
import { VerifyPhoneClient } from "./VerifyPhoneClient";

function createTr(messages: Record<string, unknown>) {
  return (key: string, fallback: string): string => {
    const value = key
      .split(".")
      .reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), messages);
    return typeof value === "string" && value.length > 0 ? value : fallback;
  };
}

export const metadata = {
  title: "Account verification | LyVoX",
  description: "Verify email and phone details before publishing listings.",
};

export default async function VerifyPage() {
  const supabase = await supabaseServer();
  const { messages } = await getI18nProps();
  const tr = createTr(messages as Record<string, unknown>);
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
            {tr("profile.back_to_profile", "Back to profile")}
          </Link>
        </Button>

        <header className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="lyvox-trust-gradient inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white shadow-[var(--shadow-soft)]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {tr("verify.trust_checks", "Trust checks")}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {tr("verify.title", "Account verification")}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              {tr(
                "verify.subtitle",
                "Verify email and phone details to improve marketplace trust and unlock safer publishing flows.",
              )}
            </p>
          </div>

          <Card
            className={
              isFullyVerified
                ? "lyvox-trust-gradient rounded-2xl border-transparent text-white shadow-[var(--shadow-card)]"
                : "rounded-2xl border-border/70 bg-muted shadow-[var(--shadow-soft)]"
            }
          >
            <CardHeader>
              <div className="flex items-start gap-3">
                {isFullyVerified ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-white" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                )}
                <div>
                  <CardTitle className={isFullyVerified ? "text-white" : "text-foreground"}>
                    {isFullyVerified
                      ? tr("verify.ready_title", "Ready to publish")
                      : tr("verify.required_title", "Verification required")}
                  </CardTitle>
                  <CardDescription className={isFullyVerified ? "text-white/85" : "text-muted-foreground"}>
                    {isFullyVerified
                      ? tr("verify.ready_desc", "Your account has the required trust checks.")
                      : tr("verify.required_desc", "Complete both checks before posting with full trust signals.")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {isFullyVerified ? (
              <CardContent>
                <Button asChild variant="secondary">
                  <Link href="/post">{tr("verify.post_listing", "Post a listing")}</Link>
                </Button>
              </CardContent>
            ) : null}
          </Card>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                  <CardTitle>{tr("verify.email_title", "Email address")}</CardTitle>
                </div>
                {verifiedEmail ? (
                  <Badge className="lyvox-trust-gradient border-transparent text-white">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {tr("verify.verified", "Verified")}
                  </Badge>
                ) : (
                  <Badge variant="destructive">{tr("verify.not_verified", "Not verified")}</Badge>
                )}
              </div>
              <CardDescription>{user.email}</CardDescription>
            </CardHeader>
            <CardContent>
              {verifiedEmail ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {tr(
                    "verify.email_done",
                    "Your email is verified. Marketplace updates and buyer/seller notifications can reach this address.",
                  )}
                </p>
              ) : (
                <VerifyEmailClient email={user.email!} />
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
                  <CardTitle>{tr("verify.phone_title", "Phone number")}</CardTitle>
                </div>
                {verifiedPhone ? (
                  <Badge className="lyvox-trust-gradient border-transparent text-white">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {tr("verify.verified", "Verified")}
                  </Badge>
                ) : (
                  <Badge variant="destructive">{tr("verify.not_verified", "Not verified")}</Badge>
                )}
              </div>
              <CardDescription>{phone || tr("verify.no_phone", "No phone number added")}</CardDescription>
            </CardHeader>
            <CardContent>
              {verifiedPhone ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {tr(
                    "verify.phone_done",
                    "Your phone is verified. Buyers can use stronger trust signals when deciding to contact you.",
                  )}
                </p>
              ) : (
                <VerifyPhoneClient userId={user.id} currentPhone={phone} />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/70 bg-muted shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle>{tr("verify.help_title", "Need help?")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground md:grid-cols-3">
            <p>
              <strong className="text-foreground">{tr("verify.help_email_q", "No email?")}</strong>{" "}
              {tr("verify.help_email_a", "Check spam or request another confirmation email.")}
            </p>
            <p>
              <strong className="text-foreground">{tr("verify.help_phone_q", "Phone issue?")}</strong>{" "}
              {tr("verify.help_phone_a", "Use international format such as +32.")}
            </p>
            <p>
              <strong className="text-foreground">{tr("verify.help_blocked_q", "Still blocked?")}</strong>{" "}
              <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
                {tr("verify.contact_support", "Contact support")}
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
