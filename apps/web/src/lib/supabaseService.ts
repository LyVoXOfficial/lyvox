import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabaseTypes";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient<Database> | null = null;

export async function supabaseService(): Promise<SupabaseClient<Database>> {
  if (url && serviceKey) {
    if (!cached) {
      cached = createClient<Database>(url, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }

    return cached;
  }

  throw new Error(
    "supabaseService: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set — refusing to fall back to a non-service client.",
  );
}
