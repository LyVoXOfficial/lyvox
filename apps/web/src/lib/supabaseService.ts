import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabaseTypes";
import { supabaseServer } from "./supabaseServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient<Database> | null = null;
let warnedAboutFallback = false;

export function supabaseService(): SupabaseClient<Database> {
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

  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn(
      "supabaseService: SUPABASE_SERVICE_ROLE_KEY или NEXT_PUBLIC_SUPABASE_URL не заданы. Используется fallback на supabaseServer().",
    );
  }

  return supabaseServer();
}
