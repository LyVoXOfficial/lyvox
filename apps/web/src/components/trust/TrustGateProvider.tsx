// apps/web/src/components/trust/TrustGateProvider.tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { fetchViewerTrust } from "@/components/trust/useViewerTrust";

// PERF-07 item 4: the dialog body pulls the heavy client chain
// (TrustGateLogin → RegisterForm → react-hook-form + react-icons/fa, and
// TrustGatePhone → TurnstileWidget). It only ever renders when `open === true`
// (Radix unmounts DialogContent while closed), so eagerly importing it forced
// ~17kB of rhf/icons into every route's first-load JS. Load it on demand — the
// Dialog shell below stays eager so the gate can open instantly.
const TrustGateLogin = dynamic(() => import("@/components/trust/TrustGateLogin"));
const TrustGatePhone = dynamic(() => import("@/components/trust/TrustGatePhone"));

type Level = "auth" | "verified";
type Stage = "login" | "phone";
type TrustGateContextValue = { requireTrust: (level: Level, run: () => void) => Promise<void> };

const TrustGateContext = createContext<TrustGateContextValue | null>(null);

export function TrustGateProvider({ children }: { children: ReactNode }) {
  const { t, locale } = useI18n();
  const tr = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("login");
  const [level, setLevel] = useState<Level>("auth");
  const pendingRun = useRef<(() => void) | null>(null);

  const finish = useCallback(() => {
    setOpen(false);
    const run = pendingRun.current;
    pendingRun.current = null;
    if (run) run();
  }, []);

  const requireTrust = useCallback(async (lvl: Level, run: () => void) => {
    const trust = await fetchViewerTrust();
    const met = lvl === "auth" ? trust.signedIn : trust.signedIn && trust.verifiedPhone;
    if (met) { run(); return; }
    pendingRun.current = run;
    setLevel(lvl);
    setStage(trust.signedIn ? "phone" : "login");
    setOpen(true);
  }, []);

  // After sign-in: re-evaluate. If level is "verified" and phone still unverified, advance to phone; else finish.
  const handleSignedIn = useCallback(async () => {
    const trust = await fetchViewerTrust();
    if (level === "verified" && !(trust.signedIn && trust.verifiedPhone)) {
      setStage("phone");
    } else {
      finish();
    }
  }, [level, finish]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) {
      pendingRun.current = null; // dismiss = cancel the gated action
    }
    setOpen(next);
  }, []);

  const value: TrustGateContextValue = { requireTrust };

  return (
    <TrustGateContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {stage === "login" ? tr("trust.gate_title_auth", "Sign in to continue") : tr("trust.gate_title_phone", "Verify your phone")}
            </DialogTitle>
            <DialogDescription>
              {stage === "login"
                ? tr("trust.gate_body_auth", "Create a free account or sign in to continue.")
                : tr("trust.gate_body_phone", "Confirm your phone number to contact sellers and publish listings.")}
            </DialogDescription>
          </DialogHeader>
          {stage === "login" ? (
            <TrustGateLogin locale={locale} onSignedIn={handleSignedIn} />
          ) : (
            <TrustGatePhone onVerified={finish} />
          )}
        </DialogContent>
      </Dialog>
    </TrustGateContext.Provider>
  );
}

export function useTrustGate(): TrustGateContextValue {
  const ctx = useContext(TrustGateContext);
  if (!ctx) throw new Error("useTrustGate must be used within TrustGateProvider");
  return ctx;
}
