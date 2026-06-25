import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseServer } from "@/lib/supabaseServer";

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

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName,
      phone,
    },
    { onConflict: "id" },
  );

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

  return (
    <main className="bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:py-10">
        <Button asChild variant="ghost" size="sm" className="px-0">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to profile
          </Link>
        </Button>

        <Card className="rounded-md border-border/80 shadow-sm">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Public identity
            </div>
            <CardTitle className="text-2xl">Edit profile</CardTitle>
            <CardDescription>
              Keep your seller profile clear and consistent. Buyers use these details before starting a conversation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchParams?.status === "error" ? (
              <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                Could not save your profile. Check the values and try again.
              </div>
            ) : null}

            <form action={updateProfileAction} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  type="text"
                  defaultValue={profile?.display_name || user.email?.split("@")[0] || ""}
                  placeholder="Your public name"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">Shown on your listings, profile, and chat conversations.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user.email || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email changes are handled through account security.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={profile?.phone || ""}
                  placeholder="+32 XXX XX XX XX"
                />
                <p className="text-xs text-muted-foreground">
                  Used for trust checks and buyer contact preferences. Verify it from the verification page.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="flex-1">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Save profile
                </Button>
                <Button asChild variant="outline">
                  <Link href="/profile">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
