"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/UserMenu";

export default function MainHeader() {
  const [search, setSearch] = useState("");

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    window.location.href = `/search?q=${encodeURIComponent(query)}`;
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
            placeholder="Поиск объявлений"
            aria-label="Поиск объявлений"
          />
          <Button type="submit" variant="outline" className="hidden md:inline-flex">
            Найти
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Link href="/post">
            <Button>Подать объявление</Button>
          </Link>
          <UserMenu />
        </div>
      </div>
    </div>
  );
}
