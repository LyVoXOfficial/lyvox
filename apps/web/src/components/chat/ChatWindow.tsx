"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  TriangleAlert,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeMessages, type Message } from "@/hooks/useRealtimeMessages";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/i18n/format";
import { formatDate } from "@/lib/i18n/formatDate";

interface ChatWindowProps {
  conversationId: string;
  peer: { id: string; display_name: string | null } | null;
  advert: { id: string; title: string; price: number; currency: string } | null;
  initialMessages: Message[];
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
    has_more?: boolean;
    next_cursor?: number | null;
  };
  error?: string;
  detail?: string;
};

export default function ChatWindow({
  conversationId,
  peer,
  advert,
  initialMessages,
  currentUserId,
}: ChatWindowProps) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
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
  }, [conversationId, hasMore, isLoadingMore, nextCursor, translate]);

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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="min-h-[calc(100vh-9rem)] rounded-md py-0">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Button asChild variant="ghost" size="icon" aria-label={translate("chat.back", "Back to messages")}>
              <Link href="/chat">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarImage src="" />
              <AvatarFallback>{getInitials(peerName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold">{peerName}</h1>
              {advert ? (
                <p className="truncate text-sm text-muted-foreground">{advert.title}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {translate("chat.direct_conversation", "Direct conversation")}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={isConnected ? translate("chat.connected", "Live connection") : translate("chat.disconnected", "Reconnect")}
              aria-label={isConnected ? translate("chat.connected", "Live connection") : translate("chat.disconnected", "Reconnect")}
              onClick={isConnected ? undefined : reconnect}
              disabled={isConnected}
            >
              {isConnected ? (
                <Wifi className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              ) : (
                <WifiOff className="h-4 w-4 text-amber-600" aria-hidden="true" />
              )}
            </Button>
          </div>

          <div
            ref={messagesContainerRef}
            className="h-[calc(100vh-20rem)] min-h-[360px] space-y-4 overflow-y-auto px-4 py-4"
            onScroll={(event) => {
              const target = event.target as HTMLDivElement;
              if (target.scrollTop === 0 && hasMore) {
                void loadMoreMessages();
              }
            }}
          >
            {hasMore ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadMoreMessages()}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  )}
                  {translate("chat.loading_more", "Load earlier messages")}
                </Button>
              </div>
            ) : null}

            {historyError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {historyError}
              </div>
            ) : null}

            {messages.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold">
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
                const isOwn = message.author_id === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
                  >
                    {!isOwn ? (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src="" />
                        <AvatarFallback>{getInitials(peerName)}</AvatarFallback>
                      </Avatar>
                    ) : null}
                    <div className={`flex max-w-[78%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
                      <div
                        className={`rounded-md px-4 py-2 ${
                          isOwn
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">
                          {message.body}
                        </p>
                      </div>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {formatDate(message.created_at, locale, "short")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t bg-background px-4 py-3">
            {sendError ? (
              <div className="mb-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{sendError}</span>
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <Textarea
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={translate("chat.input_placeholder", "Write a message about the listing...")}
                disabled={isSending}
                maxLength={5000}
                rows={2}
                className="max-h-36 min-h-11 resize-none"
              />
              <Button
                type="button"
                onClick={() => void handleSend()}
                disabled={!inputValue.trim() || isSending}
                className="h-11"
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
              <p className="mt-2 text-xs text-amber-700">
                {translate("chat.realtime_warning", "Live updates are reconnecting. You can still send messages.")}
              </p>
            ) : null}
          </div>
        </Card>

        <aside className="space-y-4">
          {advert ? (
            <Card className="rounded-md py-0">
              <CardContent className="space-y-3 p-4">
                <Badge variant="secondary">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {translate("chat.listing_context", "Listing context")}
                </Badge>
                <div>
                  <h2 className="text-sm font-semibold leading-5">{advert.title}</h2>
                  {advertPrice ? (
                    <p className="mt-1 text-lg font-semibold">{advertPrice}</p>
                  ) : null}
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/ad/${advert.id}`}>
                    {translate("chat.view_listing", "View listing")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-md py-0">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold">
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
