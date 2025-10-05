"use client";

import Link from "next/link";

// Заглушечные категории (можешь заменить на реальные запросом к БД)
const cats = [
  { slug: "elektronika", name: "Электроника" },
  { slug: "dom-i-sad", name: "Дом и сад" },
  { slug: "transport", name: "Транспорт" },
  { slug: "nedvizhimost", name: "Недвижимость" },
  { slug: "uslugi", name: "Услуги" },
  { slug: "detskoe", name: "Детское" },
  { slug: "hobbi", name: "Хобби" },
];

export default function CategoriesCarousel() {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-5 snap-x snap-mandatory pr-4 py-1">
        {cats.map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="snap-start flex flex-col items-center gap-2">
            <div className="size-16 md:size-20 rounded-full bg-zinc-100 border flex items-center justify-center">
              {/* сюда позже поставим иконку */}
              <span className="text-sm opacity-60">🛒</span>
            </div>
            <div className="text-xs md:text-sm text-center w-20 md:w-24">{c.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
