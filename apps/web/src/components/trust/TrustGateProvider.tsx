// apps/web/src/components/trust/TrustGateProvider.tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { fetchViewerTrust } from "@/components/trust/useViewerTrust";
import TrustGateLogin from "@/components/trust/TrustGateLogin";
import TrustGatePhone from "@/components/trust/TrustGatePhone";

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

  const value: TrustGateContextValue = { requireTrust };

  return (
    <TrustGateContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
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
