import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import PasswordResetForm from "./PasswordResetForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/recovery?error=invalid_or_expired");
  }

  return <PasswordResetForm />;
}
