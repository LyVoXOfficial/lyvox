"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";
import { useI18n } from "@/i18n";

type MeResponse = {
  user: unknown | null;
};

const hasUser = (payload: MeResponse | { user?: unknown } | null | undefined) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const candidate = (payload as { user?: unknown }).user;
  return !!candidate;
};

export default function MainHeader() {
  const { t } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data: MeResponse = await response.json().catch(() => ({ user: null }));
        if (active) {
          setHasSession(hasUser(data));
        }
      } catch {
        if (active) {
          setHasSession(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    window.location.href = `/search?q=${encodeURIComponent(query)}`;
  };

  const handlePostClick = async () => {
    let session = hasSession;

    if (session === null) {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data: MeResponse = await response.json().catch(() => ({ user: null }));
        session = hasUser(data);
        setHasSession(session);
      } catch {
        session = false;
        setHasSession(false);
      }
    }

    if (session) {
      router.push("/post");
    } else {
      const next = encodeURIComponent("/post");
      router.push(`/register?next=${next}`);
    }
  };

  return (
    <div className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="text-lg font-semibold">
          LyVoX
        </Link>

        <form onSubmit={submitSearch} className="flex flex-1 items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            placeholder={t("common.search")}
            aria-label={t("common.search")}
          />
          <Button type="submit" variant="outline" className="hidden md:inline-flex">
            {t("common.find")}
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Button onClick={handlePostClick}>{t("common.post")}</Button>
          <UserMenu />
        </div>
      </div>
    </div>
  );
}
