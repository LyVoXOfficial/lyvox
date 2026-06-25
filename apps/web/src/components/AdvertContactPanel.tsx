"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarDays,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  PencilLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import FavoriteToggle from "@/components/favorites/FavoriteToggle";
import ReportButton from "@/components/ReportButton";
import { Button } from "@/components/ui/button";
import { apiFetch, RateLimitedError } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

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
  priceText: string;
  locationText: string;
  createdText: string | null;
  loginHref: string;
  editHref: string;
  sellerName: string;
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
  priceText,
  locationText,
  createdText,
  loginHref,
  editHref,
  sellerName,
  className,
}: AdvertContactPanelProps) {
  const router = useRouter();
  const [startingChat, setStartingChat] = useState(false);

  const isOwnListing = currentUserId === seller.id;
  const sellerVerified = seller.verifiedEmail && seller.verifiedPhone;

  const startChat = async () => {
    if (!currentUserId) {
      router.push(loginHref);
      return;
    }

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

      if (response.status === 401) {
        router.push(loginHref);
        return;
      }

      const payload = (await response.json().catch(() => null)) as ChatStartResponse | null;
      const conversationId = payload?.data?.conversation_id;

      if (!response.ok || !payload?.ok || !conversationId) {
        throw new Error(payload?.detail || payload?.error || "Could not open the conversation");
      }

      router.push(`/chat/${conversationId}`);
    } catch (error) {
      if (error instanceof RateLimitedError) {
        const seconds = Math.max(1, Math.round(error.retryAfterSec ?? 60));
        toast.error(`Too many chat attempts. Try again in ${seconds}s.`);
      } else {
        const message = error instanceof Error ? error.message : "Could not open the conversation";
        toast.error(message);
      }
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <aside
      className={cn(
        "space-y-4 rounded-md border border-border/80 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase text-muted-foreground">Price</p>
        <p className="text-3xl font-semibold tracking-tight text-foreground">{priceText}</p>
      </div>

      <div className="grid gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{locationText}</span>
        </div>
        {createdText ? (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Posted {createdText}</span>
          </div>
        ) : null}
      </div>

      <div className="rounded-md border border-border/70 bg-muted/30 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-background text-primary">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{sellerName}</p>
              <p className="text-xs text-muted-foreground">
                {seller.activeAdverts} active listings
              </p>
            </div>
          </div>
          {sellerVerified ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              Checks pending
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-background px-2 py-1.5">
            <span className="text-muted-foreground">Email</span>
            <p className="font-medium text-foreground">
              {seller.verifiedEmail ? "Verified" : "Not verified"}
            </p>
          </div>
          <div className="rounded-md bg-background px-2 py-1.5">
            <span className="text-muted-foreground">Phone</span>
            <p className="font-medium text-foreground">
              {seller.verifiedPhone ? "Verified" : "Not verified"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {isOwnListing ? (
          <Button asChild className="h-10 flex-1">
            <Link href={editHref}>
              <PencilLine className="h-4 w-4" aria-hidden="true" />
              Manage listing
            </Link>
          </Button>
        ) : currentUserId ? (
          <Button
            type="button"
            onClick={startChat}
            disabled={startingChat}
            className="h-10 flex-1"
          >
            {startingChat ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            )}
            {startingChat ? "Opening chat..." : "Message seller"}
          </Button>
        ) : (
          <Button asChild className="h-10 flex-1">
            <Link href={loginHref}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Sign in to message
            </Link>
          </Button>
        )}

        <FavoriteToggle
          advert={advert}
          variant="overlay"
          className="h-10 w-10 rounded-md"
        />
      </div>

      <div className="flex justify-end">
        <ReportButton advertId={advert.id} />
      </div>

      <div className="rounded-md border border-primary/15 bg-primary/5 p-3">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Safer deal checklist</p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Keep payment and delivery discussion inside LyVoX.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Inspect the item and seller signals before sending money.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}
