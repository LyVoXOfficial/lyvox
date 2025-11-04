import Link from "next/link";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseService } from "@/lib/supabaseService";
import { hasAdminRole } from "@/lib/adminRole";

export const runtime = "nodejs";
export const revalidate = 0;

type ReportItem = {
  id: number;
  reason: string;
  details: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string | null;
  advert_id: string;
  reporter: string;
  reviewed_by: string | null;
  adverts?: { id: string; title: string | null; user_id: string | null } | null;
};

const TABS: Array<{ value: ReportItem["status"]; label: string }> = [
  { value: "pending", label: "В ожидании" },
  { value: "accepted", label: "Приняты" },
  { value: "rejected", label: "Отклонены" },
];

const REASON_LABEL: Record<string, string> = {
  fraud: "Мошенничество",
  spam: "Спам",
  duplicate: "Дубликат",
  nsfw: "Непристойный контент",
  other: "Другое",
};

function formatReason(reason: string) {
  return REASON_LABEL[reason] ?? reason;
}

function encodeError(message: string) {
  return Buffer.from(message, "utf8").toString("base64url");
}

function decodeError(value: string | null) {
  if (!value) return null;
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return value;
  }
}

function normalizeStatus(value: string | null): ReportItem["status"] {
  if (!value) return "pending";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "accepted" || trimmed === "rejected") return trimmed;
  return "pending";
}

async function setFlash(message: string | null) {
  const store = await cookies();
  if (message) {
    store.set("moderation_error", encodeError(message), {
      path: "/admin/reports",
      maxAge: 10,
    });
  } else {
    store.delete("moderation_error");
  }
}

async function updateReport(
  id: number,
  newStatus: "accepted" | "rejected",
  unpublish: boolean,
) {
  "use server";

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash("Необходимо авторизоваться");
    revalidatePath("/admin/reports");
    return;
  }

  if (!hasAdminRole(user)) {
    await setFlash("Недостаточно прав");
    revalidatePath("/admin/reports");
    return;
  }

  let service;
  try {
    service = supabaseService();
  } catch {
    await setFlash(
      "SUPABASE_SERVICE_ROLE_KEY не настроен. Укажите переменную окружения SUPABASE_SERVICE_ROLE_KEY на сервере.",
    );
    revalidatePath("/admin/reports");
    return;
  }

  const { data: report, error: fetchError } = await service
    .from("reports")
    .select("id, advert_id, status, reporter, adverts:advert_id ( id, user_id )")
    .eq("id", id)
    .single();

  if (fetchError || !report) {
    await setFlash(fetchError?.message ?? "Жалоба не найдена");
    revalidatePath("/admin/reports");
    return;
  }

  const { error: updateError } = await service
    .from("reports")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    await setFlash(updateError.message);
    revalidatePath("/admin/reports");
    return;
  }

  if (newStatus === "accepted" && report.adverts?.user_id) {
    const { error: trustError } = await service.rpc("trust_inc", {
      uid: report.adverts.user_id,
      pts: -15,
    });

    if (trustError) {
      await setFlash(trustError.message);
      revalidatePath("/admin/reports");
      return;
    }

    if (unpublish) {
      const { error: unpublishError } = await service
        .from("adverts")
        .update({ status: "inactive" })
        .eq("id", report.adverts.id);

      if (unpublishError) {
        await setFlash(unpublishError.message);
        revalidatePath("/admin/reports");
        return;
      }
    }
  }

  await setFlash(null);
  revalidatePath("/admin/reports");
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <main className="p-4 text-sm text-red-600">Необходимо авторизоваться.</main>;
  }

  if (!hasAdminRole(user)) {
    return <main className="p-4 text-sm text-red-600">Доступ запрещён.</main>;
  }

  let service;
  try {
    service = supabaseService();
  } catch {
    return (
      <main className="p-4 text-sm text-red-600">
        SUPABASE_SERVICE_ROLE_KEY не настроен. Укажите переменную окружения SUPABASE_SERVICE_ROLE_KEY на сервере.
      </main>
    );
  }

  const cookieStore = await cookies();
  const flashError = decodeError(cookieStore.get("moderation_error")?.value ?? null);

  const rawStatus = Array.isArray(searchParams?.status)
    ? searchParams?.status[0] ?? null
    : searchParams?.status ?? null;
  const status = normalizeStatus(rawStatus);

  const { data, error } = await service
    .from("reports")
    .select(
      `id, reason, details, status, created_at, updated_at, advert_id, reporter, reviewed_by, adverts:advert_id ( id, title, user_id )`
    )
    .order("created_at", { ascending: false });

  const items: ReportItem[] = ((data ?? []) as ReportItem[]).filter(
    (report) => normalizeStatus(report.status) === status,
  );
  const loadError = error?.message ?? null;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Модерация жалоб</h1>

      {(flashError || loadError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {flashError || loadError}
        </div>
      )}

      <div className="flex gap-2 text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`?status=${tab.value}`}
            className={`rounded-xl border px-3 py-1 ${
              status === tab.value ? "bg-black text-white" : "hover:bg-muted"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {!items.length ? (
        <p className="text-sm text-muted-foreground">Жалоб нет.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((report) => {
            const acceptAction = updateReport.bind(null, report.id, "accepted", false);
            const acceptAndUnpublishAction = updateReport.bind(
              null,
              report.id,
              "accepted",
              true,
            );
            const rejectAction = updateReport.bind(null, report.id, "rejected", false);

            return (
              <div key={report.id} className="space-y-3 rounded-2xl border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      #{report.id} • {formatReason(report.reason)} • {" "}
                      {new Date(report.created_at).toLocaleString("ru-RU")}
                    </div>
                    <div className="text-muted-foreground">
                      Объявление: {report.advert_id} • Жалобщик: {report.reporter}
                    </div>
                    {report.details && (
                      <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                        {report.details}
                      </div>
                    )}
                  </div>
                  <Link href={`/ad/${report.advert_id}`} className="text-sm underline">
                    Открыть объявление
                  </Link>
                </div>

                {status === "pending" ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={acceptAction}>
                      <button type="submit" className="rounded-xl bg-black px-3 py-1.5 text-white">
                        Принять
                      </button>
                    </form>
                    <form action={acceptAndUnpublishAction}>
                      <button type="submit" className="rounded-xl border px-3 py-1.5">
                        Принять + снять с публикации
                      </button>
                    </form>
                    <form action={rejectAction}>
                      <button type="submit" className="rounded-xl border px-3 py-1.5">
                        Отклонить
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Статус изменён: {" "}
                    {new Date(report.updated_at ?? report.created_at).toLocaleString("ru-RU")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

