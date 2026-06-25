"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  email: string;
};

export function VerifyEmailClient({ email }: Props) {
  const [sending, setSending] = useState(false);

  const handleResendVerification = async () => {
    setSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        toast.error("Could not send the email. Try again later.");
      } else {
        toast.success(`Verification email sent to ${email}.`);
      }
    } catch {
      toast.error("Could not send the email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">
        We sent a verification email to <strong className="text-foreground">{email}</strong>.
        Check your inbox and open the confirmation link.
      </p>
      <Button onClick={handleResendVerification} disabled={sending} variant="outline">
        {sending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="size-4" />
            Resend verification email
          </>
        )}
      </Button>
    </div>
  );
}
