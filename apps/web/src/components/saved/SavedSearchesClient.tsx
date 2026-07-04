"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Trash2, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { getLocalSavedSearches, removeLocalSavedSearch, type SavedSearchFilters } from "@/lib/savedSearches";

type AlertFrequency = "instant" | "daily" | "off";

type Row = {
  id: string;
  name: string;
  query: string | null;
  filters: SavedSearchFilters;
  alert_enabled?: boolean;
  alert_frequency?: AlertFrequency;
  new_count?: number;
  new_count_capped?: boolean;
  local?: boolean;
};

function buildHref(query: string | null, f: SavedSearchFilters = {}): string {
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  if (f.category_id) p.set("category_id", f.category_id);
  if (f.price_min != null) p.set("price_min", String(f.price_min));
  if (f.price_max != null) p.set("price_max", String(f.price_max));
  if (f.location) p.set("location", f.location);
  if (f.verified_only) p.set("verified_only", "true");
  if (f.condition) p.set("condition", f.condition);
  if (f.sort_by) p.set("sort_by", f.sort_by);
  return `/search?${p.toString()}`;
}

export default function SavedSearchesClient() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/saved-searches", { cache: "no-store" });
        if (res.status === 401) {
          setAuthed(false);
          setRows(getLocalSavedSearches().map((s) => ({ ...s, local: true })));
          return;
        }
        const json = await res.json().catch(() => null);
        setAuthed(true);
        setRows((json?.data?.items ?? []) as Row[]);
      } catch {
        setAuthed(false);
        setRows(getLocalSavedSearches().map((s) => ({ ...s, local: true })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markSeen = (r: Row) => {
    if (r.local) return;
    void fetch(`/api/saved-searches/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seen: true }),
    }).catch(() => null);
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, new_count: 0 } : x)));
  };

  const updateAlertFrequency = (r: Row, alert_frequency: AlertFrequency) => {
    if (r.local) return;
    setRows((rs) =>
      rs.map((x) =>
        x.id === r.id ? { ...x, alert_frequency, alert_enabled: alert_frequency !== "off" } : x,
      ),
    );
    void fetch(`/api/saved-searches/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert_frequency }),
    }).catch(() => null);
  };

  const remove = (r: Row) => {
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    if (r.local) removeLocalSavedSearch(r.id);
    else void fetch(`/api/saved-searches/${r.id}`, { method: "DELETE" }).catch(() => null);
    toast.success(t("saved.deleted_toast"));
  };

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">…</div>;

  return (
    <div className="space-y-4">
      {!authed ? (
        <p className="rounded-md border border-border/70 bg-card p-3 text-sm text-muted-foreground">
          {t("saved.signin_prompt")}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("saved.empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border border-border/70 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{r.name}</span>
                    {r.new_count ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {t("saved.new_count", { count: r.new_count_capped ? `${r.new_count}+` : r.new_count })}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {r.filters?.location ? <span>{r.filters.location}</span> : null}
                    {r.filters?.condition ? <span>· {r.filters.condition}</span> : null}
                    {r.filters?.verified_only ? <span>· ✓</span> : null}
                    {r.filters?.price_min != null || r.filters?.price_max != null ? (
                      <span>· {r.filters?.price_min ?? 0}–{r.filters?.price_max ?? "∞"} €</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label={t("saved.delete")} onClick={() => remove(r)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!r.local ? (
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    {(r.alert_frequency ?? ((r.alert_enabled ?? true) ? "daily" : "off")) === "off" ? (
                      <BellOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
                    )}
                    <span>{t("saved.alert_frequency")}</span>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                      value={r.alert_frequency ?? ((r.alert_enabled ?? true) ? "daily" : "off")}
                      onChange={(event) => updateAlertFrequency(r, event.target.value as AlertFrequency)}
                      aria-label={t("saved.alert_frequency")}
                    >
                      <option value="instant">{t("saved.alert_instant")}</option>
                      <option value="daily">{t("saved.alert_daily")}</option>
                      <option value="off">{t("saved.alert_off")}</option>
                    </select>
                  </label>
                ) : null}
                <Button asChild variant="outline" size="sm" onClick={() => markSeen(r)}>
                  <Link href={buildHref(r.query, r.filters)}>
                    <SearchIcon className="h-4 w-4" aria-hidden="true" />
                    {t("saved.view_results")}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
