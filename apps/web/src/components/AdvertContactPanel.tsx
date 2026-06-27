"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  MessageCircle,
  PencilLine,
  Phone,
  ShieldCheck,
} from "lucide-react";

import FavoriteToggle from "@/components/favorites/FavoriteToggle";
import ReportButton from "@/components/ReportButton";
import { apiFetch, RateLimitedError } from "@/lib/fetcher";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { useTrustGate } from "@/components/trust/TrustGateProvider";

type FavoriteAdvert = {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  image?: string | null;
  createdAt?: string | null;
  sellerVerified?: boolean;
};

type SellerSummary = {
  id: string;
  displayName: string | null;
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  trustScore: number;
  activeAdverts: number;
};

type AdvertContactPanelProps = {
  advert: FavoriteAdvert;
  seller: SellerSummary;
  currentUserId: string | null;
  editHref: string;
  sellerName: string;
  canSeeSeller: boolean;
  isBusiness?: boolean;
  className?: string;
};

type ChatStartResponse = {
  ok?: boolean;
  data?: {
    conversation_id?: string;
    created?: boolean;
  };
  error?: string;
  detail?: string;
};

export default function AdvertContactPanel({
  advert,
  seller,
  currentUserId,
  editHref,
  sellerName,
  canSeeSeller,
  isBusiness = false,
  className,
}: AdvertContactPanelProps) {
  const router = useRouter();
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const { requireTrust } = useTrustGate();
  const [startingChat, setStartingChat] = useState(false);

  const isOwnListing = currentUserId === seller.id;
  const sellerVerified = seller.verifiedEmail && seller.verifiedPhone;

  // Derive seller initials for avatar
  const displayedName = canSeeSeller ? sellerName : tr("seller_gate.name_hidden", "Verified users only");
  const initials = canSeeSeller && sellerName
    ? sellerName
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0] ?? "")
        .join("")
        .toUpperCase()
    : "?";

  const startChat = async () => {
    if (isOwnListing || startingChat) {
      return;
    }

    setStartingChat(true);

    try {
      const response = await apiFetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advert_id: advert.id,
          peer_id: seller.id,
        }),
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as ChatStartResponse | null;

      if (response.status === 401 || (response.status === 403 && payload?.error === "VERIFICATION_REQUIRED")) {
        requireTrust("verified", () => void startChat());
        return;
      }

      const conversationId = payload?.data?.conversation_id;

      if (!response.ok || !payload?.ok || !conversationId) {
        throw new Error(payload?.detail || payload?.error || tr("contact.error_generic", "Could not open the conversation"));
      }

      router.push(`/chat/${conversationId}`);
    } catch (error) {
      if (error instanceof RateLimitedError) {
        const seconds = Math.max(1, Math.round(error.retryAfterSec ?? 60));
        toast.error(tr("contact.too_many", "Too many chat attempts. Try again shortly.") + ` (${seconds}s)`);
      } else {
        const message = error instanceof Error ? error.message : tr("contact.error_generic", "Could not open the conversation");
        toast.error(message);
      }
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <aside
      className={cn("border border-border/70 bg-card", className)}
      style={{
        borderRadius: "var(--r)",
        padding: "20px",
        boxShadow: "var(--shC)",
      }}
    >
      {/* ── Seller avatar + name row ── */}
      <div className="mb-[15px] flex items-center gap-[13px]">
        <span
          className="lyvox-trust-gradient flex shrink-0 items-center justify-center text-white"
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "16px",
            font: "800 18px Inter",
          }}
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-[7px]">
            <span
              className="truncate text-foreground"
              style={{ font: "800 17px Inter" }}
            >
              {displayedName}
            </span>
            {sellerVerified ? (
              <ShieldCheck
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            ) : null}
          </div>
          {isBusiness ? (
            <span
              className="lyvox-trust-gradient mt-[5px] inline-flex items-center text-white"
              style={{
                height: "22px",
                padding: "0 10px",
                borderRadius: "999px",
                font: "700 11px Inter",
              }}
            >
              {tr("contact.business_seller", "Business seller")}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Trust badge row ── */}
      {(sellerVerified || seller.verifiedPhone) ? (
        <div
          className="mb-[18px] flex flex-wrap gap-[7px]"
        >
          {sellerVerified ? (
            <span
              className="lyvox-trust-gradient inline-flex items-center gap-[5px] text-white"
              style={{
                height: "27px",
                padding: "0 11px",
                borderRadius: "999px",
                font: "700 11.5px Inter",
                boxShadow: "0 2px 8px oklch(0.55 0.12 172 / 0.30)",
              }}
            >
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {tr("contact.verified", "Verified")}
            </span>
          ) : null}
          {seller.verifiedPhone ? (
            <span
              className="inline-flex items-center gap-[5px] border border-border"
              style={{
                height: "27px",
                padding: "0 11px",
                borderRadius: "999px",
                background: "var(--sec)",
                color: "var(--mintI)",
                font: "700 11.5px Inter",
              }}
            >
              <Phone className="h-3 w-3" aria-hidden="true" />
              {tr("contact.phone_verified", "Phone-verified")}
            </span>
          ) : null}
          {!sellerVerified ? (
            <span
              className="inline-flex items-center"
              style={{
                height: "27px",
                padding: "0 11px",
                borderRadius: "999px",
                background: "oklch(0.83 0.14 72 / 0.15)",
                color: "var(--amberI)",
                font: "700 11.5px Inter",
              }}
            >
              {tr("contact.checks_pending", "Checks pending")}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mb-[18px]">
          <span
            className="inline-flex items-center"
            style={{
              height: "27px",
              padding: "0 11px",
              borderRadius: "999px",
              background: "oklch(0.83 0.14 72 / 0.15)",
              color: "var(--amberI)",
              font: "700 11.5px Inter",
            }}
          >
            {tr("contact.checks_pending", "Checks pending")}
          </span>
        </div>
      )}

      {/* ── Contact CTA / Manage listing ── */}
      {isOwnListing ? (
        <Link
          href={editHref}
          className="mb-[11px] flex w-full items-center justify-center gap-[9px] text-white"
          style={{
            height: "50px",
            borderRadius: "var(--rm)",
            background: "var(--gC)",
            font: "700 15.5px Inter",
            boxShadow: "0 5px 16px oklch(0.55 0.13 178 / 0.38)",
          }}
        >
          <PencilLine className="h-[19px] w-[19px]" aria-hidden="true" />
          {tr("contact.manage", "Manage listing")}
        </Link>
      ) : (
        <div className="mb-[11px] flex gap-2">
          <button
            type="button"
            onClick={() => requireTrust("verified", () => void startChat())}
            disabled={startingChat}
            className={cn(
              "flex flex-1 items-center justify-center gap-[9px] text-white transition-opacity",
              startingChat && "opacity-70",
            )}
            style={{
              height: "50px",
              borderRadius: "var(--rm)",
              background: "var(--gC)",
              border: 0,
              font: "700 15.5px Inter",
              cursor: "pointer",
              boxShadow: "0 5px 16px oklch(0.55 0.13 178 / 0.38)",
            }}
          >
            {startingChat ? (
              <Loader2 className="h-[19px] w-[19px] animate-spin" aria-hidden="true" />
            ) : (
              <MessageCircle className="h-[19px] w-[19px]" aria-hidden="true" />
            )}
            {startingChat ? tr("contact.opening", "Opening chat…") : tr("contact.message", "Message seller")}
          </button>
          <FavoriteToggle
            advert={advert}
            variant="overlay"
            className="h-[50px] w-[50px] rounded-[13px]"
          />
        </div>
      )}

      {/* ── Safety tip row ── */}
      <div
        className="mb-[13px] flex items-center gap-[8px]"
        style={{
          padding: "10px 12px",
          background: "oklch(0.56 0.13 178 / 0.06)",
          border: "1px solid oklch(0.56 0.13 178 / 0.16)",
          borderRadius: "var(--rs)",
        }}
      >
        <ShieldCheck
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--priD)" }}
          aria-hidden="true"
        />
        <span
          className="leading-snug"
          style={{ font: "500 11.5px/1.4 Inter", color: "var(--priD)" }}
        >
          {tr(
            "contact.safety_tip",
            "A quick safety check confirms you’re a real account, then opens a private chat. LyVoX never handles payment.",
          )}
        </span>
      </div>

      {/* ── Report link — centered ── */}
      <div className="flex items-center justify-center">
        <ReportButton advertId={advert.id} />
      </div>
    </aside>
  );
}
