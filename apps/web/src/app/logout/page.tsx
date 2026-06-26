"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/i18n";

// A guaranteed escape hatch: clears BOTH the client Supabase session (localStorage) and the server
// cookie, then sends you to /login. Reachable directly at /logout even when the header's account
// menu (and its sign-out button) isn't showing because the client didn't detect the session.
export default function LogoutPage() {
  const { t } = useI18n();

  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      try {
        await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
      } catch {
        /* ignore */
      }
      window.location.replace("/login");
    })();
  }, []);

  return (
    <main className="container mx-auto flex min-h-[50vh] max-w-md items-center justify-center p-4">
      <p className="text-sm text-muted-foreground">{t("nav.sign_out")}…</p>
    </main>
  );
}
