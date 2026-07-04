"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeEuro, Check, Loader2, MessageCircle, PencilLine, ShieldCheck, X } from "lucide-react";

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
  const [safetyOpen, setSafetyOpen] = useState(false);

  const isOwnListing = currentUserId === sellerId;
  const safetyItems = [
    tr("advert.safety_meet_public", "Meet in a busy public place."),
    tr("advert.safety_inspect_first", "Inspect the item before payment."),
    tr("advert.safety_keep_chat", "Keep the conversation inside LyVoX."),
  ];

  const startChat = async (options?: { openOffer?: boolean }) => {
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
      router.push(`/chat/${conversationId}${options?.openOffer ? "?offer=1" : ""}`);
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
    <>
      {safetyOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-foreground/18"
            aria-label={tr("advert.safety_close", "Close safety tips")}
            onClick={() => setSafetyOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="advert-mobile-safety-title"
            className="lyvox-ad-safety-sheet fixed inset-x-0 bottom-[var(--bottom-nav-h)] border-t border-border bg-card px-5 pb-5 pt-4 shadow-[0_-18px_45px_oklch(0.22_0.03_200_/_0.18)]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--rm)] bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="advert-mobile-safety-title" className="text-base font-extrabold tracking-tight">
                  {tr("advert.safety_sheet_title", "Before you meet")}
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {safetyItems.map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-[transform,background-color] duration-150 ease-out active:scale-[0.97]"
                aria-label={tr("advert.safety_close", "Close safety tips")}
                onClick={() => setSafetyOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div
        className="lyvox-ad-contact-bar fixed left-0 right-0 z-30 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-2 lg:hidden"
        style={{
          bottom: "var(--bottom-nav-h)",
          minHeight: "var(--contact-bar-h)",
          background: "color-mix(in oklch, var(--background) 97%, transparent)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div className="shrink-0">
          <div className="text-foreground text-[1.125rem] font-extrabold leading-none">
            {priceText}
          </div>
        </div>

        {isOwnListing ? (
          <Link
            href={editHref}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 text-[0.906rem] font-bold text-white transition-[transform,opacity] duration-150 ease-out active:scale-[0.97]"
            style={{
              borderRadius: "var(--rm)",
              background: "var(--gC)",
              boxShadow: "0 4px 14px oklch(0.55 0.13 178 / 0.38)",
            }}
          >
            <PencilLine className="h-[17px] w-[17px]" aria-hidden="true" />
            {tr("contact.manage", "Manage listing")}
          </Link>
        ) : (
          <div className="min-w-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <button
                type="button"
                onClick={() => requireTrust("verified", () => void startChat())}
                disabled={startingChat}
                className="flex min-h-11 items-center justify-center gap-2 text-[0.906rem] font-bold text-white transition-[transform,opacity] duration-150 ease-out active:scale-[0.97]"
                style={{
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
                  ? tr("contact.opening", "Opening chat...")
                  : tr("contact.message", "Message seller")}
              </button>
              <button
                type="button"
                onClick={() => requireTrust("verified", () => void startChat({ openOffer: true }))}
                disabled={startingChat}
                className="flex min-h-11 w-11 items-center justify-center gap-1.5 border border-border bg-card px-0 text-[0.812rem] font-bold text-foreground shadow-[var(--shS)] transition-[transform,opacity,background-color] duration-150 ease-out active:scale-[0.97] min-[430px]:w-auto min-[430px]:px-3"
                style={{
                  borderRadius: "var(--rm)",
                  opacity: startingChat ? 0.7 : 1,
                }}
              >
                <BadgeEuro className="h-[16px] w-[16px] shrink-0 text-primary" aria-hidden="true" />
                <span className="hidden min-[430px]:inline">{tr("chat.offer_button", "Offer price")}</span>
              </button>
            </div>
            <button
              type="button"
              className="mt-1 flex min-h-5 w-full items-center justify-center gap-1.5 text-center text-[11px] font-semibold leading-tight text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              onClick={() => setSafetyOpen(true)}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">
                {tr("advert.safety_microcopy", "Chat inside LyVoX - contact details stay private")}
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
