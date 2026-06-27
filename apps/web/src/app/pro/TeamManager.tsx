"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { I18nProvider, useI18n } from "@/i18n";
import type { Locale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/fetcher";
import { toast } from "sonner";
import { Loader2, UserMinus } from "lucide-react";
import type { BusinessMember } from "./BusinessCabinet";

// ---- Types ------------------------------------------------------------------

type ViewerRole = "owner" | "admin" | "member";

type Props = {
  businessId: string;
  businessName: string;
  members: BusinessMember[];
  viewerId: string;
  viewerRole: ViewerRole;
  locale: Locale;
  messages: Record<string, any>;
};

// ---- Inner component (needs I18n context) -----------------------------------

function TeamManagerInner({
  businessId,
  businessName,
  members,
  viewerId,
  viewerRole,
}: Omit<Props, "locale" | "messages">) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  const router = useRouter();

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  // Remove state
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Accept state
  const [accepting, setAccepting] = useState(false);

  const canManage = viewerRole === "owner" || viewerRole === "admin";

  // Check if the current viewer has a pending invite
  const viewerPendingRow = members.find(
    (m) => m.user_id === viewerId && m.accepted_at == null,
  );

  // ── Accept invitation ──────────────────────────────────────────────────────

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await apiFetch(`/api/business/${businessId}/members/accept`, {
        method: "POST",
      });
      const body: { ok: boolean; error?: string } = await res.json();
      if (!body.ok) {
        toast.error(tr("team.invite_error", "Could not send invitation"));
        return;
      }
      toast.success(tr("team.accepted_ok", "Invitation accepted"));
      router.refresh();
    } catch {
      toast.error(tr("team.invite_error", "Could not send invitation"));
    } finally {
      setAccepting(false);
    }
  };

  // ── Invite member ──────────────────────────────────────────────────────────

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviting(true);
    try {
      const res = await apiFetch(`/api/business/${businessId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const body: { ok: boolean; error?: string; detail?: string } = await res.json();
      if (!body.ok) {
        if (body.error === "USER_NOT_FOUND") {
          setInviteError(tr("team.user_not_found", "User must register first"));
        } else if (body.error === "ALREADY_MEMBER") {
          setInviteError(tr("team.already_member", "Already a member"));
        } else {
          setInviteError(tr("team.invite_error", "Could not send invitation"));
        }
        return;
      }
      toast.success(tr("team.invited_ok", "Invitation sent"));
      setInviteEmail("");
      setInviteRole("member");
      router.refresh();
    } catch {
      setInviteError(tr("team.invite_error", "Could not send invitation"));
    } finally {
      setInviting(false);
    }
  };

  // ── Remove member ──────────────────────────────────────────────────────────

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      const res = await apiFetch(`/api/business/${businessId}/members/${userId}`, {
        method: "DELETE",
      });
      const body: { ok: boolean; error?: string } = await res.json();
      if (!body.ok) {
        toast.error(tr("team.invite_error", "Could not send invitation"));
        return;
      }
      toast.success(tr("team.removed_ok", "Member removed"));
      router.refresh();
    } catch {
      toast.error(tr("team.invite_error", "Could not send invitation"));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Accept invitation banner ────────────────────────────────────────── */}
      {viewerPendingRow && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full sm:w-auto"
          >
            {accepting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {tr("team.accept_invite", "Accept invitation to {business}").replace(
              "{business}",
              businessName,
            )}
          </Button>
        </div>
      )}

      {/* ── Member list ─────────────────────────────────────────────────────── */}
      <ul className="divide-y divide-border/50">
        {members.map((member) => {
          const isPending = member.accepted_at == null;
          const isOwnerRow = member.role === "owner";
          const isSelf = member.user_id === viewerId;
          const showRemove = canManage && !isOwnerRow && !isSelf;

          return (
            <li
              key={member.user_id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {member.display_name ?? tr("team.title", "Team")}
                </span>
                {isPending && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    {tr("team.pending", "Pending")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="capitalize text-muted-foreground">{member.role}</span>
                {showRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(member.user_id)}
                    disabled={removingId === member.user_id}
                    className="h-7 px-2 text-destructive hover:text-destructive"
                  >
                    {removingId === member.user_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <>
                        <UserMinus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        {tr("team.remove", "Remove")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── Invite form (owner/admin only) ───────────────────────────────────── */}
      {canManage && (
        <form onSubmit={handleInvite} className="space-y-3 border-t border-border/50 pt-4">
          <p className="text-sm font-medium text-foreground">
            {tr("team.invite", "Invite member")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-1">
              <Label htmlFor="team_invite_email">
                {tr("team.email_label", "Email address")}
              </Label>
              <Input
                id="team_invite_email"
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError(null);
                }}
                placeholder="colleague@example.com"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="team_invite_role">
                {tr("team.role_label", "Role")}
              </Label>
              <select
                id="team_invite_role"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "member" | "admin")
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-36"
              >
                <option value="member">{tr("team.role_member", "Member")}</option>
                <option value="admin">{tr("team.role_admin", "Admin")}</option>
              </select>
            </div>
          </div>
          {inviteError && (
            <p className="text-sm text-destructive">{inviteError}</p>
          )}
          <Button type="submit" disabled={inviting}>
            {inviting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {tr("team.invite_btn", "Invite")}
          </Button>
        </form>
      )}
    </div>
  );
}

// ---- Public wrapper (provides I18n context) ---------------------------------

export function TeamManager({
  businessId,
  businessName,
  members,
  viewerId,
  viewerRole,
  locale,
  messages,
}: Props) {
  return (
    <I18nProvider locale={locale} messages={messages as Record<string, any>}>
      <TeamManagerInner
        businessId={businessId}
        businessName={businessName}
        members={members}
        viewerId={viewerId}
        viewerRole={viewerRole}
      />
    </I18nProvider>
  );
}
