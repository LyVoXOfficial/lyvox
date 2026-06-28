"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ThumbsUp,
  X,
  ChevronUp,
  ExternalLink,
  MessageCircle,
  Tag,
  RotateCcw,
  ChevronDown,
  HelpCircle,
  Settings,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import { useLikes } from "@/components/likes/LikesProvider";
import { useTrustGate } from "@/components/trust/TrustGateProvider";
import SwipeCard, { type SwipeHint } from "@/components/discover/SwipeCard";
import DiscoverCoachMark from "@/components/discover/DiscoverCoachMark";
import DiscoverSettings, {
  type DiscoverPrefs,
  type DiscoverMode,
  DEFAULT_PREFS,
} from "@/components/discover/DiscoverSettings";
import {
  type DeckCard,
  type Drop,
  mapSearchItemToDeckCard,
  rerankByTaste,
  filterUnseen,
} from "@/lib/discover/deck";
import { recordSignal, undoSignal, type TasteSignal } from "@/lib/taste";
import { addSeenAdverts, removeSeen } from "@/lib/seenAdverts";
import { resetTaste } from "@/lib/taste";
import { cn } from "@/lib/utils";
import { shouldAutoOffer, setSectionState } from "@/lib/discover/navHelp";
import { trackEvent, flushEvents, getDiscoverSessionId } from "@/lib/discover/discoverTrack";

const THRESH_X = 110;
const THRESH_Y = 110;
const TAP_MOVE = 8;
const PAGE_SIZE = 24;
const LOW_WATER = 5;
const VELOCITY_THRESH = 0.6; // px/ms
const UNDO_BUFFER_SIZE = 3;
// Ask reason for first N "less" swipes; after that, silent with undo snack
const ASK_REASON_COUNT_KEY = "lyvox:discover:lessCount";

type Drag = { dx: number; dy: number; active: boolean };

// Exit animation — card flies off screen; then removed from queue
type ExitState = {
  card: DeckCard;
  dx: number;
  dy: number;
} | null;

type UndoEntry = {
  card: DeckCard;
  signal: TasteSignal;
  likeWasAdded: boolean;
};

const REASONS = ["too_expensive", "wrong_category", "already_have", "hide_seller", "not_interested"] as const;
type Reason = (typeof REASONS)[number];

// localStorage prefs key (guest fallback for discover_prefs)
const PREFS_KEY = "lyvox:discover:prefs";

function readLocalPrefs(): DiscoverPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS;
}

function writeLocalPrefs(p: DiscoverPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode */
  }
}

function getLessCount(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(window.localStorage.getItem(ASK_REASON_COUNT_KEY) ?? "0", 10);
}
function incLessCount(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ASK_REASON_COUNT_KEY, String(getLessCount() + 1));
}

