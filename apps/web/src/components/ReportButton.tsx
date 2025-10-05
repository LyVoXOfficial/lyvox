"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { apiFetch, RateLimitedError } from "@/lib/fetcher";

type Props = {
  advertId: string;
};

export default function ReportButton({ advertId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("fraud");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const close = useCallback(() => {
    setOpen(false);
    setMessage(null);
    setSubmitting(false);
  }, []);

  const submit = async () => {
    if (submitting || cooldown > 0) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await apiFetch("/api/reports/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advert_id: advertId, reason, details }),
        credentials: "include",
      });

      const payload = await response.json().catch(() => ({ ok: false }));

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || response.statusText);
      }

      setMessage("Жалоба отправлена. Спасибо!");
      setTimeout(() => close(), 1000);
    } catch (error) {
      if (error instanceof RateLimitedError) {
        const seconds = Math.max(1, Math.round(error.retryAfterSec ?? 60));
        setCooldown(seconds);
        toast.error(`Слишком много попыток. Повторите через ${seconds} сек.`);
      } else {
        const text =
          error instanceof Error ? error.message : "Не удалось отправить жалобу";
        setMessage(`Ошибка: ${text}`);
      }
      setSubmitting(false);
    }
  };

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Пожаловаться
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">Пожаловаться на объявление</h3>
              <button
                type="button"
                onClick={close}
                className="rounded-full px-2 text-lg leading-none text-muted-foreground hover:bg-muted"
              >
                ×
                <span className="sr-only">Закрыть</span>
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                  Причина
                </label>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                >
                  <option value="fraud">Мошенничество</option>
                  <option value="spam">Спам</option>
                  <option value="duplicate">Дубликат</option>
                  <option value="nsfw">Непристойный контент</option>
                  <option value="other">Другое</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
                  Подробности (необязательно)
                </label>
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={submit}
                disabled={submitting || cooldown > 0}
                className="rounded-xl bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Отправляем…"
                  : cooldown > 0
                    ? `Повторите через ${cooldown} с`
                    : "Отправить"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-xl border px-4 py-2"
              >
                Отмена
              </button>
            </div>

            {message && (
              <p className="mt-3 text-sm text-muted-foreground">{message}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
