"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function isVerified(s: TopSeller) {
  return s.verified_email || s.verified_phone;
}

function isFullyVerified(s: TopSeller) {
  return s.verified_email && s.verified_phone;
}

function SellerCard({ seller, tr }: { seller: TopSeller; tr: (k: string, fb: string) => string }) {
  return (
    <Link
      href={`/user/${seller.id}`}
      className="flex items-center gap-[13px] rounded-[var(--r)] border border-border bg-card p-[18px] transition hover:border-primary/40 hover:shadow-[var(--shC)]"
      style={{ boxShadow: "var(--shS)" }}
    >
      {/* Avatar */}
      <span
        className="grid shrink-0 place-items-center font-extrabold"
        style={{
          width: 50,
          height: 50,
          borderRadius: "15px",
          fontSize: "17px",
          background: isFullyVerified(seller)
            ? "linear-gradient(135deg, var(--accent), var(--primary) 78%)"
            : "var(--sec)",
          color: isFullyVerified(seller) ? "#fff" : "var(--priD)",
          border: isFullyVerified(seller) ? "none" : "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        {getInitials(seller.display_name)}
      </span>

      {/* Info */}
      <div className="min-w-0">
        {/* Name + shield */}
        <div className="flex items-center gap-[6px]">
          <span className="truncate font-bold" style={{ fontSize: "15px" }}>
            {seller.display_name ?? tr("common.user", "User")}
          </span>
          {isVerified(seller) && (
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.6"
              aria-label="Verified"
              className="shrink-0"
            >
              <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          )}
        </div>

        {/* Seller type label */}
        <div
          className="font-semibold"
          style={{
            fontSize: "12px",
            color: isFullyVerified(seller) ? "var(--mintI)" : "var(--muted-foreground)",
            margin: "3px 0 2px",
          }}
        >
          {isFullyVerified(seller)
            ? tr("home.business_seller", "Business seller")
            : tr("home.private_seller", "Private seller")}
        </div>

        {/* Rating */}
        <div
          className="flex items-center gap-[4px] font-semibold text-muted-foreground"
          style={{ fontSize: "12.5px" }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="var(--amber)" stroke="none" aria-hidden="true">
            <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />
          </svg>
          {seller.rating?.toFixed(1) ?? "5.0"} · {seller.total_deals}
        </div>
      </div>
    </Link>
  );
}

export default function TopSellersCarousel() {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };

  const [sellers, setSellers] = useState<TopSeller[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const VISIBLE = 4;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/top-sellers?limit=8");
        const body = await res.json();
        if (body.ok && body.data?.sellers) setSellers(body.data.sellers);
      } catch {
        // silent — section won't render
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="font-extrabold tracking-tight text-foreground" style={{ fontSize: "22px", letterSpacing: "-0.02em", margin: 0 }}>
            {tr("home.top_sellers_title", "Top sellers")}{" "}
            <span className="font-semibold text-muted-foreground" style={{ fontSize: "14px" }}>
              · {tr("home.top_sellers_subtitle", "verified this week")}
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-[var(--r)] border border-border bg-card p-[18px]" style={{ boxShadow: "var(--shS)" }}>
              <div className="flex items-center gap-[13px]">
                <div className="shrink-0 rounded-[15px] bg-muted" style={{ width: 50, height: 50 }} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-2.5 w-1/2 rounded bg-muted" />
                  <div className="h-2.5 w-2/5 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (sellers.length === 0) return null;

  const canPrev = offset > 0;
  const canNext = offset + VISIBLE < sellers.length;
  const visible = sellers.slice(offset, offset + VISIBLE);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <h2
          className="font-extrabold tracking-tight text-foreground"
          style={{ fontSize: "22px", letterSpacing: "-0.02em", margin: 0 }}
        >
          {tr("home.top_sellers_title", "Top sellers")}{" "}
          <span className="font-semibold text-muted-foreground" style={{ fontSize: "14px" }}>
            · {tr("home.top_sellers_subtitle", "verified this week")}
          </span>
        </h2>
        {sellers.length > VISIBLE && (
          <span className="flex gap-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - 1))}
              disabled={!canPrev}
              aria-label={tr("common.previous", "Previous")}
              className="grid place-items-center rounded-full border border-border bg-card transition hover:bg-secondary disabled:opacity-40"
              style={{ width: 34, height: 34, color: "var(--muted-foreground)" }}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setOffset((o) => Math.min(sellers.length - VISIBLE, o + 1))}
              disabled={!canNext}
              aria-label={tr("common.next", "Next")}
              className="grid place-items-center rounded-full border border-border bg-card transition hover:bg-secondary disabled:opacity-40"
              style={{ width: 34, height: 34, color: "var(--foreground)" }}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>

      {/* Grid — 4-up desktop, 2-up mobile */}
      <div className="grid grid-cols-2 gap-4 pb-1 md:grid-cols-4">
        {visible.map((seller) => (
          <SellerCard key={seller.id} seller={seller} tr={tr} />
        ))}
      </div>
    </section>
  );
}