function hapticBump() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* not supported */
  }
}
function hapticCommit() {
  try {
    navigator.vibrate?.(30);
  } catch {
    /* not supported */
  }
}

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
  const { addLike, removeLike } = useLikes();
  const { requireTrust } = useTrustGate();

  const [prefs, setPrefs] = useState<DiscoverPrefs>(DEFAULT_PREFS);
  const [activeDrop, setActiveDrop] = useState<Drop>(drops[0]);
  const [queue, setQueue] = useState<DeckCard[]>(initial);
  const [page, setPage] = useState(initial.length ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(initial.length > 0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [actCard, setActCard] = useState<DeckCard | null>(null);
  const [sending, setSending] = useState(false);
  const [undoBuffer, setUndoBuffer] = useState<UndoEntry[]>([]);
  const [exitState, setExitState] = useState<ExitState>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [reasonCard, setReasonCard] = useState<DeckCard | null>(null);
  const [positionInSession, setPositionInSession] = useState(0);

  const reducedMotion = useRef(false);
  const startPt = useRef<{ x: number; y: number; ts: number } | null>(null);
  const movedRef = useRef(false);
  const dwellStart = useRef<number>(Date.now());
  // aria-live region — only announced on commit, not during drag
  const liveRef = useRef<HTMLDivElement>(null);

  // Hydration: apply seen-filter + taste rerank, read prefs, check coach
  useEffect(() => {
    setQueue((q) => rerankByTaste(filterUnseen(q)));
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const localPrefs = readLocalPrefs();
    setPrefs(localPrefs);
    // Show coach on first visit
    if (shouldAutoOffer("discover")) {
      setSectionState("discover", "offered");
      setShowCoach(true);
    }
    getDiscoverSessionId(); // initialise session
    trackEvent({ event_name: "discover_open", props: { drop: drops[0]?.key } });
    return () => { flushEvents(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top = queue[0] ?? null;

  // Reset photo index when top card changes
  useEffect(() => {
    setPhotoIndex(0);
    dwellStart.current = Date.now();
  }, [top?.id]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    setError(false);
    try {
      const next = await fetchDropPage(activeDrop, page);
      const fresh = filterUnseen(next);
      if (next.length < PAGE_SIZE) setDone(true);
      setPage((p) => p + 1);
      setQueue((q) => {
        const have = new Set(q.map((c) => c.id));
        const merged = q.concat(fresh.filter((c) => !have.has(c.id)));
        return rerankByTaste(merged);
      });
      setHasLoadedOnce(true);
    } catch {
      setError(true);
      setHasLoadedOnce(true);
    } finally {
      setLoading(false);
    }
  }, [activeDrop, page, loading, done]);

  // refill when running low
  useEffect(() => {
    if (queue.length < LOW_WATER && !loading && !done) void loadMore();
  }, [queue.length, loading, done, loadMore]);

  // Track empty state
  useEffect(() => {
    if (hasLoadedOnce && !loading && queue.length === 0) {
      trackEvent({ event_name: "discover_empty", props: { drop: activeDrop.key, reason: error ? "error" : "end" } });
    }
  }, [hasLoadedOnce, loading, queue.length, activeDrop.key, error]);

  /** Fly card off-screen then remove from queue. */
  const commit = useCallback(
    (card: DeckCard, dx: number, dy: number) => {
      setDrag(null);
      if (reducedMotion.current) {
        addSeenAdverts([card.id]);
        setQueue((q) => q.slice(1));
        setPositionInSession((n) => n + 1);
      } else {
        // Start fly-out animation; onTransitionEnd removes from queue
        setExitState({ card, dx, dy });
      }
      // Update aria-live (only on commit, not drag)
      if (liveRef.current && queue[1]) {
        liveRef.current.textContent = `${queue[1].title}, ${queue[1].price ?? ""}`;
      }
    },
    [queue],
  );

  const handleExitEnd = useCallback(() => {
    if (!exitState) return;
    addSeenAdverts([exitState.card.id]);
    setQueue((q) => q.slice(1));
    setExitState(null);
    setPositionInSession((n) => n + 1);
  }, [exitState]);

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoBuffer((buf) => [entry, ...buf].slice(0, UNDO_BUFFER_SIZE));
  }, []);

  const doLike = useCallback(
    (card: DeckCard, via: "gesture" | "button" | "key") => {
      recordSignal(card, "like");
      if (prefs.haptics && !reducedMotion.current) hapticCommit();
      commit(card, THRESH_X * 1.5, 0);
      const dwell = Date.now() - dwellStart.current;
      trackEvent({
        event_name: "discover_swipe",
        props: { direction: "like", advert_id: card.id, category_id: card.categoryId, seller_verified: card.sellerVerified, position_in_session: positionInSession, via, dwell_ms: dwell },
      });
      requireTrust("auth", () => {
        void addLike(card.id);
        pushUndo({ card, signal: "like", likeWasAdded: true });
      });
      // If trust gate fails (no callback), still push undo without like rollback
      pushUndo({ card, signal: "like", likeWasAdded: false });
    },
    [commit, prefs.haptics, positionInSession, requireTrust, addLike, pushUndo],
  );

  const doPass = useCallback(
    (card: DeckCard, via: "gesture" | "button" | "key") => {
      recordSignal(card, "pass");
      if (prefs.haptics && !reducedMotion.current) hapticCommit();
      commit(card, -THRESH_X * 1.5, 0);
      const dwell = Date.now() - dwellStart.current;
      trackEvent({
        event_name: "discover_swipe",
        props: { direction: "pass", advert_id: card.id, category_id: card.categoryId, seller_verified: card.sellerVerified, position_in_session: positionInSession, via, dwell_ms: dwell },
      });
      pushUndo({ card, signal: "pass", likeWasAdded: false });
    },
    [commit, prefs.haptics, positionInSession, pushUndo],
  );

  const doAct = useCallback((card: DeckCard) => setActCard(card), []);
  const openListing = useCallback((card: DeckCard) => {
    trackEvent({ event_name: "discover_action_open", props: { advert_id: card.id } });
    router.push(`/ad/${card.id}`);
  }, [router]);

  const doDown = useCallback(
    (card: DeckCard, via: "gesture" | "button" | "key") => {
      recordSignal(card, "down");
      if (prefs.haptics && !reducedMotion.current) hapticCommit();
      commit(card, 0, THRESH_Y * 1.5);
      const dwell = Date.now() - dwellStart.current;
      trackEvent({
        event_name: "discover_swipe",
        props: { direction: "down", advert_id: card.id, category_id: card.categoryId, seller_verified: card.sellerVerified, position_in_session: positionInSession, via, dwell_ms: dwell },
      });
      pushUndo({ card, signal: "down", likeWasAdded: false });
      const lessCount = getLessCount();
      incLessCount();
      if (prefs.ask_reason_down && lessCount < 5) {
        // Show non-blocking reason snack inline
        setReasonCard(card);
      } else {
        // Silent — show undo snack
        toast(
          <div className="flex items-center gap-3">
            <span className="text-sm">{t("discover.less_like_this")}</span>
            <button
              type="button"
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => handleUndoLatest()}
            >
              {t("discover.undo")}
            </button>
          </div>,
          { duration: 3000 },
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, prefs.haptics, prefs.ask_reason_down, positionInSession, pushUndo, t],
  );

  const handleUndoLatest = useCallback(() => {
    if (!undoBuffer.length) return;
    const [entry, ...rest] = undoBuffer;
    setUndoBuffer(rest);
    undoSignal(entry.card, entry.signal);
    removeSeen(entry.card.id);
    if (entry.likeWasAdded) void removeLike(entry.card.id);
    setQueue((q) => [entry.card, ...q]);
    trackEvent({ event_name: "discover_undo", props: { undone_direction: entry.signal, advert_id: entry.card.id } });
  }, [undoBuffer, removeLike]);

  const handleReasonSelect = useCallback(
    (reason: Reason) => {
      if (reason === "hide_seller" && reasonCard?.sellerId) {
        // Mute seller locally via taste signal
        recordSignal(reasonCard, "down"); // extra -2 to suppress
      }
      setReasonCard(null);
    },
    [reasonCard],
  );

  // ---- pointer gestures (top card) ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!top || exitState) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startPt.current = { x: e.clientX, y: e.clientY, ts: Date.now() };
    movedRef.current = false;
    setDrag({ dx: 0, dy: 0, active: true });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startPt.current) return;
    const dx = e.clientX - startPt.current.x;
    const dy = e.clientY - startPt.current.y;
    if (Math.abs(dx) > TAP_MOVE || Math.abs(dy) > TAP_MOVE) movedRef.current = true;
    setDrag({ dx, dy, active: true });
    // Haptics at threshold cross
    if (prefs.haptics && !reducedMotion.current) {
      const wasAtThreshold = drag && (Math.abs(drag.dx) >= THRESH_X || Math.abs(drag.dy) >= THRESH_Y);
      const nowAtThreshold = Math.abs(dx) >= THRESH_X || Math.abs(dy) >= THRESH_Y;
      if (!wasAtThreshold && nowAtThreshold) hapticBump();
    }
  };

  const onPointerUp = () => {
    if (!top || !startPt.current) return;
    const d = drag ?? { dx: 0, dy: 0, active: false };
    const dt = Date.now() - startPt.current.ts;
    const vx = dt > 0 ? Math.abs(d.dx) / dt : 0;
    const vy = dt > 0 ? Math.abs(d.dy) / dt : 0;
    startPt.current = null;

    if (!movedRef.current) {
      setDrag(null);
      openListing(top);
      return;
    }

    const commitX = Math.abs(d.dx) >= THRESH_X || (vx > VELOCITY_THRESH && Math.abs(d.dx) > 40);
    const commitY = Math.abs(d.dy) >= THRESH_Y || (vy > VELOCITY_THRESH && Math.abs(d.dy) > 40);

    if (commitX && d.dx > 0 && prefs.mode !== "simple" || (commitX && d.dx > 0)) {
      doLike(top, "gesture");
    } else if (commitX && d.dx < 0) {
      doPass(top, "gesture");
    } else if (commitY && d.dy < 0 && prefs.mode === "standard") {
      doAct(top);
      setDrag(null);
    } else if (commitY && d.dy > 0 && prefs.mode === "standard") {
      doDown(top, "gesture");
    } else {
      setDrag(null); // snap back
    }
  };

  // ---- keyboard ----
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!top) return;
    if (e.key === "ArrowRight") { e.preventDefault(); doLike(top, "key"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); doPass(top, "key"); }
    else if (e.key === "ArrowUp" && prefs.mode === "standard") { e.preventDefault(); doAct(top); }
    else if (e.key === "ArrowDown" && prefs.mode === "standard") { e.preventDefault(); doDown(top, "key"); }
    else if (e.key === "Enter") { e.preventDefault(); openListing(top); }
    else if ((e.key === "u" || e.key === "U") && undoBuffer.length) { e.preventDefault(); handleUndoLatest(); }
  };

  const selectDrop = async (drop: Drop) => {
    if (drop.key === activeDrop.key) return;
    trackEvent({ event_name: "discover_drop_change", props: { from: activeDrop.key, to: drop.key } });
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
      setHasLoadedOnce(true);
    }
  };

  // ---- act sheet: chat start ----
  const startConversation = async (card: DeckCard, firstMessage: string | null) => {
    if (!card.sellerId) { openListing(card); return; }
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
      trackEvent({ event_name: "discover_action_message", props: { advert_id: card.id, with_offer: Boolean(firstMessage) } });
      recordSignal(card, "contact");
      router.push(`/chat/${conversationId}`);
    } finally {
      setSending(false);
    }
  };

  // ---- hint strength (0–1) proportional to drag distance / threshold ----
  const hintRaw: SwipeHint = drag
    ? drag.dx > 30 ? "like"
      : drag.dx < -30 ? "pass"
        : drag.dy < -30 && prefs.mode === "standard" ? "act"
          : drag.dy > 30 && prefs.mode === "standard" ? "down"
            : null
    : null;
  const hintStrength = drag && hintRaw
    ? Math.min(
        (Math.max(Math.abs(drag.dx), Math.abs(drag.dy)) - 30) / (THRESH_X - 30),
        1.5,
      )
    : 0;

  // Exit direction multipliers for fly-out animation
  const exitStyle = (card: DeckCard): React.CSSProperties => {
    if (!exitState || exitState.card.id !== card.id) return {};
    const mult = reducedMotion.current ? 0 : 1;
    return {
      transform: `translate(${exitState.dx * mult * 3}px, ${exitState.dy * mult * 3}px) rotate(${exitState.dx * 0.04}deg)`,
      transition: reducedMotion.current ? "opacity 150ms ease" : "transform 280ms cubic-bezier(0.25,0.46,0.45,0.94)",
      opacity: reducedMotion.current ? 0 : 1,
    };
  };

  const topStyle: React.CSSProperties = drag?.active
    ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx * 0.04}deg)`, transition: "none" }
    : { transform: "translate(0,0) rotate(0deg)", transition: reducedMotion.current ? "none" : "transform 200ms ease" };

  // Skeleton while loading before first data arrives
  const showSkeleton = !hasLoadedOnce && loading;
  const isEmpty = hasLoadedOnce && !top && !loading && !exitState;

  const handleSavePrefs = (p: DiscoverPrefs) => {
    setPrefs(p);
    writeLocalPrefs(p);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      {/* Drops + controls row */}
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
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label={t("discover.coach.title")}
            onClick={() => setShowCoach(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t("discover.settings.title")}
            onClick={() => setShowSettings(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              resetTaste();
              toast.success(t("discover.reset_prefs"));
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("discover.reset_prefs")}
          </button>
        </div>
      </div>

      {/* Card stack */}
      <div
        className="relative aspect-[3/4] w-full select-none outline-none touch-none overscroll-none"
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="group"
        aria-label={t("discover.title")}
      >
        {/* aria-live region — announced on commit, not during drag */}
        <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

        {showSkeleton ? (
          <div className="absolute inset-0 animate-pulse rounded-2xl bg-muted" />
        ) : isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
            <h2 className="text-lg font-semibold">
              {error ? t("discover.error_title") : t("discover.empty_title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {error ? t("discover.error_body") : t("discover.empty_body")}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {error ? (
                <Button onClick={() => void loadMore()} variant="outline">
                  {t("discover.retry")}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      window.localStorage.removeItem("lyvox:seenAdverts");
                      setQueue([]);
                      setDone(false);
                      setPage(0);
                      void loadMore();
                    }}
                    variant="outline"
                  >
                    {t("discover.empty_cta_reset")}
                  </Button>
                  <Button onClick={() => router.push("/")} variant="ghost">
                    {t("discover.back_to_feed")}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Background cards (depth illusion) */}
            {queue.slice(1, 3).map((card, i) => (
              <div
                key={card.id}
                className="absolute inset-0"
                style={{ transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * 10}px)`, zIndex: 1 }}
              >
                <SwipeCard card={card} />
              </div>
            ))}

            {/* Top card — interactive */}
            {top && !exitState ? (
              <div
                className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
                style={{ ...topStyle, zIndex: 2 }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <SwipeCard
                  card={top}
                  hint={hintRaw}
                  hintStrength={hintStrength}
                  photoIndex={photoIndex}
                  onPhotoChange={(idx) => {
                    setPhotoIndex(idx);
                    trackEvent({ event_name: "discover_photo_paged", props: { advert_id: top.id, photo_index: idx } });
                  }}
                />
                {/* Coach-mark overlay (one-time) */}
                {showCoach ? <DiscoverCoachMark onDismiss={() => setShowCoach(false)} /> : null}
              </div>
            ) : null}

            {/* Exiting card (fly-out animation) */}
            {exitState ? (
              <div
                key={`exit-${exitState.card.id}`}
                className="absolute inset-0 touch-none pointer-events-none"
                style={{ ...exitStyle(exitState.card), zIndex: 3 }}
                onTransitionEnd={handleExitEnd}
              >
                <SwipeCard card={exitState.card} />
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Reason chip sheet for swipe-down (non-blocking snack as sheet) */}
      {reasonCard ? (
        <div className="rounded-xl border border-border bg-card p-3 text-sm">
          <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {t("discover.less_like_this")}
          </p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleReasonSelect(r)}
                className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted focus:outline focus:outline-2 focus:outline-ring"
              >
                {t(`discover.reason.${r}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* On-screen buttons */}
      {prefs.mode !== "buttons" ? (
        <div className="flex items-center justify-center gap-3">
          {/* Pass */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50"
            aria-label={t("discover.pass")}
            disabled={!top}
            onClick={() => top && doPass(top, "button")}
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </Button>
          {/* Less like this (only in standard mode) */}
          {prefs.mode === "standard" ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-purple-200 text-purple-600 hover:bg-purple-50"
              aria-label={t("discover.less_like_this")}
              disabled={!top}
              onClick={() => top && doDown(top, "button")}
            >
              <ChevronDown className="h-5 w-5" aria-hidden="true" />
            </Button>
          ) : null}
          {/* Actions */}
          {prefs.mode === "standard" ? (
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
          ) : null}
          {/* Undo — always visible, disabled when buffer empty */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-30"
            aria-label={t("discover.undo")}
            disabled={undoBuffer.length === 0}
            onClick={handleUndoLatest}
          >
            <Undo2 className="h-5 w-5" aria-hidden="true" />
          </Button>
          {/* Like */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full border-emerald-200 text-emerald-600 hover:bg-emerald-50"
            aria-label={t("discover.like")}
            disabled={!top}
            onClick={() => top && doLike(top, "button")}
          >
            <ThumbsUp className="h-6 w-6" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        /* Buttons-only mode — full button grid */
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="border-rose-200 text-rose-600 hover:bg-rose-50"
            disabled={!top}
            onClick={() => top && doPass(top, "button")}
          >
            <X className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("discover.pass")}
          </Button>
          <Button
            variant="outline"
            className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
            disabled={!top}
            onClick={() => top && doLike(top, "button")}
          >
            <ThumbsUp className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("discover.like")}
          </Button>
          <Button
            variant="outline"
            className="border-sky-200 text-sky-600 hover:bg-sky-50"
            disabled={!top}
            onClick={() => top && doAct(top)}
          >
            <ChevronUp className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("discover.act")}
          </Button>
          <Button
            variant="outline"
            className="border-purple-200 text-purple-600 hover:bg-purple-50"
            disabled={!top}
            onClick={() => top && doDown(top, "button")}
          >
            <ChevronDown className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("discover.less_like_this")}
          </Button>
          <Button
            variant="outline"
            className="col-span-2 border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-30"
            disabled={undoBuffer.length === 0}
            onClick={handleUndoLatest}
          >
            <Undo2 className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("discover.undo")}
          </Button>
          <Button
            variant="outline"
            className="col-span-2"
            disabled={!top}
            onClick={() => top && openListing(top)}
          >
            <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
            {t("discover.open_listing")}
          </Button>
        </div>
      )}

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
            {/* Trust anchor */}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {t("discover.trust_anchor")}
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Discover Settings sheet */}
      <DiscoverSettings
        open={showSettings}
        prefs={prefs}
        onClose={() => setShowSettings(false)}
        onSave={handleSavePrefs}
      />
    </div>
  );
}
