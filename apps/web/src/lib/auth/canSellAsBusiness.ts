// apps/web/src/lib/auth/canSellAsBusiness.ts  (D4 — does NOT require entity_verified)
import { isViewerVerified } from "@/lib/auth/requireVerified";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function canSellAsBusiness(
  supabase: SupabaseClient, userId: string, businessId: string,
): Promise<{ ok: true } | { ok: false; reason: "phone" | "membership" | "not_active" }> {
  if (!(await isViewerVerified(supabase, userId))) return { ok: false, reason: "phone" };
  const { data: isMember } = await supabase.rpc("is_business_member", { b_id: businessId, min_role: "member" });
  if (!isMember) return { ok: false, reason: "membership" };
  const { data: b } = await supabase.from("businesses").select("status").eq("id", businessId).maybeSingle();
  if ((b as { status?: string } | null)?.status !== "active") return { ok: false, reason: "not_active" };
  return { ok: true };
}
