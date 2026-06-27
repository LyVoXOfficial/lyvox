import { supabaseServer } from "@/lib/supabaseServer";
import { isViewerVerified } from "@/lib/auth/requireVerified";
import { getI18nProps } from "@/i18n/server";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProOnboardingWizard } from "./ProOnboardingWizard";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ProPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { messages, locale } = await getI18nProps();

  const t = (key: string) =>
    key.split(".").reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;
  const tf = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  if (!user) {
    return (
      <main className="container mx-auto flex min-h-[60vh] max-w-xl items-center p-4">
        <Card className="w-full rounded-md">
          <CardHeader>
            <CardTitle>{tf("pro.title", "Become a professional seller")}</CardTitle>
            <CardDescription>
              {tf(
                "pro.signin_required",
                "Sign in to register your business and start selling professionally on LyVoX.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">{tf("profile.login", "Sign in")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const verifiedPhone = await isViewerVerified(supabase, user.id);

  if (!verifiedPhone) {
    return (
      <main className="container mx-auto flex min-h-[60vh] max-w-2xl items-center p-4">
        <Card className="w-full rounded-md border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-amber-950 dark:text-amber-100">
              {tf("pro.verify_title", "Phone verification required")}
            </CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              {tf(
                "pro.verify_body",
                "A verified phone number is required to register as a professional seller. This keeps our marketplace trustworthy for all buyers.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/verify">{tf("post.goto_verify", "Go to verification")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">{tf("profile.login", "Sign in")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl p-4">
      <ProOnboardingWizard locale={locale} messages={messages} />
    </main>
  );
}
