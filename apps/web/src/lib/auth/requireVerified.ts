import type { SupabaseClient } from "@supabase/supabase-js";

/** True iff the user's phone is verified by EITHER signal (phones.verified OR profiles.verified_phone).
 *  OR — not ?? — so a stale phones.verified=false row can't mask a verified profile, and vice-versa. */
export async function isViewerVerified(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<boolean> {
  const [profileRes, phoneRes] = await Promise.all([
    supabase.from("profiles").select("verified_phone").eq("id", userId).maybeSingle(),
    supabase.from("phones").select("verified").eq("user_id", userId).maybeSingle(),
  ]);
  const profileVerified = (profileRes.data as { verified_phone?: boolean } | null)?.verified_phone === true;
  const phoneVerified = (phoneRes.data as { verified?: boolean } | null)?.verified === true;
  return profileVerified || phoneVerified;
}
