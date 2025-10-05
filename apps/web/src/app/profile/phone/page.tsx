"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { apiFetch, RateLimitedError } from "@/lib/fetcher";

const parseJsonObject = (raw: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // noop — handled by caller
  }
  return null;
};

export default function PhoneVerify() {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const request = async () => {
    if (requesting || cooldown > 0) return;
    setMsg(null);
    setRequesting(true);
    try {
      const response = await apiFetch("/api/phone/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const txt = await response.text();
      const parsed = parseJsonObject(txt);
      const data: Record<string, unknown> =
        parsed ?? { error: "NON_JSON_RESPONSE", detail: txt.slice(0, 200) };

      if (response.ok && data["ok"] === true) {
        setSent(true);
        setMsg("Код отправлен по SMS.");
      } else {
        const errorText = typeof data["error"] === "string" ? (data["error"] as string) : undefined;
        setMsg("Ошибка: " + (errorText ?? response.statusText));
      }
    } catch (error: unknown) {
      if (error instanceof RateLimitedError) {
        const seconds = Math.max(1, Math.round(error.retryAfterSec ?? 60));
        setCooldown(seconds);
        toast.error(`Слишком много попыток. Повторите через ${seconds} сек.`);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        setMsg("Сеть/браузер: " + message);
      }
    } finally {
      setRequesting(false);
    }
  };

  const verify = async () => {
    setMsg(null);
    try {
      const r = await fetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ phone, code })
      });
      const txt = await r.text();
      const parsed = parseJsonObject(txt);
      const data: Record<string, unknown> =
        parsed ?? { error: "NON_JSON_RESPONSE", detail: txt.slice(0, 200) };

      if (r.ok && data["ok"] === true) {
        setMsg("Телефон подтверждён ✅");
      } else {
        const errorText = typeof data["error"] === "string" ? (data["error"] as string) : undefined;
        setMsg("Ошибка: " + (errorText ?? r.statusText));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setMsg("Сеть/браузер: " + message);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-3 p-4">
      <h1 className="text-xl font-semibold">Верификация телефона</h1>
      <input
        className="w-full rounded-xl border px-3 py-2"
        placeholder="+3247..."
        value={phone}
        onChange={(e)=>setPhone(e.target.value)}
      />
      {!sent ? (
        <button
          onClick={request}
          disabled={requesting || cooldown > 0 || !phone.trim()}
          className="rounded-xl bg-black px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {requesting
            ? "Отправляем..."
            : cooldown > 0
              ? `Повторите через ${cooldown} с`
              : "Получить код"}
        </button>
      ) : (
        <div className="space-y-2">
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Код из SMS"
            value={code}
            onChange={(e)=>setCode(e.target.value)}
          />
          <button onClick={verify} className="rounded-xl bg-black px-3 py-2 text-white">
            Подтвердить
          </button>
        </div>
      )}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </main>
  );
}
