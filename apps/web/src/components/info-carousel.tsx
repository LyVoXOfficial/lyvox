"use client";

const items = [
  { title: "Бонус до 50€ на первую рекламу", link: "/promo" },
  { title: "Гид по безопасности: как не попасться мошенникам", link: "/safety" },
  { title: "Советы: как сфотографировать товар", link: "/tips/photos" },
];

export default function InfoCarousel() {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 snap-x snap-mandatory pr-4">
        {items.map((it) => (
          <a
            key={it.title}
            href={it.link}
            className="snap-start min-w-[260px] md:min-w-[320px] bg-zinc-100 rounded-xl p-4 hover:bg-zinc-200 transition"
          >
            <div className="font-medium">{it.title}</div>
            <div className="text-xs text-zinc-600 mt-1">Подробнее →</div>
          </a>
        ))}
      </div>
    </div>
  );
}
