"use client";

import { useState } from "react";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  userId: string;
  currentPhone: string | null | undefined;
};

export function VerifyPhoneClient({ userId, currentPhone }: Props) {
  const [phone, setPhone] = useState(currentPhone || "");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!phone || phone.length < 10) {
      toast.error("Enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.from("profiles").update({ phone }).eq("id", userId);

      if (updateError) {
        toast.error("Could not update your phone number.");
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        if (error.message.includes("SMS provider")) {
          toast.error("SMS delivery is temporarily unavailable.");
        } else {
          toast.error("Could not send the verification code.");
        }
      } else {
        toast.success(`Verification code sent to ${phone}.`);
        setStep("verify");
      }
    } catch {
      toast.error("Could not send the verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!verificationCode || verificationCode.length < 6) {
      toast.error("Enter the SMS code.");
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
        toast.error("The code is incorrect. Try again.");
      } else {
        await supabase.from("profiles").update({ verified_phone: true }).eq("id", userId);

        toast.success("Phone number verified.");
        window.location.reload();
      }
    } catch {
      toast.error("Could not verify the code.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "verify") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="verification-code">SMS code</Label>
          <Input
            id="verification-code"
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            maxLength={6}
            required
          />
          <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to {phone}.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify code"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("input")} disabled={loading}>
            Change number
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Phone number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+32 XXX XX XX XX"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">Use international format, for example +32...</p>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Phone className="size-4" />
            Send verification code
          </>
        )}
      </Button>
    </form>
  );
}
