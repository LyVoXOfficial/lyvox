"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeEuro,
  Check,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeMessages, type ChatOffer, type Message } from "@/hooks/useRealtimeMessages";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/i18n/format";
import { getChatOfferIdFromMessage } from "@/lib/chat/offers";
import { formatDate } from "@/lib/i18n/formatDate";

interface ChatWindowProps {
  conversationId: string;
  peer: { id: string; display_name: string | null } | null;
  advert: { id: string; user_id: string; title: string; price: number; currency: string } | null;
  initialMessages: Message[];
  initialOffers: ChatOffer[];
  currentUserId: string;
  messages: Record<string, any>;
}

type SendMessageResponse = {
  ok?: boolean;
  data?: {
    message?: Message;
  };
  error?: string;
  detail?: string;
};

type HistoryResponse = {
  ok?: boolean;
  data?: {
    messages?: Message[];
    offers?: ChatOffer[];
    has_more?: boolean;
    next_cursor?: number | null;
  };
  error?: string;
  detail?: string;
};

type OfferResponse = {
  ok?: boolean;
  data?: {
    offer?: ChatOffer;
    message?: Message | null;
    autoDeclined?: boolean;
  };
  error?: string;
  detail?: string;
};

export default function ChatWindow({
  conversationId,
  peer,
  advert,
  initialMessages,
  initialOffers,
  currentUserId,
}: ChatWindowProps) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [offersById, setOffersById] = useState<Map<string, ChatOffer>>(
    () => new Map(initialOffers.map((offer) => [offer.id, offer])),
  );
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const [isSendingOffer, setIsSendingOffer] = useState(false);
  const [offerActionId, setOfferActionId] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerNotice, setOfferNotice] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [nextCursor, setNextCursor] = useState<number | null>(
    initialMessages.length > 0 ? initialMessages[0].id : null,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const translate = useCallback((key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  }, [t]);

  const peerName = peer?.display_name || translate("chat.unknown_user", "LyVoX user");
  const advertPrice = advert
    ? formatCurrency(advert.price, locale, advert.currency || "EUR")
    : null;
  const canMakeOffer = Boolean(advert && advert.user_id !== currentUserId);

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      if (prev.some((existing) => existing.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
  }, []);

  const appendOffer = useCallback((offer: ChatOffer) => {
    setOffersById((prev) => {
      const next = new Map(prev);
      next.set(offer.id, offer);
      return next;
    });
  }, []);

  const appendOffers = useCallback((offers: ChatOffer[]) => {
    if (offers.length === 0) return;
    setOffersById((prev) => {
      const next = new Map(prev);
      for (const offer of offers) {
        next.set(offer.id, offer);
      }
      return next;
    });
  }, []);

  const markAsRead = useCallback(async () => {
    try {
      await fetch("/api/chat/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
    } catch {
      // Read receipts should never interrupt the conversation.
    }
  }, [conversationId]);

  const { isConnected, error: realtimeError, reconnect } = useRealtimeMessages({
    conversationId,
    onMessage: (message) => {
      appendMessage(message);
      void markAsRead();
    },
    onOffer: appendOffer,
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    void markAsRead();
  }, [markAsRead]);

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return;

    setIsLoadingMore(true);
    setHistoryError(null);

    try {
      const response = await fetch(
        `/api/chat/history?conversationId=${conversationId}&cursor=${nextCursor}&limit=50`,
      );
      const payload = (await response.json().catch(() => null)) as HistoryResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.detail ||
            payload?.error ||
            translate("chat.history_error", "Could not load earlier messages."),
        );
      }

      const olderMessages = payload.data?.messages ?? [];
      appendOffers(payload.data?.offers ?? []);
      setMessages((prev) => [...olderMessages, ...prev]);
      setHasMore(Boolean(payload.data?.has_more));
      setNextCursor(payload.data?.next_cursor ?? null);
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : translate("chat.history_error", "Could not load earlier messages."),
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [appendOffers, conversationId, hasMore, isLoadingMore, nextCursor, translate]);

  const handleSend = useCallback(async () => {
    const body = inputValue.trim();
    if (!body || isSending) return;

    setIsSending(true);
    setSendError(null);
    setInputValue("");

    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          body,
        }),
      });

      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;

      if (!response.ok || !payload?.ok || !payload.data?.message) {
        throw new Error(
          payload?.detail ||
            payload?.error ||
            translate("chat.send_error", "Could not send the message."),
        );
      }

      appendMessage(payload.data.message);
    } catch (error) {
      setInputValue(body);
      setSendError(
        error instanceof Error
          ? error.message
          : translate("chat.send_error", "Could not send the message."),
      );
    } finally {
      setIsSending(false);
    }
  }, [appendMessage, conversationId, inputValue, isSending, translate]);

  const parseOfferAmountCents = useCallback(() => {
    const normalized = offerAmount.trim().replace(",", ".");
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const cents = Math.round(amount * 100);
    if (cents <= 0 || cents >= 100000000) return null;
    return cents;
  }, [offerAmount]);

  const handleOfferSubmit = useCallback(async () => {
    if (!advert || !canMakeOffer || isSendingOffer) return;

    const amountCents = parseOfferAmountCents();
    if (!amountCents) {
      setOfferError(translate("chat.offer_invalid_amount", "Enter a valid amount."));
      return;
    }

    setIsSendingOffer(true);
    setOfferError(null);
    setOfferNotice(null);

    try {
      const response = await fetch("/api/chat/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advert_id: advert.id,
          conversation_id: conversationId,
          amount_cents: amountCents,
          currency: "EUR",
        }),
      });

      const payload = (await response.json().catch(() => null)) as OfferResponse | null;

      if (!response.ok || !payload?.ok || !payload.data?.offer) {
        throw new Error(
          payload?.detail ||
            payload?.error ||
            translate("chat.offer_send_error", "Could not send the price offer."),
        );
      }

      appendOffer(payload.data.offer);
      if (payload.data.message) {
        appendMessage(payload.data.message);
      }

      setOfferAmount("");
      setIsOfferOpen(false);
      setOfferNotice(
        payload.data.autoDeclined
          ? translate("chat.offer_auto_declined", "This price offer is below the seller's threshold.")
          : translate("chat.offer_sent_notice", "Price offer sent."),
      );
    } catch (error) {
      setOfferError(
        error instanceof Error
          ? error.message
          : translate("chat.offer_send_error", "Could not send the price offer."),
      );
    } finally {
      setIsSendingOffer(false);
    }
  }, [
    advert,
    appendMessage,
    appendOffer,
    canMakeOffer,
    conversationId,
    isSendingOffer,
    parseOfferAmountCents,
    translate,
  ]);

  const handleOfferResponse = useCallback(async (offerId: string, status: "declined" | "accepted_in_chat") => {
    if (offerActionId) return;

    setOfferActionId(offerId);
    setOfferError(null);
    setOfferNotice(null);

    try {
      const response = await fetch("/api/chat/offer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offerId, status }),
      });

      const payload = (await response.json().catch(() => null)) as OfferResponse | null;

      if (!response.ok || !payload?.ok || !payload.data?.offer) {
        throw new Error(
          payload?.detail ||
            payload?.error ||
            translate("chat.offer_update_error", "Could not update the price offer."),
        );
      }

      appendOffer(payload.data.offer);
    } catch (error) {
      setOfferError(
        error instanceof Error
          ? error.message
          : translate("chat.offer_update_error", "Could not update the price offer."),
      );
    } finally {
      setOfferActionId(null);
    }
  }, [appendOffer, offerActionId, translate]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-0 sm:px-4 sm:py-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ── Thread column ────────────────────────────────────────────── */}
        <Card className="flex min-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-none border-x-0 border-border/70 py-0 shadow-[var(--shadow-soft)] sm:min-h-[calc(100vh-9rem)] sm:rounded-[var(--r)] sm:border-x">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              aria-label={translate("chat.back", "Back to messages")}
            >
              <Link href="/chat">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>

            {/* Peer avatar — trust-gradient tile */}
            <div
              className="lyvox-trust-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--rm)] text-sm font-bold text-white"
              aria-hidden="true"
            >
              {getInitials(peerName)}
            </div>

            {/* Peer name only — no badge, no shield, no response-time */}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-extrabold tracking-tight">{peerName}</h1>
            </div>

            {/* Connection indicator — keep all wiring, restyle only */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              title={
                isConnected
                  ? translate("chat.connected", "Live connection")
                  : translate("chat.disconnected", "Reconnect")
              }
              aria-label={
                isConnected
                  ? translate("chat.connected", "Live connection")
                  : translate("chat.disconnected", "Reconnect")
              }
              onClick={isConnected ? undefined : reconnect}
              disabled={isConnected}
            >
              {isConnected ? (
                <Wifi className="h-4 w-4 text-primary" aria-hidden="true" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </Button>
          </div>

          {/* Message list */}
          <div
            ref={messagesContainerRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            onScroll={(event) => {
              const target = event.target as HTMLDivElement;
              if (target.scrollTop === 0 && hasMore) {
                void loadMoreMessages();
              }
            }}
          >
            {/* Load-more button */}
            {hasMore ? (
              <div className="flex justify-center py-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  onClick={() => void loadMoreMessages()}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {translate("chat.loading_more", "Load earlier messages")}
                </Button>
              </div>
            ) : null}

            {/* History error */}
            {historyError ? (
              <div className="flex items-start gap-2 rounded-[var(--rs)] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{historyError}</span>
              </div>
            ) : null}

            {/* Listing reference card — inline at thread top */}
            {advert ? (
              <div className="rounded-[var(--rm)] border border-border/60 bg-secondary/40 p-3">
                <div className="flex items-center gap-3">
                  {/* Small gradient image placeholder */}
                  <div className="lyvox-image-placeholder h-12 w-12 shrink-0 rounded-[var(--rs)]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{advert.title}</p>
                    {advertPrice ? (
                      <p className="mt-0.5 text-sm font-extrabold text-primary">{advertPrice}</p>
                    ) : null}
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full text-xs"
                  >
                    <Link href={`/ad/${advert.id}`}>
                      {translate("chat.view_listing", "View listing")}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Safety check pill — generic conversation property, NOT a per-peer claim */}
            <div className="flex justify-center py-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground shadow-[var(--shS)]">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {translate("chat.safety_check_pill", "Safety check passed · chat opened securely")}
              </span>
            </div>

            {/* Empty state */}
            {messages.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--rm)] lyvox-trust-gradient text-white">
                  <MessageSquare className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-extrabold tracking-tight">
                  {translate("chat.no_messages_title", "Start the conversation")}
                </h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {translate(
                    "chat.no_messages_body",
                    "Ask a specific question about condition, pickup, documents, or payment before arranging a deal.",
                  )}
                </p>
              </div>
            ) : (
              messages.map((message) => {
                // isOwn is false for null author_id (GDPR tombstone safety)
                const isOwn = message.author_id === currentUserId;
                const offerId = getChatOfferIdFromMessage(message.body);
                const offer = offerId ? offersById.get(offerId) : null;
                const offerAmountLabel = offer
                  ? formatCurrency(offer.amount_cents / 100, locale, offer.currency || "EUR")
                  : null;
                const offerStatusLabel = offer
                  ? translate(`chat.offer_status_${offer.status}`, offer.status)
                  : translate("chat.offer_status_loading", "Price offer");
                const canRespondToOffer =
                  Boolean(offer && offer.status === "sent" && offer.sender_id !== currentUserId);

                return (
                  <div
                    key={message.id}
                    className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}
                  >
                    {/* Incoming avatar */}
                    {!isOwn ? (
                      <div
                        className="lyvox-trust-gradient mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--rs)] text-xs font-bold text-white"
                        aria-hidden="true"
                      >
                        {getInitials(peerName)}
                      </div>
                    ) : null}

                    <div className={`flex max-w-[78%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                      {offerId ? (
                        <div
                          className={[
                            "w-64 max-w-full rounded-[var(--rm)] border p-3 shadow-[var(--shS)]",
                            isOwn
                              ? "border-primary/25 bg-primary/10"
                              : "border-border/70 bg-card",
                          ].join(" ")}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--rs)] bg-primary/10 text-primary"
                              aria-hidden="true"
                            >
                              <BadgeEuro className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                {translate("chat.offer_card_title", "Price offer")}
                              </p>
                              <p className="mt-0.5 text-lg font-extrabold tracking-tight">
                                {offerAmountLabel ?? translate("chat.offer_status_loading", "Price offer")}
                              </p>
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                {offerStatusLabel}
                              </p>
                              {offer?.message ? (
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5">
                                  {offer.message}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {canRespondToOffer && offer ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-full text-xs"
                                onClick={() => void handleOfferResponse(offer.id, "declined")}
                                disabled={offerActionId === offer.id}
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                {translate("chat.offer_decline", "Decline")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 rounded-full lyvox-cta-gradient border-0 text-xs text-white hover:opacity-90"
                                onClick={() => void handleOfferResponse(offer.id, "accepted_in_chat")}
                                disabled={offerActionId === offer.id}
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                {translate("chat.offer_accept", "Accept in chat")}
                              </Button>
                            </div>
                          ) : null}

                          {offer?.status === "accepted_in_chat" ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {translate("chat.offer_chat_only", "Recorded in chat only.")}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div
                          className={[
                            "px-4 py-2.5 shadow-[var(--shS)]",
                            isOwn
                              ? "lyvox-cta-gradient rounded-2xl rounded-br-sm text-white"
                              : "rounded-2xl rounded-bl-sm border border-border/70 bg-card text-foreground",
                          ].join(" ")}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">
                            {message.body}
                          </p>
                        </div>
                      )}
                      {/* Timestamp */}
                      <span className="mt-1 px-1 text-xs text-muted-foreground">
                        {formatDate(message.created_at, locale, "short")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer — preserve mobile clearance exactly */}
          <div className="sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-10 border-t border-border/70 bg-card/95 px-4 py-3 backdrop-blur md:bottom-0">
            {canMakeOffer ? (
              <div className="mb-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={isOfferOpen ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 rounded-full text-xs"
                    onClick={() => {
                      setIsOfferOpen((value) => !value);
                      setOfferError(null);
                      setOfferNotice(null);
                    }}
                  >
                    <BadgeEuro className="h-3.5 w-3.5" aria-hidden="true" />
                    {translate("chat.offer_button", "Offer price")}
                  </Button>
                  {offerNotice ? (
                    <span className="text-xs font-medium text-muted-foreground">{offerNotice}</span>
                  ) : null}
                </div>

                {isOfferOpen ? (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleOfferSubmit();
                    }}
                  >
                    <Input
                      value={offerAmount}
                      onChange={(event) => setOfferAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder={translate("chat.offer_amount_placeholder", "Amount in EUR")}
                      disabled={isSendingOffer}
                      className="h-9 w-40 rounded-full text-sm"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-9 rounded-full lyvox-cta-gradient border-0 text-white hover:opacity-90"
                      disabled={isSendingOffer || !offerAmount.trim()}
                    >
                      {isSendingOffer ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {translate("chat.offer_send", "Send offer")}
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}

            {offerError ? (
              <div className="mb-2 flex items-start gap-2 rounded-[var(--rs)] border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{offerError}</span>
              </div>
            ) : null}

            {sendError ? (
              <div className="mb-2 flex items-start gap-2 rounded-[var(--rs)] border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{sendError}</span>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              {/* "+" affordance — decorative, non-interactive per brief */}
              <div
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 text-muted-foreground"
                aria-hidden="true"
              >
                <Plus className="h-4 w-4" />
              </div>

              <Textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={translate("chat.input_placeholder", "Write a message about the listing...")}
                disabled={isSending}
                maxLength={5000}
                rows={1}
                className="max-h-36 min-h-11 resize-none rounded-2xl px-4 py-2.5 focus-visible:ring-4 focus-visible:ring-primary/12"
              />

              {/* Circular gradient send button */}
              <Button
                type="button"
                size="icon"
                onClick={() => void handleSend()}
                disabled={!inputValue.trim() || isSending}
                className="h-11 w-11 shrink-0 rounded-full lyvox-cta-gradient border-0 text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="sr-only">{translate("chat.send", "Send")}</span>
              </Button>
            </div>

            {realtimeError ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {translate("chat.realtime_warning", "Live updates are reconnecting. You can still send messages.")}
              </p>
            ) : null}
          </div>
        </Card>

        {/* ── Right aside ────────────────────────────────────────────── */}
        <aside className="space-y-4 px-4 sm:px-0">
          {/* Listing context card — desktop aside; listing also shown inline above */}
          {advert ? (
            <Card className="rounded-[var(--r)] border-border/60 py-0 shadow-[var(--shC)]">
              <CardContent className="space-y-3 p-4">
                <div className="lyvox-image-placeholder h-28 w-full rounded-[var(--rm)]" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-extrabold tracking-tight leading-5">{advert.title}</h2>
                  {advertPrice ? (
                    <p className="mt-1 text-lg font-extrabold tracking-tight text-primary">{advertPrice}</p>
                  ) : null}
                </div>
                <Button asChild variant="outline" className="w-full rounded-full">
                  <Link href={`/ad/${advert.id}`}>
                    {translate("chat.view_listing", "View listing")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Safety-guidance card — MUST be kept (founder #1 priority) */}
          <Card className="rounded-[var(--r)] border-border/60 py-0 shadow-[var(--shC)]">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-extrabold tracking-tight">
                    {translate("chat.safety.title", "Deal safely")}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {translate(
                      "chat.safety.body",
                      "Keep payment links, delivery changes, and identity questions in this chat so support can review the timeline if needed.",
                    )}
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>{translate("chat.safety.tip_one", "Avoid external payment links and rushed deposits.")}</li>
                <li>{translate("chat.safety.tip_two", "Inspect high-value items before sending money.")}</li>
                <li>{translate("chat.safety.tip_three", "Report suspicious requests from the listing page or support.")}</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
