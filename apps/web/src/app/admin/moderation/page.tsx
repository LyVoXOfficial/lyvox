import { getI18nProps } from "@/i18n/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import ModerationQueueClient from "@/components/admin/ModerationQueueClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function ModerationQueuePage() {
  const { t, locale } = await getI18nProps(["admin", "common"]);
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

  return (
    <div className="container mx-auto p-4">
      <ModerationQueueClient
        initialAdverts={queueData || []}
        t={t}
        locale={locale}
      />
    </div>
  );
}

