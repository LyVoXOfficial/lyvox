"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Phone } from "lucide-react";

type Props = {
  userId: string;
  currentPhone: string | null | undefined;
};

export function VerifyPhoneClient({ userId, currentPhone }: Props) {
  const [phone, setPhone] = useState(currentPhone || "");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic phone validation
    if (!phone || phone.length < 10) {
      toast.error("Введите корректный номер телефона");
      return;
    }

    setLoading(true);
    try {
      // Update phone in profile first
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ phone })
        .eq("id", userId);

      if (updateError) {
        toast.error("Не удалось обновить телефон");
        return;
      }

      // Send SMS OTP (requires Twilio setup in Supabase)
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        if (error.message.includes("SMS provider")) {
          toast.error("SMS отправка временно недоступна");
        } else {
          toast.error("Не удалось отправить код");
        }
      } else {
        toast.success(`Код отправлен на ${phone}`);
        setStep("verify");
      }
    } catch (err) {
      toast.error("Ошибка отправки кода");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationCode || verificationCode.length < 6) {
      toast.error("Введите код из SMS");
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
        toast.error("Неверный код. Попробуйте еще раз");
      } else {
        // Update verified_phone in profile
        await supabase
          .from("profiles")
          .update({ verified_phone: true })
          .eq("id", userId);

        toast.success("Телефон успешно подтвержден!");
        // Reload page to show updated status
        window.location.reload();
      }
    } catch (err) {
      toast.error("Ошибка подтверждения кода");
    } finally {
      setLoading(false);
    }
  };

  if (step === "verify") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="verification-code">Код из SMS</Label>
          <Input
            id="verification-code"
            type="text"
            placeholder="123456"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            maxLength={6}
            required
          />
          <p className="text-xs text-muted-foreground">
            Введите 6-значный код, отправленный на {phone}
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Проверка...
              </>
            ) : (
              "Подтвердить"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep("input")}
            disabled={loading}
          >
            Изменить номер
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Номер телефона</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+32 XXX XX XX XX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Введите номер в международном формате (например, +32...)
        </p>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Отправка...
          </>
        ) : (
          <>
            <Phone className="mr-2 size-4" />
            Отправить код подтверждения
          </>
        )}
      </Button>
    </form>
  );
}

