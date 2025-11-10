import { supabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { getI18nProps } from "@/i18n/server";
import BillingPageClient from "@/components/billing/BillingPageClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function BillingPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Load purchases
  const { data: purchases, error: purchasesError } = await supabase
    .from("purchases")
    .select(
      `
      id,
      product_code,
      provider,
      status,
      amount_cents,
      currency,
      created_at,
      updated_at,
      products (
        code,
        name
      )
    `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (purchasesError) {
    console.error("Error loading purchases:", purchasesError);
  }

  // Load active benefits
  const { data: benefits, error: benefitsError } = await supabase
    .from("benefits")
    .select("id, purchase_id, advert_id, benefit_type, valid_from, valid_until, created_at")
    .eq("user_id", user.id)
    .gt("valid_until", new Date().toISOString())
    .order("valid_until", { ascending: false });

  if (benefitsError) {
    console.error("Error loading benefits:", benefitsError);
  }

  const { messages } = await getI18nProps();

  return (
    <BillingPageClient
      purchases={purchases || []}
      benefits={benefits || []}
      messages={messages}
    />
  );
}

