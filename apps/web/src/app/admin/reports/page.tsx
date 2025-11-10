import Link from "next/link";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
type ServiceClient = Awaited<ReturnType<typeof supabaseService>>;
import { supabaseService } from "@/lib/supabaseService";
import { hasAdminRole } from "@/lib/adminRole";
import { getI18nProps } from "@/i18n/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/i18n/formatDate";
import BulkActionsClient from "@/components/admin/BulkActionsClient";

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

const AVAILABLE_REASONS = ["fraud", "spam", "duplicate", "nsfw", "other"];

function getTabs(messages: any): Array<{ value: ReportItem["status"]; label: string }> {
  return [
    { value: "pending", label: messages?.admin?.reports?.tabs?.pending ?? "Pending" },
    { value: "accepted", label: messages?.admin?.reports?.tabs?.accepted ?? "Accepted" },
    { value: "rejected", label: messages?.admin?.reports?.tabs?.rejected ?? "Rejected" },
  ];
}

function formatReason(reason: string, messages: any): string {
  return messages?.admin?.reports?.reasons?.[reason] ?? reason;
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
  messages: any,
): Promise<{ success: boolean; error?: string }> {
  const { data: report, error: fetchError } = await service
    .from("reports")
    .select("id, advert_id, status, reporter, adverts:advert_id ( id, user_id )")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !report) {
    return {
      success: false,
      error: fetchError?.message ?? (messages?.admin?.reports?.errors?.report_not_found ?? "Report not found"),
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

  const { messages } = await getI18nProps();
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash(messages?.admin?.reports?.errors?.auth_required ?? "Authentication required");
    revalidatePath("/admin/reports");
    return;
  }

  if (!hasAdminRole(user)) {
    await setFlash(messages?.admin?.reports?.errors?.access_denied ?? "Access denied");
    revalidatePath("/admin/reports");
    return;
  }

  let service: ServiceClient;
  try {
    service = await supabaseService();
  } catch {
    await setFlash(
      messages?.admin?.reports?.errors?.service_role_missing ?? "SUPABASE_SERVICE_ROLE_KEY is not configured.",
    );
    revalidatePath("/admin/reports");
    return;
  }

  const result = await moderateReport(service, user.id, id, newStatus, unpublish, messages);

  if (!result.success) {
    await setFlash(result.error ?? (messages?.admin?.reports?.errors?.update_failed ?? "Failed to update report"));
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

  const { messages } = await getI18nProps();

  if (!ids.length) {
    await setFlash(messages?.admin?.reports?.errors?.bulk_select_required ?? "Select at least one report");
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
      await setFlash(messages?.admin?.reports?.errors?.unknown_action ?? "Unknown action for bulk update");
      revalidatePath("/admin/reports");
      return;
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await setFlash(messages?.admin?.reports?.errors?.auth_required ?? "Authentication required");
    revalidatePath("/admin/reports");
    return;
  }

  if (!hasAdminRole(user)) {
    await setFlash(messages?.admin?.reports?.errors?.access_denied ?? "Access denied");
    revalidatePath("/admin/reports");
    return;
  }

  let service: ServiceClient;
  try {
    service = await supabaseService();
  } catch {
    await setFlash(
      messages?.admin?.reports?.errors?.service_role_missing ?? "SUPABASE_SERVICE_ROLE_KEY is not configured.",
    );
    revalidatePath("/admin/reports");
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  for (const id of ids) {
    const result = await moderateReport(service, user.id, id, newStatus, unpublish, messages);
    if (result.success) {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  if (failureCount === 0) {
    await setFlash(null);
  } else if (successCount === 0) {
    await setFlash(messages?.admin?.reports?.errors?.bulk_update_failed ?? "Failed to update selected reports");
  } else {
    const message = messages?.admin?.reports?.errors?.bulk_partial_failure ?? "Some reports were not updated ({failureCount} out of {totalCount}).";
    await setFlash(message.replace("{failureCount}", String(failureCount)).replace("{totalCount}", String(ids.length)));
  }

  revalidatePath("/admin/reports");
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const { locale, messages } = await getI18nProps();
  
  // Helper function for translations
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split(".");
    let value: any = messages;
    for (const k of keys) {
      value = value?.[k];
    }
    let result = value ?? key;
    if (params) {
      result = result.replace(/\{(\w+)\}/g, (match: string, varName: string) => {
        return params[varName] !== undefined ? String(params[varName]) : match;
      });
    }
    return result;
  };

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <main className="p-4 text-sm text-red-600">{t("admin.reports.errors.auth_required")}.</main>;
  }

  if (!hasAdminRole(user)) {
    return <main className="p-4 text-sm text-red-600">{t("admin.reports.errors.access_denied")}.</main>;
  }

  let service: ServiceClient;
  try {
    service = await supabaseService();
  } catch {
    return (
      <main className="p-4 text-sm text-red-600">
        {t("admin.reports.errors.service_role_missing")}
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
  const dateFrom = getFirstParam(searchParams?.date_from);
  const dateTo = getFirstParam(searchParams?.date_to);
  const sortBy = getFirstParam(searchParams?.sort_by) || "created_at";
  const sortOrder = getFirstParam(searchParams?.sort_order) || "desc";

  let query = service
    .from("reports")
    .select(
      `id, reason, details, status, created_at, updated_at, advert_id, reporter, reviewed_by, adverts:advert_id ( id, title, user_id )`
    )
    .eq("status", status);

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

  if (dateFrom) {
    query = query.gte("created_at", `${dateFrom}T00:00:00Z`);
  }

  if (dateTo) {
    query = query.lte("created_at", `${dateTo}T23:59:59Z`);
  }

  // Sorting
  const sortColumn = sortBy === "updated_at" ? "updated_at" : 
                     sortBy === "reason" ? "reason" :
                     sortBy === "status" ? "status" :
                     "created_at";
  query = query.order(sortColumn, { ascending: sortOrder === "asc" });

  const { data, error } = await query;

  const items: ReportItem[] = (data ?? []) as ReportItem[];
  const loadError = error?.message ?? null;

  const createTabHref = (targetStatus: ReportItem["status"]) => {
    const params = new URLSearchParams();
    params.set("status", targetStatus);
    if (reason) params.set("reason", reason);
    if (searchQuery) params.set("q", searchQuery);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (sortBy && sortBy !== "created_at") params.set("sort_by", sortBy);
    if (sortOrder && sortOrder !== "desc") params.set("sort_order", sortOrder);
    return `?${params.toString()}`;
  };

  const tabs = getTabs(messages);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{t("admin.reports.title")}</h1>

      {(flashError || loadError) && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="text-sm text-destructive font-medium">
              {flashError || loadError}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              asChild
              variant={status === tab.value ? "default" : "outline"}
              size="sm"
            >
              <Link href={createTabHref(tab.value)}>
                {tab.label}
              </Link>
            </Button>
          ))}
        </div>
        <form method="get" className="ml-auto flex items-center gap-2 text-sm">
          <input type="hidden" name="status" value={status} />
          {reason && <input type="hidden" name="reason" value={reason} />}
          {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
          {dateFrom && <input type="hidden" name="date_from" value={dateFrom} />}
          {dateTo && <input type="hidden" name="date_to" value={dateTo} />}
          <label htmlFor="sort-select" className="text-muted-foreground">
            {t("filters.sort_by")}:
          </label>
          <select
            id="sort-select"
            name="sort_by"
            className="rounded-lg border px-2 py-1 text-sm h-8"
            defaultValue={`${sortBy}_${sortOrder}`}
            onChange={(e) => {
              const form = e.target.closest("form");
              if (form) {
                const [col, ord] = e.target.value.split("_");
                const sortByInput = document.createElement("input");
                sortByInput.type = "hidden";
                sortByInput.name = "sort_by";
                sortByInput.value = col;
                form.appendChild(sortByInput);
                const sortOrderInput = document.createElement("input");
                sortOrderInput.type = "hidden";
                sortOrderInput.name = "sort_order";
                sortOrderInput.value = ord;
                form.appendChild(sortOrderInput);
                form.submit();
              }
            }}
          >
            <option value="created_at_desc">{t("admin.reports.table.created_at")} ↓</option>
            <option value="created_at_asc">{t("admin.reports.table.created_at")} ↑</option>
            <option value="updated_at_desc">{t("admin.reports.table.updated_at")} ↓</option>
            <option value="updated_at_asc">{t("admin.reports.table.updated_at")} ↑</option>
            <option value="reason_asc">{t("admin.reports.table.reason")} ↑</option>
            <option value="reason_desc">{t("admin.reports.table.reason")} ↓</option>
          </select>
        </form>
      </div>

      <Card>
        <CardContent className="p-4">
          <form
            method="get"
            className="flex flex-wrap items-end gap-4"
          >
            <input type="hidden" name="status" value={status} />
            <div className="flex min-w-[200px] flex-col gap-1.5">
              <label
                htmlFor="reason-filter"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t("admin.reports.filters.reason")}
              </label>
              <select
                id="reason-filter"
                name="reason"
                defaultValue={reason ?? ""}
                className="rounded-lg border px-3 py-1.5 text-sm h-9"
              >
                <option value="">{t("common.all")} {t("admin.reports.filters.reason")}</option>
                {AVAILABLE_REASONS.map((code) => (
                  <option key={code} value={code}>
                    {formatReason(code, messages)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-[240px] flex-col gap-1.5">
              <label
                htmlFor="search-filter"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t("admin.reports.filters.search")}
              </label>
              <input
                id="search-filter"
                name="q"
                defaultValue={searchQuery ?? ""}
                placeholder={t("admin.reports.table.search_placeholder")}
                className="rounded-lg border px-3 py-1.5 text-sm h-9"
              />
            </div>

            <div className="flex min-w-[180px] flex-col gap-1.5">
              <label
                htmlFor="date-from-filter"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t("admin.reports.filters.date_from")}
              </label>
              <input
                id="date-from-filter"
                name="date_from"
                type="date"
                defaultValue={getFirstParam(searchParams?.date_from) ?? ""}
                className="rounded-lg border px-3 py-1.5 text-sm h-9"
              />
            </div>

            <div className="flex min-w-[180px] flex-col gap-1.5">
              <label
                htmlFor="date-to-filter"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t("admin.reports.filters.date_to")}
              </label>
              <input
                id="date-to-filter"
                name="date_to"
                type="date"
                defaultValue={getFirstParam(searchParams?.date_to) ?? ""}
                className="rounded-lg border px-3 py-1.5 text-sm h-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                {t("search.apply")}
              </Button>
              {(reason || searchQuery || getFirstParam(searchParams?.date_from) || getFirstParam(searchParams?.date_to)) && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`?status=${status}`}>
                    {t("search.clear")}
                  </Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {status === "pending" && items.length > 0 && (
        <>
          <BulkActionsClient totalCount={items.length} formId="bulkForm" />
          <form
            id="bulkForm"
            action={bulkUpdateReports}
          >
            <Button
              type="submit"
              name="action"
              value="accept"
              className="hidden"
              id="bulk-accept-btn"
            />
            <Button
              type="submit"
              name="action"
              value="accept_unpublish"
              className="hidden"
              id="bulk-accept-unpublish-btn"
            />
            <Button
              type="submit"
              name="action"
              value="reject"
              className="hidden"
              id="bulk-reject-btn"
            />
          </form>
        </>
      )}

      {!items.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t("admin.reports.table.no_reports")}
          </CardContent>
        </Card>
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
            const statusBadgeVariant = 
              report.status === "accepted" ? "default" :
              report.status === "rejected" ? "destructive" :
              "outline";

            return (
              <Card key={report.id}>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {status === "pending" && (
                          <div className="pt-1 shrink-0">
                            <Checkbox
                              id={checkboxId}
                              name="ids"
                              value={report.id}
                              form="bulkForm"
                              aria-label={`${t("admin.reports.table.select_all")} #${report.id}`}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="font-semibold">#{report.id}</span>
                            <Badge variant={statusBadgeVariant}>
                              {t(`admin.reports.tabs.${report.status}`)}
                            </Badge>
                            <Badge variant="outline">
                              {formatReason(report.reason, messages)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>
                              {t("admin.reports.table.advert")}:{" "}
                              <Link href={`/ad/${report.advert_id}`} className="underline hover:text-foreground">
                                {report.adverts?.title || report.advert_id}
                              </Link>
                            </div>
                            <div>
                              {t("admin.reports.table.reporter")}: {report.reporter}
                            </div>
                            <div>
                              {t("admin.reports.table.created_at")}: {formatDate(report.created_at, locale, "short")}
                            </div>
                            {report.reviewed_by && (
                              <div>
                                {t("admin.reports.table.reviewed_by")}: {report.reviewed_by}
                              </div>
                            )}
                          </div>
                          {report.details && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                              {report.details}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {status === "pending" ? (
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        <form action={acceptAction}>
                          <Button type="submit" size="sm">
                            {t("admin.reports.actions.accept")}
                          </Button>
                        </form>
                        <form action={acceptAndUnpublishAction}>
                          <Button type="submit" size="sm" variant="outline">
                            {t("admin.reports.actions.accept_unpublish")}
                          </Button>
                        </form>
                        <form action={rejectAction}>
                          <Button type="submit" size="sm" variant="destructive">
                            {t("admin.reports.actions.reject")}
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        {t("admin.reports.table.status")} {t("common.changed")}: {formatDate(report.updated_at ?? report.created_at, locale, "short")}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

