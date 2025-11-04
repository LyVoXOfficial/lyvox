"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Mail } from "lucide-react";

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
        toast.error("Не удалось отправить письмо. Попробуйте позже");
      } else {
        toast.success("Письмо с подтверждением отправлено на " + email);
      }
    } catch (err) {
      toast.error("Ошибка отправки письма");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Мы отправили письмо с подтверждением на <strong>{email}</strong>. 
        Пожалуйста, проверьте вашу почту и перейдите по ссылке.
      </p>
      <Button
        onClick={handleResendVerification}
        disabled={sending}
        variant="outline"
      >
        {sending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Отправка...
          </>
        ) : (
          <>
            <Mail className="mr-2 size-4" />
            Отправить письмо повторно
          </>
        )}
      </Button>
    </div>
  );
}

