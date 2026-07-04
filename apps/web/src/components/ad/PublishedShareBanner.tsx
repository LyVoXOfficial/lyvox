"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Share2, X } from "lucide-react";
import { FaWhatsapp, FaFacebookF, FaTelegram, FaXTwitter } from "react-icons/fa6";
import { useI18n } from "@/i18n";

// Post-publish share loop (supply wave): shown once right after the seller
// publishes (?published=1). The prefilled text is deliberately neutral —
// title + link only, no platform trust claims (DSA Art.30 discipline).
//
// Motion notes (seen once per publish → delight is appropriate):
// banner rises in, network icons stagger 45ms apart, the success check
// pops — all ≤350ms on a strong ease-out, with a reduced-motion fallback
// (see .lyvox-rise-in / .lyvox-pop-in in globals.css).
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
  // transition from /post the component mounts before the URL commits.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.lyvox.be").replace(/\/+$/, "");
  const url = `${origin}/ad/${adId}`;

  if (searchParams.get("published") !== "1" || dismissed) return null;

  const shareText = `${title} — ${url}`;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const networks = [
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      icon: FaWhatsapp,
      bg: "#25D366",
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      icon: FaFacebookF,
      bg: "#1877F2",
    },
    {
      name: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      icon: FaTelegram,
      bg: "#229ED9",
    },
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      icon: FaXTwitter,
      bg: "#0F1419",
    },
  ];

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

  const iconBtn =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--shS)] transition-[transform,filter] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5 [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110";

  return (
    <section
      className="lyvox-rise-in flex flex-col gap-3.5 rounded-[var(--rm)] border border-primary/25 bg-accent/25 p-4 sm:flex-row sm:items-center sm:justify-between"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="lyvox-trust-gradient lyvox-pop-in flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white">
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
        {networks.map(({ name, href, icon: Icon, bg }, i) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            title={name}
            className={`lyvox-rise-in ${iconBtn}`}
            style={{ background: bg, animationDelay: `${90 + i * 45}ms` }}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </a>
        ))}

        {canNativeShare ? (
          <button
            type="button"
            onClick={nativeShare}
            aria-label={tr("post.share_native", "Share")}
            title={tr("post.share_native", "Share")}
            className={`lyvox-rise-in ${iconBtn} border border-border !text-foreground bg-card`}
            style={{ animationDelay: `${90 + networks.length * 45}ms` }}
          >
            <Share2 className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? tr("post.share_copied", "Link copied") : tr("post.share_copy", "Copy link")}
          title={copied ? tr("post.share_copied", "Link copied") : tr("post.share_copy", "Copy link")}
          className={`lyvox-rise-in ${iconBtn} border ${copied ? "border-primary bg-primary" : "border-border bg-card !text-foreground"}`}
          style={{ animationDelay: `${90 + (networks.length + 1) * 45}ms` }}
        >
          {/* Crossfade between copy/check — blur bridges the icon swap */}
          <span className="relative block h-5 w-5">
            <Copy
              className={`absolute inset-0 h-5 w-5 transition-[opacity,filter] duration-200 ${copied ? "opacity-0 blur-[2px]" : "opacity-100 blur-0"}`}
              aria-hidden="true"
            />
            <Check
              className={`absolute inset-0 h-5 w-5 text-white transition-[opacity,filter] duration-200 ${copied ? "opacity-100 blur-0" : "opacity-0 blur-[2px]"}`}
              aria-hidden="true"
            />
          </span>
          <span className="sr-only" aria-live="polite">
            {copied ? tr("post.share_copied", "Link copied") : ""}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={tr("common.close", "Close")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
