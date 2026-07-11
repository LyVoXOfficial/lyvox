import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseServer } from "@/lib/supabaseServer";
import { getI18nProps } from "@/i18n/server";

function createTr(messages: Record<string, unknown>) {
  return (key: string, fallback: string): string => {
    const value = key
      .split(".")
      .reduce<unknown>((acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined), messages);
    return typeof value === "string" && value.length > 0 ? value : fallback;
  };
}

export const metadata = {
  title: "Edit profile | LyVoX",
  description: "Update marketplace profile details.",
};

async function updateProfileAction(formData: FormData) {
  "use server";

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile/edit");
  }

  const displayNameRaw = formData.get("display_name");
  const phoneRaw = formData.get("phone");
  const displayName =
    typeof displayNameRaw === "string" && displayNameRaw.trim()
      ? displayNameRaw.trim().slice(0, 100)
      : user.email?.split("@")[0] || "LyVoX user";
  const phone = typeof phoneRaw === "string" && phoneRaw.trim() ? phoneRaw.trim() : null;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, phone })
    .eq("id", user.id)
    .select("id")
    .single();

  if (error) {
    redirect("/profile/edit?status=error");
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  redirect("/profile?updated=profile");
}

type PageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function ProfileEditPage({ searchParams }: PageProps) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile/edit");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const { messages } = await getI18nProps();
  const tr = createTr(messages as Record<string, unknown>);

  return (
    <main className="bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:py-10">
        <Button asChild variant="ghost" size="sm" className="px-0">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {tr("profile.back_to_profile", "Back to profile")}
          </Link>
        </Button>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <div className="lyvox-trust-gradient inline-flex w-fit items-center gap-2 rounded-xl px-3 py-1 text-xs font-medium text-white">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {tr("profile.public_identity", "Public identity")}
            </div>
            <CardTitle className="text-2xl font-extrabold tracking-tight">
              {tr("profile.edit_profile", "Edit profile")}
            </CardTitle>
            <CardDescription>
              {tr(
                "profile.edit_intro",
                "Keep your seller profile clear and consistent. Buyers use these details before starting a conversation.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchParams?.status === "error" ? (
              <div className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {tr("profile.edit_save_error", "Could not save your profile. Check the values and try again.")}
              </div>
            ) : null}

            <form action={updateProfileAction} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="display_name">{tr("profile.display_name", "Display name")}</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  type="text"
                  defaultValue={profile?.display_name || user.email?.split("@")[0] || ""}
                  placeholder={tr("profile.display_name_placeholder", "Your public name")}
                  maxLength={100}
                  className="rounded-xl focus:ring-4 focus:ring-primary/12"
                />
                <p className="text-xs text-muted-foreground">
                  {tr("profile.display_name_hint", "Shown on your listings, profile, and chat conversations.")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{tr("profile.email", "Email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email || ""}
                  disabled
                  className="rounded-xl bg-muted focus:ring-4 focus:ring-primary/12"
                />
                <p className="text-xs text-muted-foreground">
                  {tr("profile.email_hint", "Email changes are handled through account security.")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{tr("profile.phone", "Phone")}</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={profile?.phone || ""}
                  placeholder="+32 XXX XX XX XX"
                  className="rounded-xl focus:ring-4 focus:ring-primary/12"
                />
                <p className="text-xs text-muted-foreground">
                  {tr(
                    "profile.phone_hint",
                    "Used for trust checks and buyer contact preferences. Verify it from the verification page.",
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="flex-1">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {tr("profile.save_profile", "Save profile")}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/profile">{tr("common.cancel", "Cancel")}</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
