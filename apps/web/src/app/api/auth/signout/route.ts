import { supabaseServer } from "@/lib/supabaseServer";
import { createSuccessResponse } from "@/lib/apiErrors";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return createSuccessResponse({});
}
