import Link from "next/link";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
type ServiceClient = Awaited<ReturnType<typeof supabaseService>>;
import { supabaseService } from "@/lib/supabaseService";
import { hasAdminRole } from "@/lib/adminRole";

export const runtime = "nodejs";
export const revalidate = 0;

function getFirstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value.length ? value[0] ?? null : null;
  }
  return value ?? null;
}

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

type ModerationRow = {
  id: number;
  advert_id: string;
  status: string;
  reporter: string;
  adverts: { id: string; user_id: string | null } | null;
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

const AVAILABLE_REASONS = Object.keys(REASON_LABEL);

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

function normalizeReason(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return AVAILABLE_REASONS.includes(trimmed) ? trimmed : null;
}

function sanitizeSearch(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

async function moderateReport(
  service: ServiceClient,
  actorId: string,
  id: number,
  newStatus: "accepted" | "rejected",
  unpublish: boolean,
): Promise<{ success: boolean; error?: string }> {
  const { data: report, error: fetchError } = await service
    .from("reports")
    .select("id, advert_id, status, reporter, adverts:advert_id ( id, user_id )")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !report) {
    return {
      success: false,
      error: fetchError?.message ?? "Жалоба не найдена",
    };
  }

  const { error: updateError } = await service
    .from("reports")
    .update({
      status: newStatus,
      reviewed_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (newStatus === "accepted" && report.adverts?.user_id) {
    const { error: trustError } = await service.rpc("trust_inc", {
      uid: report.adverts.user_id,
      pts: -15,
    });

    if (trustError) {
      return { success: false, error: trustError.message };
    }

    if (unpublish) {
      const { error: unpublishError } = await service
        .from("adverts")
        .update({ status: "inactive" })
        .eq("id", report.adverts.id);

      if (unpublishError) {
        return { success: false, error: unpublishError.message };
      }
    }
  }

  return { success: true };
}

async function updateReport(
  id: number,
  newStatus: "accepted" | "rejected",
  unpublish: boolean,
) {
  "use server";

  const supabase = await supabaseServer();
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

  let service: ServiceClient;
  try {
    service = await supabaseService();
  } catch {
    await setFlash(
      "SUPABASE_SERVICE_ROLE_KEY не настроен. Укажите переменную окружения SUPABASE_SERVICE_ROLE_KEY на сервере.",
    );
    revalidatePath("/admin/reports");
    return;
  }

  const result = await moderateReport(service, user.id, id, newStatus, unpublish);

  if (!result.success) {
    await setFlash(result.error ?? "Не удалось обновить жалобу");
  } else {
    await setFlash(null);
  }

  revalidatePath("/admin/reports");
}

async function bulkUpdateReports(formData: FormData) {
  "use server";

  const idsRaw = formData.getAll("ids");
  const action = String(formData.get("action") ?? "");
  const ids = idsRaw
    .map((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    })
    .filter((value): value is number => value !== null);

  if (!ids.length) {
    await setFlash("Выберите хотя бы одну жалобу");
    revalidatePath("/admin/reports");
    return;
  }

  let newStatus: "accepted" | "rejected";
  let unpublish = false;

  switch (action) {
    case "accept":
      newStatus = "accepted";
      break;
    case "accept_unpublish":
      newStatus = "accepted";
      unpublish = true;
      break;
    case "reject":
      newStatus = "rejected";
      break;
    default:
      await setFlash("Неизвестное действие для массового обновления");
      revalidatePath("/admin/reports");
      return;
  }

  const supabase = await supabaseServer();
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

  let service: ServiceClient;
  try {
    service = await supabaseService();
  } catch {
    await setFlash(
      "SUPABASE_SERVICE_ROLE_KEY не настроен. Укажите переменную окружения SUPABASE_SERVICE_ROLE_KEY на сервере.",
    );
    revalidatePath("/admin/reports");
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  for (const id of ids) {
    const result = await moderateReport(service, user.id, id, newStatus, unpublish);
    if (result.success) {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  if (failureCount === 0) {
    await setFlash(null);
  } else if (successCount === 0) {
    await setFlash("Не удалось обновить выбранные жалобы");
  } else {
    await setFlash(
      `Часть жалоб не обновлена (${failureCount} из ${ids.length}). Проверьте сообщения и повторите попытку.`,
    );
  }

  revalidatePath("/admin/reports");
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <main className="p-4 text-sm text-red-600">Необходимо авторизоваться.</main>;
  }

  if (!hasAdminRole(user)) {
    return <main className="p-4 text-sm text-red-600">Доступ запрещён.</main>;
  }

  let service: ServiceClient;
  try {
    service = await supabaseService();
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

  const rawReason = getFirstParam(searchParams?.reason);
  const reason = normalizeReason(rawReason);
  const rawSearch = getFirstParam(searchParams?.q);
  const searchQuery = sanitizeSearch(rawSearch);

  let query = service
    .from("reports")
    .select(
      `id, reason, details, status, created_at, updated_at, advert_id, reporter, reviewed_by, adverts:advert_id ( id, title, user_id )`
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (reason) {
    query = query.eq("reason", reason);
  }

  if (searchQuery) {
    const sanitized = searchQuery.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,");
    const pattern = `%${sanitized}%`;
    query = query.or(
      `advert_id.ilike.${pattern},reporter.ilike.${pattern},adverts.title.ilike.${pattern}`,
    );
  }

  const { data, error } = await query;

  const items: ReportItem[] = (data ?? []) as ReportItem[];
  const loadError = error?.message ?? null;

  const createTabHref = (targetStatus: ReportItem["status"]) => {
    const params = new URLSearchParams();
    params.set("status", targetStatus);
    if (reason) params.set("reason", reason);
    if (searchQuery) params.set("q", searchQuery);
    return `?${params.toString()}`;
  };

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
            href={createTabHref(tab.value)}
            className={`rounded-xl border px-3 py-1 ${
              status === tab.value ? "bg-black text-white" : "hover:bg-muted"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border bg-muted/20 p-3 text-sm"
      >
        <input type="hidden" name="status" value={status} />
        <div className="flex min-w-[200px] flex-col gap-1">
          <label
            htmlFor="reason-filter"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Причина
          </label>
          <select
            id="reason-filter"
            name="reason"
            defaultValue={reason ?? ""}
            className="rounded-lg border px-3 py-1.5"
          >
            <option value="">Все причины</option>
            {AVAILABLE_REASONS.map((code) => (
              <option key={code} value={code}>
                {formatReason(code)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-[240px] flex-col gap-1">
          <label
            htmlFor="search-filter"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Поиск
          </label>
          <input
            id="search-filter"
            name="q"
            defaultValue={searchQuery ?? ""}
            placeholder="ID объявления или жалобщик"
            className="rounded-lg border px-3 py-1.5"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="rounded-xl bg-black px-3 py-1.5 text-white">
            Применить
          </button>
          {(reason || searchQuery) && (
            <Link href={`?status=${status}`} className="rounded-xl border px-3 py-1.5">
              Сбросить
            </Link>
          )}
        </div>
      </form>

      {status === "pending" && (
        <form
          id="bulkForm"
          action={bulkUpdateReports}
          className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/10 p-3 text-sm"
        >
          <span className="font-medium">Массовые действия:</span>
          <button
            type="submit"
            name="action"
            value="accept"
            className="rounded-xl bg-black px-3 py-1.5 text-white"
          >
            Принять
          </button>
          <button
            type="submit"
            name="action"
            value="accept_unpublish"
            className="rounded-xl border px-3 py-1.5"
          >
            Принять и снять с публикации
          </button>
          <button
            type="submit"
            name="action"
            value="reject"
            className="rounded-xl border px-3 py-1.5"
          >
            Отклонить
          </button>
          <span className="text-xs text-muted-foreground">
            Отметьте нужные жалобы галочкой перед выполнением действия.
          </span>
        </form>
      )}

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

            const checkboxId = `select-report-${report.id}`;

            return (
              <div key={report.id} className="space-y-3 rounded-2xl border p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {status === "pending" && (
                      <div className="pt-1">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          name="ids"
                          value={report.id}
                          form="bulkForm"
                          className="h-4 w-4 rounded border"
                          aria-label={`Выбрать жалобу #${report.id}`}
                        />
                      </div>
                    )}
                    <div>
                      <div className="font-medium">
                        #{report.id} • {formatReason(report.reason)} •{" "}
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

