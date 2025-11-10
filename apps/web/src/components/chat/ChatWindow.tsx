"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRealtimeMessages, type Message } from "@/hooks/useRealtimeMessages";
import { useI18n } from "@/i18n";
import { formatDate } from "@/i18n/format";
import { ArrowLeft, Send, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";

interface ChatWindowProps {
  conversationId: string;
  peer: { id: string; display_name: string | null } | null;
  advert: { id: string; title: string; price: number; currency: string } | null;
  initialMessages: Message[];
  currentUserId: string;
  messages: Record<string, any>;
}

export default function ChatWindow({
  conversationId,
  peer,
  advert,
  initialMessages,
  currentUserId,
}: ChatWindowProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [nextCursor, setNextCursor] = useState<number | null>(
    initialMessages.length > 0 ? initialMessages[0].id : null,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { isConnected, error: realtimeError, reconnect } = useRealtimeMessages({
    conversationId,
    onMessage: (message) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      // Mark as read when receiving a new message
      markAsRead();
    },
    onError: (error) => {
      console.error("Realtime error:", error);
    },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const markAsRead = useCallback(async () => {
    try {
      await fetch("/api/chat/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }, [conversationId]);

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return;

    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/chat/history?conversationId=${conversationId}&cursor=${nextCursor}&limit=50`,
      );
      const data = await response.json();

      if (data.ok && data.data.messages) {
        setMessages((prev) => [...data.data.messages, ...prev]);
        setHasMore(data.data.has_more);
        setNextCursor(data.data.next_cursor);
      }
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, nextCursor, hasMore, isLoadingMore]);

  const handleSend = useCallback(async () => {
    const body = inputValue.trim();
    if (!body || isSending) return;

    setIsSending(true);
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

      const data = await response.json();

      if (!data.ok) {
        console.error("Failed to send message:", data.error);
        setInputValue(body); // Restore input on error
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setInputValue(body); // Restore input on error
    } finally {
      setIsSending(false);
    }
  }, [conversationId, inputValue, isSending]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const peerName = peer?.display_name || t("chat.unknown_user");
  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3 flex items-center gap-4">
        <Link href="/chat">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <Avatar className="h-10 w-10">
          <AvatarImage src="" />
          <AvatarFallback>{getInitials(peerName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{peerName}</h2>
          {advert && (
            <p className="text-sm text-muted-foreground truncate">{advert.title}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" title={t("chat.connected")} />
          ) : (
            <WifiOff
              className="h-4 w-4 text-muted-foreground"
              title={t("chat.disconnected")}
              onClick={reconnect}
            />
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          if (target.scrollTop === 0 && hasMore) {
            loadMoreMessages();
          }
        }}
      >
        {isLoadingMore && (
          <div className="text-center text-sm text-muted-foreground py-2">
            {t("chat.loading_more")}...
          </div>
        )}
        {messages.map((message) => {
          const isOwn = message.author_id === currentUserId;
          return (
            <div
              key={message.id}
              className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
            >
              {!isOwn && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback>{getInitials(peerName)}</AvatarFallback>
                </Avatar>
              )}
              <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[70%]`}>
                <div
                  className={`rounded-lg px-4 py-2 ${
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                </div>
                <span className="text-xs text-muted-foreground mt-1">
                  {formatDate(message.created_at, locale, "short")}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-background px-4 py-3">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t("chat.input_placeholder")}
            disabled={isSending || !isConnected}
            maxLength={5000}
          />
          <Button onClick={handleSend} disabled={!inputValue.trim() || isSending || !isConnected}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {realtimeError && (
          <p className="text-xs text-destructive mt-2">
            {t("chat.error")}: {realtimeError.message}
          </p>
        )}
      </div>
    </div>
  );
}

