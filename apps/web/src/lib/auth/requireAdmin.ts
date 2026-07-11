import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { hasAdminRole } from "@/lib/adminRole";
import { supabaseServer } from "@/lib/supabaseServer";

export type AdminAccessFailure = "unauthenticated" | "forbidden" | "mfa_required";

export type AdminAccessResult =
  | { ok: true; user: User }
  | { ok: false; reason: AdminAccessFailure };

/** Authoritative server-side admin + AAL2 check for pages, actions and APIs. */
export async function getAdminAccess(): Promise<AdminAccessResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthenticated" };
  if (!hasAdminRole(user)) return { ok: false, reason: "forbidden" };

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || data.currentLevel !== "aal2") {
    return { ok: false, reason: "mfa_required" };
  }

  return { ok: true, user };
}

export async function requireAdminPage(returnTo = "/admin"): Promise<User> {
  const access = await getAdminAccess();
  if (access.ok) return access.user;

  if (access.reason === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  if (access.reason === "mfa_required") {
    redirect(`/auth/mfa?next=${encodeURIComponent(returnTo)}`);
  }
  redirect("/");
}
