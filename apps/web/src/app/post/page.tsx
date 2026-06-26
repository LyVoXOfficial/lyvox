import { supabaseServer } from "@/lib/supabaseServer";
import { getI18nProps } from "@/i18n/server";
import type { Category } from "@/lib/types";
import { PostForm } from "./PostForm";
import Link from "next/link";
import { AlertTriangle, Mail, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

async function getCategories(): Promise<Category[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name_ru, path, is_active, level, parent_id, icon, sort, name_en, name_nl, name_fr")
    .eq("is_active", true)
    .order("sort", { ascending: true })
    .order("name_ru", { ascending: true });

  if (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
  return data as Category[];
}

async function getAdvertForEdit(id: string, userId: string) {
  const supabase = await supabaseServer();
  const { data: ad, error } = await supabase
    .from("adverts")
    .select("*, media(id, url, sort), ad_item_specifics(specifics)")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(`Failed to fetch advert ${id} for editing:`, error);
    return null;
  }

  // Massage the data a bit
  if (ad) {
    const specifics = (ad.ad_item_specifics as any)?.[0]?.specifics ?? {};
    const media = ad.media ?? [];
    return { ...ad, specifics, media };
  }

  return null;
}

async function getUserPhone(userId: string): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data: phone, error } = await supabase
    .from("phones")
    .select("e164")
    .eq("user_id", userId)
    .eq("verified", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch user phone:", error);
    return null;
  }

  return phone?.e164 || null;
}

export default async function PostPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { messages } = await getI18nProps();
  const t = (key: string) => key.split('.').reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;
  const tf = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };


  if (!user) {
    return (
      <main className="container mx-auto flex min-h-[60vh] max-w-xl items-center p-4">
        <Card className="w-full rounded-md">
          <CardHeader>
            <CardTitle>{t("post.post_ad")}</CardTitle>
            <CardDescription>
              {tf(
                "post.signin_intro",
                "Sign in before creating a listing so drafts, buyer messages, and verification stay attached to one account.",
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

  // Check verification status
  const { data: profile } = await supabase
    .from("profiles")
    .select("verified_email, verified_phone")
    .eq("id", user.id)
    .maybeSingle();

  const verifiedEmail = profile?.verified_email ?? false;
  const verifiedPhone = profile?.verified_phone ?? false;

  // Redirect to verification page if not verified
  if (!verifiedEmail || !verifiedPhone) {
    return (
      <main className="container mx-auto flex min-h-[60vh] max-w-2xl items-center p-4">
        <Card className="w-full rounded-md border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-amber-950 dark:text-amber-100">
              {tf("post.verify_title", "Verify your account before publishing")}
            </CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              {tf(
                "post.verify_body",
                "Listings require confirmed contact details to reduce fraud and keep buyer conversations accountable.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              {!verifiedEmail && (
                <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {tf("post.email_missing", "Email confirmation is missing")}
                </p>
              )}
              {!verifiedPhone && (
                <p className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {tf("post.phone_missing", "Phone verification is missing")}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/verify">{tf("post.goto_verify", "Go to verification")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  {tf("post.review_profile", "Review profile")}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }
  const categories = await getCategories();
  const editId = typeof searchParams.edit === 'string' ? searchParams.edit : null;
  const advertToEdit = editId ? await getAdvertForEdit(editId, user.id) : null;
  const userPhone = await getUserPhone(user.id);

  if (editId && !advertToEdit) {
     return (
      <main className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">{t("post.not_found_or_not_owner")}</h1>
      </main>
    );
  }

  const { locale } = await getI18nProps();

  return (
    <main className="container mx-auto max-w-3xl p-4">
       <PostForm
        categories={categories}
        userId={user.id}
        advertToEdit={advertToEdit}
        locale={locale}
        userPhone={userPhone}
      />
    </main>
  );
}
