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

// ---- Helpers ----------------------------------------------------------------

/** Derive up to 2-char initials from a display name. */
function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

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
        <div
          className="rounded-[var(--rm)] border border-primary/30 p-4"
          style={{ background: "oklch(0.56 0.13 178 / 0.06)" }}
        >
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
      <ul className="flex flex-col gap-[11px]">
        {members.map((member) => {
          const isPending = member.accepted_at == null;
          const isOwnerRow = member.role === "owner";
          const isSelf = member.user_id === viewerId;
          const showRemove = canManage && !isOwnerRow && !isSelf;
          const memberName = member.display_name ?? tr("team.title", "Team");
          const memberInitials = initials(member.display_name);

          return (
            <li
              key={member.user_id}
              className="flex items-center gap-[10px]"
            >
              {/* Avatar */}
              {isPending ? (
                /* Pending: dashed ring + plus icon */
                <span
                  className="grid size-[34px] shrink-0 place-items-center rounded-full text-muted-foreground"
                  style={{
                    background: "var(--muted)",
                    border: "1px dashed var(--border)",
                  }}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8v8M8 12h8" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </span>
              ) : (
                /* Active: gradient or sec surface */
                <span
                  className={
                    isOwnerRow
                      ? "lyvox-trust-gradient grid size-[34px] shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
                      : "grid size-[34px] shrink-0 place-items-center rounded-full border border-border text-[12px] font-bold"
                  }
                  style={
                    isOwnerRow
                      ? undefined
                      : { background: "var(--sec)", color: "var(--priD)" }
                  }
                  aria-hidden="true"
                >
                  {memberInitials}
                </span>
              )}

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="truncate text-[13px] font-bold text-foreground">
                  {memberName}
                </div>
              </div>

              {/* Role / status chip */}
              <div className="flex items-center gap-2 shrink-0">
                {isPending ? (
                  <span
                    className="inline-flex h-[23px] items-center rounded-full px-[10px] text-[11px] font-bold"
                    style={{
                      background: "oklch(0.86 0.13 72 / 0.35)",
                      color: "var(--amberI)",
                    }}
                  >
                    {tr("team.pending", "Pending")}
                  </span>
                ) : (
                  <span
                    className="inline-flex h-[23px] items-center rounded-full px-[10px] text-[11px] font-bold capitalize"
                    style={
                      isOwnerRow
                        ? {
                            background: "oklch(0.56 0.13 178 / 0.12)",
                            color: "var(--priD)",
                          }
                        : {
                            background: "var(--muted)",
                            border: "1px solid var(--border)",
                            color: "var(--muted-foreground)",
                          }
                    }
                  >
                    {member.role}
                  </span>
                )}

                {/* Remove button */}
                {showRemove && (
                  <button
                    type="button"
                    onClick={() => handleRemove(member.user_id)}
                    disabled={removingId === member.user_id}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-destructive opacity-70 hover:opacity-100 disabled:opacity-40"
                  >
                    {removingId === member.user_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserMinus className="h-3 w-3" aria-hidden="true" />
                    )}
                    {tr("team.remove", "Remove")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── Invite form (owner/admin only) ───────────────────────────────────── */}
      {canManage && (
        <form
          onSubmit={handleInvite}
          className="space-y-3 border-t border-border/50 pt-4"
        >
          <p className="text-sm font-semibold text-foreground">
            {tr("team.invite", "Invite member")}
          </p>
          {/* Email + invite row */}
          <div className="space-y-1">
            <Label htmlFor="team_invite_email">
              {tr("team.email_label", "Email address")}
            </Label>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="team_invite_email"
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError(null);
                }}
                placeholder="colleague@email.com"
                required
                className="h-[42px] rounded-[var(--rm)]"
              />
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex h-[42px] items-center rounded-[var(--rm)] border-0 px-4 text-[13px] font-bold text-white disabled:opacity-70"
              style={{ background: "var(--gC)" }}
            >
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                tr("team.invite_btn", "Invite")
              )}
            </button>
          </div>

          {/* Role selector (below the compact row, visible when needed) */}
          <div className="flex items-center gap-2">
            <Label htmlFor="team_invite_role" className="text-xs text-muted-foreground shrink-0">
              {tr("team.role_label", "Role")}
            </Label>
            <select
              id="team_invite_role"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "member" | "admin")
              }
              className="flex h-8 rounded-[var(--rm)] border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="member">{tr("team.role_member", "Member")}</option>
              <option value="admin">{tr("team.role_admin", "Admin")}</option>
            </select>
          </div>

          {inviteError && (
            <p className="text-sm text-destructive">{inviteError}</p>
          )}
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
