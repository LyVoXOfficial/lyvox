import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { coerceConsentSnapshot } from "@/lib/consents";
import ConsentSettings from "./ConsentSettings";

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
    throw error;
  }

  return data ?? null;
}

export default async function ProfilePage() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <p>
          Вы не авторизованы. {" "}
          <Link href="/login" className="underline">Войти</Link>{" или " }
          <Link href="/register" className="underline">Зарегистрироваться</Link>
        </p>
      </main>
    );
  }

  const profile = await loadProfile(supabase, user.id).catch(() => null);

  const [phoneRow, trust] = await Promise.all([
    supabase
      .from("phones")
      .select("e164, verified")
      .eq("user_id", user.id)
      .maybeSingle()
      .then((res) => res.data)
      .catch(() => null),
    supabase
      .from("trust_score")
      .select("score")
      .eq("user_id", user.id)
      .maybeSingle()
      .then((res) => res.data)
      .catch(() => null),
  ]);

  const displayName = profile?.display_name ?? "—";
  const phoneValue = phoneRow?.e164 ?? profile?.phone ?? "—";
  const phoneVerified = phoneRow?.verified ?? profile?.verified_phone ?? false;
  const emailVerified = profile?.verified_email ?? !!user.email_confirmed_at;
  const createdAt = profile?.created_at ?? user.created_at ?? null;
  const createdAtText = createdAt
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(
        new Date(createdAt),
      )
    : "-";

  const consentSnapshot = coerceConsentSnapshot(profile?.consents ?? null);
  const marketingOptIn = consentSnapshot?.marketing?.accepted ?? false;
  const marketingUpdatedAt = consentSnapshot?.marketing?.accepted_at ?? null;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Профиль</h1>

      <div className="rounded-2xl border p-4">
        <div className="text-sm text-muted-foreground">Email</div>
        <div className="font-medium">{user.email}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Отображаемое имя</div>
          <div className="font-medium">{displayName}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Телефон</div>
          <div className="flex flex-wrap items-center gap-2 font-medium">
            <span>{phoneValue}</span>
            {phoneVerified ? (
              <span className="text-sm text-muted-foreground">📱 Подтверждён</span>
            ) : (
              <Link className="underline" href="/profile/phone">
                Подтвердить
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Подтверждение email</div>
          <div className="font-medium">
            {emailVerified ? "✅ Подтверждён" : "— (ожидает подтверждения)"}
          </div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm text-muted-foreground">Trust Score</div>
          <div className="font-medium">⭐ {trust?.score ?? 0}</div>
        </div>
      </div>

      <div className="rounded-2xl border p-4">
        <div className="text-sm text-muted-foreground">Аккаунт создан</div>
        <div className="font-medium">{createdAtText}</div>
      </div>

      <div className="flex gap-2">
        <Link
          href="/profile/edit"
          className="rounded-xl border px-3 py-2 hover:bg-muted"
        >
          Редактировать профиль
        </Link>
        <Link
          href="/profile/ads"
          className="rounded-xl border px-3 py-2 hover:bg-muted"
        >
          Мои объявления
        </Link>
      </div>

      <ConsentSettings initialMarketingOptIn={marketingOptIn} lastUpdated={marketingUpdatedAt} />
    </main>
  );
}

