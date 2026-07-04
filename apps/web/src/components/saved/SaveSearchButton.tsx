"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { addLocalSavedSearch, type SavedSearchFilters } from "@/lib/savedSearches";

/**
 * "Save this search" — POSTs the current q + filters for signed-in users; for anonymous users
 * (401) it stores to localStorage and nudges sign-in. Used in the /search results header.
 */
export default function SaveSearchButton({
  query,
  filters,
}: {
  query: string;
  filters: SavedSearchFilters;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const name = query && query.trim() ? query.trim() : t("saved.all_listings");

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, query: query || null, filters, alert_frequency: "daily" }),
      });
      if (res.status === 401) {
        addLocalSavedSearch({ name, query: query || null, filters });
        toast(t("saved.signin_to_alert"));
        return;
      }
      if (res.status === 409) {
        toast.error(t("saved.cap_reached"));
        return;
      }
      if (!res.ok) {
        toast.error(t("saved.error"));
        return;
      }
      toast.success(t("saved.saved_toast"));
    } catch {
      toast.error(t("saved.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button type="button" variant="outline" disabled={saving} onClick={save} className="gap-1.5">
      <Bookmark className="h-4 w-4" aria-hidden="true" />
      {t("saved.save_button")}
    </Button>
  );
}
