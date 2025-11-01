import { supabaseServer } from "@/lib/supabaseServer";
import { getI18nProps } from "@/i18n/server";
import { PostForm } from "./PostForm";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

async function getCategories(): Promise<Category[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name_ru, path, is_active")
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
  const supabase = supabaseServer();
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
  const supabase = supabaseServer();
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
  const {
    data: { user },
  } = await supabaseServer().auth.getUser();
  const { messages } = await getI18nProps();
  const t = (key: string) => key.split('.').reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;


  if (!user) {
    return (
      <main className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold">{t("post.post_ad")}</h1>
        <p className="mt-4">
          {t("post.please")}{" "}
          <a href="/login" className="underline">
            {t("profile.login")}
          </a>
          , {t("post.to_post")}.
        </p>
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
