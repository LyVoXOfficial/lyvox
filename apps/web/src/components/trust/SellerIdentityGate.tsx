// apps/web/src/components/trust/SellerIdentityGate.tsx
"use client";

import { ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useTrustGate } from "@/components/trust/TrustGateProvider";

export default function SellerIdentityGate() {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };
  const { requireTrust } = useTrustGate();

  const unlock = () => requireTrust("verified", () => window.location.reload());

  return (
    <section className="rounded-md border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-medium">{tr("seller_gate.title", "Verify to see the seller")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("seller_gate.body", "Confirm your phone number to view the seller's profile and contact them. It keeps the marketplace safe for everyone.")}
          </p>
          <Button type="button" onClick={unlock} className="mt-3">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {tr("seller_gate.cta", "Verify my phone")}
          </Button>
        </div>
      </div>
    </section>
  );
}
