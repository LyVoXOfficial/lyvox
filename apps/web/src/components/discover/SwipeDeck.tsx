"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, X, ChevronUp, ExternalLink, MessageCircle, Tag, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { useLikes } from "@/components/likes/LikesProvider";
import { useTrustGate } from "@/components/trust/TrustGateProvider";
import SwipeCard, { type SwipeHint } from "@/components/discover/SwipeCard";
import {
  type DeckCard,
  type Drop,
  mapSearchItemToDeckCard,
  rerankByTaste,
  filterUnseen,
} from "@/lib/discover/deck";
import { recordSignal } from "@/lib/taste";
import { addSeenAdverts } from "@/lib/seenAdverts";
import { resetTaste } from "@/lib/taste";
import { cn } from "@/lib/utils";

const THRESH_X = 110;
const THRESH_Y = 110;
const TAP_MOVE = 8;
const PAGE_SIZE = 24;
const LOW_WATER = 5;

type Drag = { dx: number; dy: number; active: boolean };

async function fetchDropPage(drop: Drop, page: number): Promise<DeckCard[]> {
  const params = new URLSearchParams({ ...drop.query, page: String(page), limit: String(PAGE_SIZE) });
  const res = await fetch(`/api/search?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const json = await res.json().catch(() => null);
  const items = json?.data?.items ?? json?.items ?? [];
  return (Array.isArray(items) ? items : []).map(mapSearchItemToDeckCard);
}

export default function SwipeDeck({ initial, drops }: { initial: DeckCard[]; drops: Drop[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const { addLike } = useLikes();
  const { requireTrust } = useTrustGate();

  const [activeDrop, setActiveDrop] = useState<Drop>(drops[0]);
  const [queue, setQueue] = useState<DeckCard[]>(initial);
  const [page, setPage] = useState(initial.length ? 1 : 0); // page 0 if no SSR seed
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [actCard, setActCard] = useState<DeckCard | null>(null);
  const [sending, setSending] = useState(false);

  const reducedMotion = useRef(false);
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  // Client-only: apply seen-filter + taste rerank after hydration (avoids SSR mismatch).
  useEffect(() => {
    setQueue((q) => rerankByTaste(filterUnseen(q)));
    reducedMotion.current =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top = queue[0] ?? null;

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    setError(false);
    try {
      const next = await fetchDropPage(activeDrop, page);
      const fresh = filterUnseen(next);
      if (next.length === 0) setDone(true);
      setPage((p) => p + 1);
      setQueue((q) => {
        const have = new Set(q.map((c) => c.id));
        const merged = q.concat(fresh.filter((c) => !have.has(c.id)));
        return rerankByTaste(merged);
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeDrop, page, loading, done]);

  const advance = useCallback(
    (card: DeckCard) => {
      addSeenAdverts([card.id]);
      setDrag(null);
      setQueue((q) => q.slice(1));
    },
    [],
  );

  // refill when running low
  useEffect(() => {
    if (queue.length < LOW_WATER && !loading && !done) void loadMore();
  }, [queue.length, loading, done, loadMore]);

  const doLike = useCallback(
    (card: DeckCard) => {
      recordSignal(card, "like");
      advance(card);
      requireTrust("auth", () => {
        void addLike(card.id);
      });
    },
    [advance, requireTrust, addLike],
  );

  const doPass = useCallback(
    (card: DeckCard) => {
      recordSignal(card, "pass");
      advance(card);
    },
    [advance],
  );

  const doAct = useCallback((card: DeckCard) => setActCard(card), []);
  const openListing = useCallback((card: DeckCard) => router.push(`/ad/${card.id}`), [router]);

  // ---- pointer gestures (top card) ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!top) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startPt.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    setDrag({ dx: 0, dy: 0, active: true });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startPt.current) return;
    const dx = e.clientX - startPt.current.x;
    const dy = e.clientY - startPt.current.y;
    if (Math.abs(dx) > TAP_MOVE || Math.abs(dy) > TAP_MOVE) movedRef.current = true;
    setDrag({ dx, dy, active: true });
  };
  const onPointerUp = () => {
    if (!top || !startPt.current) return;
    const d = drag ?? { dx: 0, dy: 0, active: false };
    startPt.current = null;
    if (!movedRef.current) {
      setDrag(null);
      openListing(top);
      return;
    }
    if (d.dx > THRESH_X) doLike(top);
    else if (d.dx < -THRESH_X) doPass(top);
    else if (d.dy < -THRESH_Y) doAct(top);
    else setDrag(null); // snap back
  };

  // ---- keyboard ----
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!top) return;
    if (e.key === "ArrowRight") doLike(top);
    else if (e.key === "ArrowLeft") doPass(top);
    else if (e.key === "ArrowUp") doAct(top);
    else if (e.key === "Enter") openListing(top);
  };

  const selectDrop = async (drop: Drop) => {
    if (drop.key === activeDrop.key) return;
    setActiveDrop(drop);
    setDone(false);
    setError(false);
    setPage(1);
    setLoading(true);
    try {
      const first = await fetchDropPage(drop, 0);
      setQueue(rerankByTaste(filterUnseen(first)));
      if (first.length === 0) setDone(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // ---- act sheet: chat start (+ optional offer first message) ----
  const startConversation = async (card: DeckCard, firstMessage: string | null) => {
    if (!card.sellerId) {
      openListing(card);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advert_id: card.id, peer_id: card.sellerId }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || (res.status === 403 && json?.error === "VERIFICATION_REQUIRED")) {
        setActCard(null);
        requireTrust("verified", () => void startConversation(card, firstMessage));
        return;
      }
      const conversationId = json?.data?.conversation_id;
      if (!res.ok || !conversationId) {
        toast.error(t("discover.retry"));
        return;
      }
      if (firstMessage) {
        await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: conversationId, body: firstMessage }),
        }).catch(() => null);
      }
      router.push(`/chat/${conversationId}`);
    } finally {
      setSending(false);
    }
  };

  const hint: SwipeHint = drag
    ? drag.dx > 60
      ? "like"
      : drag.dx < -60
        ? "pass"
        : drag.dy < -60
          ? "act"
          : null
    : null;

  const topStyle: React.CSSProperties = drag?.active
    ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx * 0.04}deg)`, transition: "none" }
    : { transform: "translate(0,0) rotate(0deg)", transition: reducedMotion.current ? "none" : "transform 200ms ease" };

  const isEmpty = !top && !loading;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      {/* Drops */}
      <div className="flex flex-wrap items-center gap-2">
        {drops.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => void selectDrop(d)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition",
              d.key === activeDrop.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/80 bg-card text-foreground hover:border-primary/40",
            )}
          >
            {t(`discover.drop.${d.key}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            resetTaste();
            toast.success(t("discover.reset_prefs"));
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t("discover.reset_prefs")}
        </button>
      </div>

      {/* Card stack */}
      <div
        className="relative aspect-[3/4] w-full select-none outline-none"
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="group"
        aria-label={t("discover.title")}
      >
        {isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
            <h2 className="text-lg font-semibold">{t("discover.empty_title")}</h2>
            <p className="text-sm text-muted-foreground">
              {error ? t("discover.empty_body") : t("discover.empty_body")}
            </p>
            {error ? (
              <Button onClick={() => void loadMore()} variant="outline">
                {t("discover.retry")}
              </Button>
            ) : (
              <Button onClick={() => router.push("/")} variant="outline">
                {t("discover.back_to_feed")}
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* cards behind (static, for depth) */}
            {queue.slice(1, 3).map((card, i) => (
              <div
                key={card.id}
                className="absolute inset-0"
                style={{ transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * 10}px)`, zIndex: 1 }}
              >
                <SwipeCard card={card} />
              </div>
            ))}
            {/* top card (interactive) */}
            {top ? (
              <div
                className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
                style={{ ...topStyle, zIndex: 2 }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <SwipeCard card={top} hint={hint} />
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* On-screen buttons (accessibility / desktop) */}
      <div className="flex items-center justify-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50"
          aria-label={t("discover.pass")}
          disabled={!top}
          onClick={() => top && doPass(top)}
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-sky-200 text-sky-600 hover:bg-sky-50"
          aria-label={t("discover.act")}
          disabled={!top}
          onClick={() => top && doAct(top)}
        >
          <ChevronUp className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          aria-label={t("discover.like")}
          disabled={!top}
          onClick={() => top && doLike(top)}
        >
          <ThumbsUp className="h-6 w-6" aria-hidden="true" />
        </Button>
      </div>

      {/* Actions sheet (swipe up / act button) */}
      <Sheet open={!!actCard} onOpenChange={(o) => !o && setActCard(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="truncate">{actCard?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2 pb-4">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => actCard && openListing(actCard)}
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t("discover.open_listing")}
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              disabled={sending}
              onClick={() =>
                actCard &&
                requireTrust("verified", () => {
                  setActCard(null);
                  void startConversation(actCard, null);
                })
              }
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {t("discover.message_seller")}
            </Button>
            <Button
              className="justify-start gap-2"
              disabled={sending}
              onClick={() =>
                actCard &&
                requireTrust("verified", () => {
                  const card = actCard;
                  setActCard(null);
                  void startConversation(card, t("discover.offer_template"));
                })
              }
            >
              <Tag className="h-4 w-4" aria-hidden="true" />
              {t("discover.make_offer")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
