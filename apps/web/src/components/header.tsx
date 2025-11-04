import Link from "next/link";
import UserMenu from "@/components/UserMenu";

export default function Header() {
  return (
    <header className="border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <Link className="text-lg font-semibold" href="/">
          LyVoX
        </Link>

        <div className="hidden flex-1 md:block">
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Поиск объявлений"
            type="search"
          />
        </div>

        <nav className="flex items-center gap-2">
          <Link className="rounded-xl px-3 py-2 text-sm hover:bg-muted" href="/c">
            Категории
          </Link>
          <Link className="rounded-xl px-3 py-2 text-sm hover:bg-muted" href="/post">
            Подать объявление
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
