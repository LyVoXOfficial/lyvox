"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  email: string;
};

export function VerifyEmailClient({ email }: Props) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string): string => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const [sending, setSending] = useState(false);

  const handleResendVerification = async () => {
    setSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        toast.error(tr("verify.email_send_error_retry", "Could not send the email. Try again later."));
      } else {
        toast.success(`${tr("verify.email_sent", "Verification email sent to")} ${email}.`);
      }
    } catch {
      toast.error(tr("verify.email_send_error", "Could not send the email."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        {tr("verify.email_intro", "We sent a verification email to")}{" "}
        <strong className="text-foreground">{email}</strong>.{" "}
        {tr("verify.email_intro_2", "Check your inbox and open the confirmation link.")}
      </p>
      <Button onClick={handleResendVerification} disabled={sending} variant="outline">
        {sending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {tr("verify.sending", "Sending...")}
          </>
        ) : (
          <>
            <Mail className="size-4" />
            {tr("verify.resend_email", "Resend verification email")}
          </>
        )}
      </Button>
    </div>
  );
}
