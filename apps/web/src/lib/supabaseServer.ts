import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          const set = (cookieStore as unknown as { set?: Function }).set;
          if (!set) return;
          cookies.forEach(({ name, value, options }) => {
            set.call(cookieStore, { name, value, ...options });
          });
        },
      },
    }
  );
}
