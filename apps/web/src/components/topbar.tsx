"use client";

export default function TopBar() {
  return (
    <div className="w-full bg-zinc-100 text-xs md:text-sm text-zinc-700">
      <div className="mx-auto max-w-6xl px-4 h-8 flex items-center justify-end gap-3">
        <span className="opacity-70">Язык:</span>
        <button className="hover:underline">RU</button>
        <button className="hover:underline">EN</button>
        <button className="hover:underline">NL</button>
        <button className="hover:underline">FR</button>
      </div>
    </div>
  );
}
