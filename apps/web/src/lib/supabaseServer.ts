import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/lib/supabaseTypes";

export function supabaseServer() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const store = await cookies();
          return store.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions = {}) {
          const store = await cookies();
          await store.set({ name, value, ...options });
        },
        async remove(name: string, options: CookieOptions = {}) {
          const store = await cookies();
          await store.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    },
  );
}
