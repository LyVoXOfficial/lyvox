import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { MfaChallenge } from "./MfaChallenge";

export const dynamic = "force-dynamic";

export default async function AdminMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { next } = await searchParams;
  const nextPath = next?.startsWith("/admin") ? next : "/admin";

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/auth/mfa?next=${nextPath}`)}`);
  }

  return (
    <main className="container mx-auto flex min-h-[70vh] items-center justify-center px-4 py-10">
      <MfaChallenge nextPath={nextPath} />
    </main>
  );
}
