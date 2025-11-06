"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, Heart, Star, TrendingUp } from "lucide-react";
import { useI18n } from "@/i18n";

type TopAdvert = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  location: string | null;
  image: string | null;
  view_count: number;
  favorite_count: number;
  popularity_score: number;
};

export default function TopAdvertCard() {
  const { t } = useI18n();
  const [advert, setAdvert] = useState<TopAdvert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTopAdvert() {
      try {
        const response = await fetch("/api/top-adverts?limit=1");
        const data = await response.json();
        
        if (data.ok && data.data?.adverts?.[0]) {
          setAdvert(data.data.adverts[0]);
        }
      } catch (error) {
        console.error("Failed to load top advert:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTopAdvert();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border p-6 bg-white shadow-md animate-pulse">
        <div className="space-y-3">
          <div className="h-48 bg-gray-200 rounded-lg"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!advert) return null;

  const formatPrice = (price: number | null, currency: string) => {
    if (price === null || price === 0) return t("common.free") || "Бесплатно";
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="relative">
      {/* Специальная рамка для ТОП объявления */}
      <div className="relative rounded-2xl p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-4 border-blue-400 shadow-2xl scale-105">
        {/* ТОП badge */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg flex items-center gap-1 z-10">
          <TrendingUp className="w-4 h-4" />
          {t("home.top_advert") || "ТОП Объявление"}
        </div>

        <Link href={`/advert/${advert.id}`} className="block">
          {/* Изображение */}
          <div className="relative w-full h-48 rounded-lg overflow-hidden mb-4 bg-gray-100">
            {advert.image ? (
              <Image
                src={advert.image}
                alt={advert.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 400px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <Star className="w-12 h-12" />
              </div>
            )}
            
            {/* Badge с популярностью */}
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1 text-xs font-semibold">
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
              {advert.popularity_score}
            </div>
          </div>

          {/* Заголовок */}
          <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-gray-900">
            {advert.title}
          </h3>

          {/* Цена */}
          <p className="text-2xl font-bold text-blue-600 mb-3">
            {formatPrice(advert.price, advert.currency)}
          </p>

          {/* Статистика */}
          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>{advert.view_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4 text-red-500" />
              <span>{advert.favorite_count}</span>
            </div>
          </div>

          {/* Локация */}
          {advert.location && (
            <p className="text-sm text-gray-500 truncate">
              📍 {advert.location}
            </p>
          )}
        </Link>
      </div>
    </div>
  );
}

