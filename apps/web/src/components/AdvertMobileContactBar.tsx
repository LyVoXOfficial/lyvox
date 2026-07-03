"use client";

/**
 * AdvertMobileContactBar
 *
 * Mobile-only sticky bottom bar: price + "Contact seller" CTA.
 * Wires to the same requireTrust/startChat flow as AdvertContactPanel.
 * Rendered `lg:hidden` — invisible on desktop.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle, PencilLine } from "lucide-react";

import { apiFetch, RateLimitedError } from "@/lib/fetcher";
import { useI18n } from "@/i18n";
import { useTrustGate } from "@/components/trust/TrustGateProvider";

type Props = {
  advertId: string;
  sellerId: string;
  currentUserId: string | null;
  priceText: string;
  editHref: string;
};

export default function AdvertMobileContactBar({
  advertId,
  sellerId,
  currentUserId,
  priceText,
  editHref,
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  const { requireTrust } = useTrustGate();
  const [startingChat, setStartingChat] = useState(false);

  const isOwnListing = currentUserId === sellerId;

  const startChat = async () => {
    if (isOwnListing || startingChat) return;
    setStartingChat(true);
    try {
      const response = await apiFetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advert_id: advertId, peer_id: sellerId }),
        credentials: "include",
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; data?: { conversation_id?: string }; error?: string; detail?: string } | null;
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
    /* Sticky bottom bar — mobile only (lg:hidden) */
    <div
      className="fixed left-0 right-0 z-30 flex items-center gap-[11px] px-4 lg:hidden"
      style={{
        bottom: "var(--bottom-nav-h)",
        height: "var(--contact-bar-h)",
        background: "color-mix(in oklch, var(--background) 97%, transparent)",
        backdropFilter: "blur(10px)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* Price */}
      <div className="shrink-0">
        <div
          className="text-foreground text-[1.125rem] font-extrabold leading-none"
        >
          {priceText}
        </div>
      </div>

      {/* CTA */}
      {isOwnListing ? (
        <Link
          href={editHref}
          className="flex flex-1 items-center justify-center gap-2 text-[0.906rem] font-bold text-white"
          style={{
            height: "46px",
            borderRadius: "var(--rm)",
            background: "var(--gC)",
            boxShadow: "0 4px 14px oklch(0.55 0.13 178 / 0.38)",
          }}
        >
          <PencilLine className="h-[17px] w-[17px]" aria-hidden="true" />
          {tr("contact.manage", "Manage listing")}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => requireTrust("verified", () => void startChat())}
          disabled={startingChat}
          className="flex flex-1 items-center justify-center gap-2 text-[0.906rem] font-bold text-white"
          style={{
            height: "46px",
            borderRadius: "var(--rm)",
            background: "var(--gC)",
            border: 0,
            cursor: "pointer",
            boxShadow: "0 4px 14px oklch(0.55 0.13 178 / 0.38)",
            opacity: startingChat ? 0.7 : 1,
          }}
        >
          {startingChat ? (
            <Loader2 className="h-[17px] w-[17px] animate-spin" aria-hidden="true" />
          ) : (
            <MessageCircle className="h-[17px] w-[17px]" aria-hidden="true" />
          )}
          {startingChat
            ? tr("contact.opening", "Opening chat…")
            : tr("contact.message", "Message seller")}
        </button>
      )}
    </div>
  );
}
