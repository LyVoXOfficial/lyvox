"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  userId: string;
  currentPhone: string | null | undefined;
};

export function VerifyPhoneClient({ userId, currentPhone }: Props) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const [phone, setPhone] = useState(currentPhone || "");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!phone || phone.length < 10) {
      toast.error(tr("verify.phone_invalid", "Enter a valid phone number."));
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.from("profiles").update({ phone }).eq("id", userId);

      if (updateError) {
        toast.error(tr("verify.phone_update_error", "Could not update your phone number."));
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        if (error.message.includes("SMS provider")) {
          toast.error(tr("verify.sms_unavailable", "SMS delivery is temporarily unavailable."));
        } else {
          toast.error(tr("verify.code_send_error", "Could not send the verification code."));
        }
      } else {
        toast.success(`${tr("verify.code_sent", "Verification code sent to")} ${phone}.`);
        setStep("verify");
      }
    } catch {
      toast.error(tr("verify.code_send_error", "Could not send the verification code."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!verificationCode || verificationCode.length < 6) {
      toast.error(tr("verify.code_required", "Enter the SMS code."));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: verificationCode,
        type: "sms",
      });

      if (error) {
        toast.error(tr("verify.code_incorrect", "The code is incorrect. Try again."));
      } else {
        await supabase.from("profiles").update({ verified_phone: true }).eq("id", userId);

        toast.success(tr("verify.phone_verified", "Phone number verified."));
        window.location.reload();
      }
    } catch {
      toast.error(tr("verify.code_verify_error", "Could not verify the code."));
    } finally {
      setLoading(false);
    }
  };

  if (step === "verify") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4">
        <div className="lyvox-trust-gradient inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white shadow-[var(--shadow-soft)]">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {tr("verify.step_code", "Step 2 — Enter code")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="verification-code">{tr("verify.sms_code", "SMS code")}</Label>
          <Input
            id="verification-code"
            type="text"
            inputMode="numeric"
            placeholder="XXXXXX"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            maxLength={6}
            required
            className="h-12 rounded-xl text-center text-lg font-semibold tracking-[0.5em] focus:ring-4 focus:ring-primary/12"
          />
          <p className="text-xs text-muted-foreground">
            {tr("verify.code_hint", "Enter the 6-digit code sent to")} {phone}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {tr("verify.verifying", "Verifying...")}
              </>
            ) : (
              tr("verify.verify_code", "Verify code")
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("input")} disabled={loading}>
            {tr("verify.change_number", "Change number")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <Phone className="h-3.5 w-3.5" aria-hidden="true" />
        {tr("verify.step_phone", "Step 1 — Add phone")}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">{tr("verify.phone_title", "Phone number")}</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+32 XXX XX XX XX"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          className="h-12 rounded-xl focus:ring-4 focus:ring-primary/12"
        />
        <p className="text-xs text-muted-foreground">
          {tr("verify.phone_hint", "Use international format, for example +32...")}
        </p>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {tr("verify.sending", "Sending...")}
          </>
        ) : (
          <>
            <Phone className="size-4" />
            {tr("verify.send_code", "Send verification code")}
          </>
        )}
      </Button>
    </form>
  );
}
