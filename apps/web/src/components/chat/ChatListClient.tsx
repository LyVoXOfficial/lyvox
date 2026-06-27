"use client";

import Link from "next/link";
import { ArrowRight, MessageSquare, Plus, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/i18n/format";
import { formatDate } from "@/lib/i18n/formatDate";

interface Conversation {
  id: string;
  peer: { id: string; display_name: string | null } | null;
  advert: { id: string; title: string; price: number; currency: string } | null;
  last_message: {
    id: number;
    body: string;
    created_at: string;
    // nullable after GDPR erasure (tombstoned messages have author_id=null)
    author_id: string | null;
  } | null;
  last_message_at: string | null;
  created_at: string;
  last_read_at: string | null;
}

interface ChatListClientProps {
  conversations: Conversation[];
  messages: Record<string, any>;
}

export default function ChatListClient({ conversations }: ChatListClientProps) {
  const { t, locale } = useI18n();
  const translate = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatMessagePreview = (body: string, maxLength = 50) => {
    if (body.length <= maxLength) return body;
    return body.slice(0, maxLength) + "...";
  };

  const hasUnread = (conversation: Conversation) => {
    if (!conversation.last_message) return false;
    if (!conversation.last_read_at) return true;
    return new Date(conversation.last_message.created_at) > new Date(conversation.last_read_at);
  };

  if (conversations.length === 0) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <section
          className="rounded-[var(--r)] border border-border/60 bg-card p-8 shadow-[var(--shC)]"
        >
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--rm)] lyvox-trust-gradient text-white">
              <MessageSquare className="h-7 w-7" aria-hidden="true" />
            </div>
            <Badge variant="secondary" className="mb-3 rounded-full gap-1.5 px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {translate("chat.empty.badge", "Safe conversations")}
            </Badge>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {translate("chat.empty.title", "No conversations yet")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {translate(
                "chat.empty.description",
                "When you message a seller from a listing, the conversation will appear here with the advert context and safety history.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild className="rounded-full lyvox-cta-gradient border-0 text-white hover:opacity-90">
                <Link href="/search">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {translate("chat.empty.find_listing", "Find listings")}
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/post">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {translate("chat.empty.post_listing", "Post advert")}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="secondary" className="mb-3 rounded-full gap-1.5 px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {translate("chat.safety_badge", "In-platform deal record")}
          </Badge>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {translate("chat.title", "Messages")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {translate(
              "chat.subtitle",
              "Keep seller questions, payment decisions, and delivery details inside LyVoX.",
            )}
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/search">
            <Search className="h-4 w-4" aria-hidden="true" />
            {translate("chat.find_listing", "Find listings")}
          </Link>
        </Button>
      </header>

      <div className="space-y-2">
        {conversations.map((conversation) => {
          const unread = hasUnread(conversation);
          const peerName = conversation.peer?.display_name || translate("chat.unknown_user", "LyVoX user");
          const messagePreview = conversation.last_message
            ? formatMessagePreview(conversation.last_message.body)
            : translate("chat.no_messages", "No messages yet");
          const advertPrice =
            conversation.advert?.price !== undefined && conversation.advert?.price !== null
              ? formatCurrency(conversation.advert.price, locale, conversation.advert.currency || "EUR")
              : null;

          return (
            <Link key={conversation.id} href={`/chat/${conversation.id}`} className="block">
              <div
                className={[
                  "flex items-center gap-4 rounded-[var(--rm)] border px-4 py-3.5 transition-colors",
                  "hover:bg-secondary/60",
                  unread
                    ? "border-l-[3px] border-l-primary border-r-border/60 border-t-border/60 border-b-border/60 bg-primary/5"
                    : "border-border/60 bg-card",
                ].join(" ")}
              >
                {/* Avatar tile — trust gradient with white initials */}
                <div
                  className="lyvox-trust-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--rm)] text-sm font-bold text-white"
                  aria-hidden="true"
                >
                  {getInitials(peerName)}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold truncate text-foreground">
                      {peerName}
                    </span>
                    {conversation.last_message_at && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-3 shrink-0">
                        {formatDate(conversation.last_message_at, locale, "relative")}
                      </span>
                    )}
                  </div>
                  {conversation.advert && (
                    <div className="flex min-w-0 items-center gap-2 mb-0.5">
                      <p className="truncate text-xs text-muted-foreground">
                        {conversation.advert.title}
                      </p>
                      {advertPrice ? (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {advertPrice}
                        </span>
                      ) : null}
                    </div>
                  )}
                  <p className={`text-sm truncate ${unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {messagePreview}
                  </p>
                </div>

                {/* Unread dot + arrow */}
                <div className="flex shrink-0 items-center gap-1.5 ml-1">
                  {unread && (
                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  )}
                  <ArrowRight
                    className={`h-4 w-4 ${unread ? "text-primary" : "text-muted-foreground"}`}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
