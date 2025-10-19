"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { apiFetch, RateLimitedError } from "@/lib/fetcher";

type Status = "loading" | "unverified" | "verified";

const parseJsonObject = (raw: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore - handled by caller
  }
  return null;
};

const pickVerified = (payload: unknown): boolean => {
  if (payload && typeof payload === "object") {
    const record = payload as {
      phone?: { verified?: boolean | null } | null;
      verifiedPhone?: boolean;
    };
    if (record.phone && typeof record.phone.verified === "boolean") {
      return record.phone.verified;
    }
    if (typeof record.verifiedPhone === "boolean") {
      return record.verifiedPhone;
    }
  }
  return false;
};

const pickPhoneNumber = (payload: unknown): string | null => {
  if (payload && typeof payload === "object") {
    const record = payload as { phone?: { number?: string | null } | null };
    const number = record.phone?.number;
    return typeof number === "string" && number.length ? number : null;
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
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1_000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        const verified = pickVerified(data);
        const number = pickPhoneNumber(data);

        if (number) {
          setPhone(number);
        }

        setStatus(verified ? "verified" : "unverified");
        if (verified) {
          setSent(false);
          setCode("");
          setMsg("Телефон уже подтверждён.");
        }
      } catch {
        if (!cancelled) {
          setStatus("unverified");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const request = async () => {
    if (requesting || cooldown > 0 || status !== "unverified") return;
    if (!phone.trim()) {
      setMsg("Введите номер телефона в формате +3247...");
      return;
    }

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
        toast.error(`Слишком много попыток. Попробуйте через ${seconds} сек.`);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        setMsg("Сбой запроса: " + message);
      }
    } finally {
      setRequesting(false);
    }
  };

  const verify = async () => {
    if (status !== "unverified") return;
    if (!code.trim()) {
      setMsg("Введите код из SMS.");
      return;
    }

    setMsg(null);
    try {
      const response = await fetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const txt = await response.text();
      const parsed = parseJsonObject(txt);
      const data: Record<string, unknown> =
        parsed ?? { error: "NON_JSON_RESPONSE", detail: txt.slice(0, 200) };

      if (response.ok && data["ok"] === true) {
        setStatus("verified");
        setMsg("Телефон успешно подтверждён.");
        setSent(false);
        setCode("");
        toast.success("Телефон подтверждён");
      } else {
        const errorText = typeof data["error"] === "string" ? (data["error"] as string) : undefined;
        setMsg("Ошибка: " + (errorText ?? response.statusText));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setMsg("Сбой запроса: " + message);
    }
  };

  const isLoading = status === "loading";

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-semibold">Верификация телефона</h1>

      {status === "verified" ? (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Ваш номер уже подтверждён — повторная проверка не требуется.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-xl bg-black px-3 py-2 text-sm font-medium text-white hover:bg-black/90"
          >
            Вернуться в профиль
          </Link>
        </div>
      ) : (
        <>
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="+3247..."
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={isLoading}
          />
          {!sent ? (
            <button
              onClick={request}
              disabled={
                isLoading || requesting || cooldown > 0 || !phone.trim() || status !== "unverified"
              }
              className="rounded-xl bg-black px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading
                ? "Загрузка..."
                : requesting
                  ? "Отправка..."
                  : cooldown > 0
                    ? `Повторить через ${cooldown} с`
                    : "Получить код"}
            </button>
          ) : (
            <div className="space-y-2">
              <input
                className="w-full rounded-xl border px-3 py-2"
                placeholder="Код из SMS"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={isLoading || status !== "unverified"}
              />
              <button
                onClick={verify}
                disabled={isLoading || status !== "unverified"}
                className="rounded-xl bg-black px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Подтвердить
              </button>
            </div>
          )}
        </>
      )}

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </main>
  );
}
