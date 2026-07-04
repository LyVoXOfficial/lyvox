"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, MessageCircle, Share2, X } from "lucide-react";
import { useI18n } from "@/i18n";

// Post-publish share loop (supply wave): shown once right after the seller
// publishes (?published=1). The prefilled text is deliberately neutral —
// title + link only, no platform trust claims (DSA Art.30 discipline).
export default function PublishedShareBanner({ title, adId }: { title: string; adId: string }) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  // The link is built from the server-provided ad id and the canonical
  // site origin, NEVER from window.location: during the client-side
  // transition from /post the component mounts before the URL commits,
  // so a pathname captured at mount still said /post — that exact bug
  // shipped a WhatsApp link pointing at the post form instead of the
  // listing. NEXT_PUBLIC_SITE_URL is identical on server and client
  // (no hydration drift) and keeps shared links canonical even from dev.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.lyvox.be").replace(/\/+$/, "");
  const url = `${origin}/ad/${adId}`;

  if (searchParams.get("published") !== "1" || dismissed) return null;

  const shareText = `${title} — ${url}`;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard denied — leave the button as-is
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // user cancelled the sheet — nothing to do
    }
  };

  return (
    <section
      className="flex flex-col gap-3 rounded-[var(--rm)] border border-primary/25 bg-accent/25 p-4 sm:flex-row sm:items-center sm:justify-between"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="lyvox-trust-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white">
          <Check className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold tracking-tight">
            {tr("post.share_banner_title", "Your listing is live")}
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
            {tr("post.share_banner_body", "Share the link — buyers will find it sooner.")}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 text-[13px] font-bold text-white transition hover:brightness-105"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          WhatsApp
        </a>
        {canNativeShare ? (
          <button
            type="button"
            onClick={nativeShare}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            {tr("post.share_native", "Share")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold transition hover:border-primary/40 hover:text-primary"
        >
          {copied ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? tr("post.share_copied", "Link copied") : tr("post.share_copy", "Copy link")}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={tr("common.close", "Close")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
