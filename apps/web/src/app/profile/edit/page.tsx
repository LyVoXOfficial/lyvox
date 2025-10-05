"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileEdit() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const userResponse = await fetch("/api/me", { cache: "no-store" });
      const userJson = await userResponse.json().catch(() => null);
      if (!userJson?.user) {
        router.push("/login");
        return;
      }

      const profileResponse = await fetch("/api/profile/get", {
        cache: "no-store",
      });
      const profile = await profileResponse.json().catch(() => null);
      if (cancelled) return;

      setDisplayName(profile?.display_name ?? "");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    const response = await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName }),
    });

    const result = await response.json().catch(() => ({ ok: false }));
    setLoading(false);

    if (result.ok) {
      setMessage("Сохранено");
      setTimeout(() => router.push("/profile"), 400);
    } else {
      setMessage("Ошибка: " + (result.error || "Неизвестно"));
    }
  };

  const cancel = () => {
    router.back();
  };

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Редактировать профиль</h1>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="block text-sm text-muted-foreground" htmlFor="display_name">
            Отображаемое имя
          </label>
          <input
            id="display_name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            maxLength={80}
          />
          <p className="mt-1 text-xs text-muted-foreground">До 80 символов, видят другие пользователи.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-black px-4 py-2 text-white"
            disabled={loading}
          >
            {loading ? "Сохраняем..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded-xl border px-4 py-2"
          >
            Отменить
          </button>
        </div>
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </form>
    </main>
  );
}
