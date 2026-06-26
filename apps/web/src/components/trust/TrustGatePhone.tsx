// apps/web/src/components/trust/TrustGatePhone.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";

export default function TrustGatePhone({ onVerified }: { onVerified: () => void }) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!phone.trim().startsWith("+") || phone.trim().length < 8) { toast.error(tr("trust.phone_invalid", "Enter a valid phone number with country code (e.g. +32…).")); return; }
    setPending(true);
    try {
      const res = await apiFetch("/api/phone/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ phone: phone.trim() }),
      });
      const body = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !body?.ok) { toast.error(tr("trust.code_send_error", "Could not send the code.")); return; }
      toast.success(tr("trust.code_sent", "Code sent."));
      setStep("code");
    } catch {
      toast.error(tr("trust.code_send_error", "Could not send the code."));
    } finally {
      setPending(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!code || code.trim().length < 4) { toast.error(tr("trust.code_required", "Enter the SMS code.")); return; }
    setPending(true);
    try {
      const res = await apiFetch("/api/phone/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ code: code.trim(), phone: phone.trim() }),
      });
      const body = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !body?.ok) { toast.error(tr("trust.code_incorrect", "The code is incorrect.")); return; }
      toast.success(tr("trust.phone_verified", "Phone verified."));
      onVerified();
    } catch {
      toast.error(tr("trust.code_incorrect", "The code is incorrect."));
    } finally {
      setPending(false);
    }
  };

  return step === "phone" ? (
    <form onSubmit={sendCode} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="trust-phone">{tr("trust.phone", "Phone number")}</Label>
        <Input id="trust-phone" type="tel" autoComplete="tel" placeholder="+32…" required value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? tr("trust.sending", "Sending…") : tr("trust.send_code", "Send code")}
      </Button>
    </form>
  ) : (
    <form onSubmit={verify} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="trust-code">{tr("trust.code", "SMS code")}</Label>
        <Input id="trust-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? tr("trust.verifying", "Verifying…") : tr("trust.verify", "Verify")}
      </Button>
    </form>
  );
}
