"use client";

import { useEffect, useState } from "react";
import { Bell, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";

type EmailPrefs = Record<string, boolean>;

/**
 * User-facing, non-transactional email categories. Each `key` maps to a real
 * opt-out flag that a delivery path actually reads:
 *   - new_message  → sender.ts gates `email[type] === false`
 *   - saved_search → cron/saved-search-alerts reads `email.saved_search`
 * Transactional types (advert_approved/rejected, payment_completed) are not
 * exposed — users generally must receive those. Push is omitted on purpose:
 * no send path reads `preferences.push` yet, so a push toggle would be a
 * decorative no-op (exactly the fake-control anti-pattern we're removing).
 */
const ROWS = [
  { key: "new_message", labelKey: "profile.messages_notifications", fallback: "Messages", Icon: MessageSquare },
  { key: "saved_search", labelKey: "profile.notif_saved_search", fallback: "Saved-search alerts", Icon: Mail },
] as const;

export function NotificationPreferencesCard() {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };

  // `null` = still loading (skeleton); otherwise the email opt-out map.
  const [email, setEmail] = useState<EmailPrefs | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/notifications/preferences", {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        // Envelope: { ok, data: { preferences: { email, push, sms } } }
        const prefs = json?.data?.preferences?.email;
        if (active) setEmail(prefs && typeof prefs === "object" ? (prefs as EmailPrefs) : {});
      } catch {
        if (active) setEmail({});
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setPref = async (key: string, value: boolean) => {
    const prev = email ?? {};
    setEmail({ ...prev, [key]: value }); // optimistic
    setSaving(key);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: { [key]: value } }),
      });
      if (!res.ok) throw new Error("save_failed");
      toast.success(tr("profile.notif_updated", "Preferences updated"));
    } catch {
      setEmail(prev); // revert on failure
      toast.error(tr("saved.error", "Something went wrong"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle>{tr("profile.notifications", "Notifications")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {tr("profile.notif_email_desc", "Choose which emails you receive from LyVoX.")}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {ROWS.map((row) => {
            const RowIcon = row.Icon;
            const label = tr(row.labelKey, row.fallback);
            // Opt-out semantics: absent or true → ON. Never render undefined as OFF.
            const checked = email !== null && email[row.key] !== false;
            return (
              <div
                key={row.key}
                className="flex items-center justify-between rounded-xl border border-border/70 p-3"
              >
                <div className="flex items-center gap-2">
                  <RowIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{label}</span>
                </div>
                {email === null ? (
                  <div className="h-6 w-11 animate-pulse rounded-full bg-muted" aria-hidden="true" />
                ) : (
                  <Switch
                    checked={checked}
                    disabled={saving === row.key}
                    onCheckedChange={(v) => void setPref(row.key, v)}
                    aria-label={label}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
