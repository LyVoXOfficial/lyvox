import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { coerceConsentSnapshot } from "@/lib/consents";
import ConsentSettings from "./ConsentSettings";
import { getI18nProps } from "@/i18n/server";
import { formatDate } from "@/i18n/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type ProfileRow = {
  display_name: string | null;
  phone: string | null;
  verified_email: boolean | null;
  verified_phone: boolean | null;
  created_at: string | null;
  consents: Record<string, unknown> | null;
};

async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, phone, verified_email, verified_phone, created_at, consents")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("PROFILE_FETCH_FAILED", error.message);
    return null;
  }

  return (data as ProfileRow | null) ?? null;
}

export default async function ProfilePage() {
  const supabase = supabaseServer();
  const { locale, messages } = await getI18nProps();
  const t = (key: string) => key.split('.').reduce<any>((acc, p) => (acc ? acc[p] : undefined), messages) ?? key;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <p>
          {t("profile.not_auth")} {" "}
          <Link href="/login" className="underline">{t("profile.login")}</Link>{" "}
          {t("profile.or")}{" "}
          <Link href="/register" className="underline">{t("profile.register")}</Link>
        </p>
      </main>
    );
  }

  const profile = await loadProfile(supabase, user.id);

  const [phoneResult, trustResult] = await Promise.all([
    supabase.from("phones").select("e164, verified").eq("user_id", user.id).maybeSingle(),
    supabase.from("trust_score").select("score").eq("user_id", user.id).maybeSingle(),
  ]);

  const phoneRow = phoneResult.error ? null : phoneResult.data;
  const trust = trustResult.error ? null : trustResult.data;

  const displayName = profile?.display_name ?? "—";
  const phoneValue = phoneRow?.e164 ?? profile?.phone ?? "—";
  const phoneVerified = phoneRow?.verified ?? profile?.verified_phone ?? false;
  const emailVerified = profile?.verified_email ?? !!user.email_confirmed_at;
  const createdAt = profile?.created_at ?? user.created_at ?? null;
  const createdAtText = createdAt ? formatDate(createdAt, locale) : "-";

  const consentSnapshot = coerceConsentSnapshot(profile?.consents ?? null);
  const marketingOptIn = consentSnapshot?.marketing?.accepted ?? false;
  const marketingUpdatedAt = consentSnapshot?.marketing?.accepted_at ?? null;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t("profile.title")}</h1>

      <div className="rounded-2xl border p-4">
        <div className="text-sm text-muted-foreground">Email</div>
        <div className="font-medium">{user.email}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">{t("profile.display_name")}</div>
          <div className="font-medium">{displayName}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">{t("profile.phone")}</div>
          <div className="flex flex-wrap items-center gap-2 font-medium">
            <span>{phoneValue}</span>
            {phoneVerified ? (
              <span className="text-sm text-muted-foreground">📱 {t("profile.phone_verified")}</span>
            ) : (
              <Link className="underline" href="/profile/phone">
                {t("profile.verify")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">{t("profile.email_verification")}</div>
          <div className="font-medium">
            {emailVerified ? "✅ " + t("profile.verified") : "— (" + t("profile.pending") + ")"}
          </div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Trust Score</div>
          <div className="font-medium">⭐ {trust?.score ?? 0}</div>
        </div>
      </div>

      <div className="rounded-2xl border p-4">
        <div className="text-sm text-muted-foreground">{t("profile.account_created")}</div>
        <div className="font-medium">{createdAtText}</div>
      </div>

      <div className="flex gap-2">
        <Link
          href="/profile/edit"
          className="rounded-xl border px-3 py-2 hover:bg-muted"
        >
          {t("profile.edit")}
        </Link>
        <Link
          href="/profile/ads"
          className="rounded-xl border px-3 py-2 hover:bg-muted"
        >
          {t("profile.my_ads")}
        </Link>
      </div>

      <ConsentSettings initialMarketingOptIn={marketingOptIn} lastUpdated={marketingUpdatedAt} />
    </main>
  );
}

