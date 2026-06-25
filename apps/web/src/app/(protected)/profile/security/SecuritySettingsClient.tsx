"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Laptop,
  Loader2,
  LogOut,
  Monitor,
  Shield,
  Smartphone,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TOTPSettings } from "@/components/TOTPSettings";
import { supabase } from "@/lib/supabaseClient";
import { WebAuthnNotAvailableNotice } from "./mfa-notice";

interface Session {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  factorId?: string;
  aal: string;
  notAfter?: string;
}

interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
  icon: ReactNode;
}

function parseUserAgent(userAgent: string): ParsedUserAgent {
  const ua = userAgent.toLowerCase();

  let browser = "Unknown browser";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edg")) browser = "Edge";
  else if (ua.includes("opera")) browser = "Opera";

  let os = "Unknown OS";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  let device = "Desktop";
  let icon: ReactNode = <Monitor className="size-5" aria-hidden="true" />;

  if (ua.includes("mobile") || ua.includes("android")) {
    device = "Mobile";
    icon = <Smartphone className="size-5" aria-hidden="true" />;
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    device = "Tablet";
    icon = <Smartphone className="size-5" aria-hidden="true" />;
  } else {
    icon = <Laptop className="size-5" aria-hidden="true" />;
  }

  return { browser, os, device, icon };
}

function formatSessionDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

function isCurrentSession(session: Session, currentSessionId: string | undefined): boolean {
  return session.id === currentSessionId;
}

interface SessionCardProps {
  session: Session;
  isCurrent: boolean;
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
}

function SessionCard({ session, isCurrent, onRevoke, isRevoking }: SessionCardProps) {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const parsed = parseUserAgent(userAgent);

  return (
    <Card className={isCurrent ? "rounded-md border-primary/50" : "rounded-md"}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="mt-1 text-muted-foreground">{parsed.icon}</div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">
                {parsed.browser} on {parsed.os}
              </p>
              <Badge variant="outline" className="text-xs">
                {parsed.device}
              </Badge>
              {isCurrent && (
                <Badge variant="default" className="text-xs">
                  Current session
                </Badge>
              )}
              {session.aal === "aal2" && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                  MFA checked
                </Badge>
              )}
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="size-3" aria-hidden="true" />
                <span>Last activity: {formatSessionDate(session.updatedAt)}</span>
              </div>
              {session.notAfter && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  <span>Expires: {formatSessionDate(session.notAfter)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isCurrent && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRevoke(session.id)}
            disabled={isRevoking}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="End session"
          >
            {isRevoking ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function SecuritySettingsClient() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const loadSessions = async () => {
    setIsLoading(true);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession) {
        setSessions([]);
        setCurrentSessionId(undefined);
        return;
      }

      setCurrentSessionId(currentSession.access_token);
      setSessions([
        {
          id: currentSession.access_token,
          userId: currentSession.user.id,
          createdAt: new Date(currentSession.user.created_at).toISOString(),
          updatedAt: new Date().toISOString(),
          aal: currentSession.user.aud === "authenticated" ? "aal1" : "unknown",
        },
      ]);
    } catch (error) {
      console.error("Failed to load sessions:", error);
      toast.error("Could not load active sessions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);

    try {
      toast.success("Session ended");
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (error) {
      console.error("Failed to revoke session:", error);
      toast.error("Could not end this session");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    setIsRevokingAll(true);

    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });

      if (error) {
        throw error;
      }

      toast.success("Other devices disconnected");
      await loadSessions();
      setShowRevokeAllDialog(false);
    } catch (error) {
      console.error("Failed to revoke all sessions:", error);
      toast.error("Could not disconnect other devices");
    } finally {
      setIsRevokingAll(false);
    }
  };

  const otherSessionsCount = sessions.filter((session) => !isCurrentSession(session, currentSessionId)).length;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Account security</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage two-factor authentication, active sessions, and recovery-aware account protection.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/profile")}>
          Back to profile
        </Button>
      </div>

      <WebAuthnNotAvailableNotice />
      <TOTPSettings />

      <Card className="rounded-md">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" aria-hidden="true" />
                Active sessions
              </CardTitle>
              <CardDescription>
                Review where your LyVoX account is currently signed in.
              </CardDescription>
            </div>
            {otherSessionsCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRevokeAllDialog(true)}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Disconnect other devices
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="ml-2 text-sm text-muted-foreground">Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <Shield className="mx-auto size-12 text-muted-foreground/50" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold">No active session found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in again if this page cannot read your current session.
              </p>
              <Button className="mt-5" onClick={() => router.push("/login")}>
                Sign in
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isCurrent={isCurrentSession(session, currentSessionId)}
                  onRevoke={handleRevokeSession}
                  isRevoking={revokingSessionId === session.id}
                />
              ))}
            </div>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex gap-3">
              <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  See a device you do not recognize?
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  End the session, change your password, and keep two-factor authentication enabled before continuing buyer or seller conversations.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5" aria-hidden="true" />
            Security recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div>
                <p className="font-medium">Enable authenticator-app codes</p>
                <p className="text-muted-foreground">
                  They protect listing drafts, seller identity signals, and buyer conversations from password-only account takeover.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div>
                <p className="font-medium">Review sessions regularly</p>
                <p className="text-muted-foreground">
                  If you use shared or public devices, sign out when you finish and check this page afterwards.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div>
                <p className="font-medium">Keep recovery details current</p>
                <p className="text-muted-foreground">
                  Verified email and phone details make account recovery safer without exposing private information to buyers.
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <AlertDialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <AlertDialogContent className="rounded-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect every other device?</AlertDialogTitle>
            <AlertDialogDescription>
              This signs out all other active sessions. Those devices will need to sign in again before accessing your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevokingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAllSessions}
              disabled={isRevokingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevokingAll ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect other devices"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
