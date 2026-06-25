import { getI18nProps } from "@/i18n/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasAdminRole } from "@/lib/adminRole";
import { redirect } from "next/navigation";
import ModerationQueueClient from "@/components/admin/ModerationQueueClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ModerationQueuePage() {
  const { locale, messages } = await getI18nProps();
  const t = (key: string) =>
    key.split(".").reduce<any>((acc, part) => (acc ? acc[part] : undefined), messages) ?? key;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is admin
  const isAdmin = hasAdminRole(user);
  if (!isAdmin) {
    redirect("/");
  }

  // Fetch initial moderation queue
  const { data: queueData, error } = await supabase
    .from("adverts")
    .select(
      `
      id,
      title,
      description,
      price,
      currency,
      status,
      moderation_status,
      ai_moderation_score,
      ai_moderation_reason,
      created_at,
      user_id,
      profiles!adverts_user_id_fkey (
        display_name,
        verified_email,
        verified_phone
      ),
      categories (
        name_en,
        name_nl,
        name_fr,
        name_de,
        name_ru
      )
    `,
    )
    .in("moderation_status", ["pending", "pending_review", "flagged"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching moderation queue:", error);
  }

  const initialAdverts = (queueData || []).map((advert) => {
    const profile =
      (advert.profiles as unknown as
        | {
            display_name: string | null;
            verified_email: boolean | null;
            verified_phone: boolean | null;
          }
        | null) ?? null;

    return {
      id: advert.id,
      title: advert.title,
      description: advert.description ?? null,
      price: advert.price ?? null,
      currency: advert.currency ?? null,
      status: advert.status,
      moderation_status: advert.moderation_status ?? "pending",
      ai_moderation_score: advert.ai_moderation_score ?? null,
      ai_moderation_reason: advert.ai_moderation_reason ?? null,
      created_at: advert.created_at ?? "",
      user_id: advert.user_id,
      profiles: profile
        ? {
            display_name: profile.display_name,
            verified_email: Boolean(profile.verified_email),
            verified_phone: Boolean(profile.verified_phone),
          }
        : null,
      categories:
        (advert.categories as
          | {
              name_en: string | null;
              name_nl: string | null;
              name_fr: string | null;
              name_de: string | null;
              name_ru: string | null;
            }
          | null) ?? null,
    };
  });

  return (
    <div className="container mx-auto p-4">
      <ModerationQueueClient
        initialAdverts={initialAdverts}
        t={t}
        locale={locale}
      />
    </div>
  );
}
