import { supabaseServer } from "@/lib/supabaseServer";
import { createSuccessResponse } from "@/lib/apiErrors";

export const runtime = "nodejs";

export async function POST() {
  const supabase = supabaseServer();
  await supabase.auth.signOut();
  return createSuccessResponse({});
}
