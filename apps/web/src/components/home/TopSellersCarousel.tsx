"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star, Check } from "lucide-react";
import { useI18n } from "@/i18n";

type TopSeller = {
  id: string;
  display_name: string | null;
  verified_email: boolean;
  verified_phone: boolean;
  trust_score: number;
  total_deals: number;
  active_adverts: number;
  rating: number;
};

export default function TopSellersCarousel() {
  const { t } = useI18n();
  const [sellers, setSellers] = useState<TopSeller[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Загрузка топ продавцов
  useEffect(() => {
    async function loadTopSellers() {
      try {
        const response = await fetch("/api/top-sellers?limit=5");
        const data = await response.json();
        
        if (data.ok && data.data?.sellers) {
          setSellers(data.data.sellers);
        }
      } catch (error) {
        console.error("Failed to load top sellers:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTopSellers();
  }, []);

  // Автоматическая прокрутка каждые 5 секунд
  useEffect(() => {
    if (!isAutoPlaying || sellers.length === 0) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sellers.length);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAutoPlaying, sellers.length]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % sellers.length);
    setIsAutoPlaying(false);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + sellers.length) % sellers.length);
    setIsAutoPlaying(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border p-6 bg-white shadow-md animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gray-200"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (sellers.length === 0) return null;

  const currentSeller = sellers[currentIndex];
  const isTopOne = currentIndex === 0;

  return (
    <div className="relative">
      {/* Специальная рамка для #1 */}
      <div className={`
        relative rounded-2xl p-6 transition-all duration-500
        ${isTopOne 
          ? 'bg-gradient-to-br from-yellow-100 via-amber-50 to-orange-100 border-4 border-yellow-400 shadow-2xl scale-105' 
          : 'bg-white border border-gray-200 shadow-md'
        }
      `}>
        {/* Топ #1 badge */}
        {isTopOne && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
            <Star className="w-4 h-4 fill-current" />
            {t("home.top_seller") || "ТОП #1 Продавец"}
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* Аватар */}
          <div className="relative">
            <div className={`
              w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold
              ${isTopOne ? 'bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-900' : 'bg-gray-200 text-gray-600'}
            `}>
              {currentSeller.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            {/* Верификации */}
            {(currentSeller.verified_email || currentSeller.verified_phone) && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* Информация */}
          <div className="flex-1 min-w-0">
            <Link 
              href={`/user/${currentSeller.id}`}
              className="text-lg font-semibold hover:underline block truncate"
            >
              {currentSeller.display_name || t("common.user") || "Пользователь"}
            </Link>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 flex-wrap">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                {currentSeller.rating?.toFixed(1) || '5.0'}
              </span>
              <span>•</span>
              <span>{currentSeller.total_deals} {t("home.deals") || "сделок"}</span>
              <span>•</span>
              <span>{currentSeller.active_adverts} {t("home.adverts") || "объявлений"}</span>
            </div>
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-green-500 h-full transition-all duration-500"
                    style={{ width: `${Math.min(currentSeller.trust_score || 0, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600">{currentSeller.trust_score || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Навигация */}
        {sellers.length > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={handlePrev}
              className="p-2 rounded-full hover:bg-gray-100 transition"
              aria-label={t("common.previous") || "Предыдущий"}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            {/* Индикаторы */}
            <div className="flex gap-2">
              {sellers.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setIsAutoPlaying(false);
                  }}
                  className={`
                    w-2 h-2 rounded-full transition-all
                    ${idx === currentIndex 
                      ? 'bg-blue-600 w-6' 
                      : 'bg-gray-300 hover:bg-gray-400'
                    }
                  `}
                  aria-label={`${t("home.seller") || "Продавец"} ${idx + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="p-2 rounded-full hover:bg-gray-100 transition"
              aria-label={t("common.next") || "Следующий"}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

